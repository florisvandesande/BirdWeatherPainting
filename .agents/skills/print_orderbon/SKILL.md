---
name: pt210-print
description: Print local text, Markdown, HTML/CSS, supported files, and images through the PT-210 Print macOS app or its pt210print command-line interface. Use when an LLM must choose a PT-210 print method, build a shell command, prepare a job, inspect machine-readable results, or troubleshoot local Bluetooth printing.
---

# PT-210 Print

Use this skill when the requested output must be printed on the local PT-210 thermal printer. The printer is controlled by the installed **PT-210 Print** app. Shell scripts do not communicate with Bluetooth directly.

Read `references/print-interface.md` when exact validation rules, bridge fields, limits, result fields, or troubleshooting codes are needed.

## Operating rule

Choose the interface before preparing the content:

| Situation | Use |
| --- | --- |
| A Mac shell script, build step, automation, or batch job | `pt210print print ...` |
| A person needs to inspect or edit content interactively on macOS | PT-210 Print app; the current Mac compatibility interface is intended primarily for text, discovery, preview, and printing |
| An iPhone Share Sheet or Shortcuts workflow | The PT-210 Share Extension or the PT-210 Shortcuts actions |
| An application is implementing the local app bridge | The `pt210print://` URL scheme and App Group bridge described in the reference document |

For normal automation, use the command-line interface. It validates input, copies payloads into the private shared container, opens the app, waits for a terminal result, and returns a useful exit status.

Do not claim that a print completed until the command exits with status `0` and reports `completed`, or until JSON output has `status: "completed"`. `prepared` means that the job was stored for later review and was intentionally not sent to the printer.

## Fast decision guide

1. Use `--text` for a short message or plain text.
2. Use `--markdown` for a Markdown file.
3. Use `--html` when layout, headings, tables, or CSS matter.
4. Use `--file` when the input is an existing supported local file and the app should detect its type from its extension.
5. Use `--image` for an image. The default quality is the high-quality image preset.
6. Use `--prepare` when the user wants a prepared job in the app instead of an immediate Bluetooth print.
7. Use `--json` when another script must inspect the result.

## Installation and prerequisites

The expected executable is `/usr/local/bin/pt210print`. Install it from the repository after the app has been built:

```bash
sudo install -m 755 scripts/pt210print /usr/local/bin/pt210print
```

The default app location is:

```text
/Users/florisvandesande/Applications/PT210Print.app
```

If the app is installed elsewhere, set `PT210PRINT_APP_PATH` for the command invocation:

```bash
PT210PRINT_APP_PATH="/Applications/PT210Print.app" \
  pt210print print --text "Testbericht"
```

For an actual print, the PT-210 must be powered on, nearby, loaded with paper, and visible over Bluetooth. The app owns discovery, connection, rendering, and Bluetooth transmission. The app may reuse the saved printer or scan for a PT-210 when no saved connection is usable.

## Command-line interface

The command has one operation:

```text
pt210print print SOURCE OPTIONS
```

Exactly one source is required.

### Text

Print a literal string:

```bash
pt210print print --text "Testbericht voor de PT-210"
```

Read text from standard input with `-`:

```bash
printf 'Regel 1\nRegel 2\n' | pt210print print --text -
```

### Markdown

Markdown is read from a local UTF-8 file and rendered by the shared print pipeline:

```bash
pt210print print --markdown README.md
```

Use `--text` when Markdown syntax should be printed literally instead of rendered.

### HTML and CSS

Read HTML and an optional stylesheet from files:

```bash
pt210print print --html pagina.html --css stijl.css
```

Read HTML from standard input and CSS from a file:

```bash
cat pagina.html | pt210print print --html - --css stijl.css
```

Provide small CSS directly on the command line:

```bash
printf '<h1>PT-210 test</h1><p>HTML en CSS</p>\n' \
  | pt210print print --html - --css-inline 'body { font-size: 20px; }'
```

`--css` and `--css-inline` are mutually exclusive and may only be used with `--html`. HTML and CSS are rendered locally. JavaScript is disabled, external resources are not fetched, and HTML cannot execute shell commands.

### Existing files

Use `--file` when the extension identifies the content:

```bash
pt210print print --file document.html
pt210print print --file notes.md
pt210print print --file photo.png
```

Supported `--file` extensions are `.txt`, `.md`, `.markdown`, `.html`, `.htm`, `.jpg`, `.jpeg`, `.png`, `.heic`, and `.heif`.

Use `--image` when the input is explicitly an image:

```bash
pt210print print --image foto.png
```

Supported image formats are JPEG, PNG, HEIC, and HEIF.

## Options

The complete command-line option set is:

