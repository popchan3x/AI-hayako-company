param([switch]$SkipDelay)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$healthUrl = "http://localhost:3000/health"
$logsDirectory = Join-Path $projectRoot "logs"
$stdoutPath = Join-Path $logsDirectory "site-server.stdout.log"
$stderrPath = Join-Path $logsDirectory "site-server.stderr.log"

if (-not $SkipDelay) {
  Start-Sleep -Seconds 30
}

try {
  $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 3
  if ($health.ok -eq $true) {
    exit 0
  }
} catch {
  # Start the site only when the health check is unavailable.
}

New-Item -ItemType Directory -Force -Path $logsDirectory | Out-Null
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source

Start-Process `
  -FilePath $nodePath `
  -ArgumentList "--use-system-ca", "src/server.js" `
  -WorkingDirectory $projectRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdoutPath `
  -RedirectStandardError $stderrPath
