using System;
using System.Diagnostics;
using System.IO;

internal static class StartSiteSilent
{
    [STAThread]
    private static int Main()
    {
        string scripts = AppDomain.CurrentDomain.BaseDirectory;
        string logs = Path.GetFullPath(Path.Combine(scripts, "..", "logs"));
        try
        {
            var start = new ProcessStartInfo
            {
                FileName = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "WindowsPowerShell", "v1.0", "powershell.exe"),
                Arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"" + Path.Combine(scripts, "start-site-hidden.ps1") + "\" -SkipDelay",
                WorkingDirectory = Path.GetFullPath(Path.Combine(scripts, "..")),
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using (var process = Process.Start(start))
            {
                process.WaitForExit();
                return process.ExitCode;
            }
        }
        catch (Exception error)
        {
            try
            {
                Directory.CreateDirectory(logs);
                File.AppendAllText(Path.Combine(logs, "site-launcher-errors.log"), DateTime.UtcNow.ToString("o") + " " + error + Environment.NewLine);
            }
            catch { }
            return 1;
        }
    }
}
