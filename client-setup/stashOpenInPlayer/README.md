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
2. Run `install.ps1` with the path to it. A relative path is fine; it is stored
   as an absolute one. It also allows the Stash address to open links without
   the browser asking every time (see
   [No "Always allow" option](#no-always-allow-option)). The address defaults to
   `http://192.168.178.11:9999`. If yours is different, pass `-StashUrl`:

   ```
   powershell -ExecutionPolicy Bypass -File install.ps1 C:\Tools\stashplay.ps1
   powershell -ExecutionPolicy Bypass -File install.ps1 C:\Tools\stashplay.ps1 -StashUrl http://192.168.1.10:9999
   ```

   It writes under `HKEY_CURRENT_USER`, so no administrator rights are needed.
   If you move `stashplay.ps1` later, run it again.

Options:

- `-StashUrl` — one or more Stash addresses, comma-separated. Only scheme, host
  and port are used, so a URL copied from the address bar works. Default
  `http://192.168.178.11:9999`. Pass `-StashUrl ""` to leave the browser policy
  untouched.
- `-Browser Brave|Chrome|Edge` — which browser's policy to set. Default `Brave`.
- `-Scheme` — the URL scheme to register. Default `stashplay`; must match the
  plugin's **URL scheme** setting.

## Configure the plugin

In Stash, go to **Settings → Plugins → Stash Open In Player** and set:

- **Path prefix (server)** — the leading part of the path as Stash stores it,
  e.g. `/data/media/`. Check a scene card: the path is shown under the title.
- **Path prefix (client)** — what that maps to on this PC, e.g. `Z:\media\` or
  `\\nas\media\`.
- **Convert / to \\** — leave on for Windows.
- **URL scheme** — leave as `stashplay` unless you passed `-Scheme` to
  `install.ps1`.

Then hard-refresh the Stash tab.

## First click

The browser will ask whether to open the link (it may name *Console Window Host*,
the program that starts PowerShell without a window) the first time. Tick **Always
allow** and confirm; it won't ask again.

### No "Always allow" option

Chromium-based browsers (Chrome, Edge, Brave) only offer **Always allow** when
Stash is served over HTTPS or from `localhost`. If you reach Stash over plain
`http://` on the LAN, they ask on every click.

`install.ps1` handles this for the `-StashUrl` addresses. It sets the browser's
`AutoLaunchProtocolsFromOrigins` policy, which lets links from those Stash
addresses open without the prompt. It is set per user, so no administrator
rights are needed. The address must match the one you actually open Stash at: if
you sometimes use a hostname and sometimes the IP, pass both. Running the
installer again replaces the addresses for this scheme and keeps any rules the
policy has for other protocols.

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
Almost always `stashplay.ps1` has been moved or deleted since you ran
`install.ps1`. Open `regedit`, check
`HKEY_CURRENT_USER\Software\Classes\stashplay\shell\open\command`, and confirm the
path in it exists. If not, run `install.ps1` again with the new location.

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
