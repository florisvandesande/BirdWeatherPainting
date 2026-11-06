# Repository Structure and Hygiene

Read this reference before creating directories, adding project tooling, changing generated-file handling, or modifying the root `.gitignore`.

## Standard structure

Use this structure when it fits the project:

```text
project/
├── .sync/          Reserved synchronization tooling; do not inspect or modify
├── .temporary/     Repository-local temporary and generated working files
├── docs/           Documentation, screenshots, and documentation artwork
├── .gitignore
├── AGENTS.md
└── README.md
```

Create only the optional directories the project needs:

```text
project/
├── web/            PHP web application and browser assets
├── ios/            iOS application or iOS-specific target
├── watchos/        watchOS application or watchOS-specific target
├── macos/          macOS application or macOS-specific target
├── shared/         Code or assets genuinely shared by multiple platforms
├── scripts/        Optional local development and maintenance tools
├── examples/       Safe example input or sample data
└── tests/          Cross-project tests when they do not belong beside a target
```

- Put supplementary Markdown documentation in `docs/`, screenshots in `docs/screenshots/`, and documentation icons in `docs/icons/`.
- Keep runtime assets with the application that uses them. An iOS AppIcon belongs in its Xcode asset catalog, not in `docs/icons/`.
- Put agent-created scratch files, local build output, rendered previews, and other disposable work in `.temporary/`.
- Ignore `.temporary/` contents except an optional `.gitkeep`.
- Keep platform-specific source, tests, configuration, and runtime assets inside that platform's directory.
- Use `shared/` only when at least two targets already use the code or asset. Keep target-specific tests beside the target when that is the platform convention.
- Keep optional Python and shell tooling in `scripts/`. Production application requests must not depend on a local maintenance script.
- Store script logs in `.temporary/logs/`.
- Existing repositories may retain a different structure when reorganization would add risk without practical benefit; document the intentional difference in the README.

Application runtime temporary data may use the secure temporary or cache location provided by its platform. Production code must not depend on development files in `.temporary/`.

## Git worktrees

Git worktrees are separate working copies, not disposable scratch files. Keep them outside `Repositories` under:

```text
~/Worktrees/<repository>/<task-or-branch>/
```

Use one unique directory per repository and task or branch. Do not create a worktree as a sibling of a repository, inside the repository itself, or under `.temporary/`. Do not use `/tmp` for an active worktree because the operating system may remove it before the work is reviewed.

Remove a worktree only after its changes are reviewed and the branch is merged or deliberately abandoned. Use Git to remove it rather than deleting the directory manually:

```bash
git worktree remove ~/Worktrees/<repository>/<task-or-branch>
git worktree prune
```

Before removal, check `git status` in the worktree and confirm that no uncommitted work or required untracked files remain. Preserve the worktree and report the blocker when review, merge, or user direction is still pending.

## Gitignore

Review the root `.gitignore` whenever the project gains a platform, tool, generated artifact, secret format, local database, or upload location.

Ignore, where applicable, operating-system metadata, editor and IDE state, build products, derived data, caches, coverage, logs, test results, downloaded dependencies, real configuration, credentials, signing material, local databases, uploads, user-generated data, local server state, and machine-specific paths.

Do not ignore files required to build, test, or run a fresh clone. Commit source code, runtime assets, dependency manifests and lock files, migrations and schemas, required Xcode configuration, non-secret build and deployment configuration, safe configuration examples, required scripts, fixtures, examples, documentation, screenshots, and license notices.

Avoid broad patterns that hide source or configuration files. Before completing work, use `git status` and Git ignore diagnostics to confirm that required files are tracked and private files are ignored.
