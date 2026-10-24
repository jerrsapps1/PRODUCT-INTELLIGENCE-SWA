# Locks sign-in to Product Intelligence SWA: everyone is signed out and no one can sign in
# until Unlock SWA is run. The app keeps running and no data is changed.
# Works whether or not SWA Local is running. Same as `npm.cmd run access:lock`.
$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
try {
  Set-Location $repoRoot
  if (!(Test-Path (Join-Path $repoRoot "node_modules"))) { throw "Dependencies aren't installed yet. Start SWA Local once first." }
  npm.cmd run --silent access:lock
  if ($LASTEXITCODE -ne 0) { throw "Nothing was changed." }
} catch {
  Write-Host ""
  Write-Host $_.Exception.Message -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to close"
