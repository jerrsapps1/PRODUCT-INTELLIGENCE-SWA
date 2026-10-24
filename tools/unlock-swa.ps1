# Unlocks sign-in to Product Intelligence SWA after Lock SWA. Accounts sign in again with their
# passwords (existing sessions were ended by the lock).
# Works whether or not SWA Local is running. Same as `npm.cmd run access:unlock`.
$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
try {
  Set-Location $repoRoot
  if (!(Test-Path (Join-Path $repoRoot "node_modules"))) { throw "Dependencies aren't installed yet. Start SWA Local once first." }
  npm.cmd run --silent access:unlock
  if ($LASTEXITCODE -ne 0) { throw "Nothing was changed." }
} catch {
  Write-Host ""
  Write-Host $_.Exception.Message -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to close"
