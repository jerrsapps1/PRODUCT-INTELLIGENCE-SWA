param(
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimeRoot = Join-Path $repoRoot ".data\local-runtime"
$logRoot = Join-Path $runtimeRoot "logs"
$statePath = Join-Path $runtimeRoot "swa-local-state.json"
$envPath = Join-Path $repoRoot ".env"
$frontendUrl = "http://127.0.0.1:5173/"
$apiHealthUrl = "http://127.0.0.1:4174/api/health"
$containerName = "swa-local-postgres"

New-Item -ItemType Directory -Force -Path $runtimeRoot, $logRoot | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$launcherLog = Join-Path $logRoot "launcher-$timestamp.log"
$stdoutLog = Join-Path $logRoot "npm-dev-$timestamp.out.log"
$stderrLog = Join-Path $logRoot "npm-dev-$timestamp.err.log"

function Write-Log {
  param([string]$Message)
  $line = "[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $Message
  Write-Host $line
  Add-Content -Path $launcherLog -Value $line
}

function New-Secret {
  return ([Convert]::ToBase64String([Guid]::NewGuid().ToByteArray()) + [Convert]::ToBase64String([Guid]::NewGuid().ToByteArray())).Replace("+", "A").Replace("/", "B").Replace("=", "")
}

function Read-EnvFile {
  param([string]$Path)
  $values = @{}
  if (!(Test-Path $Path)) { return $values }
  foreach ($line in Get-Content $Path) {
    $trimmed = $line.Trim()
    if (!$trimmed -or $trimmed.StartsWith("#") -or !$trimmed.Contains("=")) { continue }
    $parts = $trimmed.Split("=", 2)
    $key = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"').Trim("'")
    if ($key) { $values[$key] = $value }
  }
  return $values
}

function Write-DefaultEnv {
  $dbPassword = New-Secret
  $bootstrapPassword = New-Secret
  $sessionSecret = New-Secret
  $content = @(
    "DATABASE_URL=postgres://project_intelligence:$dbPassword@127.0.0.1:55432/project_intelligence",
    "BOOTSTRAP_EMAIL=owner@example.com",
    "BOOTSTRAP_PASSWORD=$bootstrapPassword",
    "BOOTSTRAP_DISPLAY_NAME=Safety Professional",
    "SESSION_SECRET=$sessionSecret",
    "LOCAL_STORAGE_DIR=.data/source-objects",
    "PORT=4174"
  )
  Set-Content -Path $envPath -Value $content -Encoding UTF8
  Write-Log "Created local .env with generated private development credentials. Bootstrap email is owner@example.com; password remains only in .env."
}

function Test-HttpReady {
  param([string]$Url)
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
  } catch {
    return $false
  }
}

function Wait-HttpReady {
  param([string]$Url, [string]$Name, [int]$TimeoutSeconds = 90)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-HttpReady $Url) {
      Write-Log "$Name is ready at $Url"
      return
    }
    Start-Sleep -Seconds 2
  }
  throw "$Name did not become ready at $Url within $TimeoutSeconds seconds."
}

function Get-PortOwner {
  param([int]$Port)
  return Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq "Listen" } |
    Select-Object -First 1
}

function Stop-ProcessTree {
  param([int]$ProcessId)
  $children = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $ProcessId }
  foreach ($child in $children) {
    Stop-ProcessTree -ProcessId ([int]$child.ProcessId)
  }
  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

function Assert-Tool {
  param([string]$Name)
  if (!(Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required but was not found on PATH."
  }
}

function Wait-Docker {
  param([int]$TimeoutSeconds = 120)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      docker info --format "{{.ServerVersion}}" *> $null
      return $true
    } catch {
      Start-Sleep -Seconds 3
    }
  }
  return $false
}

