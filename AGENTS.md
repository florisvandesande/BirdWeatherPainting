# Repository Working Agreement

This file defines the default working rules for projects created from this repository. A project may contain a PHP web application, an iOS application, a watchOS application, a macOS application, or a deliberate combination of these targets.

Apply the general rules to every project. Apply a platform-specific section only when that platform is present. When an existing project already uses a clear, working convention, preserve it unless the user explicitly requests a migration or the convention conflicts with this file.

## 1. Goal and audience

Every repository must be professional, complete, secure, maintainable, and usable from a fresh clone of `main`.

Assume that the repository owner and many readers are beginning developers. Do not expect them to know specialist terminology or infer missing steps.

For every change:

- explain what changed and why in clear English;
- give copy-and-pasteable commands for setup, configuration, testing, and deployment where commands are needed;
- define unavoidable technical terms when first used;
- include concrete examples of expected input, output, and user-visible behaviour where useful;
- prefer explicit, readable implementations over clever abstractions;
- keep error messages actionable and safe to share;
- leave the project in a working state.

Do not claim that work is complete when required files, documentation, tests, configuration examples, or deployment instructions are missing.

## 2. Language and writing conventions

All source code, identifiers, code comments, developer-facing messages, commit messages, Pull Request text, and primary documentation must be written in English. User-facing text must follow the [localization requirements](docs/agents/localization.md).

Write comments to explain intent, constraints, or non-obvious decisions. Do not comment on syntax that is already clear from the code.

Use Markdown for repository documentation. Keep headings descriptive, examples current, and links relative when they point to files in the same repository.

## 3. Repository structure

Follow [repository structure and hygiene](docs/agents/repository.md) when creating directories, adding tooling, handling generated files, or changing `.gitignore`.

Keep `.sync/` and `.temporary/` protected even when the repository uses an intentional different layout. Do not inspect, modify, delete, execute, or derive rules from `.sync/` unless the user explicitly asks for work on `.sync/`.

