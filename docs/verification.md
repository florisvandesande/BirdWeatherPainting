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
