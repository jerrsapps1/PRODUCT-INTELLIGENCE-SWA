# Creates the Product Intelligence SWA shortcuts on the desktop AND in the Start menu
# (Start > "Product Intelligence SWA", or type "SWA" in Windows search). Per-user; no admin rights needed.
# Safe to run again any time (e.g. after `git pull`): existing shortcuts are updated in place.
param(
  [switch]$NoPause
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$shell = New-Object -ComObject WScript.Shell
$powershellExe = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"

$shortcuts = @(
  @{ Name = "SWA Local"; Script = "start-swa-local.ps1"; Description = "Start Product Intelligence SWA local services and open the app." },
  @{ Name = "Stop SWA Local"; Script = "stop-swa-local.ps1"; Description = "Stop Product Intelligence SWA local app services started from this repository." },
  @{ Name = "SWA Accounts"; Script = "swa-accounts.ps1"; Description = "List or create Product Intelligence SWA accounts, reset a password, or hash the .env password (backs up the database first)." },
  @{ Name = "Reset SWA Password"; Script = "reset-swa-password.ps1"; Description = "Reset a forgotten Product Intelligence SWA password on this computer (backs up the database first)." },
  @{ Name = "Lock SWA"; Script = "lock-swa.ps1"; Description = "Lock sign-in to Product Intelligence SWA: signs everyone out and refuses sign-in until unlocked." },
  @{ Name = "Unlock SWA"; Script = "unlock-swa.ps1"; Description = "Allow sign-in to Product Intelligence SWA again after Lock SWA." }
)

$locations = @(
  @{ Label = "Desktop"; Folder = [Environment]::GetFolderPath("Desktop") },
  @{ Label = "Start menu"; Folder = Join-Path ([Environment]::GetFolderPath("Programs")) "Product Intelligence SWA" }
)

function New-Shortcut {
  param([string]$Folder, [hashtable]$Item)
  $scriptPath = Join-Path $repoRoot "tools\$($Item.Script)"
  if (!(Test-Path $scriptPath)) { throw "Missing $scriptPath (run git pull first)." }
  $shortcutPath = Join-Path $Folder "$($Item.Name).lnk"
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $powershellExe
  $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
  $shortcut.WorkingDirectory = $repoRoot
  $shortcut.Description = $Item.Description
  $shortcut.IconLocation = "$powershellExe,0"
  $shortcut.Save()
  if (!(Test-Path $shortcutPath)) { throw "Windows did not save $shortcutPath." }
  return $shortcutPath
}

$failures = 0
foreach ($location in $locations) {
  Write-Host ""
  Write-Host "$($location.Label): $($location.Folder)"
  try {
    New-Item -ItemType Directory -Force -Path $location.Folder | Out-Null
  } catch {
    Write-Host "  Could not open this folder: $($_.Exception.Message)" -ForegroundColor Red
    $failures += $shortcuts.Count
    continue
  }
  foreach ($item in $shortcuts) {
    try {
      $path = New-Shortcut -Folder $location.Folder -Item $item
      Write-Host "  Created $(Split-Path $path -Leaf)"
    } catch {
      Write-Host "  Could not create $($item.Name): $($_.Exception.Message)" -ForegroundColor Red
      $failures++
    }
  }
}

Write-Host ""
if ($failures -eq 0) {
  Write-Host "Done. Find the shortcuts on the desktop, or in Start > Product Intelligence SWA (or type ""SWA"" in Windows search)." -ForegroundColor Green
} else {
  Write-Host "$failures shortcut(s) could not be created; see the red lines above." -ForegroundColor Yellow
}
if (!$NoPause) { Read-Host "Press Enter to close" | Out-Null }
