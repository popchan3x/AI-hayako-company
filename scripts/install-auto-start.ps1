param(
  [string]$TaskName = "Hayako Market AI - Start Site at Logon"
)

$ErrorActionPreference = "Stop"

# A Windows application launcher prevents Terminal console delegation entirely.
$launcherPath = Join-Path $PSScriptRoot "StartSiteSilent.exe"
$launcherSource = Join-Path $PSScriptRoot "StartSiteSilent.cs"
$compiler = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
& $compiler /nologo /target:winexe /optimize+ "/out:$launcherPath" $launcherSource
if ($LASTEXITCODE -ne 0) { throw "Failed to compile the silent site launcher." }
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute $launcherPath -WorkingDirectory (Split-Path -Parent $PSScriptRoot)
$triggers = @(
  New-ScheduledTaskTrigger -AtLogOn -User $currentUser
  New-ScheduledTaskTrigger -Daily -At "09:00"
)
$principal = New-ScheduledTaskPrincipal `
  -UserId $currentUser `
  -LogonType Interactive `
  -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -WakeToRun `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $triggers `
  -Principal $principal `
  -Settings $settings `
  -Description "Starts Hayako Market AI at Windows logon and daily at 09:00." `
  -Force | Out-Null

$task = Get-ScheduledTask -TaskName $TaskName
$info = Get-ScheduledTaskInfo -TaskName $TaskName
[pscustomobject]@{
  TaskName = $task.TaskName
  State = $task.State
  LastRunTime = $info.LastRunTime
  LastTaskResult = $info.LastTaskResult
  NextRunTime = $info.NextRunTime
  MissedRuns = $info.NumberOfMissedRuns
  TriggerCount = @($task.Triggers).Count
  WakeToRun = $task.Settings.WakeToRun
  User = $currentUser
}
