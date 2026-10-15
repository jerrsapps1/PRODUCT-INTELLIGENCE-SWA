# Resets a forgotten Product Intelligence SWA password on this computer.
# 1. Makes sure Docker Desktop and the local PostgreSQL container are running.
# 2. Backs up the database to .data\backups\ (projects, sources and records are never changed).
# 3. Runs `npm.cmd run auth:reset-password`, which asks for the account and a new password
#    (typed without being shown) and updates only that account's password.

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envPath = Join-Path $repoRoot ".env"
$containerName = "swa-local-postgres"
$backupRoot = Join-Path $repoRoot ".data\backups"

function Write-Step {
  param([string]$Message)
  Write-Host ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $Message)
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

# Runs a native command quietly and reports success (stderr output never aborts the script).
function Test-Native {
  param([scriptblock]$Command)
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try { & $Command *> $null; return $LASTEXITCODE -eq 0 } catch { return $false } finally { $ErrorActionPreference = $previous }
}

function Test-Docker { return Test-Native { docker info --format "{{.ServerVersion}}" } }

try {
  Set-Location $repoRoot
  if (!(Test-Path $envPath)) { throw "No .env found in $repoRoot. Start SWA Local once first; it creates the account and .env." }
  $envValues = Read-EnvFile $envPath
  if (!$envValues["DATABASE_URL"]) { throw "DATABASE_URL is missing from .env." }
  $uri = [Uri]$envValues["DATABASE_URL"]
  $dbName = $uri.AbsolutePath.TrimStart("/")
  $dbUser = [Uri]::UnescapeDataString($uri.UserInfo.Split(":", 2)[0])
  $isLocal = @("127.0.0.1", "localhost", "::1") -contains $uri.Host

  if ($isLocal) {
    if (!(Get-Command docker -ErrorAction SilentlyContinue)) { throw "Docker is required but was not found on PATH." }
    if (!(Test-Docker)) {
      $dockerDesktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
      if (!(Test-Path $dockerDesktop)) { throw "Docker Desktop is not running. Start it, wait for 'Engine running', then try again." }
      Write-Step "Starting Docker Desktop (this can take a couple of minutes)..."
      Start-Process -FilePath $dockerDesktop | Out-Null
      $deadline = (Get-Date).AddMinutes(4)
      while (!(Test-Docker)) {
        if ((Get-Date) -gt $deadline) { throw "Docker Desktop did not become ready. Open it, wait for 'Engine running', then try again." }
        Start-Sleep -Seconds 3
      }
    }
    $existing = docker ps -a --filter "name=^/$containerName$" --format "{{.Names}}"
    if (!$existing) { throw "The local database container ($containerName) doesn't exist yet. Start SWA Local once first." }
    if (!(Test-Native { docker start $containerName })) { throw "Could not start the local database container ($containerName)." }
    $deadline = (Get-Date).AddSeconds(90)
    while ($true) {
      if (Test-Native { docker exec $containerName pg_isready -U $dbUser -d $dbName }) { break }
      if ((Get-Date) -gt $deadline) { throw "The local database did not become ready." }
      Start-Sleep -Seconds 2
    }

    New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
    $backup = Join-Path $backupRoot ("before-password-reset-{0}.sql" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
    $dumped = Test-Native { cmd /c "docker exec $containerName pg_dump -U $dbUser $dbName > `"$backup`"" }
    if (!$dumped -or !(Test-Path $backup) -or (Get-Item $backup).Length -lt 1000) {
      throw "The database backup failed, so nothing was changed."
    }
    Write-Step "Database backed up to $backup"
  } else {
    Write-Step "DATABASE_URL points to $($uri.Host); back that database up separately before resetting."
  }

  if (!(Test-Path (Join-Path $repoRoot "node_modules"))) { throw "Dependencies aren't installed yet. Start SWA Local once first." }
  Write-Step "Choose the new password. Typed characters are not shown."
  npm.cmd run --silent auth:reset-password
  if ($LASTEXITCODE -ne 0) { throw "The password was not changed." }
} catch {
  Write-Host ""
  Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Read-Host "Press Enter to close"
