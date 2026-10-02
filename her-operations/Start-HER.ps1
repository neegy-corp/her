param([Parameter(Mandatory=$true)][ValidatePattern('^[1-9A-HJ-NP-Za-km-z]{32,44}$')][string]$Mint,[switch]$Tunnel)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (Get-NetTCPConnection -LocalPort 4501 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 4501 is already in use. Stop the existing relay first.' }
$herEnv = Join-Path $PSScriptRoot '.env'
if (Test-Path -LiteralPath $herEnv) {
  $herTokenLine = Get-Content -LiteralPath $herEnv | Where-Object { $_ -match '^HER_RELAY_TOKEN=' } | Select-Object -First 1
  $herRelayToken = $herTokenLine -replace '^HER_RELAY_TOKEN=', ''
}
if (-not $herRelayToken) { $herRelayToken = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)) }
[IO.File]::WriteAllText($herEnv, "HER_RELAY_TOKEN=$herRelayToken`nHER_RELAY_MINT=$Mint`n", [Text.UTF8Encoding]::new($false))
$herNode = (Get-Command node).Source
$herStarted = @()
try {
  $herRelay = Start-Process $herNode -ArgumentList @('--env-file=.env','../her/scripts/chat-relay.mjs') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput 'relay.log' -RedirectStandardError 'relay-error.log' -PassThru
  $herStarted += $herRelay
  Start-Sleep -Milliseconds 500
  if ($herRelay.HasExited) { throw 'Relay failed; see relay-error.log.' }
  $herReader = Start-Process $herNode -ArgumentList @('--env-file=.env','pump-reader.mjs') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput 'reader.log' -RedirectStandardError 'reader-error.log' -PassThru
  $herStarted += $herReader
  if ($Tunnel) {
    if (-not (Test-Path -LiteralPath 'bin/cloudflared.exe')) { throw 'Cloudflared is not installed in bin.' }
    $herProxy = Start-Process (Join-Path $PSScriptRoot 'bin/cloudflared.exe') -ArgumentList @('tunnel','--url','http://127.0.0.1:4501','--no-autoupdate') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput 'tunnel.log' -RedirectStandardError 'tunnel-error.log' -PassThru
    $herStarted += $herProxy
  }
  @($herStarted | ForEach-Object { @{ id=$_.Id; started=$_.StartTime.ToUniversalTime().ToString('o') } }) | ConvertTo-Json | Set-Content 'processes.pid'
  Write-Output 'HER reader and authenticated relay started. Logs: reader.log and relay.log.'
  if ($Tunnel) { Write-Output 'Temporary HTTPS address will appear in tunnel-error.log. It changes on restart. Never use it as an unattended production dependency.' }
  Write-Output 'No coin was created and no broadcast or paid video session was started.'
} catch {
  foreach ($herProcess in $herStarted) { if (-not $herProcess.HasExited) { Stop-Process -Id $herProcess.Id } }
  throw
}
