#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

###############################################################################
# Repository configuration
#
# Set XCODE_CONTAINER_PATH and SCHEME when adding an iOS app to the repository.
# XCODE_CONTAINER_PATH must point to one .xcodeproj or .xcworkspace inside this
# repository. Relative paths are resolved from the repository root.
###############################################################################
XCODE_CONTAINER_PATH=""
SCHEME=""
CONFIGURATION="Debug"
DEVELOPMENT_TEAM=""

# Build output, logs, and retry policy. These defaults normally need no changes.
DERIVED_DATA_PATH="$REPO_ROOT/.temporary/ios-deploy/DerivedData"
LOG_DIR="$REPO_ROOT/.temporary/logs"
TMP_ROOT="$REPO_ROOT/.temporary/ios-deploy/tmp"
COREDEVICE_RETRIES=3
COREDEVICE_RETRY_DELAY_SECONDS=2
COREDEVICE_LIST_TIMEOUT_SECONDS=10
XCODEBUILD_RETRIES=2
POST_INSTALL_RETRIES=3
POST_INSTALL_TIMEOUT_SECONDS=30

DEVICE_IDENTIFIER=""
LIST_ONLY=0
DEVICES_JSON=""
USB_JSON=""
LOG_FILE=""

usage() {
    cat <<'EOF'
Build and deploy this repository's iOS app to a physical iPhone or iPad.

Usage:
  ./.agents/scripts/deploy_ios_to_device.sh --device DEVICE_IDENTIFIER [options]
  ./.agents/scripts/deploy_ios_to_device.sh --list

Options:
  --device IDENTIFIER     Exact CoreDevice identifier. Required for deployment.
  --configuration NAME   Override the configured Xcode build configuration.
  --list                 List paired physical iPhones and iPads, then exit.
  -h, --help             Show this help message.

Repository setup:
  Edit the "Repository configuration" block near the top of this script and set:
    XCODE_CONTAINER_PATH  Relative path to one .xcodeproj or .xcworkspace.
    SCHEME                Name of a shared Xcode scheme.
    CONFIGURATION         Build configuration; defaults to Debug.
    DEVELOPMENT_TEAM      Optional Apple Developer team identifier.

The selected device must be unlocked, trusted by this Mac, have Developer Mode
enabled, and be connected over USB or available through paired Wi-Fi.
EOF
}

fail() {
    printf 'Error: %s\n' "$*" >&2
    exit 1
}

cleanup() {
    [[ -z "$DEVICES_JSON" || ! -e "$DEVICES_JSON" ]] || rm -f "$DEVICES_JSON"
    [[ -z "$USB_JSON" || ! -e "$USB_JSON" ]] || rm -f "$USB_JSON"
}

trap cleanup EXIT INT TERM

require_command() {
    command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

require_positive_integer() {
    local name="$1"
    local value="$2"
    if [[ ! "$value" =~ ^[1-9][0-9]*$ ]]; then
        fail "$name must be a positive integer; received '$value'."
    fi
}

validate_runtime_configuration() {
    require_positive_integer "COREDEVICE_RETRIES" "$COREDEVICE_RETRIES"
    [[ "$COREDEVICE_RETRY_DELAY_SECONDS" =~ ^[0-9]+$ ]] || \
        fail "COREDEVICE_RETRY_DELAY_SECONDS must be zero or a positive integer."
    require_positive_integer "COREDEVICE_LIST_TIMEOUT_SECONDS" "$COREDEVICE_LIST_TIMEOUT_SECONDS"
    require_positive_integer "XCODEBUILD_RETRIES" "$XCODEBUILD_RETRIES"
    require_positive_integer "POST_INSTALL_RETRIES" "$POST_INSTALL_RETRIES"
    require_positive_integer "POST_INSTALL_TIMEOUT_SECONDS" "$POST_INSTALL_TIMEOUT_SECONDS"
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --device)
                [[ $# -ge 2 ]] || fail "--device requires an identifier."
                DEVICE_IDENTIFIER="$2"
                shift 2
                ;;
            --device=*)
                DEVICE_IDENTIFIER="${1#*=}"
                shift
                ;;
            --configuration)
                [[ $# -ge 2 ]] || fail "--configuration requires a name."
                CONFIGURATION="$2"
                shift 2
                ;;
            --configuration=*)
                CONFIGURATION="${1#*=}"
                shift
                ;;
            --list)
                LIST_ONLY=1
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                printf 'Unknown option: %s\n\n' "$1" >&2
                usage >&2
                exit 2
                ;;
        esac
    done

    [[ -n "$CONFIGURATION" ]] || fail "The build configuration cannot be empty."
    if [[ "$LIST_ONLY" -eq 0 && -z "$DEVICE_IDENTIFIER" ]]; then
        printf 'A device identifier is required for deployment.\n\n' >&2
        usage >&2
        exit 2
    fi
    validate_runtime_configuration
}

