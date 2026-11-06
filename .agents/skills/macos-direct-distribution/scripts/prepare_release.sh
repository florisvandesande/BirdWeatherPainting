#!/bin/bash

set -euo pipefail

usage() {
    cat <<'EOF'
Prepare a signed, notarized macOS DMG and Sparkle appcast locally.

Usage:
  prepare_release.sh \
    --app PATH \
    --channel stable|beta \
    --download-base-url HTTPS_URL \
    --output-dir PATH \
    --signing-identity IDENTITY \
    --notary-profile KEYCHAIN_PROFILE \
    --generate-appcast PATH \
    [--dry-run]

The script never uploads files. Credentials and private keys must remain in Keychain.
EOF
}

fail() {
    echo "Error: $*" >&2
    exit 1
}

note() {
    echo "$*"
}

require_value() {
    local option="$1"
    local value="${2:-}"
    [[ -n "$value" && "$value" != --* ]] || fail "$option requires a value."
}

app_path=""
channel=""
download_base_url=""
output_dir=""
signing_identity=""
notary_profile=""
generate_appcast=""
dry_run=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --app)
            require_value "$1" "${2:-}"
            app_path="$2"
            shift 2
            ;;
        --channel)
            require_value "$1" "${2:-}"
            channel="$2"
            shift 2
            ;;
        --download-base-url)
            require_value "$1" "${2:-}"
            download_base_url="$2"
            shift 2
            ;;
        --output-dir)
            require_value "$1" "${2:-}"
            output_dir="$2"
            shift 2
            ;;
        --signing-identity)
            require_value "$1" "${2:-}"
            signing_identity="$2"
            shift 2
            ;;
        --notary-profile)
            require_value "$1" "${2:-}"
            notary_profile="$2"
            shift 2
            ;;
        --generate-appcast)
            require_value "$1" "${2:-}"
            generate_appcast="$2"
            shift 2
            ;;
        --dry-run)
            dry_run=true
            shift
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            fail "Unknown argument: $1. Run with --help for usage."
            ;;
    esac
done

[[ -n "$app_path" ]] || fail "Missing required --app."
[[ -n "$channel" ]] || fail "Missing required --channel."
[[ -n "$download_base_url" ]] || fail "Missing required --download-base-url."
[[ -n "$output_dir" ]] || fail "Missing required --output-dir."
[[ -n "$signing_identity" ]] || fail "Missing required --signing-identity."
[[ -n "$notary_profile" ]] || fail "Missing required --notary-profile."
[[ -n "$generate_appcast" ]] || fail "Missing required --generate-appcast."

