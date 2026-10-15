# Resets a forgotten Product Intelligence SWA password on this computer.
# Starts Docker and the local database if needed, backs the database up to .data\backups\,
# then asks for the account and a new password (typed without being shown).
# Same as choosing "Reset a password" in tools\swa-accounts.ps1.
& (Join-Path $PSScriptRoot "swa-accounts.ps1") -Action reset
