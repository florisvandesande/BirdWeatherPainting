---
name: web-application-server-sync
description: Refresh a local web application from its private server with a dated server snapshot, safe newer-file synchronisation, and optional authoritative SQLite replacement.
---

# Web Application Server Sync

Use this skill when a private web application needs to be refreshed from its
server into the current repository. The workflow copies server files to the
repository; it never deploys local changes to the server.

## Boundaries and safety

- Use the repository script at `scripts/sync_web_application_from_server.sh`.
- Keep passwords, private keys, access tokens, and other credentials in the
  existing SSH configuration. The repository configuration contains only a
  host or SSH alias and filesystem paths.
- Run the workflow when the private application is not writing to its SQLite
  database. The first version copies the database file over SSH and does not
  run a remote transactional SQLite backup.
- Do not enable database synchronisation unless the repository database path,
  remote database path, and separate database-backup directory are known.
- Do not use `--yes` for an unreviewed command or a general scheduled job.
- The workflow does not delete local-only files, apply server deletions, deploy
  local changes, run migrations, restart services, or restore backups.

## Prerequisites

The local machine needs Bash, `ssh`, `rsync`, `mkdir`, and the standard file
utilities used by the script. `sqlite3` is also required when database
synchronisation is enabled. The SSH target must already be usable through the
operator's local SSH configuration, including key and host settings.

The remote account must be able to read the configured web directory and, when
enabled, the configured SQLite database. The local account must be able to
write the repository web directory and both external backup directories.

## Configure a repository

From the repository root, create the private configuration file:

```bash
mkdir -p .server-sync
cp .server-sync/config.example.sh .server-sync/config.sh
```

Edit `.server-sync/config.sh` and set:

| Setting | Meaning |
| --- | --- |
| `SSH_TARGET` | An SSH host, `user@host`, or SSH configuration alias. |
| `REMOTE_WEB_SOURCE` | Absolute path to the server web directory. |
| `REPOSITORY_WEB_DIRECTORY` | Existing local web directory, relative to the repository or given as an absolute path inside it. |
| `SERVER_BACKUP_DIRECTORY` | Absolute local directory outside the repository for full server snapshots. |
| `SYNC_DATABASE` | `0` to skip database work, or `1` to enable the SQLite workflow. |
| `REMOTE_DATABASE_SOURCE` | Absolute server path to the authoritative SQLite file when database work is enabled. |
| `REPOSITORY_DATABASE_PATH` | Local database path inside the repository when database work is enabled. |
| `DATABASE_BACKUP_DIRECTORY` | Absolute local directory outside the repository for local database backups. |

The file uses a small `KEY=VALUE` format; quote values that contain spaces.
The script parses this format as data and does not execute configuration-file
commands.

The script derives the repository root from its own location under
`scripts/`. It resolves relative repository paths from that root and
rejects repository metadata, `.sync`, and `.temporary` as destinations. Both
backup directories must remain outside the repository and must be different.

## Run the workflow

Always inspect a dry run first:

```bash
./scripts/sync_web_application_from_server.sh --dry-run
```

The dry run validates local configuration and remote readability, reports the
planned dated snapshot, and makes no backup or repository changes. A normal run
creates the complete server snapshot first, backs up an existing local database
when enabled, and then asks for confirmation before changing repository files:

```bash
./scripts/sync_web_application_from_server.sh
```

Use `--yes` only after reviewing the dry-run output and when the caller is a
trusted local automation process:

```bash
./scripts/sync_web_application_from_server.sh --yes
```

The normal output identifies the server snapshot and database backup paths,
then shows the planned repository changes and asks for confirmation before it
reports the web synchronisation and any database replacement. A successful run
ends with `Web application synchronisation completed.`

## Precedence and backups

Each server snapshot is a complete archive-style copy, including hidden files,
directory structure, file times, permissions, and symbolic links. Snapshot names
use the Amsterdam date, for example `back-up_2026_10_13`; a repeated run uses a
suffix such as `back-up_2026_10_13_1`.

Ordinary web files use newer-file semantics. Missing files and newer server
files are copied, newer local files remain, local-only files remain, and files
deleted from the server are not deleted locally. The configured repository
database is excluded from this ordinary synchronisation when it is inside the
web directory. When the separately configured server database is inside the
remote web directory, that source path is excluded as well, so it cannot be
copied under a different local filename before the authoritative replacement.

When `SYNC_DATABASE=1`, the server database is authoritative regardless of file
modification times. An existing repository database is copied first with the
SQLite command-line backup mechanism to a name such as
`app.back-up_2026_10_13.sqlite`; repeated backups receive a numeric suffix. If
the repository database does not exist, its local backup step is skipped. The
server database is then copied separately and replaces the repository database.

The full server snapshot can also contain the server database when that file is
inside the remote web directory. This is intentional: the full snapshot is an
independent recovery point, while the separately handled repository database
has explicit precedence rules.

## Troubleshooting

- **Configuration file not found:** copy the example to
  `.server-sync/config.sh` and set every required value.
- **Remote source is missing or unreadable:** test the same SSH target and
  absolute paths manually, then check remote permissions.
- **Backup destination rejected:** use an absolute writable path outside the
  repository. Do not use `.git`, `.sync`, `.temporary`, or the repository root.
- **Database backup failed:** confirm that `sqlite3` is installed and that the
  existing repository database is readable and writable. The script stops before
  replacing it when its backup fails.
- **No confirmation received:** run interactively or use `--yes` only for a
  deliberately trusted invocation.
- **The server database could not be opened as SQLite:** restore the server
  database from the application or database owner before retrying. The local
  database is left in place.

The workflow does not provide retention, compression, restoration, remote
transactional database backup, multiple-server support, or application
quiescing. Operators must decide how long external backup directories are kept.
