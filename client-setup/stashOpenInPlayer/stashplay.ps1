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
# This runs with no visible window, so every step is logged. If something does
# not work, read the log first:  %TEMP%\stashplay.log

param([string]$Url)

$LogFile = Join-Path $env:TEMP 'stashplay.log'

function Write-Log([string]$Message) {
    Add-Content -Path $LogFile -Value "$(Get-Date -Format s) $Message"
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

    $path = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b64))
    Write-Log "decoded path: $path"

    if (-not (Test-Path -LiteralPath $path)) {
        Write-Log "ERROR: path does not exist on this PC. Check the pathFrom/pathTo settings in Stash."
        exit 1
    }

    # No -FilePath player here: this uses the Windows shell association for the
    # file's extension, i.e. whatever the default player is. To pin a specific
    # player instead, replace this line with e.g.
    #   Start-Process 'C:\Program Files\mpv\mpv.exe' -ArgumentList $path
    Start-Process -FilePath $path
    Write-Log "launched OK"
} catch {
    Write-Log "ERROR: $($_.Exception.Message)"
    exit 1
}
