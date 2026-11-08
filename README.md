# BirdWeather Painting

BirdWeather Painting is a static, account-free bird display that turns recent
observations from public BirdWeather stations into a natural-history painting
for a wall-mounted iPad.

## Status

The latest-bird and today-collage views, station and nearby setup, artwork
credits, and optional night schedule are implemented on the local integration
branch. The project is not deployed. The supplied artwork has been converted to
transparent PNGs. A controlled browser preview successfully packed every count
from 1 to 32 at 390 × 844 portrait and 1024 × 768 landscape. The full live
BirdWeather flow and the physical iPad acceptance pass remain outstanding.
The physical iPad 2/iOS 9 acceptance pass has not been completed, so iOS 9
compatibility is not yet confirmed.

## Features

- Show the latest detected species or today's collage of unique species.
- Select one public station or nearby stations within 2, 5, or 10 kilometres.
- Retain the most recently observed collage species. When the limit is full, a
  new species replaces the one heard least recently. Choose 1–32 species; the
  default is 12.
- Size collage birds from the supplied body-mass data and pack their transparent
  silhouettes with the selected-language common and scientific names.
- Use the local Fugleramme Classic bird illustrations and perches. Empty days
  and loading states show a randomly selected perch. If a bird illustration
  is unavailable, show a perch instead. Transparent areas show the painting's
  `#f0ece6` paper surface.
- Open one information page for the displayed artist, collection, source,
  licence, and image changes.
- Choose English, Dutch, French, German, Spanish, Italian, or Brazilian
  Portuguese. The browser language is used unless the visitor selects a
  language in Settings; the choice is saved in the URL.
- Optionally turn the screen black on a local night schedule. Polling pauses
  while the display is black.
- Use the website without a project account, API key, PHP server, database,
  proxy, or build service.

## Visual preview

The repository includes a [static painting layout preview](docs/preview.html).
It uses the app's display styles and botanical ornament; its sample text is not
live BirdWeather data.

## Requirements

- A current browser and internet connection for local development.
- Safari on an Apple iPad 2 running iOS 9 is the intended acceptance target.
  That device flow is still unverified.
- Python 3 is optional and used only to preview the static files locally.
- Apple's Swift compiler and ImageIO framework are optional and needed only to
  convert the collage WebP files to transparent PNGs.

## Getting started

Clone the repository and start a local static web server from its root:

```bash
git clone https://github.com/florisvandesande/BirdWeatherPainting.git
cd BirdWeatherPainting
python3 -m http.server 8000
```

Open <http://127.0.0.1:8000/> in a browser. The base URL opens the one-column
welcome and settings page. Nearby stations, a 2 km radius, today's collage, 12
species, automatic language, and disabled night mode are preselected. Use the
location button to fill the editable coordinates, or enter a numeric public
BirdWeather station ID. Choose the display settings and save. To stop the local
server, return to the terminal and press Control-C.

No package installation or application configuration file is required. Do not
open `index.html` directly as a `file://` URL; browsers restrict the API and
catalog requests from local files.

To exercise URL parsing and the setup screens in a local browser, open
<http://127.0.0.1:8000/tests/url-settings-preview.html>. To check that a missing
Fugleramme illustration is replaced by a perch in both display modes, open
<http://127.0.0.1:8000/tests/artwork-fallback-preview.html>.

## Settings and URLs

The URL is the only source of saved settings. A complete station URL looks like:

```text
?source=station&station=7368&view=today&limit=12&lang=auto&night=0&nightStart=22%3A00&nightEnd=07%3A00
```

The supported choices are:

- `source=station` with a public numeric `station` ID, or `source=nearby` with
  `lat`, `lon`, and a `radius` of `2`, `5`, or `10` kilometres;
- `view=latest` or `view=today`. The default is `today`;
- `limit=1` through `limit=32` for today's collage. The default is `12`.
  Single-bird mode always shows one species.
- `lang=auto` or one of `en`, `nl`, `fr`, `de`, `es`, `it`, and `pt-BR`;
- `night=0` or `night=1`, plus `nightStart` and `nightEnd` in 24-hour `HH:MM`
  format. The times are present in saved URLs even when night mode is off.

For example, nearby mode uses a URL like:

```text
?source=nearby&lat=52.12345&lon=5.12345&radius=2&view=today&limit=12&lang=nl&night=1&nightStart=22%3A00&nightEnd=07%3A00
```

The base URL opens welcome/setup with nearby selected and blank coordinates.
It does not show an incomplete-link warning until a URL contains configuration
fields. A missing `source` in a partial URL defaults to nearby; an explicitly
invalid source remains unselected. Other valid URL values remain filled in,
with localized feedback for partial or invalid links. Unknown query fields are
ignored; duplicate known fields are invalid. Nearby coordinates are rounded to
five decimal places. Night times use the device's local clock. The species
limit remains visible in both display modes and applies to today's collage.

## Artwork and reuse

