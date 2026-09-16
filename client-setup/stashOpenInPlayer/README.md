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
2. Open `stashplay.reg` in a text editor and change the path on the last line to
   wherever you put the script. Backslashes must be doubled (`C:\\Tools\\...`).
3. Double-click `stashplay.reg` and accept the import. It writes under
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

The browser will ask *"Open Windows PowerShell?"* the first time. Tick **Always
allow** and confirm; it won't ask again.

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
path in it exists.

**`ERROR: path does not exist on this PC`.** The handler ran and decoded a path,
but that path is wrong for this machine. The log line above it shows exactly
what it tried. Compare it to the real location and fix **Path prefix (server)**
and **Path prefix (client)** in the Stash plugin settings. Hovering the button in
Stash shows the same path without having to click.

**`launched OK` but no player appears.** Windows has no application associated
with that file extension. Double-click the file in Explorer: if Windows asks you
to choose a program, that is the problem. Either set a default for the extension,
or pin a specific player (see below).

**Still nothing.** Import `stashplay-debug.reg` (after editing its script path
the same way) and click the button again. It keeps the PowerShell window open so
you can read the error directly. Re-import `stashplay.reg` afterwards.

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
