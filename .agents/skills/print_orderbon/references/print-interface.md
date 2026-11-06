# PT-210 Print interface reference

This document records the current local implementation details for the `pt210-print` skill. It is a reference for an LLM implementing or diagnosing an integration, not a replacement for the public `pt210print` command.

## Repository and runtime locations

- CLI source: `scripts/pt210print`
- Installed CLI: `/usr/local/bin/pt210print`
- Default app: `/Users/florisvandesande/Applications/PT210Print.app`
- App Group: `group.nl.florisvandesande.pt210print`
- Bridge requests: `~/Library/Group Containers/group.nl.florisvandesande.pt210print/Bridge/Requests/`
- Bridge results: `~/Library/Group Containers/group.nl.florisvandesande.pt210print/Bridge/Results/`
- URL scheme: `pt210print://job?id=<UUID>`

The CLI supports `PT210PRINT_APP_PATH` to override the app path. Its optional `PT210PRINT_GROUP_ROOT` override exists for isolated command-side testing, but a normal integration must use the same App Group container as the installed app.

## Source mapping

The command maps content to a version-one shell request as follows:

| CLI source | `contentKind` | Payload fields |
| --- | --- | --- |
| `--text` | `text` | `payloadFilename: input`; no extension |
| `--markdown` | `markdown` | `payloadFilename: input`; no extension |
| `--html` | `html` | `htmlFilename: html`; optional `cssFilename: css` |
| `--file` | `file` | `payloadFilename: input`; `payloadExtension` from the filename |
| `--image` | `image` | `payloadFilename: input`; `payloadExtension` from the filename |

The request manifest is a property list. The payload filenames are deliberately fixed. A caller must not place an arbitrary path in a manifest.

Example manifest for HTML with an external CSS file:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>version</key><integer>1</integer>
<key>id</key><string>REQUEST-UUID</string>
<key>contentKind</key><string>html</string>
<key>qualityPresetID</key><string>text</string>
<key>copies</key><integer>1</integer>
<key>feedLinesAfter</key><integer>3</integer>
<key>prepare</key><false/>
<key>htmlFilename</key><string>html</string>
<key>cssFilename</key><string>css</string>
</dict></plist>
```

The request directory must be named with the same UUID as the request, and the manifest must be `request.plist`. Write a temporary manifest in that directory and atomically rename it to `request.plist`.

## Validation rules

- `version` must be `1`.
- `id` must equal the UUID from the directory and URL.
- `copies` must be an integer from `1` through `20`.
- `feedLinesAfter` must be an integer from `0` through `20`.
- `qualityPresetID` may be `text`, `imageHighQuality`, `custom`, `fast`, `balanced`, or `highQuality`.
- HTML accepts only `htmlFilename: html`, optional `cssFilename: css`, and no payload extension.
- Text and Markdown accept only `payloadFilename: input`, with no extension and no CSS.
- File and image requests accept only `payloadFilename: input` plus a supported extension.
- Supported extensions are `txt`, `md`, `markdown`, `html`, `htm`, `jpg`, `jpeg`, `png`, `heic`, and `heif`.
- Image requests are limited to `jpg`, `jpeg`, `png`, `heic`, and `heif`.
- Text, Markdown, HTML, and CSS are UTF-8 and limited to 5 MiB per text payload.
- Images are limited to 25 MiB by the CLI.

The application validates the structure again. A caller must not rely on command-line validation alone when implementing another bridge client.

## Result schema

Results are JSON objects written atomically to `Bridge/Results/<UUID>.json`:

```json
{
  "durationSeconds": 0.42,
  "errorCode": null,
  "id": "REQUEST-UUID",
  "jobID": "APP-JOB-UUID",
  "message": "Print job completed.",
  "status": "completed"
}
```

`jobID`, `message`, `errorCode`, and `durationSeconds` may be absent or `null` depending on the result. Intermediate status is `accepted`. Terminal statuses are `completed`, `prepared`, and `failed`.

Common application error codes include:

| Error code | Meaning |
| --- | --- |
| `invalid_request` | The manifest failed validation. |
| `request_not_found` | The app received a URL for which the request directory was missing. |
| `payload_not_found` | A declared fixed payload file was missing. |
| `bluetooth_unavailable` | Bluetooth was unavailable to the app. |
| `printer_not_found` | No compatible PT-210 was found. |
| `connection_failed` | Bluetooth connection failed. |
| `connection_timed_out` | Bluetooth connection timed out. |
| `write_failed` | Data transmission to the printer failed. |
| `render_failed` | Rendering failed before transmission. |
| `unsupported_content` | The declared content could not be processed. |
| `input_too_large` | The renderer rejected an oversized text payload. |
| `storage_unavailable` | The app could not access its App Group storage. |
| `cancelled` | The job was cancelled. |

## Renderer and transport constraints

All request types are converted through the same pipeline:

```text
content -> renderer -> grayscale -> dithering -> 1-bit bitmap
        -> ESC/POS raster strips -> Bluetooth Low Energy chunks -> PT-210
```

The print width is 384 pixels. The app controls rasterization, ESC/POS encoding, Bluetooth connection, write pacing, backpressure, cancellation, and paper feed. A shell client must not send ESC/POS bytes or Bluetooth writes itself.

HTML is loaded into a non-persistent local web view with JavaScript disabled. The renderer does not provide a shell bridge, does not fetch remote resources, and keeps its existing content-security policy. CSS is allowed only as a local file or inline CSS supplied with an HTML request.

Requests are serialized by `ShellBridgeCoordinator`. A caller may submit several commands sequentially, but it should not create parallel raw transmission paths or assume that two jobs print concurrently.

## UI-only capabilities

The shell interface intentionally has a smaller option set than the iOS application:

- image fit width, actual size, centered, and square crop;
- brightness, contrast, gamma, threshold, dithering, and inversion;
- detailed custom image settings;
- thermal preview and interactive prepared-job selection;
- Share Sheet and Shortcuts-specific input handling.

Use the app, Share Extension, or iOS Shortcuts when those controls are required. The shell `custom` quality value reuses the saved app profile; it does not carry individual image settings in the command.

## Failure diagnosis

1. Validate the command locally with `pt210print ... --help`, supported extensions, readable paths, UTF-8 text, and size limits.
2. If the app is not found, set `PT210PRINT_APP_PATH` to the installed `.app` bundle.
3. If the command times out, inspect the app and printer before retrying. The app may have received the request and may already be printing.
4. If the result is `failed`, use `errorCode` rather than parsing the message.
5. Test with a short `--text` request before retrying HTML, large images, or multiple copies.

A successful prepared job verifies request validation, payload transfer, and app-side preparation only. It does not verify Bluetooth discovery or a physical print.
