param([switch]$SkipDelay)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$healthUrl = "http://localhost:3000/health"
$logsDirectory = Join-Path $projectRoot "logs"
$stdoutPath = Join-Path $logsDirectory "site-server.stdout.log"
$stderrPath = Join-Path $logsDirectory "site-server.stderr.log"
$startupLogPath = Join-Path $logsDirectory "site-startup.jsonl"

New-Item -ItemType Directory -Force -Path $logsDirectory | Out-Null

function Write-StartupLog {
  param(
    [string]$Status,
    [string]$Detail,
    [int]$StartedProcessId = 0
  )

  $row = [ordered]@{
    timestamp = (Get-Date).ToUniversalTime().ToString("o")
    status = $Status
    detail = $Detail
    startedProcessId = $StartedProcessId
  }
  Add-Content -LiteralPath $startupLogPath -Value ($row | ConvertTo-Json -Compress) -Encoding UTF8
}

if (-not $SkipDelay) {
  Start-Sleep -Seconds 30
}

try {
  $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 3
  if ($health.ok -eq $true) {
    Write-StartupLog -Status "already-running" -Detail "Health check succeeded; no new server was started."
    exit 0
  }
} catch {
  # Start the site only when the health check is unavailable.
}

try {
  $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
  $process = Start-Process `
    -FilePath $nodePath `
    -ArgumentList "--use-system-ca", "src/server.js" `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru
  Write-StartupLog -Status "started" -Detail "Server process was started." -StartedProcessId $process.Id
} catch {
  Write-StartupLog -Status "failed" -Detail $_.Exception.Message
  throw
}
