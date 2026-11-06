---
name: macos-direct-distribution
description: Prepare and verify signed, notarized DMGs and Sparkle 2 appcasts for macOS apps distributed or tested outside the Mac App Store. Use for external macOS test builds and direct releases; do not use for iOS, watchOS, or Mac App Store distribution.
---

# macOS Direct Distribution

Prepare a macOS app for installation on another Mac without uploading or publishing anything. Use the bundled script for the repeatable packaging work, then report the local artifacts and any checks that could not be completed.

## Boundaries

- Work only with a release `.app` intended for direct macOS distribution. Use TestFlight or another Apple-supported route for iOS and watchOS.
- Never share a loose `.app` or a build that is unsigned, unnotarized, or unstapled.
- Never upload artifacts, edit a live appcast, or mutate a remote server without a separate explicit user instruction.
- Never put Developer ID certificates, EdDSA private keys, Apple credentials, app-specific passwords, or notarization credentials in the repository, command arguments, logs, manifests, or published files. Use macOS Keychain identities, a `notarytool` Keychain profile, and Sparkle's Keychain-managed EdDSA key.
- Build temporary files only below the repository's `.temporary/` directory. The script copies the input app before signing and does not modify the original bundle.

## Required app configuration

Before packaging, confirm that the app:

- embeds Sparkle 2 and has an update user interface appropriate to the project;
- declares `SUPublicEDKey` and an HTTPS `SUFeedURL` in `Info.plist`;
- uses a user-visible `CFBundleShortVersionString` and a monotonically increasing `CFBundleVersion`;
- is built with Hardened Runtime and only the entitlements it needs;
- uses a stable feed for normal releases and a separate beta feed for external testing.

The feed URL must be `<download-base-url>/<channel>/appcast.xml`, where `channel` is `stable` or `beta`. Do not publish a beta artifact in the stable directory or point a stable build at the beta feed.

## Prepare a release

Run `scripts/prepare_release.sh` from the repository root. Supply explicit values rather than relying on machine-specific defaults:

```bash
.agents/skills/macos-direct-distribution/scripts/prepare_release.sh \
  --app macos/build/Example.app \
  --channel beta \
  --download-base-url https://downloads.example.com/example \
  --output-dir .temporary/releases/example \
  --signing-identity "Developer ID Application: Example Company (TEAMID)" \
  --notary-profile example-notary \
  --generate-appcast /path/to/Sparkle/bin/generate_appcast
```

Use `--dry-run` first. It validates local inputs, tools, bundle metadata, channel separation, and feed configuration without signing, notarizing, generating files, accessing the network, or changing the output directory.

A real run:

1. Copies the app into a private staging directory under `.temporary/` and signs the copy with the selected Developer ID identity and a secure timestamp.
2. Verifies the app signature and Gatekeeper assessment.
3. Creates a read-only UDZO DMG containing the app and an `Applications` symlink.
4. Signs the DMG, submits it through `notarytool`, staples the notarization ticket, and verifies Gatekeeper and stapling.
5. Adds the DMG to only the selected channel, runs Sparkle `generate_appcast`, and checks the feed URL, version, build, enclosure URL, and EdDSA signature.
6. Writes the DMG, `appcast.xml`, generated deltas when applicable, and a non-secret `release-manifest.txt` to `<output-dir>/<channel>/`.

The script deliberately does not upload these files. Publish the complete channel directory to the matching static HTTPS location only after inspecting it. Upload the versioned artifacts before replacing `appcast.xml`, so clients never see a feed that points to a missing download.

## Verify on an external Mac

Do not call the release externally verified until a different Mac has completed all relevant checks:

- download and open the DMG over HTTPS;
- drag the app through the Applications shortcut and launch it without a Gatekeeper bypass;
- confirm the expected version and update channel;
- launch an older build on the same channel and confirm that Sparkle detects the new version, validates it, asks before installation, installs it, and relaunches successfully;
- confirm that stable clients do not receive beta releases.

If a Developer ID identity, notarization access, Sparkle EdDSA key, HTTPS host, older build, or external Mac is unavailable, stop at the last safe check and state exactly what remains unverified.

## Project README

Keep the project README concise and project-specific. It must document the DMG installation steps, stable and beta appcast URLs, which builds use each channel, the exact packaging command, the server directory to which each generated channel is uploaded, and how to roll back by restoring the previous appcast while retaining its referenced artifact. Link to this skill instead of copying its generic procedure.
