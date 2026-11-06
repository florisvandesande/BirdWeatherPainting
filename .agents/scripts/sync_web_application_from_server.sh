#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPOSITORY_ROOT="$(cd "$SCRIPT_DIRECTORY/.." && pwd -P)"
DEFAULT_CONFIG_PATH="$REPOSITORY_ROOT/.server-sync/config.sh"

CONFIG_PATH="$DEFAULT_CONFIG_PATH"
DRY_RUN=0
ASSUME_YES=0
TEMP_WORK_DIRECTORY=""
TEMPORARY_DATABASE_PATH=""
SERVER_SNAPSHOT_PATH=""
BACKUP_DATE=""

fail() {
    printf 'Error: %s\n' "$*" >&2
    exit 1
}

info() {
    printf '%s\n' "$*"
}

usage() {
    cat <<'EOF'
Synchronise a web application from a remote server into this repository.

Usage:
  ./scripts/sync_web_application_from_server.sh [options]

Options:
  --config FILE       Read project-specific settings from FILE.
  --dry-run           Validate the configuration and print planned actions.
  --yes               Skip the confirmation prompt before repository changes.
  -h, --help          Show this help message.

The default configuration file is:
  .server-sync/config.sh

The configuration must use an SSH host or SSH configuration alias. Passwords,
private keys, and other credentials must remain outside the repository.
EOF
}

cleanup() {
    if [[ -n "$TEMP_WORK_DIRECTORY" && -e "$TEMP_WORK_DIRECTORY" ]]; then
        rm -rf "$TEMP_WORK_DIRECTORY"
    fi
}

trap cleanup EXIT INT TERM

require_command() {
    command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --config)
                [[ $# -ge 2 ]] || fail "--config requires a file path."
                CONFIG_PATH="$2"
                shift 2
                ;;
            --config=*)
                CONFIG_PATH="${1#*=}"
                shift
                ;;
            --dry-run)
                DRY_RUN=1
                shift
                ;;
            --yes)
                ASSUME_YES=1
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
}

load_configuration() {
    local line
    local key
    local value

    [[ -f "$CONFIG_PATH" ]] || fail "Configuration file not found: $CONFIG_PATH. Copy .server-sync/config.example.sh to .server-sync/config.sh and edit its values."
    [[ -r "$CONFIG_PATH" ]] || fail "Configuration file is not readable: $CONFIG_PATH"

    SSH_TARGET=""
    REMOTE_WEB_SOURCE=""
    REPOSITORY_WEB_DIRECTORY=""
    SERVER_BACKUP_DIRECTORY=""
    SYNC_DATABASE="0"
    REMOTE_DATABASE_SOURCE=""
    REPOSITORY_DATABASE_PATH=""
    DATABASE_BACKUP_DIRECTORY=""

    # Parse a deliberately small KEY=VALUE format instead of sourcing the
    # configuration. A configuration file is input and must not execute shell
    # code merely because it was passed with --config.
    while IFS= read -r line || [[ -n "$line" ]]; do
        line="${line%$'\r'}"
        case "$line" in
            ""|\#*)
                continue
                ;;
        esac

        [[ "$line" == *=* ]] || fail "Invalid configuration line in $CONFIG_PATH: $line"
        key="${line%%=*}"
        value="${line#*=}"
        [[ "$key" =~ ^[A-Z_][A-Z0-9_]*$ ]] || fail "Invalid configuration key in $CONFIG_PATH: $key"
        value="$(parse_config_value "$value")"

        case "$key" in
            SSH_TARGET) SSH_TARGET="$value" ;;
            REMOTE_WEB_SOURCE) REMOTE_WEB_SOURCE="$value" ;;
            REPOSITORY_WEB_DIRECTORY) REPOSITORY_WEB_DIRECTORY="$value" ;;
            SERVER_BACKUP_DIRECTORY) SERVER_BACKUP_DIRECTORY="$value" ;;
            SYNC_DATABASE) SYNC_DATABASE="$value" ;;
            REMOTE_DATABASE_SOURCE) REMOTE_DATABASE_SOURCE="$value" ;;
            REPOSITORY_DATABASE_PATH) REPOSITORY_DATABASE_PATH="$value" ;;
            DATABASE_BACKUP_DIRECTORY) DATABASE_BACKUP_DIRECTORY="$value" ;;
            *) fail "Unknown configuration key in $CONFIG_PATH: $key" ;;
        esac
    done < "$CONFIG_PATH"
}

