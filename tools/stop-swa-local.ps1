$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimeRoot = Join-Path $repoRoot ".data\local-runtime"
$statePath = Join-Path $runtimeRoot "swa-local-state.json"
$ports = @(4174, 5173)

function Stop-ProcessTree {
  param([int]$ProcessId)
  $children = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $ProcessId }
  foreach ($child in $children) {
    Stop-ProcessTree -ProcessId ([int]$child.ProcessId)
  }
  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

function Stop-IfSwaProcess {
  param([int]$ProcessId)
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
  if (!$process) { return }
  $commandLine = [string]$process.CommandLine
  if ($commandLine -like "*PRODUCT-INTELLIGENCE-SWA*" -or $commandLine -like "*product-intelligence-swa*") {
    Write-Host "Stopping SWA process tree rooted at PID $ProcessId"
    Stop-ProcessTree -ProcessId $ProcessId
  }
}

if (Test-Path $statePath) {
  $state = Get-Content $statePath -Raw | ConvertFrom-Json
  if ($state.npmPid) {
    Stop-IfSwaProcess -ProcessId ([int]$state.npmPid)
  }
}

foreach ($port in $ports) {
  $owners = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq "Listen" } |
    Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($owner in $owners) {
    Stop-IfSwaProcess -ProcessId ([int]$owner)
  }
}

if (Test-Path $statePath) {
  Remove-Item -LiteralPath $statePath -Force
}

Write-Host "SWA local app services stopped where matching repo-owned processes were found. The local PostgreSQL container is left running to preserve local data."
