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

Test the handler on its own first, before involving Stash. Get the encoded URL for
a file you know exists:

```powershell
$p = 'Z:\media\some video.mp4'
$b = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($p))
'stashplay://open/' + $b.Replace('+','-').Replace('/','_').TrimEnd('=')
```

Paste the result into Run (Win+R). If the player opens, the handler is fine and any
remaining problem is the path mapping in the plugin settings. If nothing happens,
check `%TEMP%\stashplay.log` — the script logs a line there when the path does not
exist or decoding fails.

If you hover the button in Stash, the tooltip shows the exact path that will be
sent, which is usually enough to spot a wrong prefix.

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
