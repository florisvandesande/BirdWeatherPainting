#!/usr/bin/env bash
set -euo pipefail

source_root="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
output_root="${2:-$source_root/_site}"
source_root="$(cd "$source_root" && pwd)"
mkdir -p "$output_root"
output_root="$(cd "$output_root" && pwd)"

if [[ "$source_root" == "$output_root" ]]; then
    echo "The Pages output directory must be separate from the source directory." >&2
    exit 2
fi
if ! command -v pngquant >/dev/null 2>&1; then
    echo "pngquant is required to prepare the iPad-compatible Pages artwork." >&2
    exit 2
fi
if ! command -v rsync >/dev/null 2>&1; then
    echo "rsync is required to assemble the Pages site." >&2
    exit 2
fi

rsync -a --delete \
    --exclude='/.git/' \
    --exclude='/.github/' \
    --exclude='/.agents/' \
    --exclude='/.temporary/' \
    --exclude='/.DS_Store' \
    --exclude='/docs/' \
    --exclude='/tests/' \
    --exclude='/scripts/' \
    --exclude='/README.md' \
    --exclude='/AGENTS.md' \
    --exclude='/LICENSE' \
    --exclude='/_site/' \
    "$source_root/" "$output_root/"

: > "$output_root/.nojekyll"

artwork_root="$output_root/assets/artwork"
if [[ ! -d "$artwork_root/birds" || ! -d "$artwork_root/perches" ]]; then
    echo "The Pages source must contain the bird and perch PNG directories." >&2
    exit 2
fi

original_bytes=0
published_bytes=0
while IFS= read -r -d '' image; do
    original_size="$(wc -c < "$image" | tr -d ' ')"
    original_bytes=$((original_bytes + original_size))
    optimized="${image%.png}.pages-optimized.png"

    if pngquant --quality=70-95 --speed=1 --output "$optimized" "$image"; then
        optimized_size="$(wc -c < "$optimized" | tr -d ' ')"
        if (( optimized_size < original_size )); then
            mv "$optimized" "$image"
            published_bytes=$((published_bytes + optimized_size))
        else
            rm -f "$optimized"
            published_bytes=$((published_bytes + original_size))
        fi
    else
        result=$?
        rm -f "$optimized"
        if (( result != 99 )); then
            echo "pngquant failed for ${image#"$output_root"/} (exit $result)." >&2
            exit "$result"
        fi
        published_bytes=$((published_bytes + original_size))
    fi
done < <(find "$artwork_root/birds" "$artwork_root/perches" -type f -name '*.png' -print0)

if (( original_bytes > 0 )); then
    saved_bytes=$((original_bytes - published_bytes))
    printf 'Prepared %s of PNG artwork for Pages; reduced artwork by %s bytes. Source PNGs remain unchanged.\n' \
        "$(find "$artwork_root/birds" "$artwork_root/perches" -type f -name '*.png' | wc -l | tr -d ' ')" \
        "$saved_bytes"
fi