Single-bird mode keeps its detection behavior while using the supplied PNG
artwork. Both display modes use the same transparent PNG catalogue at
`assets/artwork/birds/` and `assets/artwork/perches/`. When a Fugleramme bird
image is missing or fails to load, a randomly selected perch is shown instead.
In collages, that perch stays with the species label. BirdWeather's translated
common names provide each collage label, with the scientific name below it.

The Fugleramme derivatives are CC BY-SA 4.0. PNGs retain transparency and are
resized to at most 600 pixels to preserve the existing single-bird source size
while keeping the static artwork download manageable. The artwork information
page shows all unique species heard today, with local PNGs, BirdWeather names,
scientific names, available eBird and Wikipedia links, and expandable Wikipedia
summaries. The page links to the Fugleramme attribution ledger. See
[artwork sources and reuse](docs/artwork.md) and the
[Fugleramme attribution ledger](https://github.com/arnegiacomo/fugleramme/blob/main/assets/artwork/classic/ATTRIBUTION.md).

The source code is under the MIT License. This does not change the separate
licences for the included artwork.

## Privacy and network use

The app has no project server and does not use application-owned browser
storage. Settings are visible in the URL, browser history, and bookmarks. Nearby
coordinates are included in that URL, and the nearby search area is sent to
BirdWeather's public GraphQL API. The app needs internet access for new
observations. A static host such as GitHub Pages may record visitor IP addresses
for routine security and operations. Old settings stored by earlier versions
are ignored.

## Install on the iPad

After a host is configured, open the app in iPad Safari, tap **Share**, then
**Add to Home Screen**. In the iPad Settings app, open **General** → **Auto-Lock**
and choose **Never**. Keep the iPad connected to power while it is on display.

iOS 9 Safari cannot keep a page awake or refresh it after the operating system
suspends Safari. It also lacks service-worker support for a dependable
offline app launch. The site needs a network connection to request current
BirdWeather data.

## Local artwork preparation

The collage WebP files belong in the ignored `.temporary/assets/artwork/`
directory and are not needed at runtime. When the supplied files are present,
convert the illustrations and update the catalog paths with Swift on macOS:

```bash
swift scripts/prepare_collage_artwork.swift .temporary/assets/artwork assets/artwork
```

The source directory must contain `birds/` and `perches/`. The committed
`assets/artwork/catalog.json` is authoritative for image paths, names, source
records, geometry and attribution; the converter changes its `.jpg` image
paths to `.png` while preserving the other catalogue fields and caps each
PNG's longest edge at 600 pixels. The existing
`geometry.json` and `bird_sizes.csv` files are preserved. The script uses
Apple's built-in Core Graphics and ImageIO frameworks; it adds no website
runtime dependency. The PNGs are part of `assets/artwork/`, so a fresh clone
does not need the ignored source WebPs to run the app.

## Preview, verification, and known limitations

There is no build step for the website. Serve the repository root with the
Python command above to preview it. The collage was visually inspected in a
controlled preview at 390 × 844 portrait and 1024 × 768 landscape. All 64
combinations of 1–32 birds and both orientations packed successfully with
every image loaded. The full live BirdWeather flow still needs verification on
the physical iPad 2 at 1024 × 768 landscape. Until that pass succeeds, treat
iOS 9 Safari behavior as unverified. See
[the verification record](docs/verification.md) for completed and pending
checks.

The bundled station-time-zone data covers 2025 through 2036. If using the app
after that period, regenerate the data using the documented procedure in
[time-zone data](docs/time-zones.md).

## Deploy with GitHub Pages

The app can be served as static files from the repository root:

1. In the GitHub repository, open **Settings** → **Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select the published branch and the `/ (root)` folder, then save.
4. Wait for GitHub Pages to show the site URL, then open that URL in Safari.

GitHub Pages has not been activated by this implementation. For a custom
domain, add the domain under Pages settings first, then configure DNS using
GitHub's current [custom-domain documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site).
This order helps prevent another site from claiming the domain before it is
attached to this repository. Enable HTTPS in Pages settings when GitHub offers
it for the domain.

## Verification

The previous station, setup, and artwork information flow was checked in
Chrome 157 at mobile, tablet, 1024 × 768, and large desktop viewports in light
and dark browser appearances. In a controlled preview using the app's collage
view, the browser packed all 1–32 bird counts in portrait (390 × 844) and
landscape (1024 × 768), with all artwork loaded. Every count and orientation
was visually inspected in contact sheets; full-size checks included 1, 8, 16,
and 32 birds in portrait and 32 birds in landscape. At 32 birds, labels shrink
to fit the available area. The physical iPad 2 is unavailable, so its native
Safari behavior remains unverified.

The unrelated repository server-synchronization shell check is not required to
run or host this static application.

## License

The application source code is available under the [MIT License](LICENSE).
Artwork has separate terms; see [artwork sources and reuse](docs/artwork.md).