initialize_runtime() {
    mkdir -p "$DERIVED_DATA_PATH" "$LOG_DIR" "$TMP_ROOT"
    DEVICES_JSON="$(mktemp "$TMP_ROOT/devices.XXXXXX")"
    USB_JSON="$(mktemp "$TMP_ROOT/usb.XXXXXX")"
}

start_deployment_log() {
    LOG_FILE="$LOG_DIR/ios-deploy-$(date '+%Y-%m-%d_%H-%M-%S').log"
    touch "$LOG_FILE"
    exec > >(tee -a "$LOG_FILE") 2>&1
    printf 'Deployment log: %s\n' "$LOG_FILE"
}

validate_platform_and_tools() {
    [[ "$(uname -s)" == "Darwin" ]] || fail "iOS device deployment requires macOS."

    require_command xcodebuild
    require_command xcrun
    require_command xcode-select
    require_command /usr/bin/python3
    require_command /usr/libexec/PlistBuddy
    require_command codesign
    require_command security
    require_command system_profiler

    xcode-select -p >/dev/null 2>&1 || fail "Xcode Command Line Tools are not configured. Open Xcode once, or select Xcode with xcode-select."
    xcrun --find devicectl >/dev/null 2>&1 || fail "devicectl is unavailable. Install or select a recent Xcode version."
}

write_devices_json() {
    local attempt=1
    local output_file
    local exit_code

    output_file="$(mktemp "$TMP_ROOT/devicectl-list.XXXXXX")"
    while [[ "$attempt" -le "$COREDEVICE_RETRIES" ]]; do
        : >"$DEVICES_JSON"
        set +e
        run_devicectl_timed "$COREDEVICE_LIST_TIMEOUT_SECONDS" \
            list devices --json-output "$DEVICES_JSON" >"$output_file" 2>&1
        exit_code=$?
        set -e

        if [[ "$exit_code" -eq 0 ]] && /usr/bin/python3 - "$DEVICES_JSON" <<'PY' >/dev/null 2>&1
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
if not isinstance(payload.get("result", {}).get("devices"), list):
    raise SystemExit(1)
PY
        then
            rm -f "$output_file"
            return 0
        fi

        if [[ "$attempt" -lt "$COREDEVICE_RETRIES" ]]; then
            printf 'CoreDevice is not ready (%s/%s); retrying in %ss...\n' \
                "$attempt" "$COREDEVICE_RETRIES" "$COREDEVICE_RETRY_DELAY_SECONDS" >&2
            sleep "$COREDEVICE_RETRY_DELAY_SECONDS"
        fi
        attempt=$((attempt + 1))
    done

    cat "$output_file" >&2
    rm -f "$output_file"
    fail "Unable to read devices from CoreDevice after $COREDEVICE_RETRIES attempts. Open Xcode, confirm the device appears, and try again."
}

write_usb_json() {
    if ! system_profiler -json SPUSBDataType >"$USB_JSON" 2>/dev/null; then
        printf '{"SPUSBDataType": []}\n' >"$USB_JSON"
        printf 'Warning: USB topology could not be read; reachable devices will be reported as wireless.\n' >&2
    fi
}

