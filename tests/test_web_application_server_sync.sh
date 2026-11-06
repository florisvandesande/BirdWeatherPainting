#!/usr/bin/env bash

set -euo pipefail

SOURCE_SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/scripts/sync_web_application_from_server.sh"
TEST_ROOTS=()
CURRENT_TEST_ROOT=""
REMOTE_WEB_DIRECTORY=""
REPOSITORY_ROOT=""
SERVER_BACKUP_DIRECTORY=""
DATABASE_BACKUP_DIRECTORY=""
FAKE_BIN_DIRECTORY=""
CONFIG_PATH=""
TEST_SCRIPT_PATH=""
LAST_OUTPUT=""
LAST_STATUS=0

cleanup() {
    local test_root
    for test_root in "${TEST_ROOTS[@]}"; do
        [[ -e "$test_root" ]] && rm -rf "$test_root"
    done
}

trap cleanup EXIT

fail_test() {
    printf 'FAIL: %s\n' "$*" >&2
    if [[ -n "$LAST_OUTPUT" ]]; then
        printf '%s\n' "$LAST_OUTPUT" >&2
    fi
    exit 1
}

assert_file_contains() {
    local path="$1"
    local expected="$2"
    [[ -f "$path" ]] || fail_test "Expected file does not exist: $path"
    grep -Fqx "$expected" "$path" || fail_test "Expected '$path' to contain exactly '$expected'"
}

assert_sqlite_value() {
    local database_path="$1"
    local query="$2"
    local expected="$3"
    local actual

    actual="$(sqlite3 "$database_path" "$query")"
    [[ "$actual" == "$expected" ]] || fail_test "Expected SQLite query '$query' to return '$expected', received '$actual'"
}

