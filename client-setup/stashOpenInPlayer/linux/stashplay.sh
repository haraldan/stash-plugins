#!/usr/bin/env bash
# Stash Open In Player - protocol handler
#
# Registered (via stashplay.desktop) as the handler for stashplay:// URLs. The
# browser runs xdg-open on the URL, which looks up x-scheme-handler/stashplay
# and runs this script with the URL as $1. The plugin builds URLs of the form:
#
#     stashplay://open/<base64url-of-utf8-path>
#
# The path arrives exactly as Stash stores it, e.g. /data/Movies/x.mkv. This
# script rewrites the prefix to where the share is mounted here, using the
# config written by install.sh, then opens the file in mpv (via mpv-open if
# it is installed).
#
# This runs with no terminal, so every step is logged. If something does not
# work, read the log first:  ~/.cache/stashplay.log

set -u

log_file="${XDG_CACHE_HOME:-$HOME/.cache}/stashplay.log"
config_file="${XDG_CONFIG_HOME:-$HOME/.config}/stashplay/config"

mkdir -p "$(dirname "$log_file")"

log() {
    printf '%s %s\n' "$(date +%Y-%m-%dT%H:%M:%S)" "$*" >>"$log_file"
}

# Also shown as a desktop notification, since there is no window to see it in.
fail() {
    log "ERROR: $*"
    command -v notify-send >/dev/null && notify-send "Stash Open In Player" "$*"
    exit 1
}

# Logged unconditionally: if this line is absent from the log, the script was
# never started and the fault is in the scheme registration, not below.
log "--- invoked with: ${1:-}"

url="${1:-}"
[[ -n "$url" ]] || fail "no URL was passed. Check that Exec= in stashplay.desktop ends with %u"

# Strip the scheme and the /open/ path segment, leaving the payload. Some
# browsers append a trailing slash.
b64=$(sed -E 's#^[A-Za-z0-9+.-]+:/*open/?##; s#/+$##' <<<"$url" | tr -- '-_' '+/')
case $(( ${#b64} % 4 )) in
    2) b64+="==" ;;
    3) b64+="=" ;;
esac

stash_path=$(base64 -d <<<"$b64" 2>/dev/null) || fail "could not decode the URL payload"
log "decoded path: $stash_path"

[[ -r "$config_file" ]] || fail "$config_file not found. Run install.sh."
path_from=$(sed -n 's/^path_from=//p' "$config_file")
path_to=$(sed -n 's/^path_to=//p' "$config_file")

# Matches on whole path segments, so /data/ maps /data/x but not /database/x,
# and a trailing slash on either prefix doesn't matter.
path_from="${path_from%/}"
path_to="${path_to%/}"
if [[ "$stash_path" == "$path_from" || "$stash_path" == "$path_from/"* ]]; then
    path="$path_to${stash_path#"$path_from"}"
else
    log "WARNING: path does not start with '$path_from/', so the prefix was left unchanged"
    path="$stash_path"
fi
log "mapped path: $path"

[[ -e "$path" ]] || fail "path does not exist on this PC: $path. Check $config_file, or run install.sh again."

# mpv-open, where installed, loads the file into an mpv that is already running
# instead of opening a second window, and starts mpv otherwise.
player=$(command -v mpv-open || command -v mpv) || fail "mpv is not installed"

# pseudo-gui is what mpv.desktop uses: a window even for audio-only files, and
# no terminal output. mpv-open passes it on when it has to start mpv. Detached
# so this script exits while mpv keeps playing; anything mpv does print still
# goes to the log.
setsid -f "$player" --player-operation-mode=pseudo-gui -- "$path" >>"$log_file" 2>&1
log "launched OK with $player"
