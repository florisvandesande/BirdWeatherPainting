#!/bin/bash

set -euo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
STATE_DIRECTORY="${REPOSITORY_ROOT}/.temporary/macos-appearance"
STATE_FILE="${STATE_DIRECTORY}/original-interface-style"

usage() {
    cat <<'USAGE'
Usage:
  .agents/scripts/macos-appearance.sh set <light|dark>
  .agents/scripts/macos-appearance.sh run <light|dark> -- <command> [arguments...]
  .agents/scripts/macos-appearance.sh status
  .agents/scripts/macos-appearance.sh restore

Use "set" for a manual browser or application session. Always run "restore"
afterward. Use "run" for a command-driven check; it restores the original
appearance automatically when the command exits, fails, or is interrupted.
USAGE
}

fail() {
    printf 'Error: %s\n' "$1" >&2
    exit 1
}

require_macos() {
    [ "$(uname -s)" = "Darwin" ] || fail "This script can only change the macOS appearance."
    command -v defaults >/dev/null 2>&1 || fail "The macOS defaults command is unavailable."
}

current_style() {
    local value

    if value="$(defaults read -g AppleInterfaceStyle 2>/dev/null)"; then
        printf '%s\n' "$value"
    else
        printf 'Light\n'
    fi
}

save_original_style() {
    local temporary_state_file
    local value

    mkdir -p "$STATE_DIRECTORY"

    if [ -f "$STATE_FILE" ]; then
        return 0
    fi

    temporary_state_file="$(mktemp "${STATE_DIRECTORY}/original-interface-style.XXXXXX")"
    if value="$(defaults read -g AppleInterfaceStyle 2>/dev/null)"; then
        {
            printf 'present\n'
            printf '%s\n' "$value"
        } > "$temporary_state_file"
    else
        {
            printf 'absent\n'
            printf '\n'
        } > "$temporary_state_file"
    fi
    mv -- "$temporary_state_file" "$STATE_FILE"
}

set_style() {
    case "$1" in
        dark)
            defaults write -g AppleInterfaceStyle -string Dark
            ;;
        light)
            defaults delete -g AppleInterfaceStyle >/dev/null 2>&1 || true
            ;;
        *)
            fail "Appearance must be light or dark."
            ;;
    esac
}

restore_style() {
    local presence
    local original_value

    if [ ! -f "$STATE_FILE" ]; then
        printf 'No saved macOS appearance state found; nothing to restore.\n'
        return 0
    fi

    {
        IFS= read -r presence
        IFS= read -r original_value || true
    } < "$STATE_FILE"

    case "$presence" in
        present)
            [ -n "$original_value" ] || fail "The saved macOS appearance state is invalid."
            defaults write -g AppleInterfaceStyle -string "$original_value"
            ;;
        absent)
            defaults delete -g AppleInterfaceStyle >/dev/null 2>&1 || true
            ;;
        *)
            fail "The saved macOS appearance state is invalid."
            ;;
    esac

    rm -f -- "$STATE_FILE"
    rmdir -- "$STATE_DIRECTORY" 2>/dev/null || true
    printf 'Restored macOS appearance to %s.\n' "$(current_style)"
}

begin_session() {
    save_original_style
    if ! set_style "$1"; then
        restore_style || true
        fail "Could not set the requested macOS appearance."
    fi
    printf 'Set macOS appearance to %s. Restart affected apps before testing.\n' "$1"
}

run_command() {
    local mode="$1"
    shift

    [ "$#" -ge 2 ] || fail "Use: run <light|dark> -- <command> [arguments...]"
    [ "$1" = "--" ] || fail "Use -- before the command to run."
    shift
    [ "$#" -gt 0 ] || fail "A command is required after --."

    begin_session "$mode"

    cleanup() {
        local command_status="$?"
        local restore_status=0

        trap - EXIT INT TERM
        restore_style || restore_status=$?
        if [ "$restore_status" -ne 0 ]; then
            printf 'Error: macOS appearance could not be restored.\n' >&2
            [ "$command_status" -eq 0 ] && command_status="$restore_status"
        fi
        exit "$command_status"
    }

    trap cleanup EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    "$@"
}

require_macos

command_name="${1:-}"
case "$command_name" in
    set)
        [ "$#" -eq 2 ] || fail "Use: set <light|dark>"
        begin_session "$2"
        ;;
    run)
        [ "$#" -ge 4 ] || fail "Use: run <light|dark> -- <command> [arguments...]"
        run_command "$2" "${@:3}"
        ;;
    status)
        [ "$#" -eq 1 ] || fail "Use: status"
        printf 'Current macOS appearance: %s.\n' "$(current_style)"
        if [ -f "$STATE_FILE" ]; then
            printf 'Saved state available: yes. Run restore after testing.\n'
        else
            printf 'Saved state available: no.\n'
        fi
        ;;
    restore)
        [ "$#" -eq 1 ] || fail "Use: restore"
        restore_style
        ;;
    help|--help|-h)
        [ "$#" -eq 1 ] || fail "Use: --help"
        usage
        ;;
    *)
        usage >&2
        exit 1
        ;;
esac
