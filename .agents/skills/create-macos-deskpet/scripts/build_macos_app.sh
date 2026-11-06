#!/bin/zsh
set -euo pipefail

usage() {
  echo "Usage: $0 --name NAME --bundle-id ID --assets-dir DIR --json FILE --icon ICNS --out-dir DIR"
}

name="" bundle_id="" assets_dir="" json_file="" icon_file="" out_dir=""
while (( $# )); do
  case "$1" in
    --name) name="$2"; shift 2 ;;
    --bundle-id) bundle_id="$2"; shift 2 ;;
    --assets-dir) assets_dir="$2"; shift 2 ;;
    --json) json_file="$2"; shift 2 ;;
    --icon) icon_file="$2"; shift 2 ;;
    --out-dir) out_dir="$2"; shift 2 ;;
    *) usage; exit 2 ;;
  esac
done
[[ -n "$name" && -n "$bundle_id" && -d "$assets_dir" && -f "$json_file" && -f "$icon_file" && -n "$out_dir" ]] || { usage; exit 2; }

script_dir="${0:A:h}"
skill_dir="${script_dir:h}"
template_dir="$skill_dir/assets/app-template"
app="$out_dir/$name DeskPet.app"
source_out="$out_dir/source"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources" "$source_out"
cp "$template_dir/main.swift" "$source_out/main.swift"
cp "$template_dir/Info.plist" "$source_out/Info.plist"
cp "$source_out/Info.plist" "$app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier $bundle_id" "$app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleName $name DeskPet" "$app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName $name DeskPet" "$app/Contents/Info.plist"

atlas_name=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["spritesheetPath"])' "$json_file")
cp "$assets_dir/$atlas_name" "$app/Contents/Resources/$atlas_name"
cp "$json_file" "$app/Contents/Resources/pet.json"
cp "$icon_file" "$app/Contents/Resources/AppIcon.icns"
cp "$json_file" "$source_out/pet.json"
cp "$assets_dir/$atlas_name" "$out_dir/$atlas_name"
cp "$json_file" "$out_dir/${json_file:t}"

cache_dir="$out_dir/.swift-module-cache"
mkdir -p "$cache_dir"
swiftc -module-cache-path "$cache_dir" -O -framework AppKit "$source_out/main.swift" -o "$app/Contents/MacOS/DeskPet"
plutil -lint "$app/Contents/Info.plist"
codesign --force --deep --sign - "$app"
codesign --verify --deep --strict "$app"
ditto -c -k --sequesterRsrc --keepParent "$app" "$out_dir/$name DeskPet-macOS.zip"
echo "Built $app"
