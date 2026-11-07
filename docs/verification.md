# Verification record

Date: 2026-11-07.

## Completed checks

- On 2026-11-07, the painting markup passed structural checks for unique IDs,
  accessible control names and targets, and removed routine painting notes.
  Node's JavaScript parser accepted the changed painting, setup, and collage
  scripts. These checks do not verify rendered layout or interactions.
- The station search, setup/save/restore, latest-bird display, artwork
  information page, and earlier licensed-art fallback were exercised in
  Chrome 157 at 390 × 844, 820 × 1180, 1024 × 768, 1440 × 900, and 2560 ×
  1440 in light and dark browser appearances. No viewport overflow was found
  in those earlier flows.
- The collage implementer used JavaScriptCore to check paginated detections,
  unique-species ranking and tie breaks, date rollover, API failures, URL
  settings, nearby-coordinate privacy, and translation keys in all seven
  locales. A separate data check covered 96,333 UTC offsets across 598 time
  zone names and aliases.
- The daily-species data fixture passed a controlled JavaScriptCore run with 34
  unique species and a collage limit of two. It confirmed that collage ranking,
  membership, and the omitted count stay unchanged while the information page
  receives metadata for every species in API-sized batches.
- The local artwork converter processed 1,355 bird illustrations and nine
  perches. Representative converted images were inspected at their prepared
  size. The full app has not yet been exercised with the new Fugleramme
  collection in a browser.
- The artwork generator now emits one light and one dark JPEG for each of the
  1,355 bird illustrations and nine perches. A catalogue check confirmed all
  1,364 dark paths exist; the dark set adds 83.7 MiB. The blackbird, blue tit,
  stonechat, and pine-bough dark previews were inspected. These file checks do
  not verify browser rendering or scrolling.

## Still unverified

- The simplified latest-bird painting changes from 2026-11-07 were not
  exercised in a browser. The Computer Use service failed to start and exposed
  no browser or app inventory, so no browser version, viewport, appearance, or
  interaction result is available. Chrome and Safari checks at 390 × 844,
  820 × 1180, 1440 × 900, and 2560 × 1440 in light and dark appearances remain
  required.
- The shared Settings canvas, Settings scrolling, and theme-specific artwork
  selection from ticket #3 have not yet received a browser check. CUA rejected
  the local `file://` URL under its browser URL policy, and the sandbox denied
  binding a local Python HTTP server. The parent agent will complete the
  browser-visible check from its authorized preview environment.
- The complete collage and new Fugleramme flows have not received a full
  browser pass at the supported viewport sizes.
- Ticket #5's daily-species list and inline artwork details have not received a
  Chrome or Safari interaction and layout check. The local preview could not be
  opened from this subagent because the browser URL policy blocked `file://`
  pages and the local server was not reachable; the parent agent can verify the
  browser-visible seam from its preview environment.
- The app has not been checked in Safari on a physical iPad 2 at 1024 × 768.
  No physical iPad was available to this session, so the device's iOS and Safari
  versions and all touch, installation, and Auto-Lock behavior remain
  unverified. Do not claim iOS 9 compatibility until that acceptance pass
  succeeds.
- Safari WebDriver was unavailable because Remote Automation was not enabled
  on the current Mac. This check did not change the Mac's automation settings.

## Environment note

The repository's unrelated web-server synchronization shell check refers to a
script path that does not exist in this checkout. It is outside the static app
and was not changed as part of this work.
