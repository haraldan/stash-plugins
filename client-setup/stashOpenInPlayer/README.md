# Windows client setup

This has to be done **once on each Windows PC** you browse Stash from. Without it
the button is inert — the browser will report that it cannot open the link.

## Why this step exists

A web page cannot start a program: the browser sandbox has no API for it, by
design. `file://` links from an `http://` page are blocked too, and would hand the
file to the browser rather than to a player. The one sanctioned route is a custom
URL scheme: you register `stashplay://` as belonging to a program, and the browser
asks for your confirmation before handing the URL to Windows.

## Install

1. Copy `stashplay.ps1` somewhere permanent, e.g. `C:\Tools\stashplay.ps1`.
2. Open `stashplay.reg` in a text editor and change the script path in the
   `shell\open\command` line to wherever you put the script. Backslashes must be
   doubled (`C:\\Tools\\...`). Replace only the path between the existing `\"`
   quotes. Don't add quotes of your own, or regedit skips the line without an
   error.
3. If you use Brave, also change the Stash address in the policy at the end of
   the file (see [No "Always allow" option](#no-always-allow-option)). Otherwise
   delete that section.
4. Double-click `stashplay.reg` and accept the import. It writes under
   `HKEY_CURRENT_USER`, so no administrator rights are needed.

## Configure the plugin

In Stash, go to **Settings → Plugins → Stash Open In Player** and set:

- **Path prefix (server)** — the leading part of the path as Stash stores it,
  e.g. `/data/media/`. Check a scene card: the path is shown under the title.
- **Path prefix (client)** — what that maps to on this PC, e.g. `Z:\media\` or
  `\\nas\media\`.
- **Convert / to \\** — leave on for Windows.
- **URL scheme** — leave as `stashplay` unless you changed it in the `.reg`.

Then hard-refresh the Stash tab.

## First click

The browser will ask whether to open the link (it may name *Console Window Host*,
the program that starts PowerShell without a window) the first time. Tick **Always
allow** and confirm; it won't ask again.

### No "Always allow" option

Chromium-based browsers (Chrome, Edge, Brave) only offer **Always allow** when
Stash is served over HTTPS or from `localhost`. If you reach Stash over plain
`http://` on the LAN, they ask on every click.

`stashplay.reg` handles this for Brave with the `AutoLaunchProtocolsFromOrigins`
policy, which allows the scheme from your Stash address without the prompt. It is
set per user, so no administrator rights are needed. Set `allowed_origins` to the
exact origin you open Stash at: scheme, host and port, no trailing slash. For
Chrome or Edge, change the key to `Software\Policies\Google\Chrome` or
`Software\Policies\Microsoft\Edge`.

Restart the browser, or open `brave://policy` (`chrome://policy`, `edge://policy`)
and click **Reload policies**. The policy should be listed there with status OK.
The browser will also show "Managed by your organization" in its menu. That's
expected for any policy and does not change anything else.

## Troubleshooting

### The browser prompts "Open URL:Stash External Player?" but nothing happens

The prompt means the registry entry is correct and Windows is handing the URL
over, so the fault is in the script or its arguments. The handler runs with no
visible window, so start with the log:

```
notepad %TEMP%\stashplay.log
```

**No log file, or no new `--- invoked with:` line.** The script never started.
Almost always the path to `stashplay.ps1` in the `.reg` does not match where you
actually put the file. Open `regedit`, check
`HKEY_CURRENT_USER\Software\Classes\stashplay\shell\open\command`, and confirm the
path in it exists. If that key has no value at all, the command line in the
`.reg` has broken quoting (usually extra quotes around the script path) and
regedit skipped it. Fix the line and import again.

**`ERROR: path does not exist on this PC`.** The handler ran and decoded a path,
but that path is wrong for this machine. The log line above it shows exactly
what it tried. Compare it to the real location and fix **Path prefix (server)**
and **Path prefix (client)** in the Stash plugin settings. Hovering the button in
Stash shows the same path without having to click.

**`launched OK` but no player appears.** Windows has no application associated
with that file extension. Double-click the file in Explorer: if Windows asks you
to choose a program, that is the problem. Either set a default for the extension,
or pin a specific player (see below).

**Still nothing.** Run the handler in a PowerShell window so you can see its
errors directly. Take the URL from an `--- invoked with:` line in the log, or
build one as shown in [Testing the handler without Stash](#testing-the-handler-without-stash),
and run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Tools\stashplay.ps1 "stashplay://open/..."
```

### Testing the handler without Stash

Get the encoded URL for a file you know exists:

```powershell
$p = 'Z:\media\some video.mp4'
$b = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($p))
'stashplay://open/' + $b.Replace('+','-').Replace('/','_').TrimEnd('=')
```

Paste the result into Run (Win+R). If the player opens, the handler is fine and
any remaining problem is the path mapping in the plugin settings.

## Using a specific player

The handler uses the Windows default for the file's extension. To pin a particular
player, edit the `Start-Process` line in `stashplay.ps1`:

```powershell
Start-Process 'C:\Program Files\mpv\mpv.exe' -ArgumentList $path
```

No plugin change is needed.

## Multiple client PCs

The path mapping lives in the Stash server's plugin settings, so it is shared by
every client. If two PCs need different mappings (say different drive letters),
leave the plugin's prefixes empty and do the rewrite inside `stashplay.ps1`
instead, per machine.