parse_config_value() {
    local value="$1"

    case "$value" in
        \"*\")
            value="${value#\"}"
            value="${value%\"}"
            ;;
        \'*\')
            value="${value#\'}"
            value="${value%\'}"
            ;;
        *\"*|*\'*)
            fail "Configuration values with quotes must be enclosed consistently in $CONFIG_PATH"
            ;;
    esac

    printf '%s' "$value"
}

trim_trailing_slashes() {
    local value="$1"
    while [[ "$value" != "/" && "$value" == */ ]]; do
        value="${value%/}"
    done
    printf '%s' "$value"
}

path_from_repository_root() {
    local value="$1"
    if [[ "$value" == /* ]]; then
        printf '%s' "$value"
    else
        printf '%s/%s' "$REPOSITORY_ROOT" "$value"
    fi
}

resolve_path() {
    local value="$1"
    local absolute_path
    local current_path
    local suffix=""
    local component
    local parent_path
    local resolved_base

    [[ -n "$value" ]] || fail "A configured path cannot be empty."
    absolute_path="$(trim_trailing_slashes "$(path_from_repository_root "$value")")"
    [[ -n "$absolute_path" ]] || fail "A configured path cannot resolve to an empty path."

    if [[ -e "$absolute_path" && ! -d "$absolute_path" ]]; then
        parent_path="$(dirname "$absolute_path")"
        [[ -d "$parent_path" ]] || fail "The parent directory does not exist: $parent_path"
        resolved_base="$(cd "$parent_path" && pwd -P)"
        printf '%s/%s' "$resolved_base" "$(basename "$absolute_path")"
        return
    fi

    current_path="$absolute_path"
    while [[ ! -e "$current_path" ]]; do
        component="$(basename "$current_path")"
        suffix="/$component$suffix"
        parent_path="$(dirname "$current_path")"
        [[ "$parent_path" != "$current_path" ]] || fail "Unable to resolve path: $value"
        current_path="$parent_path"
    done

    [[ -d "$current_path" ]] || fail "The existing path is not a directory: $current_path"
    resolved_base="$(cd "$current_path" && pwd -P)"
    printf '%s%s' "$resolved_base" "$suffix"
}

nearest_existing_directory() {
    local value="$1"
    local current_path
    local parent_path

    current_path="$value"
    while [[ ! -d "$current_path" ]]; do
        parent_path="$(dirname "$current_path")"
        [[ "$parent_path" != "$current_path" ]] || fail "Unable to find an existing parent directory for: $value"
        current_path="$parent_path"
    done
    cd "$current_path" && pwd -P
}

path_is_inside_repository() {
    local value="$1"
    case "$value" in
        "$REPOSITORY_ROOT"|"$REPOSITORY_ROOT"/*)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

path_is_same_or_within() {
    local parent_path="$1"
    local candidate_path="$2"

    case "$candidate_path" in
        "$parent_path"|"$parent_path"/*)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

path_is_protected() {
    local value="$1"
    case "$value" in
        "$REPOSITORY_ROOT/.git"|"$REPOSITORY_ROOT/.git"/*|\
        "$REPOSITORY_ROOT/.sync"|"$REPOSITORY_ROOT/.sync"/*|\
        "$REPOSITORY_ROOT/.temporary"|"$REPOSITORY_ROOT/.temporary"/*|\
        "$REPOSITORY_ROOT/.server-sync"|"$REPOSITORY_ROOT/.server-sync"/*)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

validate_repository_directory() {
    local configured_value="$1"
    local label="$2"
    local resolved_path

    resolved_path="$(resolve_path "$configured_value")"
    [[ -d "$resolved_path" ]] || fail "$label must be an existing directory: $configured_value"
    [[ -r "$resolved_path" ]] || fail "$label is not readable: $configured_value"
    [[ -w "$resolved_path" ]] || fail "$label is not writable: $configured_value"
    path_is_inside_repository "$resolved_path" || fail "$label must be inside the repository: $configured_value"
    [[ "$resolved_path" != "$REPOSITORY_ROOT" ]] || fail "$label cannot be the repository root."
    path_is_protected "$resolved_path" && fail "$label cannot target repository metadata or temporary files: $configured_value"

    printf '%s' "$resolved_path"
}

validate_repository_file_destination() {
    local configured_value="$1"
    local label="$2"
    local configured_path
    local resolved_path
    local parent_path

    configured_path="$(path_from_repository_root "$configured_value")"
    [[ ! -L "$configured_path" ]] || fail "$label cannot be a symbolic link: $configured_value"
    resolved_path="$(resolve_path "$configured_value")"
    parent_path="$(dirname "$resolved_path")"
    [[ -d "$parent_path" ]] || fail "$label parent directory does not exist: $parent_path"
    [[ -w "$parent_path" ]] || fail "$label parent directory is not writable: $parent_path"
    path_is_inside_repository "$resolved_path" || fail "$label must be inside the repository: $configured_value"
    path_is_protected "$resolved_path" && fail "$label cannot target repository metadata or temporary files: $configured_value"

    printf '%s' "$resolved_path"
}

validate_external_backup_directory() {
    local configured_value="$1"
    local label="$2"
    local absolute_path
    local resolved_path
    local parent_path

    [[ "$configured_value" == /* ]] || fail "$label must be an absolute path outside the repository: $configured_value"
    absolute_path="$(trim_trailing_slashes "$configured_value")"
    [[ "$absolute_path" != "/" ]] || fail "$label cannot be the filesystem root."

    if [[ -e "$absolute_path" ]]; then
        [[ -d "$absolute_path" ]] || fail "$label must be a directory: $configured_value"
        [[ -w "$absolute_path" ]] || fail "$label is not writable: $configured_value"
    else
        parent_path="$(nearest_existing_directory "$(dirname "$absolute_path")")"
        [[ -w "$parent_path" ]] || fail "$label parent directory is not writable: $parent_path"
    fi

    resolved_path="$(resolve_path "$absolute_path")"
    path_is_inside_repository "$resolved_path" && fail "$label must remain outside the repository: $configured_value"
    printf '%s' "$resolved_path"
}

validate_remote_path() {
    local label="$1"
    local value="$2"
    [[ -n "$value" ]] || fail "$label is required in $CONFIG_PATH"
    [[ "$value" == /* ]] || fail "$label must be an absolute remote path: $value"
    [[ "$value" != "/" ]] || fail "$label cannot be the remote filesystem root."
}

validate_configuration() {
    [[ -n "$SSH_TARGET" ]] || fail "SSH_TARGET is required in $CONFIG_PATH"
    [[ "$SSH_TARGET" != *[[:space:]]* ]] || fail "SSH_TARGET must be an SSH host, user@host, or SSH configuration alias without spaces."
    validate_remote_path "REMOTE_WEB_SOURCE" "$REMOTE_WEB_SOURCE"
    [[ -n "$REPOSITORY_WEB_DIRECTORY" ]] || fail "REPOSITORY_WEB_DIRECTORY is required in $CONFIG_PATH"
    [[ -n "$SERVER_BACKUP_DIRECTORY" ]] || fail "SERVER_BACKUP_DIRECTORY is required in $CONFIG_PATH"
    [[ "$SYNC_DATABASE" == "0" || "$SYNC_DATABASE" == "1" ]] || fail "SYNC_DATABASE must be 0 or 1."

    REPOSITORY_WEB_DIRECTORY="$(validate_repository_directory "$REPOSITORY_WEB_DIRECTORY" "REPOSITORY_WEB_DIRECTORY")"
    SERVER_BACKUP_DIRECTORY="$(validate_external_backup_directory "$SERVER_BACKUP_DIRECTORY" "SERVER_BACKUP_DIRECTORY")"

    if [[ "$SYNC_DATABASE" == "1" ]]; then
        validate_remote_path "REMOTE_DATABASE_SOURCE" "$REMOTE_DATABASE_SOURCE"
        [[ -n "$REPOSITORY_DATABASE_PATH" ]] || fail "REPOSITORY_DATABASE_PATH is required when SYNC_DATABASE=1"
        [[ -n "$DATABASE_BACKUP_DIRECTORY" ]] || fail "DATABASE_BACKUP_DIRECTORY is required when SYNC_DATABASE=1"

        REPOSITORY_DATABASE_PATH="$(validate_repository_file_destination "$REPOSITORY_DATABASE_PATH" "REPOSITORY_DATABASE_PATH")"
        DATABASE_BACKUP_DIRECTORY="$(validate_external_backup_directory "$DATABASE_BACKUP_DIRECTORY" "DATABASE_BACKUP_DIRECTORY")"
        if path_is_same_or_within "$SERVER_BACKUP_DIRECTORY" "$DATABASE_BACKUP_DIRECTORY" || \
            path_is_same_or_within "$DATABASE_BACKUP_DIRECTORY" "$SERVER_BACKUP_DIRECTORY"; then
            fail "SERVER_BACKUP_DIRECTORY and DATABASE_BACKUP_DIRECTORY must not overlap."
        fi

        if [[ -e "$REPOSITORY_DATABASE_PATH" ]]; then
            [[ -f "$REPOSITORY_DATABASE_PATH" ]] || fail "REPOSITORY_DATABASE_PATH must be a file when it exists: $REPOSITORY_DATABASE_PATH"
            [[ -r "$REPOSITORY_DATABASE_PATH" ]] || fail "The existing repository database is not readable: $REPOSITORY_DATABASE_PATH"
            [[ -w "$REPOSITORY_DATABASE_PATH" ]] || fail "The existing repository database is not writable: $REPOSITORY_DATABASE_PATH"
        fi
    fi

    BACKUP_DATE="$(TZ=Europe/Amsterdam date '+%Y_%m_%d')"
}

validate_tools() {
    require_command date
    require_command dirname
    require_command basename
    require_command sed
    require_command mkdir
    require_command mktemp
    require_command mv
    require_command rm
    require_command rsync
    require_command ssh
    if [[ "$SYNC_DATABASE" == "1" ]]; then
        require_command sqlite3
    fi
}

quote_for_remote_shell() {
    printf '%q' "$1"
}

remote_rsync_source() {
    local path="$1"
    local quoted_path
    quoted_path="$(quote_for_remote_shell "$path")"
    printf '%s:%s' "$SSH_TARGET" "$quoted_path"
}

validate_remote_source() {
    local quoted_path
    quoted_path="$(quote_for_remote_shell "$REMOTE_WEB_SOURCE")"
    if ! ssh "$SSH_TARGET" "if [ -d $quoted_path ] && [ -r $quoted_path ]; then exit 0; fi; exit 1"; then
        fail "The remote web source is missing or unreadable: $REMOTE_WEB_SOURCE"
    fi

    if [[ "$SYNC_DATABASE" == "1" ]]; then
        quoted_path="$(quote_for_remote_shell "$REMOTE_DATABASE_SOURCE")"
        if ! ssh "$SSH_TARGET" "if [ -f $quoted_path ] && [ -r $quoted_path ]; then exit 0; fi; exit 1"; then
            fail "The remote database is missing or unreadable: $REMOTE_DATABASE_SOURCE"
        fi
    fi
}

split_backup_filename() {
    local filename="$1"
    local stem
    local extension

    if [[ "$filename" == .* || "$filename" != *.* ]]; then
        stem="$filename"
        extension=""
    else
        stem="${filename%.*}"
        extension=".${filename##*.}"
    fi
    printf '%s\n%s' "$stem" "$extension"
}

next_available_path() {
    local directory="$1"
    local filename="$2"
    local candidate="$directory/$filename"
    local suffix=1
    local stem
    local extension

    if [[ ! -e "$candidate" ]]; then
        printf '%s' "$candidate"
        return
    fi

    stem="$(split_backup_filename "$filename" | sed -n '1p')"
    extension="$(split_backup_filename "$filename" | sed -n '2p')"
    while :; do
        candidate="$directory/${stem}_${suffix}${extension}"
        [[ ! -e "$candidate" ]] && {
            printf '%s' "$candidate"
            return
        }
        suffix=$((suffix + 1))
    done
}

create_server_snapshot() {
    local snapshot_path
    local source_path
    local attempt=1

    mkdir -p "$SERVER_BACKUP_DIRECTORY"
    while :; do
        snapshot_path="$(next_available_path "$SERVER_BACKUP_DIRECTORY" "back-up_$BACKUP_DATE")"
        if mkdir "$snapshot_path" 2>/dev/null; then
            break
        fi
        attempt=$((attempt + 1))
        [[ "$attempt" -lt 10000 ]] || fail "Unable to allocate a unique server snapshot directory in: $SERVER_BACKUP_DIRECTORY"
    done

    source_path="$(remote_rsync_source "$(trim_trailing_slashes "$REMOTE_WEB_SOURCE")/")"
    info "Creating server snapshot: $snapshot_path"
    if ! rsync -a -- "$source_path" "$snapshot_path/"; then
        rm -rf "$snapshot_path"
        fail "The server snapshot failed; repository synchronisation was not started."
    fi
    SERVER_SNAPSHOT_PATH="$snapshot_path"
}

database_backup_filename() {
    local filename="$(basename "$REPOSITORY_DATABASE_PATH")"
    local parts
    local stem
    local extension

    parts="$(split_backup_filename "$filename")"
    stem="$(printf '%s\n' "$parts" | sed -n '1p')"
    extension="$(printf '%s\n' "$parts" | sed -n '2p')"
    printf '%s.back-up_%s%s' "$stem" "$BACKUP_DATE" "$extension"
}

escape_sqlite_string() {
    local value="$1"
    value="${value//\'/\'\'}"
    printf '%s' "$value"
}

backup_local_database() {
    local backup_path
    local escaped_backup_path
    local backup_command

    mkdir -p "$DATABASE_BACKUP_DIRECTORY"
    if [[ ! -e "$REPOSITORY_DATABASE_PATH" ]]; then
        info "No existing repository database found; skipping local database backup."
        return
    fi

    backup_path="$(next_available_path "$DATABASE_BACKUP_DIRECTORY" "$(database_backup_filename)")"
    escaped_backup_path="$(escape_sqlite_string "$backup_path")"
    backup_command=".backup '$escaped_backup_path'"
    info "Backing up repository database: $backup_path"
    if ! sqlite3 "$REPOSITORY_DATABASE_PATH" "$backup_command"; then
        rm -f "$backup_path"
        fail "The repository database backup failed; the repository database was not replaced."
    fi
    [[ -f "$backup_path" ]] || fail "SQLite did not create the expected database backup: $backup_path"
}

repository_database_relative_path() {
    case "$REPOSITORY_DATABASE_PATH" in
        "$REPOSITORY_WEB_DIRECTORY"/*)
            printf '%s' "${REPOSITORY_DATABASE_PATH#"$REPOSITORY_WEB_DIRECTORY"/}"
            ;;
        *)
            printf ''
            ;;
    esac
}

remote_database_relative_path() {
    local remote_web_root

    [[ "$SYNC_DATABASE" == "1" ]] || return 0
    remote_web_root="$(trim_trailing_slashes "$REMOTE_WEB_SOURCE")"
    case "$REMOTE_DATABASE_SOURCE" in
        "$remote_web_root"/*)
            printf '%s' "${REMOTE_DATABASE_SOURCE#"$remote_web_root"/}"
            ;;
        *)
            printf ''
            ;;
    esac
}

synchronise_web_files() {
    local source_path
    local relative_database_path
    local remote_relative_database_path
    local exclude_arguments=()

    source_path="$(remote_rsync_source "$(trim_trailing_slashes "$REMOTE_WEB_SOURCE")/")"
    relative_database_path="$(repository_database_relative_path)"
    if [[ -n "$relative_database_path" ]]; then
        exclude_arguments=("--exclude=$relative_database_path")
    fi
    remote_relative_database_path="$(remote_database_relative_path)"
    if [[ -n "$remote_relative_database_path" && "$remote_relative_database_path" != "$relative_database_path" ]]; then
        exclude_arguments+=("--exclude=$remote_relative_database_path")
    fi

    info "Synchronising newer web files into: $REPOSITORY_WEB_DIRECTORY"
    rsync -a --update "${exclude_arguments[@]}" -- "$source_path" "$REPOSITORY_WEB_DIRECTORY/"
}

prepare_server_database() {
    local temporary_database_path
    local source_path

    mkdir -p "$REPOSITORY_ROOT/.temporary"
    TEMP_WORK_DIRECTORY="$(mktemp -d "$REPOSITORY_ROOT/.temporary/server-sync.XXXXXX")"
    temporary_database_path="$TEMP_WORK_DIRECTORY/server-database"
    source_path="$(remote_rsync_source "$REMOTE_DATABASE_SOURCE")"

    info "Copying authoritative server database."
    if ! rsync -a -- "$source_path" "$temporary_database_path"; then
        fail "The server database could not be copied; the repository database was not replaced."
    fi
    [[ -f "$temporary_database_path" ]] || fail "The server database copy did not produce a file."
    if ! sqlite3 "$temporary_database_path" 'PRAGMA schema_version;' >/dev/null; then
        fail "The copied server database could not be opened as SQLite; the repository database was not replaced."
    fi

    TEMPORARY_DATABASE_PATH="$temporary_database_path"
}

install_server_database() {
    [[ -n "$TEMPORARY_DATABASE_PATH" && -f "$TEMPORARY_DATABASE_PATH" ]] || fail "The prepared server database is unavailable; the repository database was not replaced."
    mv -f "$TEMPORARY_DATABASE_PATH" "$REPOSITORY_DATABASE_PATH"
    TEMP_WORK_DIRECTORY=""
    TEMPORARY_DATABASE_PATH=""
    info "Installed server database at: $REPOSITORY_DATABASE_PATH"
}

print_plan() {
    local snapshot_path
    local relative_database_path

    if [[ -n "$SERVER_SNAPSHOT_PATH" ]]; then
        snapshot_path="$SERVER_SNAPSHOT_PATH"
    else
        snapshot_path="$(next_available_path "$SERVER_BACKUP_DIRECTORY" "back-up_$BACKUP_DATE")"
    fi
    if [[ "$DRY_RUN" -eq 1 ]]; then
        info "Dry run: no backups or repository files will be created or changed."
    else
        info "Planned repository changes:"
    fi
    info "Planned server snapshot: $snapshot_path"
    info "Planned web synchronisation: newer files from $REMOTE_WEB_SOURCE to $REPOSITORY_WEB_DIRECTORY"
    if [[ "$SYNC_DATABASE" == "1" ]]; then
        relative_database_path="$(repository_database_relative_path)"
        if [[ -e "$REPOSITORY_DATABASE_PATH" ]]; then
            info "Planned repository database backup directory: $DATABASE_BACKUP_DIRECTORY"
        else
            info "Planned repository database backup: skipped because the repository database does not exist."
        fi
        info "Planned server database replacement: $REPOSITORY_DATABASE_PATH"
        [[ -z "$relative_database_path" ]] || info "Planned web synchronisation exclusion: $relative_database_path"
    fi
}

confirm_repository_changes() {
    local answer

    [[ "$ASSUME_YES" -eq 1 ]] && return
    printf 'Apply the planned changes to the repository? [y/N] '
    if ! IFS= read -r answer; then
        fail "No confirmation was received. Re-run with --yes for trusted non-interactive use."
    fi
    case "$answer" in
        y|Y|yes|YES|Yes)
            ;;
        *)
            fail "Repository synchronisation cancelled; the repository was not changed."
            ;;
    esac
}

main() {
    parse_arguments "$@"
    load_configuration
    validate_tools
    validate_configuration
    validate_remote_source

    if [[ "$DRY_RUN" -eq 1 ]]; then
        print_plan
        return 0
    fi

    create_server_snapshot
    if [[ "$SYNC_DATABASE" == "1" ]]; then
        backup_local_database
    fi
    print_plan
    confirm_repository_changes
    if [[ "$SYNC_DATABASE" == "1" ]]; then
        prepare_server_database
    fi
    synchronise_web_files
    if [[ "$SYNC_DATABASE" == "1" ]]; then
        install_server_database
    fi
    info "Web application synchronisation completed."
}

main "$@"
