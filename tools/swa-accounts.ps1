param(
  [ValidateSet("", "list", "create", "reset", "secure-env")]
  [string]$Action = ""
)

# Product Intelligence SWA accounts, on this computer only:
#   list        show accounts
#   create      create an account (its own empty workspace)
#   reset       reset a forgotten password (signs that account out everywhere)
#   secure-env  replace the plain-text BOOTSTRAP_PASSWORD in .env with BOOTSTRAP_PASSWORD_HASH
# Before creating an account or resetting a password, Docker Desktop and the local database are
# started if needed and the database is backed up to .data\backups\. Passwords are typed
# without being shown and stored only as hashes.

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

function Start-LocalDatabase {
  param([hashtable]$EnvValues, [switch]$Backup)
  if (!$EnvValues["DATABASE_URL"]) { throw "DATABASE_URL is missing from .env." }
  $uri = [Uri]$EnvValues["DATABASE_URL"]
  $dbName = $uri.AbsolutePath.TrimStart("/")
  $dbUser = [Uri]::UnescapeDataString($uri.UserInfo.Split(":", 2)[0])
  if (@("127.0.0.1", "localhost", "::1") -notcontains $uri.Host) {
    if ($Backup) { Write-Step "DATABASE_URL points to $($uri.Host); back that database up separately." }
    return
  }
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
  if ($Backup) {
    New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
    $file = Join-Path $backupRoot ("before-account-change-{0}.sql" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
    $dumped = Test-Native { cmd /c "docker exec $containerName pg_dump -U $dbUser $dbName > `"$file`"" }
    if (!$dumped -or !(Test-Path $file) -or (Get-Item $file).Length -lt 1000) { throw "The database backup failed, so nothing was changed." }
    Write-Step "Database backed up to $file"
  }
}

function Invoke-AccountCommand {
  param([string]$Name)
  $envValues = Read-EnvFile $envPath
  if ($Name -ne "secure-env") { Start-LocalDatabase -EnvValues $envValues -Backup:($Name -ne "list") }
  $script = @{ list = "auth:accounts"; create = "auth:create-account"; reset = "auth:reset-password"; "secure-env" = "auth:secure-env" }[$Name]
  npm.cmd run --silent $script
  if ($LASTEXITCODE -ne 0) { throw "Nothing was changed." }
}

try {
  Set-Location $repoRoot
  if (!(Test-Path $envPath)) { throw "No .env found in $repoRoot. Start SWA Local once first; it creates .env and the first account." }
  if (!(Test-Path (Join-Path $repoRoot "node_modules"))) { throw "Dependencies aren't installed yet. Start SWA Local once first." }
  if ($Action) {
    Invoke-AccountCommand $Action
  } else {
    while ($true) {
      Write-Host ""
      Write-Host "SWA accounts"
      Write-Host "  1  List accounts"
      Write-Host "  2  Create an account"
      Write-Host "  3  Reset a password"
      Write-Host "  4  Hash the password stored in .env"
      Write-Host "  Q  Quit"
      $choice = (Read-Host "Choose").Trim().ToLower()
      if ($choice -eq "q" -or $choice -eq "") { break }
      $name = @{ "1" = "list"; "2" = "create"; "3" = "reset"; "4" = "secure-env" }[$choice]
      if (!$name) { Write-Host "Choose 1-4 or Q."; continue }
      try { Invoke-AccountCommand $name } catch { Write-Host $_.Exception.Message -ForegroundColor Red }
    }
    exit 0
  }
} catch {
  Write-Host ""
  Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Read-Host "Press Enter to close"