Keep Git worktrees outside `Repositories`, under `~/Worktrees/<repository>/<task-or-branch>/`. Do not create worktrees as sibling directories of a repository, inside a repository, or under `.temporary/`. Read [worktree location and cleanup](docs/agents/repository.md#git-worktrees) before creating, moving, or removing a worktree.

## 4. General implementation rules

### 4.0 Implementation authorization and workflow

Use this workflow for repository changes:

1. `/grill-with-docs` asks the clarifying questions needed to make the request explicit. This replaces `PLAN`.
2. `/to-spec` records the plan in GitHub for a small change.
3. `/to-tickets` records a large change as multiple GitHub tickets.
4. `/implement-spec` executes the approved GitHub spec or tickets. This is the implementation authorization gate.
5. `implement` authorizes a small, clearly scoped change described in the current conversation. It is an authorization gate, not a skill invocation, and does not require a GitHub specification or tickets.
6. `/diagnosing-bugs` is the designated workflow for investigating errors and problems in the application. It may inspect and explain the problem, but any resulting code change must still be authorized by `/implement-spec` or an exact standalone `implement` message.

Only an explicitly started `/implement-spec` or a user message whose complete content is `implement` authorizes implementation. `/grill-with-docs`, `/to-spec`, and `/to-tickets` may clarify the request and write the plan to GitHub, but they may not change files in the repository, generate code, build, package, deploy, or otherwise implement the request. A normal sentence containing the word `implement` is not authorization. The exact `implement` message applies only when the current conversation clearly defines the change, its scope, and its expected result; otherwise, ask clarifying questions first.

Answering a question, explaining behaviour, reviewing code, diagnosing a problem, researching an option, reporting status, or proposing a solution does not authorize implementation. Direct requests such as `build`, `create`, `add`, `change`, `fix`, `remove`, `refactor`, or `update` are not sufficient by themselves. Neither `/implement-spec` nor the exact `implement` message authorizes pushing, merging, deploying, publishing, or sending external messages; those actions require their own explicit authorization.

Agents delegated under an active `/implement-spec` or exact standalone `implement` authorization inherit that authorization only for the assigned scope. Agents working outside those authorizations remain subject to the same gate.

### Delegated work and pacing

When work has been delegated to another agent, use only neutral status questions or ask whether that agent is blocked and needs support. Do not pressure the agent to finish, shorten its scope, return a premature result, or close the task merely to show progress. Do not duplicate, interrupt, or take over delegated work without an explicit reason.

Treat delegated work as complete only after the agent reports completion and the result has been reviewed and verified against the relevant specification. Prefer a slower, verified result or an explicit blocker over a rushed or incomplete result.

### 4.1 Simplicity and dependencies

- Prefer platform standard libraries and built-in capabilities.
- Add an external package, framework, hosted service, or command-line dependency only when it has a clear benefit that would be expensive or unsafe to reproduce locally.
- Before adding a dependency, consider maintenance status, licensing, security, privacy, package size, platform support, and whether the project becomes unusable when the dependency is unavailable.
- Pin dependencies where the ecosystem supports it and commit required dependency manifests and lock files.
- Document every external dependency in the README, including why it is used, how it is installed, and any account, cost, privacy, or network requirement.
- Do not introduce broad frameworks or perform sweeping refactors unless the requested work needs them.
- Do not introduce a breaking change without documenting what breaks and how an existing user migrates.

### 4.2 Configuration and secrets

Use the configuration mechanism that fits the platform. Examples include:

- `config.php` with a committed `config.example.php` for a PHP application;
- a private `.xcconfig` with a safe committed example for an Apple application;
- a private `.env` with a committed `.env.example` only when the selected tooling genuinely uses environment files.

For every configuration format:

- commit a safe example containing labelled placeholders and non-secret sample values;
- ignore the real local or production configuration file;
- validate required values at startup or before deployment;
- fail with a clear, beginner-friendly message when configuration is missing or invalid;
- never commit, print, log, embed, or expose credentials, tokens, private keys, signing material, or production secrets;
- document exactly how to create the real configuration from its example;
- show the reader how to verify with `git status` that the private file is not tracked.

Do not make a fresh clone depend on an uncommitted file unless the README explains how to create it from a committed safe example.

### 4.3 Security and data handling

- Treat input from users, files, URLs, APIs, web views, devices, and inter-process messages as untrusted.
- Validate types, required fields, formats, ranges, allowed values, file sizes, and payload sizes at the boundary.
- Escape untrusted output for the context in which it is rendered.
- Use allowlists when the valid set of values is known.
- Store the minimum personal or sensitive data needed for the feature.
- Do not include secrets or personal data in logs, screenshots, fixtures, examples, or error messages.
- Use secure platform storage for credentials and sensitive tokens when they must be stored on a device.
- Keep sample data fictional and safe to publish, even when the repository is currently private.
- Review new dependencies and network calls for security and privacy implications.

### 4.4 Errors and logging

- Handle expected failure states explicitly.
- Show users a concise message that explains what they can do next.
- Log enough technical context to diagnose failures during development without logging secrets or unnecessary personal data.
- Make verbose or debug logging disable-able for production builds.
- Do not display stack traces, raw database errors, private paths, or internal credentials to end users.
- Include timestamps and relevant source context in persistent diagnostic logs.
- Write local development logs to `.temporary/logs/` unless a platform-standard diagnostic system is more appropriate.

### 4.5 User interface and accessibility

Every user interface must support both light and dark appearance.

- Follow the operating system or browser preference by default.
- Use semantic or design-token colours so both appearances remain consistent.
- Check text, controls, borders, focus states, charts, images, and disabled states in both appearances.
- Maintain readable contrast and do not communicate meaning through colour alone.
- Support keyboard navigation, visible focus, meaningful labels, scalable text, and assistive technology where the platform supports them.
- Respect reduced-motion and similar accessibility preferences when animation is present.

For macOS-hosted verification, use [.agents/scripts/macos-appearance.sh](.agents/scripts/macos-appearance.sh) to choose the test appearance. The agent may choose the order, but must test both `light` and `dark`, restart affected applications after switching, and restore the original macOS appearance before reporting completion. Use the script's `run` command for command-driven checks because it restores automatically; after a manual session started with `set`, run `restore` and then `status`.

### Conditional references

Read the referenced guidance before working in the matching area. These documents contain detailed rules and examples that do not belong in the always-loaded contract.

- Before creating or updating `README.md`, read [README requirements](docs/agents/readme.md).
- Before creating directories, adding tooling, or changing `.gitignore`, read [repository structure and hygiene](docs/agents/repository.md).
- Before creating, moving, or removing a Git worktree, read [worktree location and cleanup](docs/agents/repository.md#git-worktrees).
- Before adding or changing user-facing text, read [localization requirements](docs/agents/localization.md).
- When `web/` exists or the task concerns a PHP web application, read [web project requirements](docs/agents/web.md) before editing, testing, or deploying web code.
- When `ios/`, `watchos/`, or `macos/` exists, read [Apple platform requirements](docs/agents/apple.md) before editing, testing, signing, distributing, or deploying Apple code.
- When a task matches an installed skill, read and follow that skill. Keep repeatable operational procedures in skills instead of duplicating them here.
- When the task concerns GitHub issues or labels, read the relevant documents in [docs/agents](docs/agents/).
- When the task introduces or changes domain terminology, read [domain guidance](docs/agents/domain.md).

## 5. Internet access

Internet access may be used for technical research and documentation.

- Prefer primary and official documentation.
- For Apple development, prefer developer.apple.com and swift.org.
- For PHP, prefer php.net.
- For WordPress, prefer developer.wordpress.org.
- Never include source code, credentials, API keys, private project data, file contents, personal information, or secrets in web searches.
- Never upload project files to external services.
- Use web search to find information, not to share project context.

## 6. Verification and definition of done

Completion is a verification claim. Before describing work as complete, implemented, fixed, or ready for use:

1. Translate the request, specification, and acceptance criteria into checkable outcomes. Review the complete change, including untracked files, and confirm that every outcome is satisfied without unrelated refactoring.
2. Run the relevant tests, linting, type checks, builds, browser checks, simulator checks, or other verification required by the applicable guidance.
3. Fix failures caused by the current work and repeat the affected checks.
4. Confirm that no secrets, private data, temporary artifacts, local databases, uploads, or machine-specific settings are included.
5. Confirm that required source files, assets, manifests, lock files, migrations, schemas, scripts, and safe configuration examples are present.
6. Update the applicable README and documentation when behaviour, setup, configuration, dependencies, supported platforms, localization, or deployment changes.
7. Check affected interfaces in light and dark appearance, required languages, accessibility states, and important failure states when applicable.
8. Report which conditional documents and skills were applied, and state any unverified behaviour, external dependency, unavailable environment, or remaining blocker precisely.

Every checkable outcome must have evidence. When an applicable check cannot be performed, report it as unverified and do not present the work as fully verified.

For documentation-only changes, inspect the diff, verify internal links and command names, and confirm that instructions do not contradict one another.

## 7. Gitignore and repository hygiene

- Ignore generated, temporary, local, secret, credential, signing, build, cache, coverage, log, database, upload, and machine-specific files where applicable.
- Keep `.temporary/` contents and `.sync/` contents ignored. Do not inspect, modify, delete, execute, or derive rules from `.sync/` unless the user explicitly asks.
- Do not ignore files required to build, test, or run a fresh clone.
- Before completing work, use `git status` and Git ignore diagnostics to confirm that required files are tracked and private files are ignored.
- Keep project tooling in `scripts/` and agent tooling in `.agents/`; production code must not depend on local maintenance scripts.

## 8. Git and Pull Request workflow

`main` is the canonical, complete, and distributable version. Do not make unfinished changes directly on `main`; use a descriptive `feature/`, `bugfix/`, `docs/`, or `chore/` branch unless already in an isolated task worktree.

Before delivery, review `git status` and `git diff`, keep unrelated pre-existing changes out of the task, and run the applicable verification. Do not commit, push, create a Pull Request, or merge merely because implementation is complete.

The exact message `ship` authorizes the complete GitHub delivery workflow for an already implemented and verified change: inspect the tree, check for missing or private files, fetch and update from `origin/main`, resolve conflicts, commit, push, create a Pull Request targeting `main`, check mergeability and required reviews, merge when valid, and remove the remote task branch after a successful merge when repository policy permits it. `ship` does not authorize implementation; `/implement-spec` or an exact standalone `implement` message remains required.

Before `ship` commits or merges, confirm that all delegated work is complete, reviewed, and verified. A status report, partial result, or inactive response is not completion. If delegated work is still active or its result has not been reviewed, wait or ask only for neutral status or support information; do not rush, duplicate, interrupt, or take over the work. Never force-push or rewrite shared history.

## Agent skills

### Issue tracker

Use the `gh` CLI for issues and specs in `florisvandesande/BirdWeatherPainting`. See [issue tracker guidance](docs/agents/issue-tracker.md).

When `gh` in the restricted workspace reports an invalid token or cannot reach `api.github.com`, retry it through the host-accessible authorized command context so it can use the macOS keyring session. If that context is authenticated, continue there instead of asking the user to reauthenticate or provide a token. Before the first write, verify the repository with `gh repo view`; never print or copy the token.

### Triage labels

Use the five default labels `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See [triage labels](docs/agents/triage-labels.md).

### Domain docs

Use the single-context layout with `GLOSSARY.md` at the repo root and `docs/adr/` for architecture decision records. See [domain guidance](docs/agents/domain.md).