[[ "$channel" == "stable" || "$channel" == "beta" ]] || fail "--channel must be stable or beta."
[[ "$download_base_url" == https://* ]] || fail "--download-base-url must use HTTPS."
download_base_url="${download_base_url%/}"

[[ -d "$app_path" && "$app_path" == *.app ]] || fail "--app must point to an existing .app bundle."
[[ -x "$generate_appcast" ]] || fail "--generate-appcast must point to an executable Sparkle generate_appcast tool."

for tool in awk codesign ditto grep hdiutil plutil security shasum spctl xcrun; do
    command -v "$tool" >/dev/null 2>&1 || fail "Required tool not found: $tool."
done

info_plist="$app_path/Contents/Info.plist"
[[ -f "$info_plist" ]] || fail "The app has no Contents/Info.plist."

read_plist_value() {
    local key="$1"
    /usr/libexec/PlistBuddy -c "Print :$key" "$info_plist" 2>/dev/null || true
}

bundle_name="$(read_plist_value CFBundleName)"
[[ -n "$bundle_name" ]] || bundle_name="$(basename "$app_path" .app)"
short_version="$(read_plist_value CFBundleShortVersionString)"
build_version="$(read_plist_value CFBundleVersion)"
feed_url="$(read_plist_value SUFeedURL)"
public_ed_key="$(read_plist_value SUPublicEDKey)"

[[ -n "$short_version" ]] || fail "CFBundleShortVersionString is missing."
[[ -n "$build_version" ]] || fail "CFBundleVersion is missing."
[[ "$build_version" =~ ^[0-9]+([.][0-9]+)*$ ]] || fail "CFBundleVersion must be a monotonically increasing numeric version."
[[ -n "$public_ed_key" ]] || fail "SUPublicEDKey is missing; Sparkle updates must use EdDSA validation."

expected_feed_url="$download_base_url/$channel/appcast.xml"
[[ "$feed_url" == "$expected_feed_url" ]] || fail "SUFeedURL must be $expected_feed_url for the $channel channel; found ${feed_url:-<missing>}."

workspace_root="$(pwd -P)"
temporary_root="$workspace_root/.temporary"
case "$output_dir" in
    *"/../"*|*"/..") fail "--output-dir must not contain parent-directory traversal." ;;
esac
case "$output_dir" in
    .temporary|.temporary/*|"$temporary_root"|"$temporary_root"/*) ;;
    *) fail "--output-dir must be inside the repository's .temporary directory." ;;
esac

identity_listing="$(security find-identity -v -p codesigning 2>/dev/null || true)"
[[ "$identity_listing" == *"$signing_identity"* ]] || fail "The requested Developer ID signing identity is not available in Keychain."
[[ "$signing_identity" == Developer\ ID\ Application:* ]] || fail "--signing-identity must be a Developer ID Application identity."

channel_output="${output_dir%/}/$channel"
safe_name="${bundle_name// /-}"
dmg_filename="$safe_name-$short_version-$build_version-$channel.dmg"
download_url="$download_base_url/$channel/$dmg_filename"

note "App: $app_path"
note "Version: $short_version ($build_version)"
note "Channel: $channel"
note "Feed: $expected_feed_url"
note "Download: $download_url"
note "Output: $channel_output"

if [[ "$dry_run" == true ]]; then
    note "Dry run passed. No files were created and no network request was made."
    exit 0
fi

mkdir -p "$temporary_root"
work_dir="$(mktemp -d "$temporary_root/macos-direct-distribution.XXXXXX")"
cleanup() {
    rm -rf "$work_dir"
}
trap cleanup EXIT

app_copy="$work_dir/$bundle_name.app"
dmg_source="$work_dir/dmg-source"
dmg_path="$work_dir/$dmg_filename"
appcast_stage="$work_dir/appcast"
mkdir -p "$dmg_source" "$appcast_stage"

note "Copying and signing the app in temporary staging..."
ditto "$app_path" "$app_copy"
codesign --force --deep --options runtime --timestamp --sign "$signing_identity" "$app_copy"
codesign --verify --deep --strict --verbose=2 "$app_copy"
spctl --assess --type execute --verbose=2 "$app_copy"

ditto "$app_copy" "$dmg_source/$bundle_name.app"
ln -s /Applications "$dmg_source/Applications"

note "Creating and signing $dmg_filename..."
hdiutil create -volname "$bundle_name" -srcfolder "$dmg_source" -format UDZO -ov "$dmg_path"
codesign --force --timestamp --sign "$signing_identity" "$dmg_path"
codesign --verify --verbose=2 "$dmg_path"

note "Submitting the DMG for notarization..."
xcrun notarytool submit "$dmg_path" --keychain-profile "$notary_profile" --wait
xcrun stapler staple "$dmg_path"
xcrun stapler validate "$dmg_path"
spctl --assess --type open --context context:primary-signature --verbose=2 "$dmg_path"

if [[ -d "$channel_output" ]]; then
    ditto "$channel_output" "$appcast_stage"
fi
cp "$dmg_path" "$appcast_stage/$dmg_filename"

note "Generating the $channel Sparkle appcast..."
"$generate_appcast" \
    --download-url-prefix "$download_base_url/$channel/" \
    --link "$expected_feed_url" \
    "$appcast_stage"

appcast_path="$appcast_stage/appcast.xml"
[[ -f "$appcast_path" ]] || fail "Sparkle did not create appcast.xml."
grep -Fq "$expected_feed_url" "$appcast_path" || fail "The appcast does not contain the expected feed URL."
grep -Fq "$download_url" "$appcast_path" || fail "The appcast does not contain the expected DMG download URL."
grep -Fq "sparkle:edSignature=" "$appcast_path" || fail "The appcast has no Sparkle EdDSA signature."
grep -Fq ">$short_version<" "$appcast_path" || fail "The appcast does not contain version $short_version."
grep -Fq ">$build_version<" "$appcast_path" || fail "The appcast does not contain build $build_version."

mkdir -p "$channel_output"
ditto "$appcast_stage" "$channel_output"

dmg_hash="$(shasum -a 256 "$channel_output/$dmg_filename" | awk '{print $1}')"
manifest_path="$channel_output/release-manifest.txt"
cat >"$manifest_path" <<EOF
App: $bundle_name
Version: $short_version
Build: $build_version
Channel: $channel
Feed URL: $expected_feed_url
Download URL: $download_url
DMG: $dmg_filename
DMG SHA-256: $dmg_hash
Signing identity: $signing_identity
Notarization: accepted and stapled
Upload performed: no
EOF

codesign --verify --verbose=2 "$channel_output/$dmg_filename"
xcrun stapler validate "$channel_output/$dmg_filename"

note "Release prepared successfully in $channel_output"
note "No files were uploaded. Inspect the channel directory before publishing it over HTTPS."
