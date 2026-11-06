# Web Project Requirements

Read this reference before changing a project that contains `web/` or another PHP web application.

## Runtime and boundaries

- Use PHP 8.3 or later, HTML, CSS, and vanilla JavaScript for production.
- Add `declare(strict_types=1);` to every PHP source file.
- Follow PSR-12 formatting and PSR-4 when autoloading is used.
- Prefer small procedural functions. Introduce classes only when state or complexity clearly warrants it.
- Use `snake_case` for PHP functions and variables.
- Render useful HTML on the server first and add JavaScript as progressive enhancement.
- Use `prefers-color-scheme` for the default light or dark appearance. A manual theme choice may override it when the application provides appearance settings.
- Do not use React.
- Python is allowed only for optional local tooling in `scripts/`; production requests must not depend on Python or shell commands.
- Keep PHP application code, browser assets, data, uploads, and API endpoints in clearly named subdirectories.

## URLs and API responses

- Public page and API URLs must not expose the `.php` extension.
- Generate only canonical extensionless links, such as `/about` and `/api/status`.
- Redirect direct `.php` requests to the canonical clean URL when feasible.
- Use Apache rewrites, a front controller, or another shared-hosting-compatible router.
- Return API responses as JSON with the correct status code and content type.
- Use a consistent error structure such as `{ "error": { "code": "invalid_input", "message": "The supplied value is invalid." } }`.
- Keep endpoint flow explicit: parse and validate input, call business logic, then build the response.
- Version contracts that cross an app bridge or may evolve incompatibly.

## PHP and browser security

- Escape user-generated HTML by default. If limited HTML is required, document an allowlist sanitizer for permitted tags and attributes.
- Use prepared statements for every database query containing variable data.
- Validate `$_GET`, `$_POST`, `$_FILES`, cookies, headers, and JSON bodies before use.
- For uploads, allowlist MIME types and extensions, enforce size limits, generate random server-side filenames, and never trust a user-provided filename.
- Store uploads outside the public document root when hosting permits it.
- Store SQLite databases under `web/data/database/`, never under uploads or the public asset tree.
- Do not expose production errors or stack traces in HTTP responses.

## Shared-hosting target

The supported shared-hosting environment is PHP `8.3.29` through FPM/FastCGI, Apache 2 with HTTP/2, Linux with timezone `Europe/Amsterdam`, `memory_limit` `512M`, `max_execution_time` `300`, `post_max_size` `64M`, `upload_max_filesize` `64M`, `max_file_uploads` `20`, and enabled `open_basedir`.

Do not rely on `exec`, `system`, `passthru`, `shell_exec`, `proc_open`, `proc_close`, `popen`, `dl`, or restricted `posix_*` functions. Use only project-controlled writable paths under `web/data/` and `web/uploads/`. Use `sys_get_temp_dir()` for short-lived production temporary files when appropriate and permitted by the host.

Available capabilities include PDO with MySQL and SQLite drivers, Redis, Imagick, and GD. Do not adopt Redis unless the project explicitly needs it. When server-side image decoding is required, accept JPEG, PNG, or WebP. GD supports JPEG, PNG, and WebP but not AVIF. Imagick is available but cannot decode HEIC or HEIF. Do not implement production image work by shelling out to ImageMagick or FFmpeg.

## Web verification

Run configured PHP and frontend checks when present, including PHPUnit, PHPStan, PHP style checks, JavaScript tests, and linters.

For every user-visible web change, verify the affected user flow in both the installed Google Chrome and Safari browsers on macOS. Exercise the flow at each of these CSS viewport profiles:

| Profile | Viewport |
| --- | --- |
| Mobile | `390 × 844` |
| Tablet | `820 × 1180` |
| Laptop | `1440 × 900` |
| Large desktop | `2560 × 1440` |

Repeat the required Chrome and Safari checks in both the light and dark macOS appearance. Use `.agents/scripts/macos-appearance.sh set light` or `.agents/scripts/macos-appearance.sh set dark` to choose the order, restart the affected browser and application after switching, and run `.agents/scripts/macos-appearance.sh restore` after each manual session. For command-driven checks, use `.agents/scripts/macos-appearance.sh run <light|dark> -- <command>` so restoration happens after success, failure, or interruption. Confirm the final state with `.agents/scripts/macos-appearance.sh status`.

Use the actual browsers, record their versions, appearance, and viewport, and check the visible result, interaction, browser console, and network errors. A test in only a Chromium or WebKit engine is not evidence that both Chrome and Safari passed. Code-level tests alone are insufficient.

For a change that affects only backend behaviour, verify only the affected user flow in both Chrome and Safari, in addition to the relevant API, integration, or contract checks. If no browser-accessible flow exists, state that browser verification was not applicable and report the technical evidence instead.

Use this loop until the required checks pass or a concrete blocker remains:

1. Reproduce or exercise the relevant flow.
2. Record the actual result and browser errors.
3. Fix problems caused by the current work.
4. Repeat the browser test.

Do not state that a user-visible web feature works or a web bug is fixed until the required Chrome and Safari checks pass. If a required browser check is impossible, state precisely what remains unverified and why.
