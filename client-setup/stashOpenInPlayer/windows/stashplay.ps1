# Stash Open In Player - protocol handler
#
# Registered as the handler for stashplay:// URLs. The plugin builds URLs of the
# form:
#
#     stashplay://open/<base64url-of-utf8-path>
#
# base64url rather than percent-encoding because the registry's shell\open\command
# performs %1-style substitution on the command string, which can mangle a
# percent-encoded path (a space becomes %20).
#
# The path arrives exactly as Stash stores it, e.g. /data/Movies/x.mkv. This
# script rewrites the prefix to where the share is on this PC, using
# stashplay.json next to it (written by install.ps1), and converts / to \, then
# opens the file in mpv, reusing the mpv window if one it started is still open.
#
# This runs with no visible window, so every step is logged. If something does
# not work, read the log first:  %TEMP%\stashplay.log

param([string]$Url)

$LogFile = Join-Path $env:TEMP 'stashplay.log'
$ConfigFile = Join-Path $PSScriptRoot 'stashplay.json'
$MpvExe = 'C:\Program Files\MPV Player\mpv.exe'
$MpvPipe = 'mpv-stashplay'

function Write-Log([string]$Message) {
    Add-Content -Path $LogFile -Value "$(Get-Date -Format s) $Message"
}

# Matches on whole path segments, so /data/ maps /data/x but not /database/x,
# and a trailing separator on either prefix doesn't matter.
function Convert-StashPath([string]$Path, [string]$From, [string]$To) {
    $From = $From.TrimEnd('/')
    $To = $To.TrimEnd('/', '\')
    if ($Path -eq $From -or $Path.StartsWith("$From/", [StringComparison]::Ordinal)) {
        $Path = $To + $Path.Substring($From.Length)
    } else {
        Write-Log "WARNING: path does not start with '$From/', so the prefix was left unchanged"
    }
    $Path.Replace('/', '\')
}

# Logged unconditionally: if this line is absent from the log, the script was
# never started and the fault is in the registry command (usually a wrong path
# to this file), not in anything below.
Write-Log "--- invoked with: $Url"

try {
    if ([string]::IsNullOrWhiteSpace($Url)) {
        Write-Log "ERROR: no URL was passed. Check that the registry command ends with \`"%1\`""
        exit 1
    }

    # Strip the scheme and the /open/ path segment, leaving the payload. Some
    # browsers append a trailing slash.
    $b64 = $Url -replace '^[A-Za-z0-9+.\-]+:/*open/?', '' -replace '/+$', ''
    $b64 = $b64.Replace('-', '+').Replace('_', '/')
    switch ($b64.Length % 4) {
        2 { $b64 += '==' }
        3 { $b64 += '=' }
    }

    $stashPath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b64))
    Write-Log "decoded path: $stashPath"

    if (-not (Test-Path -LiteralPath $ConfigFile)) {
        Write-Log "ERROR: $ConfigFile not found. Run install.ps1 with -PathTo."
        exit 1
    }
    $config = [System.IO.File]::ReadAllText($ConfigFile) | ConvertFrom-Json
    $path = Convert-StashPath $stashPath $config.pathFrom $config.pathTo
    Write-Log "mapped path: $path"

    if (-not (Test-Path -LiteralPath $path)) {
        Write-Log "ERROR: path does not exist on this PC. Check pathFrom/pathTo in $ConfigFile, or run install.ps1 again."
        exit 1
    }

    # An mpv this script started listens on $MpvPipe, so a running one is
    # handed the file instead of a second window opening. Connect waits for the
    # pipe to appear rather than failing at once, hence the short timeout: it
    # is the delay before a fresh mpv starts.
    $pipe = New-Object System.IO.Pipes.NamedPipeClientStream('.', $MpvPipe, [System.IO.Pipes.PipeDirection]::Out)
    try {
        $pipe.Connect(300)
    } catch [TimeoutException] {
        $pipe.Dispose()
        $pipe = $null
    }

    if ($pipe) {
        try {
            # mpv's JSON IPC: one command per line, UTF-8.
            $json = ConvertTo-Json -InputObject @{ command = @('loadfile', $path, 'replace') } -Compress
            $writer = New-Object System.IO.StreamWriter($pipe, (New-Object System.Text.UTF8Encoding($false)))
            $writer.Write("$json`n")
            $writer.Flush()
        } finally {
            $pipe.Dispose()
        }
        Write-Log "sent to running mpv OK"
    } else {
        if (-not (Test-Path -LiteralPath $MpvExe -PathType Leaf)) {
            Write-Log "ERROR: mpv not found at $MpvExe. Fix `$MpvExe at the top of this script."
            exit 1
        }
        # mpv.exe, not mpv.com, which is the console build and would open a
        # terminal window. Start-Process doesn't quote arguments, so the path is
        # quoted here. pseudo-gui is what mpv's own shortcut uses: a window even
        # for audio-only files, and no terminal output.
        Start-Process -FilePath $MpvExe -ArgumentList "`"$path`"", '--player-operation-mode=pseudo-gui', "--input-ipc-server=\\.\pipe\$MpvPipe"
        Write-Log "launched mpv OK"
    }
} catch {
    Write-Log "ERROR: $($_.Exception.Message)"
    exit 1
}