function Ensure-LocalPostgres {
  param([string]$DatabaseUrl)
  $uri = [Uri]$DatabaseUrl
  if ($uri.Host -notin @("127.0.0.1", "localhost")) {
    Write-Log "DATABASE_URL points to $($uri.Host); assuming external PostgreSQL is managed separately."
    return
  }

  Assert-Tool "docker"
  if (!(Wait-Docker -TimeoutSeconds 5)) {
    $dockerDesktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerDesktop) {
      Write-Log "Docker daemon is not running; starting Docker Desktop."
      Start-Process -FilePath $dockerDesktop | Out-Null
    }
    if (!(Wait-Docker -TimeoutSeconds 120)) {
      throw "Docker Desktop did not become ready. Start Docker Desktop manually or provide DATABASE_URL for an existing PostgreSQL database."
    }
  }

  $dbPort = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
  $dbName = $uri.AbsolutePath.TrimStart("/")
  $dbUser = [Uri]::UnescapeDataString($uri.UserInfo.Split(":", 2)[0])
  $dbPassword = if ($uri.UserInfo.Contains(":")) { [Uri]::UnescapeDataString($uri.UserInfo.Split(":", 2)[1]) } else { "" }
  $existing = docker ps -a --filter "name=^/$containerName$" --format "{{.Names}}"
  if (!$existing) {
    Write-Log "Creating dedicated local PostgreSQL container $containerName on port $dbPort."
    docker run --name $containerName -e POSTGRES_USER=$dbUser -e POSTGRES_PASSWORD=$dbPassword -e POSTGRES_DB=$dbName -p "${dbPort}:5432" -d postgres:16-alpine | Out-Null
  } else {
    $running = docker ps --filter "name=^/$containerName$" --filter "status=running" --format "{{.Names}}"
    if (!$running) {
      Write-Log "Starting existing local PostgreSQL container $containerName."
      docker start $containerName | Out-Null
    }
  }

  $deadline = (Get-Date).AddSeconds(90)
  while ((Get-Date) -lt $deadline) {
    docker exec $containerName pg_isready -U $dbUser -d $dbName *> $null
    if ($LASTEXITCODE -eq 0) {
      Write-Log "PostgreSQL container is ready."
      return
    }
    Start-Sleep -Seconds 2
  }
  throw "PostgreSQL container did not become ready."
}

try {
  Set-Location $repoRoot
  Write-Log "Starting SWA local launcher from $repoRoot"

  Assert-Tool "node"
  Assert-Tool "npm.cmd"

  if (!(Test-Path $envPath)) {
    Write-DefaultEnv
  }

  $envValues = Read-EnvFile $envPath
  foreach ($key in $envValues.Keys) {
    if ([Environment]::GetEnvironmentVariable($key, "Process") -eq $null) {
      [Environment]::SetEnvironmentVariable($key, [string]$envValues[$key], "Process")
    }
  }

  foreach ($required in @("DATABASE_URL", "BOOTSTRAP_EMAIL", "BOOTSTRAP_PASSWORD", "SESSION_SECRET")) {
    if (![Environment]::GetEnvironmentVariable($required, "Process")) {
      throw "$required is required in .env or the process environment."
    }
  }

  if (!(Test-Path (Join-Path $repoRoot "node_modules"))) {
    Write-Log "node_modules not found; installing dependencies with npm ci."
    npm.cmd ci 2>&1 | Tee-Object -FilePath (Join-Path $logRoot "npm-ci-$timestamp.log")
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed. See logs under $logRoot." }
  }

  if ((Test-HttpReady $apiHealthUrl) -and (Test-HttpReady $frontendUrl)) {
    Write-Log "SWA is already running; opening the existing app."
    if (!$NoBrowser) { Start-Process $frontendUrl }
    return
  }

  foreach ($port in @(4174, 5173)) {
    $owner = Get-PortOwner -Port $port
    if ($owner) {
      throw "Port $port is already in use by process $($owner.OwningProcess), but SWA health checks are not ready. Stop that process or change the port."
    }
  }

  Ensure-LocalPostgres -DatabaseUrl ([Environment]::GetEnvironmentVariable("DATABASE_URL", "Process"))

  Write-Log "Starting existing npm development script: npm.cmd run dev"
  $npm = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev") -WorkingDirectory $repoRoot -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru
  $state = @{
    startedAt = (Get-Date).ToString("o")
    repoRoot = $repoRoot
    npmPid = $npm.Id
    frontendUrl = $frontendUrl
    apiHealthUrl = $apiHealthUrl
    stdoutLog = $stdoutLog
    stderrLog = $stderrLog
  }
  $state | ConvertTo-Json | Set-Content -Path $statePath -Encoding UTF8

  try {
    Wait-HttpReady -Url $apiHealthUrl -Name "API"
    Wait-HttpReady -Url $frontendUrl -Name "Frontend"
    if (!$NoBrowser) {
      Write-Log "Opening SWA in the default browser."
      Start-Process $frontendUrl
    }
    Write-Log "SWA Local Server is running. Close this window or run tools\stop-swa-local.ps1 to stop app services. Logs: $logRoot"
    Wait-Process -Id $npm.Id
  } finally {
    if (!$npm.HasExited) {
      Write-Log "Stopping SWA npm process tree."
      Stop-ProcessTree -ProcessId $npm.Id
    }
  }
} catch {
  Write-Log "ERROR: $($_.Exception.Message)"
  Write-Log "Logs are in $logRoot"
  throw
}
