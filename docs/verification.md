# Verification record

Date: 2026-11-08.

## URL-only settings checks

- The settings page was redesigned as a one-column screen with nearby defaults,
  source and view buttons, an always-visible species limit, a save-only action,
  a collapsed iPad guide, and a privacy note. Both light and dark backgrounds
  match the painting's artwork-information page.
- The base URL now preselects nearby, a 2 km radius, today's collage, 12
  species, automatic language, and disabled night mode without an incomplete
  link warning. A missing source in a partial URL defaults to nearby; an
  explicitly invalid source remains unselected.
- The station form accepts numeric IDs only and automatically selects an exact
  match. Location lookup keeps the coordinates editable. Settings remain in
  the URL; the setup page has no return/cancel button.
- The local setup fixture checks base and partial URLs, invalid source and
  values, station-ID auto-selection, location lookup, URL saving, language
  preview, and setup while browser storage access throws. The app does not read
  or write `localStorage` or `sessionStorage`.
- Chrome screenshots were visually inspected at 390 × 844 in light and dark
  appearance, at 320 × 740 in light appearance, and at 1440 × 1000 in light and
  dark appearance. The form stayed within the viewport at each measured size.
  Safari was not exercised in this pass.
- The app scripts and page contain no `localStorage` or `sessionStorage`
  access. The fixture temporarily seeds old settings to verify they are
  ignored and restores the prior values on unload.

## Completed checks

- The artwork information list was exercised in Chrome with a mocked BirdWeather
  response containing 65 unique species. Station and nearby daily queries
  returned all 65 for artwork-info; normal collage loading requested only its
  configured 32. Species details were fetched in batches of 32 in newest-first
  order. Local bird and perch PNGs, localized names and summaries, missing or
  unsafe links, accordion behavior, empty-day, and API-error states passed.
- The artwork information page was visually checked in Chrome at 390 × 844
  and 1440 × 900 in light and dark appearances. Both viewports had no horizontal
  overflow; mobile links remained within their rows. The expanded summary and
  bottom attribution block were also inspected.

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

- The station search, setup/save/restore, latest-bird display, and earlier
  artwork flow were exercised in
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
  size. The full application has not been checked against the live BirdWeather
  API with the new artwork-info page.

## Still unverified

- The existing collage has not received a fresh full browser pass at all
  supported viewport sizes during this artwork-info change.
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

## Staged latest-bird loading

Date: 2026-11-15.

- The latest-bird page was opened from the local server with a live public
  station. It painted a Grey Heron, and the information button opened a list
  of today's species. The today view also loaded and displayed its collage.
- The browser asset inventory showed `widget-index.json` and no full artwork
  `catalog.json` on the latest-bird page. The compact index is 71,220 bytes
  (15,217 bytes when gzip-compressed); the full catalogue is 849,669 bytes
  (117,210 bytes when gzip-compressed).
- The latest-bird route loaded the painting and the three data scripts needed
  for the information list after the page began. It did not load the collage
  layout or view scripts. The today route still loaded its collage modules.
- The first-observation GraphQL query now returns only the bird name and
  translations needed by the painting. The information-list query retains its
  full bird details.
- The information-list fixture passed with 65 species. It checked three API
  batches, background loading without rendering rows or thumbnails while the
  panel is closed, and immediate cached rendering when the panel opens.
- The collage fixture passed counts 1–32 at the current browser size, the
  empty-day perch state, and the missing-art perch state. The artwork fallback
  fixture also passed. The setup page rendered without a source in the URL.
- JavaScript syntax, Python source syntax, widget-index JSON parsing, and
  `git diff --check` passed. The widget index generator produced 787 species
  and nine perches.

## Still unverified for this change

- The first visual pass used the in-app browser. A later Chrome check on the
  local site confirmed the latest-bird painting, its information list, and the
  today collage at the current desktop viewport. The dark appearance and other
  supported Chrome viewport sizes remain unverified.
- No physical iPad 2 was available. Its Safari version, memory use, touch
  behavior, and startup speed remain unverified; the code continues to use
  classic scripts and `XMLHttpRequest`, but that is not a device acceptance
  test.
- The local GitHub Pages build was not run because `pngquant` is not installed.
  That tool is required by `scripts/build-pages.sh` to prepare the
  iPad-compatible PNG artwork. The GitHub Pages workflow builds and deploys
  the merged `main` branch online.
