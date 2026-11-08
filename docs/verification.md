# Verification record

Date: 2026-11-08.

## URL-only settings checks

- In Chrome 157, the local URL-settings fixture passed its bare URL, complete
  station URL with an unknown field, partial URL prefill, invalid optional
  values, duplicate known field, and nearby partial URL cases.
- Station and nearby save checks produced canonical URLs with the agreed
  defaults, source-specific fields, language, and night schedule. Nearby
  coordinates were rounded to five decimal places.
- Language preview changed immediately and cancel restored the language from
  the current URL. The artwork information page retained artwork credits and
  no longer includes missing-artwork reporting. Setup loaded while a fixture
  made `localStorage` access throw.
- Chrome screenshots were visually inspected for the welcome/setup screen at
  mobile and large desktop sizes, including dark appearance. Safari was not
  exercised in this pass.
- The app scripts and page contain no `localStorage` or `sessionStorage`
  access. The fixture temporarily seeds old settings to verify they are
  ignored and restores the prior values on unload.

## Completed checks

- The painting chrome changes were visually inspected in Chrome 157 at 390 ×
  844 and 1440 × 900. Single mode keeps the full artwork and both controls in
  view; the settings control is a sliders icon. The collage screenshot at
  390 × 844 has no title or footer, retains room for both controls, and shows
  complete birds and their labels. The loading state also showed a local perch
  with the loading message at 1.2rem.
- The Chrome collage fixture passed counts 1–32 in portrait and landscape,
  including full image bounds and non-overlap checks. Its empty-day case showed
  only a perch; its missing-art case kept the species labels and substituted a
  perch in that species' slot. The real artwork fallback fixture passed for
  both single and collage modes using local perch PNGs.
- Light and dark control appearances were visually checked at mobile size. The
  dark controls use the matching dark fill. Safari was not exercised in this
  visual pass.

- The station search, setup/save/restore, latest-bird display, artwork
  information page, and earlier artwork flow were exercised in
  Chrome 157 at 390 × 844, 820 × 1180, 1024 × 768, 1440 × 900, and 2560 ×
  1440 in light and dark browser appearances. No viewport overflow was found
  in those earlier flows.
- The collage implementer used JavaScriptCore to check paginated detections,
  unique-species ranking and tie breaks, date rollover, API failures, URL
  settings, nearby-coordinate privacy, and translation keys in all seven
  locales. A separate data check covered 96,333 UTC offsets across 598 time
  zone names and aliases.
- The local artwork converter processed 1,355 bird illustrations and nine
  perches. Representative converted images were inspected at their prepared
  size. The full app has not yet been exercised with the new Fugleramme
  collection in a browser.

## Still unverified

- The complete collage and new Fugleramme flows have not received a full
  browser pass at the supported viewport sizes.
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
