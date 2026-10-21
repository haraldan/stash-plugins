# Client setup

This has to be done **once on each PC** you browse Stash from: the
[Windows](#windows) or [Linux](#linux) steps below. Without it the button is
inert, and the browser will report that it cannot open the link.

## Why this step exists

A web page cannot start a program: the browser sandbox has no API for it, by
design. `file://` links from an `http://` page are blocked too, and would hand the
file to the browser rather than to a player. The one sanctioned route is a custom
URL scheme. You register `stashplay://` as belonging to a program, and the browser
asks for your confirmation before handing the URL to the OS.

## Where the path gets rewritten

The plugin sends the file's path exactly as Stash stores it, e.g.
`/data/Movies/x.mkv`. Each PC's handler rewrites the leading part to where that
folder is on that PC, e.g. `Z:\Movies\x.mkv` or `/mnt/Media/Videos/Captures/Movies/x.mkv`.
That way every PC can use its own drive letter or mount point.

The installer asks for both halves of the mapping:

- **Path prefix as Stash stores it.** Defaults to `/data/`. Check a scene card:
  the path is shown under the title, and hovering the open-in-player button shows
  it too.
- **Where that is on this PC.**

Press Enter to accept the default. Running the installer again offers your
previous answers. The match is on whole folders, so `/data/` maps `/data/x` but
not `/database/x`, and a trailing slash on either side makes no difference.

## Windows

### Install

1. Keep `windows\install.ps1` and `windows\stashplay.ps1` together somewhere
   permanent, e.g. `C:\Tools\`.
2. Run the installer and answer the two path questions. The mapping is saved
   as `stashplay.json` next to `stashplay.ps1`.

   ```
   powershell -ExecutionPolicy Bypass -File C:\Tools\install.ps1
   ```

   It writes under `HKEY_CURRENT_USER`, so no administrator rights are needed.
   If you move `stashplay.ps1` later, run it again.

The handler converts `/` to `\` itself, so answer with a normal Windows path such
as `Z:\` or `\\nas\media\`.

Options, all optional:

- `-Path` — the `stashplay.ps1` to register. Defaults to the one next to
  `install.ps1`.
- `-PathFrom`, `-PathTo` — the path mapping. Passing both skips the questions.
- `-StashUrl` — one or more Stash addresses, comma-separated. Only scheme, host
  and port are used, so a URL copied from the address bar works. Default
  `http://192.168.178.11:9999`. Pass `-StashUrl ""` to leave the browser policy
  untouched. See [No "Always allow" option](#no-always-allow-option).
- `-Browser Brave|Chrome|Edge` — which browser's policy to set. Default `Brave`.
- `-Scheme` — the URL scheme to register. Default `stashplay`. It must match the
  plugin's **URL scheme** setting.

### First click

The first time, the browser asks whether to open the link. It may name *Console
Window Host*, the program that starts PowerShell without a window. Tick **Always
allow** and confirm, and it won't ask again.

### No "Always allow" option

Chromium-based browsers (Chrome, Edge, Brave) only offer **Always allow** when
Stash is served over HTTPS or from `localhost`. If you reach Stash over plain
`http://` on the LAN, they ask on every click.

`install.ps1` handles this for the `-StashUrl` addresses. It sets the browser's
`AutoLaunchProtocolsFromOrigins` policy, which lets links from those Stash
addresses open without the prompt. It is set per user, so no administrator
rights are needed. The address must match the one you actually open Stash at. If
you sometimes use a hostname and sometimes the IP, pass both. Running the
installer again replaces the addresses for this scheme and keeps any rules the
policy has for other protocols.

Restart the browser, or open `brave://policy` (`chrome://policy`, `edge://policy`)
and click **Reload policies**. The policy should be listed there with status OK.
The browser will also show "Managed by your organization" in its menu. That's
expected for any policy and does not change anything else.

### Troubleshooting

#### The browser prompts "Open URL:Stash External Player?" but nothing happens

The prompt means the registry entry is correct and Windows is handing the URL
over, so the fault is in the script or its arguments. The handler runs with no
visible window, so start with the log:

```
notepad %TEMP%\stashplay.log
```

**No log file, or no new `--- invoked with:` line.** The script never started.
Almost always, `stashplay.ps1` has been moved or deleted since you ran
`install.ps1`. Open `regedit`, check
`HKEY_CURRENT_USER\Software\Classes\stashplay\shell\open\command`, and confirm the
path in it exists. If it doesn't, run `install.ps1` again from the new location.

**`ERROR: ...stashplay.json not found`.** The handler has no path mapping. Run
`install.ps1` again.

**`ERROR: path does not exist on this PC`.** The handler ran, but the mapped path
is wrong for this machine. The `decoded path:` and `mapped path:` lines above the
error show what Stash sent and what that was turned into. Run `install.ps1` again
with corrected answers, or edit `stashplay.json` directly.

**`ERROR: mpv not found`.** mpv is not where `$MpvExe` at the top of
`stashplay.ps1` says. Fix that line.

**`launched mpv OK` but no player appears.** mpv started but failed. Run the same
file directly to see its error:
`& 'C:\Program Files\MPV Player\mpv.exe' 'Y:\path\to\file.mkv'`.

**`sent to running mpv OK` but nothing changes.** The video was loaded into an mpv
window that is open but hidden behind other windows.

**Still nothing.** Run the handler in a PowerShell window so you can see its
errors directly. Take the URL from an `--- invoked with:` line in the log, or
build one as shown in [Testing the handler without Stash](#testing-the-handler-without-stash),
and run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Tools\stashplay.ps1 "stashplay://open/..."
```

#### Testing the handler without Stash

Get the encoded URL for a path as Stash would store it:

```powershell
$p = '/data/some video.mp4'
$b = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($p))
'stashplay://open/' + $b.Replace('+','-').Replace('/','_').TrimEnd('=')
```

Paste the result into Run (Win+R). If the player opens, the whole chain works.

### Player

The handler always opens mpv, whatever the Windows default for the file type is.
It looks for it at `C:\Program Files\MPV Player\mpv.exe`; if yours is elsewhere,
change `$MpvExe` at the top of `stashplay.ps1`.

mpv windows the handler starts listen on the named pipe `\\.\pipe\mpv-stashplay`.
While one is open, the next click loads the new file into it, replacing what is
playing, instead of opening a second window. Windows does not let the handler
bring that window to the front. To have mpv windows you open yourself take files
from Stash too, add this to `%APPDATA%\mpv\mpv.conf`:

```
input-ipc-server=\\.\pipe\mpv-stashplay
```

## Linux

### Install

Run the installer from this repository and answer the two path questions. The
mount point defaults to `/mnt/Media/Videos/Captures`.

```
client-setup/stashOpenInPlayer/linux/install.sh
```

It:

- copies `stashplay.sh` to `~/.local/bin/`,
- saves the mapping to `~/.config/stashplay/config`,
- writes `~/.local/share/applications/stashplay.desktop` and registers it as the
  handler for `x-scheme-handler/stashplay`,
- writes the browser policy that stops the confirmation prompt (see below). This
  is the one step that needs `sudo`.

Run it again after updating `stashplay.sh`.

Options, all optional:

- `--path-from`, `--path-to` — the path mapping. Passing both skips the questions.
- `--stash-url` — one or more Stash addresses, comma-separated. Default
  `http://192.168.178.11:9999`. Pass `--stash-url ""` to skip the browser policy,
  and with it `sudo`.
- `--browser brave|chrome|chromium` — which browser's policy to set. Default `brave`.
- `--scheme` — the URL scheme to register. Default `stashplay`. It must match
  the plugin's **URL scheme** setting.

### How a click reaches the player

1. The button navigates to `stashplay://open/<base64url path>`.
2. Brave doesn't handle that scheme itself. On Linux, Chromium-based browsers
   pass unknown schemes to `xdg-open`, after asking for confirmation (the prompt
   names *xdg-open*).
3. `xdg-open` looks up the default application for the MIME type
   `x-scheme-handler/stashplay`, which `install.sh` set to `stashplay.desktop`.
4. That `.desktop` file runs `~/.local/bin/stashplay.sh %u`, with `%u` replaced
   by the URL.
5. `stashplay.sh` decodes and maps the path, then opens the file in mpv.

You can run the same chain without the browser, which is the quickest way to
test:

```
xdg-open "stashplay://open/$(printf '/data/some video.mp4' | base64 -w0 | tr '+/' '-_' | tr -d =)"
```

### No confirmation prompt

The browser asks before every click over plain `http://`, as on Windows. The
installer writes `/etc/brave/policies/managed/stashplay.json` with the same
`AutoLaunchProtocolsFromOrigins` policy. It is a file of its own, so policies
other tools keep in that folder (Omarchy writes some there) are left alone.

Restart the browser, or open `brave://policy` and click **Reload policies**.

### Troubleshooting

The handler has no window. It logs every step to `~/.cache/stashplay.log` and
also shows errors as a desktop notification.

- **No new `--- invoked with:` line.** The scheme isn't registered. Check that
  `xdg-mime query default x-scheme-handler/stashplay` prints `stashplay.desktop`,
  and run `install.sh` again if not.
- **`ERROR: path does not exist on this PC`.** The `decoded path:` and
  `mapped path:` lines show what Stash sent and what it was turned into. Check
  that the share is mounted, then run `install.sh` again with corrected answers,
  or edit `~/.config/stashplay/config`.
- **`launched OK` but no player appears.** mpv started but failed. Its own
  errors are in the same log.

### Using a different player

The handler always opens mpv, whatever the desktop default for the file type is.
If an `mpv-open` wrapper is on `PATH`, the
handler runs that instead, so the file loads into the mpv that is already open
rather than a new window. It fails with a notification if neither is installed,
and the log's `launched OK with ...` line shows which one ran.

To use another player, change the `player=` line in this repository's
`stashplay.sh`, then run `install.sh` again to copy it into place.

## Plugin settings

**Settings → Plugins → Stash Open In Player** has one setting: **URL scheme**.
Leave it as `stashplay` unless you passed a different scheme to the installer.

## Upgrading from 0.1.x

Version 0.1.x rewrote the path on the server, in the plugin settings. From 0.2.0
the plugin sends the path unchanged, so run the Windows installer again to give
the handler its mapping. The old prefix settings are ignored.
