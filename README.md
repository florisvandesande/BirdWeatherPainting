# BirdWeather Painting

BirdWeather Painting is a static, account-free bird display that turns recent
observations from public BirdWeather stations into a natural-history painting
for a wall-mounted iPad.

## Status

The latest-bird and today-collage views, station and nearby setup, artwork
credits, and optional night schedule are implemented on the local integration
branch. The project is not deployed. The supplied artwork has been converted to
transparent PNGs; the collage is being checked in a browser across the 1–32
species range in portrait and landscape layouts.
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
  show a randomly selected empty perch. Transparent areas show the painting's
  `#f0ece6` paper surface.
- Open one information page for the displayed artist, collection, source,
  licence, and image changes. Keep a list of species that need artwork on the
  same device.
- Choose English, Dutch, French, German, Spanish, Italian, or Brazilian
  Portuguese. The browser language is used unless the visitor selects a
  language in Settings.
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

Open <http://127.0.0.1:8000/> in a browser. Choose a public BirdWeather
station by name or numeric ID, or select nearby stations and allow location
access or enter coordinates manually. Choose the latest-bird or today's-collage
view and save. To stop the local server, return to the terminal and press
Control-C.

No package installation or application configuration file is required. Do not
open `index.html` directly as a `file://` URL; browsers restrict the API and
catalog requests from local files.

## Settings and URLs

The settings page writes shareable display choices to the URL. For example:

```text
?source=station&station=7368&view=today&limit=12
```

The supported choices are:

- `source=station` with a public numeric `station` ID, or `source=nearby` with a
  `radius` of `2`, `5`, or `10` kilometres;
- `view=latest` or `view=today`;
- `limit=1` through `limit=32` for today's collage. The default is `12`.
  Single-bird mode always shows one species.

Nearby coordinates are saved in this browser's local storage and are not added
to the URL. BirdWeather receives the nearby search area when the page queries
stations and detections. On the same device, opening the base URL restores the
saved settings. Browser storage can be cleared in the browser's website data
settings; doing so also clears the saved settings and missing-artwork list.

Night settings use the iPad's local clock. For example, a configured URL may
include `night=1`, `nightStart=22:00`, and `nightEnd=07:00`. Setup writes these
values for you.

## Artwork and reuse

Single-bird mode keeps its presentation and detection behavior while using the
supplied PNG artwork and its BirdWeather fallback. Both display modes use the
same transparent PNG catalogue at `assets/artwork/birds/` and
`assets/artwork/perches/`. BirdWeather's translated common names provide each
collage label, with the scientific name below it. The empty-collage perch uses
the same PNG artwork.

The Fugleramme derivatives are CC BY-SA 4.0. PNGs retain transparency and are
resized to at most 600 pixels to preserve the existing single-bird source size
while keeping the static artwork download manageable. Per-image source URLs are retained in the
artwork catalog and shown through the artwork information page. See
[artwork sources and reuse](docs/artwork.md) and the
[Fugleramme attribution ledger](https://github.com/arnegiacomo/fugleramme/blob/main/assets/artwork/classic/ATTRIBUTION.md).

The source code is under the MIT License. This does not change the separate
licences for the included artwork.

## Privacy and network use

The app has no project server and sends no app settings or missing-artwork list
to the repository owner. It calls BirdWeather's public GraphQL API directly
from the browser and needs internet access for new observations. In nearby
mode, the selected search area is sent to BirdWeather. Precise coordinates and
the missing-artwork list stay in browser storage on the device. A static host
such as GitHub Pages may record visitor IP addresses for routine security and
operations.

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
Python command above to preview it. The app's full flow still needs verification
on the physical iPad 2 at 1024 × 768 landscape. Until that pass succeeds, treat
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
and dark browser appearances. The new collage and PNG rendering are being
checked in a controlled browser preview. The physical iPad 2 is unavailable,
so its native Safari behavior remains unverified.

The unrelated repository server-synchronization shell check is not required to
run or host this static application.

## License

The application source code is available under the [MIT License](LICENSE).
Artwork has separate terms; see [artwork sources and reuse](docs/artwork.md).
