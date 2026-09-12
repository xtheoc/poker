$ErrorActionPreference = "Stop"

$project = Split-Path -Parent $PSScriptRoot
$watcher = Join-Path $PSScriptRoot "hand-history-watcher.mjs"
$node = (Get-Command node).Source
$defaultFolder = Join-Path $env:LOCALAPPDATA "PokerStars\HandHistory"

Write-Host "Poker Study automatic hand importer"
$folder = Read-Host "Hand-history folder (Enter for $defaultFolder)"
if ([string]::IsNullOrWhiteSpace($folder)) { $folder = $defaultFolder }
if (-not (Test-Path -LiteralPath $folder -PathType Container)) {
  throw "That folder does not exist: $folder"
}

$code = Read-Host "Connection code (shown once in Poker Study)"
if (-not $code.StartsWith("poker_watch_")) { throw "That is not a Poker Study connection code." }
$encoded = $code.Substring("poker_watch_".Length).Replace("-", "+").Replace("_", "/")
switch ($encoded.Length % 4) {
  2 { $encoded += "==" }
  3 { $encoded += "=" }
}
try {
  $connection = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($encoded)) | ConvertFrom-Json
} catch {
  throw "That connection code could not be read. Create a new one in Poker Study."
}
if (-not $connection.endpoint -or -not $connection.supabaseUrl -or -not $connection.anonKey -or -not $connection.refreshToken) {
  throw "That connection code is incomplete. Create a new one in Poker Study."
}

$configFolder = Join-Path $env:APPDATA "Poker Study"
New-Item -ItemType Directory -Force -Path $configFolder | Out-Null
$configPath = Join-Path $configFolder "hand-history-watcher.json"
@{
  folder = (Resolve-Path -LiteralPath $folder).Path
  endpoint = $connection.endpoint
  supabaseUrl = $connection.supabaseUrl
  anonKey = $connection.anonKey
  refreshToken = $connection.refreshToken
} | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding utf8

$action = New-ScheduledTaskAction -Execute $node -Argument "`"$watcher`" --config `"$configPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "Poker Study Hand Import" -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Start-Process -FilePath $node -ArgumentList @($watcher, "--config", $configPath) -WindowStyle Hidden

Write-Host "Ready. Poker Study will import completed hand histories after PokerStars closes."
