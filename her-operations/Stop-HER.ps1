$ErrorActionPreference = 'Stop'
$herPidFile = Join-Path $PSScriptRoot 'processes.pid'
if (-not (Test-Path -LiteralPath $herPidFile)) { Write-Output 'No saved HER processes.'; exit }
$herProcesses = @(Get-Content -LiteralPath $herPidFile -Raw | ConvertFrom-Json)
foreach ($herSaved in $herProcesses) {
  $herProcess = Get-Process -Id $herSaved.id -ErrorAction SilentlyContinue
  if ($herProcess -and $herProcess.StartTime.ToUniversalTime().Ticks -eq ([datetime]$herSaved.started).ToUniversalTime().Ticks) {
    $herCommand = (Get-CimInstance Win32_Process -Filter "ProcessId=$($herSaved.id)").CommandLine
    if ($herCommand -match 'pump-reader.mjs|chat-relay.mjs|cloudflared.exe.*127.0.0.1:4501') { Stop-Process -Id $herSaved.id; Write-Output "Stopped HER process $($herSaved.id)." }
  }
}