directory_is_empty() {
    local path
    for path in "$1"/* "$1"/.[!.]* "$1"/..?*; do
        [[ -e "$path" ]] && return 1
    done
    return 0
}

new_fixture() {
    local fixture_name="$1"

    CURRENT_TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/web-server-sync-${fixture_name}.XXXXXX")"
    TEST_ROOTS+=("$CURRENT_TEST_ROOT")
    REMOTE_WEB_DIRECTORY="$CURRENT_TEST_ROOT/remote web"
    REPOSITORY_ROOT="$CURRENT_TEST_ROOT/repository"
    SERVER_BACKUP_DIRECTORY="$CURRENT_TEST_ROOT/server backups"
    DATABASE_BACKUP_DIRECTORY="$CURRENT_TEST_ROOT/database backups"
    FAKE_BIN_DIRECTORY="$CURRENT_TEST_ROOT/fake bin"
    CONFIG_PATH="$CURRENT_TEST_ROOT/config.sh"
    TEST_SCRIPT_PATH="$REPOSITORY_ROOT/scripts/sync_web_application_from_server.sh"

    mkdir -p "$REMOTE_WEB_DIRECTORY/data" "$REPOSITORY_ROOT/scripts" \
        "$REPOSITORY_ROOT/web/data" "$SERVER_BACKUP_DIRECTORY" \
        "$DATABASE_BACKUP_DIRECTORY" "$FAKE_BIN_DIRECTORY"

    cp "$SOURCE_SCRIPT_PATH" "$TEST_SCRIPT_PATH"
    chmod +x "$TEST_SCRIPT_PATH"

    cat >"$FAKE_BIN_DIRECTORY/ssh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${FAKE_SSH_FAIL:-0}" == "1" ]]; then
    exit 255
fi

shift
/bin/bash -c "$*"
EOF

    cat >"$FAKE_BIN_DIRECTORY/rsync" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${FAKE_RSYNC_FAIL:-0}" == "1" ]]; then
    exit 23
fi

arguments=("$@")
for index in "${!arguments[@]}"; do
    argument="${arguments[$index]}"
    if [[ "$argument" == fake-host:* ]]; then
        remote_path="${argument#fake-host:}"
        eval "remote_path=$remote_path"
        arguments[$index]="$remote_path"
    fi
done

exec /usr/bin/rsync "${arguments[@]}"
EOF

    cat >"$FAKE_BIN_DIRECTORY/sqlite3" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${FAKE_SQLITE_FAIL:-0}" == "1" ]]; then
    exit 1
fi

exec /usr/bin/sqlite3 "$@"
EOF

    chmod +x "$FAKE_BIN_DIRECTORY/ssh" "$FAKE_BIN_DIRECTORY/rsync" "$FAKE_BIN_DIRECTORY/sqlite3"
}

write_config() {
    local sync_database="$1"
    local remote_database_source="${2:-$REMOTE_WEB_DIRECTORY/data/authoritative.sqlite}"
    local repository_database_path="${3:-web/data/app.sqlite}"

    cat >"$CONFIG_PATH" <<EOF
SSH_TARGET="fake-host"
REMOTE_WEB_SOURCE="$REMOTE_WEB_DIRECTORY"
REPOSITORY_WEB_DIRECTORY="web"
SERVER_BACKUP_DIRECTORY="$SERVER_BACKUP_DIRECTORY"
SYNC_DATABASE=$sync_database
REMOTE_DATABASE_SOURCE="$remote_database_source"
REPOSITORY_DATABASE_PATH="$repository_database_path"
DATABASE_BACKUP_DIRECTORY="$DATABASE_BACKUP_DIRECTORY"
EOF
}

run_sync() {
    local command_arguments=(--config "$CONFIG_PATH" "$@")

    LAST_STATUS=0
    PATH="$FAKE_BIN_DIRECTORY:$PATH" \
        "$TEST_SCRIPT_PATH" "${command_arguments[@]}" >"$CURRENT_TEST_ROOT/output.txt" 2>&1 || LAST_STATUS=$?
    LAST_OUTPUT="$(sed -n '1,240p' "$CURRENT_TEST_ROOT/output.txt")"
}

run_sync_with_input() {
    local input="$1"
    shift

    LAST_STATUS=0
    printf '%s' "$input" | PATH="$FAKE_BIN_DIRECTORY:$PATH" \
        "$TEST_SCRIPT_PATH" --config "$CONFIG_PATH" "$@" >"$CURRENT_TEST_ROOT/output.txt" 2>&1 || LAST_STATUS=$?
    LAST_OUTPUT="$(sed -n '1,240p' "$CURRENT_TEST_ROOT/output.txt")"
}

backup_date() {
    TZ=Europe/Amsterdam date '+%Y_%m_%d'
}

test_web_sync_and_snapshot() {
    local date_stamp
    local snapshot_path

    new_fixture "web"
    write_config 0

    printf '%s\n' 'server is newer' >"$REMOTE_WEB_DIRECTORY/server-newer.txt"
    printf '%s\n' 'server is older' >"$REMOTE_WEB_DIRECTORY/server-older.txt"
    printf '%s\n' 'server only' >"$REMOTE_WEB_DIRECTORY/server-only.txt"
    printf '%s\n' 'hidden server file' >"$REMOTE_WEB_DIRECTORY/.env.example"
    printf '%s\n' 'server symlink target' >"$REMOTE_WEB_DIRECTORY/link-target.txt"
    ln -s 'link-target.txt' "$REMOTE_WEB_DIRECTORY/server-link"
    printf '%s\n' 'local is older' >"$REPOSITORY_ROOT/web/server-newer.txt"
    printf '%s\n' 'local is newer' >"$REPOSITORY_ROOT/web/server-older.txt"
    printf '%s\n' 'local only' >"$REPOSITORY_ROOT/web/local-only.txt"
    printf '%s\n' 'preserve after server deletion' >"$REPOSITORY_ROOT/web/deleted-on-server.txt"
    touch -t 202601010101 "$REPOSITORY_ROOT/web/server-newer.txt"
    touch -t 202601030303 "$REMOTE_WEB_DIRECTORY/server-newer.txt"
    touch -t 202601030303 "$REPOSITORY_ROOT/web/server-older.txt"
    touch -t 202601010101 "$REMOTE_WEB_DIRECTORY/server-older.txt"
    chmod 640 "$REMOTE_WEB_DIRECTORY/link-target.txt"

    date_stamp="$(backup_date)"
    mkdir "$SERVER_BACKUP_DIRECTORY/back-up_$date_stamp"
    run_sync --yes
    [[ "$LAST_STATUS" -eq 0 ]] || fail_test "Web synchronisation failed"

    snapshot_path="$SERVER_BACKUP_DIRECTORY/back-up_${date_stamp}_1"
    assert_file_contains "$REPOSITORY_ROOT/web/server-newer.txt" 'server is newer'
    assert_file_contains "$REPOSITORY_ROOT/web/server-older.txt" 'local is newer'
    assert_file_contains "$REPOSITORY_ROOT/web/server-only.txt" 'server only'
    assert_file_contains "$REPOSITORY_ROOT/web/.env.example" 'hidden server file'
    assert_file_contains "$REPOSITORY_ROOT/web/local-only.txt" 'local only'
    assert_file_contains "$REPOSITORY_ROOT/web/deleted-on-server.txt" 'preserve after server deletion'
    [[ -L "$snapshot_path/server-link" ]] || fail_test 'Server snapshot did not preserve the symbolic link'
    [[ "$(readlink "$snapshot_path/server-link")" == 'link-target.txt' ]] || fail_test 'Server snapshot changed the symbolic link target'
    [[ "$(stat -f '%Lp' "$snapshot_path/link-target.txt")" == '640' ]] || fail_test 'Server snapshot did not preserve file permissions'
}

test_database_sync() {
    local date_stamp
    local database_backup_path
    local snapshot_path

    new_fixture "database"
    write_config 1
    sqlite3 "$REPOSITORY_ROOT/web/data/app.sqlite" 'CREATE TABLE values_table (value TEXT); INSERT INTO values_table VALUES ("local");'
    sqlite3 "$REMOTE_WEB_DIRECTORY/data/authoritative.sqlite" 'CREATE TABLE values_table (value TEXT); INSERT INTO values_table VALUES ("server");'
    printf '%s\n' 'ordinary web copy must not win' >"$REMOTE_WEB_DIRECTORY/data/app.sqlite"
    date_stamp="$(backup_date)"
    database_backup_path="$DATABASE_BACKUP_DIRECTORY/app.back-up_${date_stamp}.sqlite"
    touch "$REPOSITORY_ROOT/web/data/app.sqlite"
    : >"$DATABASE_BACKUP_DIRECTORY/app.back-up_${date_stamp}_1.sqlite"

    run_sync --yes
    [[ "$LAST_STATUS" -eq 0 ]] || fail_test "Database synchronisation failed"
    snapshot_path="$SERVER_BACKUP_DIRECTORY/back-up_${date_stamp}"
    [[ -f "$snapshot_path/data/authoritative.sqlite" ]] || fail_test 'Full server snapshot omitted the server database'
    [[ ! -e "$REPOSITORY_ROOT/web/data/authoritative.sqlite" ]] || fail_test 'The server database was copied by ordinary web synchronisation'
    assert_sqlite_value "$database_backup_path" 'SELECT value FROM values_table' 'local'
    assert_sqlite_value "$REPOSITORY_ROOT/web/data/app.sqlite" 'SELECT value FROM values_table' 'server'
    [[ "$LAST_OUTPUT" == *'Planned repository changes:'* ]] || fail_test 'Normal execution did not show the planned repository changes'
    [[ -f "$DATABASE_BACKUP_DIRECTORY/app.back-up_${date_stamp}_1.sqlite" ]] || fail_test 'Existing database backup was not preserved'
}

test_database_population_without_local_database() {
    new_fixture "database-absent"
    write_config 1
    sqlite3 "$REMOTE_WEB_DIRECTORY/data/authoritative.sqlite" 'CREATE TABLE values_table (value TEXT); INSERT INTO values_table VALUES ("server");'

    run_sync --yes
    [[ "$LAST_STATUS" -eq 0 ]] || fail_test "Server database population failed"
    assert_sqlite_value "$REPOSITORY_ROOT/web/data/app.sqlite" 'SELECT value FROM values_table' 'server'
    directory_is_empty "$DATABASE_BACKUP_DIRECTORY" || fail_test 'A local database backup was created even though the database was absent'
}

test_dry_run() {
    new_fixture "dry-run"
    write_config 1
    sqlite3 "$REPOSITORY_ROOT/web/data/app.sqlite" 'CREATE TABLE values_table (value TEXT); INSERT INTO values_table VALUES ("local");'
    sqlite3 "$REMOTE_WEB_DIRECTORY/data/authoritative.sqlite" 'CREATE TABLE values_table (value TEXT); INSERT INTO values_table VALUES ("server");'

    run_sync --dry-run
    [[ "$LAST_STATUS" -eq 0 ]] || fail_test 'Dry run failed'
    [[ "$LAST_OUTPUT" == *'Dry run: no backups or repository files will be created or changed.'* ]] || fail_test 'Dry run did not report its no-change guarantee'
    directory_is_empty "$SERVER_BACKUP_DIRECTORY" || fail_test 'Dry run created a server snapshot'
    directory_is_empty "$DATABASE_BACKUP_DIRECTORY" || fail_test 'Dry run created a database backup'
    assert_sqlite_value "$REPOSITORY_ROOT/web/data/app.sqlite" 'SELECT value FROM values_table' 'local'
}

test_confirmation_decline() {
    new_fixture "confirmation"
    write_config 0
    printf '%s\n' 'server content' >"$REMOTE_WEB_DIRECTORY/index.php"
    printf '%s\n' 'local content' >"$REPOSITORY_ROOT/web/index.php"

    run_sync_with_input $'n\n'
    [[ "$LAST_STATUS" -ne 0 ]] || fail_test 'Declining confirmation unexpectedly succeeded'
    assert_file_contains "$REPOSITORY_ROOT/web/index.php" 'local content'
    if directory_is_empty "$SERVER_BACKUP_DIRECTORY"; then
        fail_test 'The required server snapshot was not created before confirmation'
    fi
}

test_server_snapshot_failure() {
    new_fixture "snapshot-failure"
    write_config 0
    printf '%s\n' 'server content' >"$REMOTE_WEB_DIRECTORY/index.php"
    printf '%s\n' 'local content' >"$REPOSITORY_ROOT/web/index.php"

    FAKE_RSYNC_FAIL=1 run_sync --yes
    [[ "$LAST_STATUS" -ne 0 ]] || fail_test 'Snapshot failure unexpectedly succeeded'
    assert_file_contains "$REPOSITORY_ROOT/web/index.php" 'local content'
    directory_is_empty "$SERVER_BACKUP_DIRECTORY" || fail_test 'A failed server snapshot was left as a recovery point'
}

test_invalid_remote_database() {
    new_fixture "missing-database"
    write_config 1 "$REMOTE_WEB_DIRECTORY/data/missing.sqlite"

    run_sync --yes
    [[ "$LAST_STATUS" -ne 0 ]] || fail_test 'Missing remote database unexpectedly succeeded'
    [[ "$LAST_OUTPUT" == *'remote database is missing or unreadable'* ]] || fail_test 'Missing remote database error was not actionable'
    directory_is_empty "$SERVER_BACKUP_DIRECTORY" || fail_test 'Missing remote database created a server snapshot'
}

test_unreachable_remote_web_source() {
    new_fixture "unreachable-web"
    write_config 0

    FAKE_SSH_FAIL=1 run_sync --dry-run
    [[ "$LAST_STATUS" -ne 0 ]] || fail_test 'Unreachable remote web source unexpectedly succeeded'
    [[ "$LAST_OUTPUT" == *'remote web source is missing or unreadable'* ]] || fail_test 'Unreachable remote web source error was not actionable'
    directory_is_empty "$SERVER_BACKUP_DIRECTORY" || fail_test 'Unreachable remote web source created a server snapshot'
}

test_invalid_server_database_before_web_sync() {
    new_fixture "invalid-server-database"
    write_config 1
    printf '%s\n' 'not a SQLite database' >"$REMOTE_WEB_DIRECTORY/data/authoritative.sqlite"
    printf '%s\n' 'local content' >"$REPOSITORY_ROOT/web/index.php"
    printf '%s\n' 'server content' >"$REMOTE_WEB_DIRECTORY/index.php"

    run_sync --yes
    [[ "$LAST_STATUS" -ne 0 ]] || fail_test 'Invalid server database unexpectedly succeeded'
    assert_file_contains "$REPOSITORY_ROOT/web/index.php" 'local content'
    [[ "$LAST_OUTPUT" == *'could not be opened as SQLite'* ]] || fail_test 'Invalid server database error was not actionable'
}

test_overlapping_backup_directories() {
    new_fixture "overlapping-backups"
    SERVER_BACKUP_DIRECTORY="$CURRENT_TEST_ROOT/shared backups"
    DATABASE_BACKUP_DIRECTORY="$SERVER_BACKUP_DIRECTORY/database"
    write_config 1

    run_sync --dry-run
    [[ "$LAST_STATUS" -ne 0 ]] || fail_test 'Overlapping backup directories unexpectedly succeeded'
    [[ "$LAST_OUTPUT" == *'must not overlap'* ]] || fail_test 'Overlapping backup directory error was not actionable'
}

test_unavailable_local_sqlite_backup() {
    new_fixture "sqlite-unavailable"
    write_config 1
    sqlite3 "$REPOSITORY_ROOT/web/data/app.sqlite" 'CREATE TABLE values_table (value TEXT); INSERT INTO values_table VALUES ("local");'
    sqlite3 "$REMOTE_WEB_DIRECTORY/data/authoritative.sqlite" 'CREATE TABLE values_table (value TEXT); INSERT INTO values_table VALUES ("server");'

    FAKE_SQLITE_FAIL=1 run_sync --yes
    [[ "$LAST_STATUS" -ne 0 ]] || fail_test 'Unavailable local SQLite backup unexpectedly succeeded'
    assert_sqlite_value "$REPOSITORY_ROOT/web/data/app.sqlite" 'SELECT value FROM values_table' 'local'
    [[ "$LAST_OUTPUT" == *'repository database backup failed'* ]] || fail_test 'SQLite backup failure was not actionable'
}

test_database_disabled_without_sqlite() {
    new_fixture "database-disabled"
    write_config 0
    printf '%s\n' 'server content' >"$REMOTE_WEB_DIRECTORY/index.php"

    FAKE_SQLITE_FAIL=1 run_sync --yes
    [[ "$LAST_STATUS" -eq 0 ]] || fail_test 'Database-disabled synchronisation required SQLite'
    assert_file_contains "$REPOSITORY_ROOT/web/index.php" 'server content'
}

test_invalid_backup_destination() {
    new_fixture "invalid-destination"
    SERVER_BACKUP_DIRECTORY="$REPOSITORY_ROOT/.temporary"
    write_config 0

    run_sync --yes
    [[ "$LAST_STATUS" -ne 0 ]] || fail_test 'Unsafe backup destination unexpectedly succeeded'
    [[ "$LAST_OUTPUT" == *'must remain outside the repository'* ]] || fail_test 'Unsafe backup destination error was not actionable'
}

test_web_sync_and_snapshot
test_database_sync
test_database_population_without_local_database
test_dry_run
test_confirmation_decline
test_server_snapshot_failure
test_invalid_remote_database
test_unreachable_remote_web_source
test_invalid_server_database_before_web_sync
test_unavailable_local_sqlite_backup
test_database_disabled_without_sqlite
test_invalid_backup_destination
test_overlapping_backup_directories

printf 'PASS: web application server sync black-box suite\n'
