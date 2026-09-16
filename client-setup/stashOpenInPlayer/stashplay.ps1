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

param([string]$Url)

$LogFile = Join-Path $env:TEMP 'stashplay.log'

function Write-Log([string]$Message) {
    Add-Content -Path $LogFile -Value "$(Get-Date -Format s) $Message"
}

try {
    # Strip the scheme and the /open/ path segment, leaving the payload. Some
    # browsers append a trailing slash.
    $b64 = $Url -replace '^[A-Za-z0-9+.\-]+:/*open/?', '' -replace '/+$', ''
    $b64 = $b64.Replace('-', '+').Replace('_', '/')
    switch ($b64.Length % 4) {
        2 { $b64 += '==' }
        3 { $b64 += '=' }
    }

    $path = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b64))

    if (Test-Path -LiteralPath $path) {
        # No -FilePath player here: this uses the Windows shell association for
        # the file's extension, i.e. whatever the default player is. To pin a
        # specific player instead, replace this line with e.g.
        #   Start-Process 'C:\Program Files\mpv\mpv.exe' -ArgumentList $path
        Start-Process -FilePath $path
    } else {
        Write-Log "NOT FOUND: $path (url: $Url)"
    }
} catch {
    Write-Log "ERROR: $($_.Exception.Message) (url: $Url)"
}