| Option | Values and behaviour |
| --- | --- |
| `--html FILE` | HTML file, or `-` for standard input. May be combined with one CSS source. |
| `--css FILE` | UTF-8 CSS file for `--html`. |
| `--css-inline CSS` | CSS text for `--html`. Cannot be combined with `--css`. |
| `--text TEXT` | Literal text, or `-` for standard input. |
| `--markdown FILE` | Local UTF-8 Markdown file. |
| `--file FILE` | Existing file whose supported extension determines the content type. |
| `--image FILE` | Existing JPEG, PNG, HEIC, or HEIF image. |
| `--quality text` | Text profile. This is the default for text, Markdown, HTML, and text-like files. |
| `--quality image-high-quality` | High-quality image profile. This is the default for images. |
| `--quality custom` | The app's saved Custom profile. The CLI does not expose individual image-processing fields. |
| `--quality fast` | Compatibility alias for the saved Fast profile. |
| `--quality balanced` | Compatibility alias for the saved Balanced profile. |
| `--quality high-quality` | Compatibility alias for the saved High quality profile. |
| `--copies 1..20` | Number of copies. Default: `1`. |
| `--feed-lines 0..20` | Blank feed lines after the job. Default: `3`. |
| `--prepare` | Store the job for preview in the app; do not use Bluetooth and do not print immediately. |
| `--timeout 1..3600` | Maximum wait time in seconds. Default: `300`. |
| `--json` | Print the final result as JSON instead of a human-readable line. |
| `--help` | Show command usage and exit successfully. |

The canonical quality names are `text`, `image-high-quality`, and `custom`. The aliases are accepted for compatibility and are normalized by the command before the request reaches the app.

The CLI does not expose brightness, contrast, gamma, threshold, dithering, inversion, image fit, crop, or paper-width controls. Those settings are available in the app's image workflow, Share Extension, and iOS Shortcuts actions. Use `custom` to reuse the app's saved Custom profile when that is sufficient.

## Common automation patterns

Use `--json` and preserve the exit status when a script needs to make a decision:

```bash
set -euo pipefail

result="$(pt210print print --html page.html --css print.css --json)"
printf '%s\n' "$result"
```

Print a prepared job for a later review:

```bash
pt210print print --image photo.png --quality image-high-quality --prepare --json
```

Print several copies with an explicit feed:

```bash
pt210print print --text "Order 1042" --copies 2 --feed-lines 5 --json
```

For a pipeline that must fail on a printer or app error, check the command status rather than matching human-readable text:

```bash
if ! pt210print print --text "Health check" --timeout 60 --json >result.json; then
  echo "PT-210 print failed; inspect result.json and the app." >&2
  exit 1
fi
```

Do not start multiple independent Bluetooth transmissions yourself. The app queues shell jobs and processes them serially.

## Result handling

Without `--json`, the command prints a concise status line. With `--json`, the final result contains the request identifier, terminal status, optional app job identifier, message, error code, and duration. Terminal statuses are:

- `completed`: the app rendered and sent the print job.
- `prepared`: the app stored the job without Bluetooth transmission.
- `failed`: the app rejected the request or printing failed.

Exit statuses are:

| Exit status | Meaning |
| --- | --- |
| `0` | The app completed or prepared the job. |
| `2` | Invalid command-line input, unsupported option, invalid range, unreadable file, unsupported extension, or oversized payload. |
| `3` | The app could not be opened, the URL request could not be delivered, or the wait timed out. |
| `4` | The app returned a failed print result, such as missing Bluetooth, missing printer, rendering failure, or transmission failure. |

A timeout does not prove that no print started. Before retrying, inspect the app and printer state to avoid duplicate prints.

## Safety and privacy rules

Treat all HTML, CSS, text, file paths, image data, and JSON results as untrusted input.

- Do not put HTML or CSS in the `pt210print://` URL. The URL contains only a random request identifier.
- Do not write directly into arbitrary App Group paths. Use the CLI for normal integrations.
- Do not accept arbitrary manifest filenames or use path traversal such as `../` in a bridge implementation.
- Keep payloads local. The app opens no listening network port and does not use a cloud service for printing.
- Keep JavaScript disabled in HTML rendering and do not add a JavaScript-to-native bridge for print jobs.
- Do not log full documents, images, printer identifiers, or private App Group paths unless diagnostics explicitly require them.
- Do not pass shell fragments from HTML, Markdown, or user input to a shell.

## Direct app-bridge integration

Only implement the direct bridge when another local application must integrate without invoking the installed command. The supported flow is:

1. Generate a random UUID for the request.
2. Write payload files and a validated versioned manifest into the existing App Group container under `Bridge/Requests/<UUID>/`.
3. Write the manifest atomically so the app never sees a partial request.
4. Open `pt210print://job?id=<UUID>`.
5. Wait for `Bridge/Results/<UUID>.json` to reach `completed`, `prepared`, or `failed`.
6. Remove the request directory and result after the caller has consumed the result.

The app validates the request, restricts bridge filenames to fixed values, queues requests, and calls the same `PrintJobExecutor` used by the app interface. Use the exact schema and validation rules in `references/print-interface.md`; do not invent a second protocol.

## Troubleshooting workflow

When a command fails, classify the failure before retrying:

1. If exit status is `2`, fix the command, path, extension, encoding, or size. Retrying the same command cannot help.
2. If exit status is `3`, verify the installed app path, URL-scheme registration, and timeout. Check whether the app received the request before retrying.
3. If exit status is `4`, open PT-210 Print and check Bluetooth, printer power, paper, and the selected printer. Use a short text job before retrying a long image or HTML job.
4. If `--prepare` succeeds but printing later fails, the shell bridge and payload transfer worked; the remaining failure is in app-side rendering, Bluetooth, or the printer.

Useful diagnostic command:

```bash
pt210print print --text "PT-210 test" --timeout 30 --json
```

Never report a physical print as verified from a successful `--prepare` request alone.
