<h1 align="center">{{NAME}}</h1>

<p align="center">
  <img src="docs/icons/default.png" width="112" height="112" alt="description">
</p>

<p align="center">short description</p>

<p align="center"> <!-- replace with the correct ones -->
  <img src="https://img.shields.io/badge/macOS-13%2B-242424" alt="macOS 13 or later">
  <img src="https://img.shields.io/badge/Swift-5.9%2B-F05138" alt="Swift 5.9 or later">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-242424" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/status-work_in_progress-FFCC29" alt="Work in progress">
</p>

<p align="center">
  <img src="docs/screenshots/screenshot.png" alt="description">
</p>

<p align="center">
  <a href="#getting-started">Getting started</a> ·
  <a href="audio-files/README.md">Add sounds</a> ·
  <a href="CONTRIBUTING.md">Contribute</a>
</p>

## Features

description


## Requirements


## Getting started

description


## Using {{NAME}}


## Screenshots


## Verification and known limitations


## Development

### Web application server synchronisation

This repository includes a reusable server-to-local workflow for private web
applications. Copy `.server-sync/config.example.sh` to
`.server-sync/config.sh`, edit the SSH target and paths, inspect a dry run, and
then run `./scripts/sync_web_application_from_server.sh`. The workflow creates
external dated backups and never stores credentials in the repository.

The workflow requires Bash to run the script, OpenSSH to authenticate and
execute remote readability checks, and `rsync` to transfer the server snapshot
and web files. The local standard file utilities create dated directories and
temporary files. Install `sqlite3` when `SYNC_DATABASE=1`; it creates
consistent local SQLite backups and validates the copied server database. On a
Debian or Ubuntu development machine, install the tools with:

```bash
sudo apt-get update
sudo apt-get install --yes bash openssh-client rsync sqlite3
```

macOS provides Bash, OpenSSH, `rsync`, and `sqlite3` as system command-line
tools on supported installations. The configured SSH account must be able to
read the server paths; the local account must be able to write the repository
web directory and both external backup directories. Transfers use the network
connection defined by the local SSH configuration.

The complete operating procedure, database rules, limitations, and recovery
guidance are documented in the [web application server sync skill](.agents/skills/web-application-server-sync/SKILL.md).
Run the black-box verification with:

```bash
bash tests/test_web_application_server_sync.sh
```

## Next steps


## License

The source code to {{NAME}} is available under the [MIT License](LICENSE).
