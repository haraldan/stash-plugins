<#
.SYNOPSIS
Registers stashplay.ps1 as the handler for stashplay:// links.

.DESCRIPTION
Writes the URL scheme registration under HKEY_CURRENT_USER, so no administrator
rights are needed. Run it again after moving stashplay.ps1; it overwrites the
previous registration.

It also sets the browser's AutoLaunchProtocolsFromOrigins policy for the
-StashUrl addresses, so links from Stash open without a confirmation prompt.
Chromium-based browsers only offer "Always allow" on HTTPS or localhost, so
over plain http:// this is the only way to stop them asking on every click.
Rules the policy already holds for other schemes are kept.

.PARAMETER Path
Path to stashplay.ps1, relative or absolute. It is stored as an absolute path.

.PARAMETER StashUrl
The address you open Stash at, e.g. http://192.168.1.10:9999. Only the scheme,
host and port are used. Pass several to allow each of them, or an empty string
("") to leave the browser policy untouched. Defaults to http://192.168.178.11:9999.

.PARAMETER Browser
Which browser's policy -StashUrl sets.

.PARAMETER Scheme
The URL scheme to register. Must match the plugin's "URL scheme" setting.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File .\install.ps1 C:\Tools\stashplay.ps1 -StashUrl http://192.168.1.10:9999
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Path,

    [string[]]$StashUrl = 'http://192.168.178.11:9999',

    [ValidateSet('Brave', 'Chrome', 'Edge')]
    [string]$Browser = 'Brave',

    [string]$Scheme = 'stashplay'
)

$ErrorActionPreference = 'Stop'

$PolicyKeys = @{
    Brave  = 'Software\Policies\BraveSoftware\Brave'
    Chrome = 'Software\Policies\Google\Chrome'
    Edge   = 'Software\Policies\Microsoft\Edge'
}

# CreateSubKey opens an existing key without touching its other values, unlike
# New-Item -Force, which would wipe any policies already set for the browser.
function Set-RegString([string]$SubKey, [string]$Name, [string]$Value) {
    $key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($SubKey)
    try { $key.SetValue($Name, $Value, [Microsoft.Win32.RegistryValueKind]::String) }
    finally { $key.Close() }
}

function Get-RegString([string]$SubKey, [string]$Name) {
    $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($SubKey)
    if (-not $key) { return $null }
    try { $key.GetValue($Name) }
    finally { $key.Close() }
}

# A handler pointing at a missing file fails silently at click time, so refuse
# to register one. ProviderPath rather than Path so PowerShell-only drives
# (e.g. Temp:\) become real filesystem paths.
if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "stashplay.ps1 not found at: $Path"
}
$scriptPath = (Resolve-Path -LiteralPath $Path).ProviderPath

# Validated before anything is written, so a typo doesn't leave a half-done
# install. The policy matches on origin, so reduce each URL to
# scheme://host:port. GetLeftPart drops default ports and any path, as the
# browser does. Values are split on commas because powershell -File passes
# "-StashUrl a,b" as a single string rather than an array.
$urls = $StashUrl -split ',' | ForEach-Object { $_.Trim().Trim("'", '"') } | Where-Object { $_ }
$origins = @(foreach ($url in $urls) {
    $uri = $null
    if (-not [Uri]::TryCreate($url, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -notin 'http', 'https') {
        throw "Not an http(s) URL: $url  (include the scheme, e.g. http://192.168.1.10:9999)"
    }
    $uri.GetLeftPart([UriPartial]::Authority)
}) | Select-Object -Unique

# conhost --headless because powershell.exe is a console program: Windows
# opens its console window before PowerShell can act on -WindowStyle Hidden,
# so without it a terminal flashes up on every click.
$conhost = Join-Path $env:SystemRoot 'System32\conhost.exe'
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$command = "`"$conhost`" --headless `"$powershell`" -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`" `"%1`""

$classKey = "Software\Classes\$Scheme"
Set-RegString $classKey '' 'URL:Stash External Player'
Set-RegString $classKey 'URL Protocol' ''
Set-RegString "$classKey\DefaultIcon" '' "$env:SystemRoot\System32\shell32.dll,115"
Set-RegString "$classKey\shell\open\command" '' $command

Write-Host "Registered ${Scheme}:// -> $scriptPath"

if ($origins) {
    $policyKey = $PolicyKeys[$Browser]
    $valueName = 'AutoLaunchProtocolsFromOrigins'

    # Keep rules for other schemes; replace any earlier rule for this one.
    $rules = @()
    $existing = Get-RegString $policyKey $valueName
    if ($existing) {
        # Assigned before piping: Windows PowerShell 5.1's ConvertFrom-Json
        # emits a JSON array as one object, which Where-Object would not unroll.
        $parsed = ConvertFrom-Json $existing
        $rules = @($parsed | Where-Object { $_.protocol -ne $Scheme })
    }
    $rules += [pscustomobject]@{ protocol = $Scheme; allowed_origins = @($origins) }

    Set-RegString $policyKey $valueName (ConvertTo-Json -InputObject $rules -Depth 5 -Compress)

    Write-Host "$Browser will open ${Scheme}:// links without asking from: $($origins -join ', ')"
    Write-Host "Restart $Browser, or open its policy page and click Reload policies."
}
