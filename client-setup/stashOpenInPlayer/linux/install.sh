#!/usr/bin/env bash
# Registers stashplay.sh as the handler for stashplay:// links.
#
# Copies stashplay.sh to ~/.local/bin and registers a .desktop file as the
# x-scheme-handler for the scheme, so no root is needed for that. Run it again
# after updating stashplay.sh; it overwrites the previous install.
#
# It asks for the path prefix mapping, from where Stash stores files to where
# this machine sees them, pre-filled with the previous answers, or with /data/
# and /mnt/Media/Videos/Captures. Pass --path-from and --path-to to skip them.
#
# It also sets the browser's AutoLaunchProtocolsFromOrigins policy for the
# --stash-url addresses, so links from Stash open without a confirmation prompt.
# Chromium-based browsers only offer "Always allow" on HTTPS or localhost, so
# over plain http:// this is the only way to stop them asking on every click.
# The policy directory is under /etc, so this one step uses sudo.
#
# Usage: install.sh [--path-from P] [--path-to P] [--stash-url URL[,URL...]]
#                   [--browser brave|chrome|chromium] [--scheme NAME]
#
#   --stash-url  The address you open Stash at; only scheme, host and port are
#                used. Comma-separate several. "" leaves the browser policy
#                untouched. Default: http://192.168.178.11:9999
#   --browser    Which browser's policy --stash-url sets. Default: brave
#   --scheme     The URL scheme to register. Must match the plugin's
#                "URL scheme" setting. Default: stashplay

set -euo pipefail

path_from=""
path_to=""
stash_url="http://192.168.178.11:9999"
browser="brave"
scheme="stashplay"

usage() {
    sed -n '/^# Usage:/,/^$/s/^# \{0,1\}//p' "$0"
    exit "${1:-0}"
}

while (( $# )); do
    case $1 in
        --path-from) path_from=$2; shift 2 ;;
        --path-to) path_to=$2; shift 2 ;;
        --stash-url) stash_url=$2; shift 2 ;;
        --browser) browser=$2; shift 2 ;;
        --scheme) scheme=$2; shift 2 ;;
        -h|--help) usage ;;
        *) echo "Unknown argument: $1" >&2; usage 1 >&2 ;;
    esac
done

die() { echo "Error: $*" >&2; exit 1; }

src_dir=$(cd "$(dirname "$0")" && pwd)
bin_dir="$HOME/.local/bin"
app_dir="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
config_file="${XDG_CONFIG_HOME:-$HOME/.config}/stashplay/config"
handler="$bin_dir/stashplay.sh"
desktop_file="$app_dir/$scheme.desktop"

case $browser in
    brave) policy_dir=/etc/brave/policies/managed ;;
    chrome) policy_dir=/etc/opt/chrome/policies/managed ;;
    chromium) policy_dir=/etc/chromium/policies/managed ;;
    *) die "--browser must be brave, chrome or chromium" ;;
esac

[[ $scheme =~ ^[a-z][a-z0-9+.-]*$ ]] || die "Not a valid URL scheme: $scheme"

# Reduces a URL to the origin the policy matches on, scheme://host[:port],
# dropping a default port as the browser does.
origin_of() {
    local re='^(https?)://([^/?#:]+)(:([0-9]+))?([/?#].*)?$'
    [[ ${1,,} =~ $re ]] || return 1
    local proto=${BASH_REMATCH[1]} host=${BASH_REMATCH[2]} port=${BASH_REMATCH[4]}
    if [[ $proto == http && $port == 80 || $proto == https && $port == 443 ]]; then
        port=""
    fi
    echo "$proto://$host${port:+:$port}"
}

# Validated before anything is written, so a typo doesn't leave a half-done
# install.
origins=()
IFS=',' read -ra urls <<<"$stash_url"
for url in "${urls[@]}"; do
    url=$(xargs <<<"$url")  # trim whitespace
    [[ -n $url ]] || continue
    origin=$(origin_of "$url") \
        || die "Not an http(s) URL: $url  (include the scheme, e.g. http://192.168.1.10:9999)"
    [[ " ${origins[*]} " == *" $origin "* ]] || origins+=("$origin")
done

# read -e -i pre-fills the answer so it can be edited or accepted with Enter.
# A rerun offers the previous mapping.
ask() {
    local prompt=$1 default=$2 answer=""
    [[ -t 0 ]] || die "no terminal to ask on; pass --path-from and --path-to"
    while [[ -z $answer ]]; do
        read -rep "$prompt: " -i "$default" answer
    done
    echo "$answer"
}

prev_from=/data/
prev_to=/mnt/Media/Videos/Captures
if [[ -r $config_file ]]; then
    prev_from=$(sed -n 's/^path_from=//p' "$config_file")
    prev_to=$(sed -n 's/^path_to=//p' "$config_file")
fi
[[ -n $path_from ]] || path_from=$(ask "Path prefix as Stash stores it" "$prev_from")
[[ -n $path_to ]] || path_to=$(ask "Where $path_from is on this machine" "$prev_to")

# ls rather than -d alone so an NFS automount gets triggered first.
if ! ls "$path_to" >/dev/null 2>&1; then
    echo "Warning: '$path_to' is not a readable folder right now. Continuing; check it before clicking." >&2
fi

mkdir -p "$bin_dir" "$app_dir" "$(dirname "$config_file")"

install -m 755 "$src_dir/stashplay.sh" "$handler"

printf 'path_from=%s\npath_to=%s\n' "$path_from" "$path_to" >"$config_file"
echo "Mapping $path_from -> $path_to (saved to $config_file)"

# NoDisplay keeps it out of the app launcher; it only exists for xdg-open.
cat >"$desktop_file" <<EOF
[Desktop Entry]
Type=Application
Name=Stash External Player
Exec=$handler %u
MimeType=x-scheme-handler/$scheme;
NoDisplay=true
Terminal=false
EOF

command -v update-desktop-database >/dev/null && update-desktop-database "$app_dir"
xdg-mime default "$(basename "$desktop_file")" "x-scheme-handler/$scheme"
echo "Registered $scheme:// -> $handler"

if (( ${#origins[@]} )); then
    # A file of its own, so policies other tools keep in the same directory
    # (Omarchy writes some there) are never touched. The browser merges every
    # file in the directory.
    policy_file="$policy_dir/$scheme.json"
    allowed=$(printf '"%s",' "${origins[@]}")
    json="{\"AutoLaunchProtocolsFromOrigins\": [{\"protocol\": \"$scheme\", \"allowed_origins\": [${allowed%,}]}]}"

    echo "Writing $policy_file (needs sudo)"
    sudo mkdir -p "$policy_dir"
    sudo tee "$policy_file" >/dev/null <<<"$json"
    sudo chmod 644 "$policy_file"

    echo "$browser will open $scheme:// links without asking from: ${origins[*]}"
    echo "Restart $browser, or open $browser://policy and click Reload policies."
fi