print_physical_ios_devices() {
    /usr/bin/python3 - "$DEVICES_JSON" "$USB_JSON" <<'PY'
import json
import sys
from pathlib import Path


def strings(value):
    if isinstance(value, dict):
        for key, nested in value.items():
            if key in {"_name", "serial_num", "serialNumber"} and isinstance(nested, str):
                yield nested.casefold()
            yield from strings(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from strings(nested)


devices_payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
usb_payload = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
usb_values = set(strings(usb_payload.get("SPUSBDataType", [])))

rows = []
for device in devices_payload.get("result", {}).get("devices", []):
    hardware = device.get("hardwareProperties", {})
    properties = device.get("deviceProperties", {})
    connection = device.get("connectionProperties", {})
    product_type = str(hardware.get("productType", ""))
    if hardware.get("reality") != "physical" or not product_type.startswith(("iPhone", "iPad")):
        continue

    identifier = str(device.get("identifier", ""))
    if not identifier:
        continue
    name = str(properties.get("name") or device.get("name") or "Unnamed device")
    state = str(connection.get("tunnelState") or connection.get("state") or device.get("state") or "unknown")
    possible_usb_values = {
        name.casefold(),
        str(properties.get("udid", "")).casefold(),
        str(hardware.get("udid", "")).casefold(),
        str(hardware.get("serialNumber", "")).casefold(),
    }
    possible_usb_values.discard("")
    connection_kind = "wired" if possible_usb_values & usb_values else "wireless"
    rows.append((name, identifier, product_type, state, connection_kind))

if not rows:
    print("No paired physical iPhone or iPad was found.")
else:
    print("NAME\tIDENTIFIER\tMODEL\tSTATE\tCONNECTION")
    for row in sorted(rows, key=lambda item: (item[0].casefold(), item[1])):
        print("\t".join(row))
PY
}

validate_selected_device() {
    local result

    set +e
    result="$(/usr/bin/python3 - "$DEVICES_JSON" "$USB_JSON" "$DEVICE_IDENTIFIER" <<'PY'
import json
import sys
from pathlib import Path


def strings(value):
    if isinstance(value, dict):
        for key, nested in value.items():
            if key in {"_name", "serial_num", "serialNumber"} and isinstance(nested, str):
                yield nested.casefold()
            yield from strings(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from strings(nested)


devices_payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
usb_payload = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
identifier = sys.argv[3]
devices = devices_payload.get("result", {}).get("devices", [])
matches = [device for device in devices if str(device.get("identifier", "")) == identifier]

if not matches:
    print(f"No device has the exact CoreDevice identifier '{identifier}'. Run with --list to see valid identifiers.", file=sys.stderr)
    raise SystemExit(10)
if len(matches) != 1:
    print(f"CoreDevice returned more than one device for identifier '{identifier}'.", file=sys.stderr)
    raise SystemExit(11)

device = matches[0]
hardware = device.get("hardwareProperties", {})
properties = device.get("deviceProperties", {})
connection = device.get("connectionProperties", {})
name = str(properties.get("name") or device.get("name") or "Unnamed device")
product_type = str(hardware.get("productType", ""))

if hardware.get("reality") != "physical":
    print(f"'{name}' is not a physical device. Simulators are not accepted.", file=sys.stderr)
    raise SystemExit(12)
if not product_type.startswith(("iPhone", "iPad")):
    print(f"'{name}' ({product_type or 'unknown model'}) is not a supported physical iPhone or iPad.", file=sys.stderr)
    raise SystemExit(13)

state = str(connection.get("tunnelState") or connection.get("state") or device.get("state") or "unknown")
if state.casefold() not in {"available", "connected", "available (paired)"}:
    print(
        f"'{name}' is not ready for deployment (state: {state}). Unlock it and check its USB or paired Wi-Fi connection.",
        file=sys.stderr,
    )
    raise SystemExit(14)

usb_values = set(strings(usb_payload.get("SPUSBDataType", [])))
possible_usb_values = {
    name.casefold(),
    str(properties.get("udid", "")).casefold(),
    str(hardware.get("udid", "")).casefold(),
    str(hardware.get("serialNumber", "")).casefold(),
}
possible_usb_values.discard("")
connection_kind = "wired" if possible_usb_values & usb_values else "wireless"
print(f"{name}\t{product_type}\t{state}\t{connection_kind}")
PY
)"
    local exit_code=$?
    set -e

    [[ "$exit_code" -eq 0 ]] || exit "$exit_code"
    IFS=$'\t' read -r DEVICE_NAME DEVICE_MODEL DEVICE_STATE DEVICE_CONNECTION <<<"$result"
    printf 'Selected device: %s (%s)\n' "$DEVICE_NAME" "$DEVICE_MODEL"
    printf 'Connection: %s (CoreDevice state: %s)\n' "$DEVICE_CONNECTION" "$DEVICE_STATE"
}

resolve_container_path() {
    local configured_path

    [[ -n "$XCODE_CONTAINER_PATH" ]] || fail "XCODE_CONTAINER_PATH is empty. Configure the script before deploying."
    [[ -n "$SCHEME" ]] || fail "SCHEME is empty. Configure the script before deploying."

    if [[ "$XCODE_CONTAINER_PATH" == /* ]]; then
        configured_path="$XCODE_CONTAINER_PATH"
    else
        configured_path="$REPO_ROOT/$XCODE_CONTAINER_PATH"
    fi

    [[ -e "$configured_path" ]] || fail "Configured Xcode container does not exist: $configured_path"
    CONTAINER_PATH="$(/usr/bin/python3 - "$configured_path" <<'PY'
import sys
from pathlib import Path

print(Path(sys.argv[1]).resolve())
PY
)"

    case "$CONTAINER_PATH" in
        "$REPO_ROOT"/*) ;;
        *) fail "XCODE_CONTAINER_PATH must resolve inside the current repository: $REPO_ROOT" ;;
    esac

    case "$CONTAINER_PATH" in
        *.xcodeproj) CONTAINER_ARGUMENT=(-project "$CONTAINER_PATH") ;;
        *.xcworkspace) CONTAINER_ARGUMENT=(-workspace "$CONTAINER_PATH") ;;
        *) fail "XCODE_CONTAINER_PATH must end in .xcodeproj or .xcworkspace." ;;
    esac
}

validate_shared_scheme() {
    local schemes_json
    schemes_json="$(mktemp "$TMP_ROOT/schemes.XXXXXX")"

    if ! xcodebuild "${CONTAINER_ARGUMENT[@]}" -list -json >"$schemes_json" 2>/dev/null; then
        rm -f "$schemes_json"
        fail "Xcode could not read the configured project or workspace."
    fi

    if ! /usr/bin/python3 - "$schemes_json" "$SCHEME" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
scheme = sys.argv[2]
containers = [value for value in payload.values() if isinstance(value, dict)]
schemes = {item for container in containers for item in container.get("schemes", [])}
if scheme not in schemes:
    print("Configured scheme was not found. Available schemes: " + (", ".join(sorted(schemes)) or "none"), file=sys.stderr)
    raise SystemExit(1)
PY
    then
        rm -f "$schemes_json"
        fail "SCHEME '$SCHEME' is unavailable. Ensure it is shared and committed to the repository."
    fi
    rm -f "$schemes_json"
}

build_xcode_arguments() {
    XCODE_ARGUMENTS=(
        "${CONTAINER_ARGUMENT[@]}"
        -scheme "$SCHEME"
        -configuration "$CONFIGURATION"
        -destination "generic/platform=iOS"
        -derivedDataPath "$DERIVED_DATA_PATH"
        -allowProvisioningUpdates
        -allowProvisioningDeviceRegistration
    )
    if [[ -n "$DEVELOPMENT_TEAM" ]]; then
        XCODE_ARGUMENTS+=(DEVELOPMENT_TEAM="$DEVELOPMENT_TEAM")
    fi
}

print_signing_help() {
    cat <<'EOF' >&2

Signing or provisioning failed. Check the following:
1. Open the configured project or workspace in Xcode.
2. Select the app target and enable "Automatically manage signing".
3. Select a valid Apple Developer team.
4. Confirm that the device is registered for development.
5. Unlock the device, trust this Mac, and enable Developer Mode.
EOF
}

run_xcodebuild() {
    local attempt=1
    local output_file
    local exit_code

    output_file="$(mktemp "$TMP_ROOT/xcodebuild.XXXXXX")"
    while [[ "$attempt" -le "$XCODEBUILD_RETRIES" ]]; do
        printf 'Building scheme %s (%s), attempt %s/%s...\n' \
            "$SCHEME" "$CONFIGURATION" "$attempt" "$XCODEBUILD_RETRIES"
        set +e
        xcodebuild "${XCODE_ARGUMENTS[@]}" build 2>&1 | tee "$output_file"
        exit_code=${PIPESTATUS[0]}
        set -e

        if [[ "$exit_code" -eq 0 ]]; then
            rm -f "$output_file"
            return 0
        fi

        if rg -qi 'code sign|codesign|provisioning profile|requires a development team|no signing certificate|developer mode' "$output_file" 2>/dev/null || \
           grep -Eqi 'code sign|codesign|provisioning profile|requires a development team|no signing certificate|developer mode' "$output_file"; then
            print_signing_help
            rm -f "$output_file"
            return "$exit_code"
        fi

        if [[ "$attempt" -lt "$XCODEBUILD_RETRIES" ]]; then
            printf 'xcodebuild failed; retrying once after a short delay...\n' >&2
            sleep 2
        fi
        attempt=$((attempt + 1))
    done

    rm -f "$output_file"
    return "$exit_code"
}

resolve_built_app() {
    local settings_json
    settings_json="$(mktemp "$TMP_ROOT/build-settings.XXXXXX")"

    xcodebuild "${XCODE_ARGUMENTS[@]}" -showBuildSettings -json >"$settings_json"
    APP_PATH="$(/usr/bin/python3 - "$settings_json" <<'PY'
import json
import sys
from pathlib import Path

entries = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
candidates = []
for entry in entries:
    settings = entry.get("buildSettings", {})
    full_product_name = str(settings.get("FULL_PRODUCT_NAME", ""))
    target_build_dir = str(settings.get("TARGET_BUILD_DIR", ""))
    product_type = str(settings.get("PRODUCT_TYPE", ""))
    if full_product_name.endswith(".app") and target_build_dir and product_type == "com.apple.product-type.application":
        candidates.append(str(Path(target_build_dir) / full_product_name))

existing = [candidate for candidate in candidates if Path(candidate).is_dir()]
selected = existing or candidates
if len(selected) != 1:
    print(
        "Expected exactly one built iOS application, found " + str(len(selected)) + ". Candidates: " + (", ".join(selected) or "none"),
        file=sys.stderr,
    )
    raise SystemExit(1)
print(selected[0])
PY
)" || {
        rm -f "$settings_json"
        fail "Unable to determine a unique built .app from Xcode build settings."
    }
    rm -f "$settings_json"

    [[ -d "$APP_PATH" ]] || fail "The build completed, but the app bundle was not found: $APP_PATH"
}

resolve_device_udid() {
    local details
    details="$(xcrun devicectl device info details --device "$DEVICE_IDENTIFIER" 2>/dev/null || true)"
    DEVICE_UDID="$(printf '%s\n' "$details" | awk '/udid:/ { print $NF; exit }')"
}

validate_provisioning_profiles() {
    /usr/bin/python3 - "$APP_PATH" "$DEVICE_UDID" <<'PY'
import datetime as dt
import plistlib
import subprocess
import sys
from pathlib import Path

app_path = Path(sys.argv[1])
device_udid = sys.argv[2]
profiles = []
host_profile = app_path / "embedded.mobileprovision"
if host_profile.is_file():
    profiles.append(host_profile)
plugins = app_path / "PlugIns"
if plugins.is_dir():
    profiles.extend(sorted(plugins.glob("*.appex/embedded.mobileprovision")))

for profile_path in profiles:
    result = subprocess.run(
        ["security", "cms", "-D", "-i", str(profile_path)],
        check=False,
        capture_output=True,
    )
    if result.returncode != 0:
        print(f"Unable to decode embedded provisioning profile: {profile_path}", file=sys.stderr)
        raise SystemExit(1)
    profile = plistlib.loads(result.stdout)
    expiration = profile.get("ExpirationDate")
    if not isinstance(expiration, dt.datetime):
        print(f"Provisioning profile has no valid expiration date: {profile_path}", file=sys.stderr)
        raise SystemExit(1)
    now = dt.datetime.now(expiration.tzinfo) if expiration.tzinfo else dt.datetime.now()
    if expiration <= now:
        print(f"Provisioning profile expired at {expiration.isoformat()}: {profile_path}", file=sys.stderr)
        raise SystemExit(1)

    provisioned_devices = profile.get("ProvisionedDevices") or []
    if device_udid and provisioned_devices and device_udid not in provisioned_devices:
        print(f"The embedded provisioning profile does not contain device UDID {device_udid}: {profile_path}", file=sys.stderr)
        raise SystemExit(1)
    print(f"Provisioning profile valid until {expiration.isoformat()}: {profile_path.name}")

if not profiles:
    print("No embedded development provisioning profile found; relying on the successful code-signature check.")
PY
}

validate_built_app() {
    local info_plist="$APP_PATH/Info.plist"
    [[ -f "$info_plist" ]] || fail "The built app has no Info.plist: $info_plist"

    BUNDLE_IDENTIFIER="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$info_plist" 2>/dev/null || true)"
    [[ -n "$BUNDLE_IDENTIFIER" ]] || fail "The built app has no CFBundleIdentifier."

    codesign --verify --deep --strict "$APP_PATH" || {
        print_signing_help
        fail "Code-signature verification failed for $APP_PATH"
    }

    resolve_device_udid
    validate_provisioning_profiles || {
        print_signing_help
        fail "Embedded provisioning-profile validation failed."
    }
    printf 'Validated app: %s (%s)\n' "$APP_PATH" "$BUNDLE_IDENTIFIER"
}

run_devicectl_timed() {
    local timeout_seconds="$1"
    shift

    local output_file
    local command_pid
    local elapsed=0
    local exit_code=0

    output_file="$(mktemp "$TMP_ROOT/devicectl-command.XXXXXX")"
    xcrun devicectl "$@" >"$output_file" 2>&1 &
    command_pid=$!

    while kill -0 "$command_pid" 2>/dev/null; do
        if [[ "$elapsed" -ge "$timeout_seconds" ]]; then
            kill "$command_pid" 2>/dev/null || true
            wait "$command_pid" 2>/dev/null || true
            cat "$output_file"
            rm -f "$output_file"
            return 124
        fi
        sleep 1
        elapsed=$((elapsed + 1))
    done

    wait "$command_pid" || exit_code=$?
    cat "$output_file"
    rm -f "$output_file"
    return "$exit_code"
}

run_post_install_step() {
    local label="$1"
    shift

    local attempt=1
    local output
    local exit_code

    while [[ "$attempt" -le "$POST_INSTALL_RETRIES" ]]; do
        set +e
        output="$(run_devicectl_timed "$POST_INSTALL_TIMEOUT_SECONDS" "$@" 2>&1)"
        exit_code=$?
        set -e

        if [[ "$exit_code" -eq 0 ]]; then
            [[ -z "$output" ]] || printf '%s\n' "$output"
            return 0
        fi

        if [[ "$output" == *"invalid code signature"* || "$output" == *"inadequate entitlements"* || \
              "$output" == *"profile has not been explicitly trusted"* || "$output" == *"Security ("* ]]; then
            printf '%s\n' "$output" >&2
            print_signing_help
            return "$exit_code"
        fi

        printf '%s failed (%s/%s, exit %s).\n' "$label" "$attempt" "$POST_INSTALL_RETRIES" "$exit_code" >&2
        [[ -z "$output" ]] || printf '%s\n' "$output" >&2
        if [[ "$attempt" -lt "$POST_INSTALL_RETRIES" ]]; then
            sleep 2
        fi
        attempt=$((attempt + 1))
    done
    return "$exit_code"
}

deploy_app() {
    printf 'Installing %s...\n' "$APP_PATH"
    run_post_install_step "Installation" device install app --device "$DEVICE_IDENTIFIER" "$APP_PATH" || \
        fail "The app could not be installed on the selected device."

    printf 'Launching %s...\n' "$BUNDLE_IDENTIFIER"
    run_post_install_step "Launch" device process launch --device "$DEVICE_IDENTIFIER" --terminate-existing "$BUNDLE_IDENTIFIER" || \
        fail "The app was installed but could not be launched. Unlock the device and try again."

    printf 'Verifying installation...\n'
    run_post_install_step "Verification" device info apps --device "$DEVICE_IDENTIFIER" --bundle-id "$BUNDLE_IDENTIFIER" || \
        fail "The app launch completed, but installation verification failed."
}

main() {
    parse_arguments "$@"
    validate_platform_and_tools
    initialize_runtime
    write_devices_json
    write_usb_json

    if [[ "$LIST_ONLY" -eq 1 ]]; then
        print_physical_ios_devices
        exit 0
    fi

    validate_selected_device
    resolve_container_path
    validate_shared_scheme
    build_xcode_arguments
    start_deployment_log
    printf 'Selected device: %s (%s)\n' "$DEVICE_NAME" "$DEVICE_MODEL"
    printf 'Connection: %s (CoreDevice state: %s)\n' "$DEVICE_CONNECTION" "$DEVICE_STATE"
    run_xcodebuild || fail "The iOS build failed."
    resolve_built_app
    validate_built_app
    deploy_app

    printf '\nDeployment succeeded: %s is installed and running on %s.\n' "$BUNDLE_IDENTIFIER" "$DEVICE_NAME"
    printf 'Log saved to: %s\n' "$LOG_FILE"
}

main "$@"
