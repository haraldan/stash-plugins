#!/bin/bash

# builds a repository of plugins
# outputs to _site with the following structure:
# index.yml
# <plugin_id>.zip
# Each zip file contains the plugin.yml file and any other files in the same directory

# Fail loudly. Without this the script exits 0 even when it builds nothing, and
# a broken build publishes as a green run with a missing or partial index.
set -euo pipefail

outdir="${1:-_site}"

rm -rf "$outdir"
mkdir -p "$outdir"

buildPlugin() 
{
    f=$1

    if grep -q "^#pkgignore" "$f"; then
        return
    fi
    
    # get the plugin id from the directory
    dir=$(dirname "$f")
    plugin_id=$(basename "$f" .yml)

    echo "Processing $plugin_id"

    # create a directory for the version
    # `|| true`: an uncommitted plugin, or a repo with no commits at all, must
    # leave these empty rather than abort the whole build under `set -e`.
    version=$(git log -n 1 --pretty=format:%h -- "$dir"/* 2>/dev/null || true)
    updated=$(TZ=UTC0 git log -n 1 --date="format-local:%F %T" --pretty=format:%ad -- "$dir"/* 2>/dev/null || true)

    # A plugin with no commits yet has no date to stamp files with. Fall back to
    # a fixed timestamp rather than letting working-tree mtimes leak in and make
    # the zip unreproducible.
    if [ -z "$updated" ]; then
        echo "  warning: $plugin_id is not committed yet; using epoch timestamps" >&2
        updated="1970-01-01 00:00:00"
    fi

    # create the zip file
    # copy other files
    zipfile=$(realpath "$outdir/$plugin_id.zip")
    
    pushd "$dir" > /dev/null

    # Package tracked files plus untracked ones that aren't gitignored. Walking
    # the working tree instead would sweep up node_modules on a local build, and
    # the previous `grep -rl .` silently dropped any zero-byte file.
    filelist=$(git ls-files --cached --others --exclude-standard | sort)
    if [ -z "$filelist" ]; then
        echo "ERROR: no files to package for $plugin_id" >&2
        exit 1
    fi

    printf '%s\n' "$filelist" | xargs -d '\n' touch -d "$updated" --
    printf '%s\n' "$filelist" | zip -0 -r -oX "$zipfile" -@ > /dev/null

    popd > /dev/null

    name=$(grep "^name:" "$f" | head -n 1 | cut -d' ' -f2- | sed -e 's/\r//' -e 's/^"\(.*\)"$/\1/')
    description=$(grep "^description:" "$f" | head -n 1 | cut -d' ' -f2- | sed -e 's/\r//' -e 's/^"\(.*\)"$/\1/')
    ymlVersion=$(grep "^version:" "$f" | head -n 1 | cut -d' ' -f2- | sed -e 's/\r//' -e 's/^"\(.*\)"$/\1/')
    version="$ymlVersion-$version"
    dep=$(grep "^# requires:" "$f" | cut -c 12- | sed -e 's/\r//' || true)

    # write to spec index
    echo "- id: $plugin_id
  name: $name
  metadata:
    description: $description
  version: $version
  date: $updated
  path: $plugin_id.zip
  sha256: $(sha256sum "$zipfile" | cut -d' ' -f1)" >> "$outdir"/index.yml

    # handle dependencies
    if [ ! -z "$dep" ]; then
        echo "  requires:" >> "$outdir"/index.yml
        for d in ${dep//,/ }; do
            echo "    - $d" >> "$outdir"/index.yml
        done
    fi

    echo "" >> "$outdir"/index.yml
}

# Quote the glob: unquoted, the shell expands it against the current directory
# first, and a stray .yml in the repo root would make find match nothing.
for srcdir in ./plugins ./themes; do
    [ -d "$srcdir" ] || continue
    find "$srcdir" -mindepth 1 -name '*.yml' | sort | while read -r file; do
        buildPlugin "$file"
    done
done

# A green run that published nothing is the failure mode this guards against.
if [ ! -s "$outdir/index.yml" ]; then
    echo "ERROR: $outdir/index.yml is empty or missing - nothing was built" >&2
    exit 1
fi

echo "Built $(grep -c '^- id:' "$outdir/index.yml") plugin(s) into $outdir"
