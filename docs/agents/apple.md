# Apple Platform Requirements

Read this reference before changing a project that contains `ios/`, `watchos/`, or `macos/`.

## General Apple rules

- Use Swift for new source code unless an existing target requires Objective-C.
- Prefer SwiftUI for new interfaces. Use UIKit, WatchKit, or AppKit when the existing architecture or required capability makes it clearer.
- Prefer Apple frameworks and small, testable components over third-party abstractions.
- Keep each target's capabilities, entitlements, assets, configuration, and tests with that target.
- Put code in `shared/` only when multiple targets compile or consume it. Keep platform adapters separate from shared business logic.
- Declare supported operating-system and Xcode versions in the README.
- Build and work locally with Xcode 15.2 and the iOS 17.2, macOS 14.2, and watchOS 10.2 SDKs. Do not require a newer local Xcode version; use Xcode Cloud or another documented remote build environment when a newer version is required.
- Keep bundle identifiers, app groups, URL schemes, capabilities, and target relationships documented in one discoverable place.
- Validate data received from URLs, share extensions, notifications, connectivity sessions, web views, and other processes.
- Never hardcode backend secrets, API keys, credentials, certificates, or provisioning profiles.
- Use platform-provided secure storage for sensitive device data.
- Use string catalogs or the current Apple localization mechanism for user-facing text.
- Use semantic system colours and verify screens in light and dark appearance.
- Support Dynamic Type, VoiceOver labels, logical focus order, and appropriate input methods.
- Commit the Xcode project, workspace, scheme, package manifest, and resolved dependency files required for a fresh clone to build.
- Do not commit personal signing data, user-specific Xcode state, DerivedData, archives, or exported credentials.
- Explain signing, capabilities, test devices, distribution, and Apple Developer account requirements in the README.

## iOS

Keep the iOS application and iOS-only extensions under `ios/`. Keep share extensions, widgets, notification extensions, and other targets small and explicit. If the app embeds web content, isolate `WKWebView` setup, message handlers, and native feature adapters. Allowlist bridge message names and validate every bridge payload. Restrict web-view navigation to trusted schemes and domains where feasible. Require explicit user intent before a web bridge invokes a privileged native action. The web application must remain usable in a normal browser when the iOS bridge is optional.

Repositories with an iOS app must use `.agents/scripts/deploy_ios_to_device.sh` for local physical-device deployments. The script may build only the Xcode project or workspace contained in the current repository and must not call deployment scripts, projects, provisioning helpers, or other repository-specific resources outside the current repository.

Configure the script with the repository-relative Xcode container path, a committed shared scheme, the `Debug` configuration unless documented otherwise, and the development team only when project settings do not select it. Make the script executable.

List devices with:

```bash
./.agents/scripts/deploy_ios_to_device.sh --list
```

Deploy with an explicit CoreDevice identifier:

```bash
./.agents/scripts/deploy_ios_to_device.sh --device DEVICE_IDENTIFIER
```

Unlock the device, trust the Mac, enable Developer Mode, and pair the device in Xcode before deploying. Wireless deployment requires an existing pairing and network reachability. If automatic signing fails, enable **Automatically manage signing**, select the correct team, and confirm that the device is registered for development. Build output remains under `.temporary/ios-deploy/` and deployment logs under `.temporary/logs/`; neither location may be committed.

## watchOS

Keep the watch experience focused on short, glanceable interactions. Do not assume that the paired iPhone is always reachable. Define and test offline, delayed-sync, duplicate-message, and reconnect behaviour. Minimize background work, network use, memory use, and battery impact. Keep WatchConnectivity payloads small, versioned when necessary, and validated on receipt. Document whether the watch app is independent or requires its companion iOS app.

## macOS

Use standard macOS window, menu, keyboard, focus, drag-and-drop, and file-access conventions. Explain sandboxing, entitlements, file permissions, login items, helper tools, and accessibility permissions when the project uses them. Store user data in appropriate macOS application support locations rather than inside the application bundle. Document signing, hardened runtime, notarization, packaging, and distribution when the app is distributed outside local development.

For every macOS build shared outside the development machine, use the repository's `macos-direct-distribution` skill. Never share a loose or unnotarized `.app`; distribute a signed, notarized, and stapled DMG containing the app and an Applications shortcut. Keep the README limited to project-specific DMG installation instructions, stable and beta appcast URLs, the selected update channel, the exact skill command, the upload destination, and a rollback procedure. Only install a macOS application locally under `/Users/florisvandesande/Applications` after it has been built, tested, and confirmed to work.

## Apple verification

For every affected Apple target, run the configured unit and user-interface tests, an `xcodebuild` build for the relevant scheme and destination, and configured static checks such as SwiftLint. Test localization, light and dark appearance, accessibility text sizes, and important failure states. For macOS-hosted tests, use `.agents/scripts/macos-appearance.sh` to select each appearance, restart the affected application after switching, and always run `restore` afterward; use its `run` command for command-driven checks. This macOS script does not replace the appearance controls of an iOS, iPadOS, or watchOS simulator or physical device. Verify both sides when changing shared code, app groups, extensions, or device communication.

When an iOS application must run on a physical device, deploy and exercise the affected flow on a compatible physical iPhone or iPad when one is available. A simulator does not replace an available physical-device test. If no suitable physical device is available, use the simulator, report the missing physical-device verification explicitly, and do not describe the result as fully verified.

Record exact schemes, destinations, and commands in the README. If signing, unavailable hardware, simulator limitations, or external services prevent a check, report the exact limitation and do not describe the result as fully verified.
