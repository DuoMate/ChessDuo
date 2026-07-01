# Keep Codespace Session Alive
# Writes a timestamp to a file every 4 minutes to prevent idle timeout.
# Run: pwsh .github/keep-alive.ps1

$keepFile = ".github/.keepalive"
$logFile = ".github/keepalive.log"
$intervalSeconds = 240

function Write-Message {
    param($msg)
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Write-Host $line
    Add-Content -Path $logFile -Value $line
}

Write-Message "Keep-alive started. Logs: $logFile | Interval: ${intervalSeconds}s"
Write-Message "Press Ctrl+C to stop."

while ($true) {
    $time = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "[$time] alive" | Out-File -FilePath $keepFile -Encoding utf8
    Write-Message "ping"
    Start-Sleep -Seconds $intervalSeconds
}

