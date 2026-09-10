param(
  [string]$TaskName = "Hayako Market AI - Start Site at Logon"
)

$ErrorActionPreference = "Stop"

$launcherPath = Join-Path $PSScriptRoot "start-site-hidden.ps1"
$powershellPath = Join-Path $PSHOME "powershell.exe"
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

$arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcherPath`" -SkipDelay"
$action = New-ScheduledTaskAction -Execute $powershellPath -Argument $arguments
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
  TriggerCount = @($task.Triggers).Count
  User = $currentUser
}
