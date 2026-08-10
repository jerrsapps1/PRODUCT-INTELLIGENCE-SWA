$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$desktop = [Environment]::GetFolderPath("Desktop")
$shell = New-Object -ComObject WScript.Shell

function New-Shortcut {
  param(
    [string]$Name,
    [string]$ScriptPath,
    [string]$Description
  )
  $shortcutPath = Join-Path $desktop "$Name.lnk"
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
  $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""
  $shortcut.WorkingDirectory = $repoRoot
  $shortcut.Description = $Description
  $shortcut.IconLocation = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe,0"
  $shortcut.Save()
  Write-Host "Created $shortcutPath"
}

New-Shortcut -Name "SWA Local" -ScriptPath (Join-Path $repoRoot "tools\start-swa-local.ps1") -Description "Start Product Intelligence SWA local services and open the app."
New-Shortcut -Name "Stop SWA Local" -ScriptPath (Join-Path $repoRoot "tools\stop-swa-local.ps1") -Description "Stop Product Intelligence SWA local app services started from this repository."
