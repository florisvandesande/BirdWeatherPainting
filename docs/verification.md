# Verification record

Date: 2026-11-07.

## Completed checks

- The painting markup passed structural checks for unique IDs, accessible
  control names and targets, and removal of the book title, station name, and
  detection-time text from the painting. Node's JavaScript parser accepted the
  changed painting, setup, artwork, and collage scripts.
- The station search, setup and restore, latest-bird painting, daily-species
  list, artwork details, and earlier licensed-art fallback were exercised in
  Chrome 157 at 390 × 844, 820 × 1180, 1024 × 768, 1440 × 900, and 2560 × 1440
  in light and dark appearances. No viewport overflow was found in those flows.
- Settings was checked on the shared paper canvas in iPad portrait, iPad
  landscape, and desktop sizes. Pointer opening does not leave an outline around
  the Settings heading; keyboard focus remains visible.
- The daily-species page showed all 25 unique species in the controlled preview
  while the collage limit was 12. It displayed the localized common name and
  Latin name, expanded a row to show artwork details, and omitted the artwork
  edit summary.
- The controlled collage-data test passed with 34 unique species, a collage
  limit of two, and metadata batches of 32 and 2. It checks paginated detections,
  the existing station/day query, the collage limit, replacement of the oldest
  displayed unique species, and the complete daily-species result.
- The controlled collage browser fixture passed 6,793 checks at 768 × 1024,
  6,769 at 1024 × 768, and 6,769 at 1440 × 900. It checks the 32-species cap,
  equal treatment of species, stable placement after repeated detections,
  replacement ordering, intentional overlap between transparent wrappers,
  non-overlapping artwork and names, localization, and page overflow. The
  fixture uses fixed API responses and local artwork, not live BirdWeather data.
- The controlled blackout fixture passed its checks for opening Settings from
  the black screen, returning to black while the schedule is active, and
  refreshing the painting after the scheduled period ends.
- The artwork converter processed 1,355 bird illustrations and nine perches.
  A catalogue check confirmed all 1,364 paired dark image paths exist; the dark
  set adds 83.7 MiB. Representative light and dark previews were inspected.
- The collage data implementer also checked paginated detections, unique-species
  ranking, date rollover, API failures, URL settings, nearby-coordinate
  privacy, and translation keys in all seven supported locales. A separate
  data check covered 96,333 UTC offsets across 598 time-zone names and aliases.

## Still unverified

- The complete live-data flow against BirdWeather and the redesigned app across
  Chrome and Safari have not received a full cross-browser pass. The new collage
  layout fixture uses controlled responses and has not been checked in dark
  appearance.
- Safari on a physical iPad 2 at 1024 × 768 has not been checked. The device's
  iOS and Safari versions, touch behavior, Add to Home Screen installation, and
  Auto-Lock behavior are still unverified. Do not claim iOS 9 compatibility
  until the physical acceptance pass succeeds.
- Safari WebDriver was unavailable because Remote Automation was not enabled on
  the Mac. This check did not change the Mac's automation settings.

## Environment note

The repository's unrelated web-server synchronization shell check refers to a
script path that does not exist in this checkout. It is outside the static app
and was not changed as part of this work.
