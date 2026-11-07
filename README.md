# BirdWeather Painting

BirdWeather Painting is a static, account-free bird display that turns recent
observations from public BirdWeather stations into a natural-history painting
for a wall-mounted iPad.

## Status

The latest-bird and today-collage views, station and nearby setup, artwork
credits, and optional night schedule are implemented on the local integration
branch. The project is not deployed. Desktop checks have covered the earlier
station, setup, and artwork flows; the finished collage and artwork changes
still need a complete browser pass. The physical iPad 2/iOS 9 acceptance pass
has not been completed, so iOS 9 compatibility is not yet confirmed.

## Features

- Show the latest detected species or today's collage of unique species.
- Select one public station or nearby stations within 2, 5, or 10 kilometres.
- Rank collage species by detection count while keeping the newest species as
  the centrepiece. Set the collage limit from 2 to 32; the default is 12.
- Use the local Fugleramme Classic bird illustrations and perches. Empty days
  show a randomly selected empty perch. The artwork background uses the same
  `#f0ece6` paper color as the images.
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

The repository includes a [static preview of a Fugleramme bird plate](docs/preview.html).
It uses the app's display styles and a local image; the sample observation text
is not live BirdWeather data.

## Requirements

- A current browser and internet connection for local development.
- Safari on an Apple iPad 2 running iOS 9 is the intended acceptance target.
  That device flow is still unverified.
- Python 3 is optional and used only to preview the static files locally.
- Apple's Swift compiler and ImageIO framework are optional and needed only to
  regenerate the Fugleramme JPEGs from the downloaded WebP source files.

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
- `limit=2` through `limit=32` for today's collage. The default is `12`.

Nearby coordinates are saved in this browser's local storage and are not added
to the URL. BirdWeather receives the nearby search area when the page queries
stations and detections. On the same device, opening the base URL restores the
saved settings. Browser storage can be cleared in the browser's website data
settings; doing so also clears the saved settings and missing-artwork list.

Night settings use the iPad's local clock. For example, a configured URL may
include `night=1`, `nightStart=22:00`, and `nightEnd=07:00`. Setup writes these
values for you.

## Artwork and reuse

The app uses local Fugleramme Classic artwork first, with matching based on
scientific names and the included BirdNET alias map. BirdWeather's translated
common names provide the displayed species names. If no local image matches,
the app may use one of its public-domain historical plates or a BirdWeather
image whose returned credit and licence are accepted. Otherwise it shows a
name plate and records the missing species on the device.

The Fugleramme derivatives are CC BY-SA 4.0. The app resizes them to at most
600 pixels, converts WebP to JPEG for older Safari, and flattens transparent
areas onto `#f0ece6`. Smooth pale edges close to transparency are softened
toward the same paper color while textured feathers and branches are retained.
Per-image original source URLs are retained in the catalogue and shown through
the artwork information page. See
[artwork sources and reuse](docs/artwork.md) and the
[Fugleramme attribution note](assets/plates/ATTRIBUTION.md).

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

The original WebP files and name data are kept in the ignored
`.temporary/assets/` directory and are not needed at runtime. If the downloaded
source files are present, regenerate the JPEGs and catalogue with Swift on
macOS:

```bash
swift -O scripts/prepare_fugleramme_artwork.swift .temporary/assets/artwork assets/plates
```

The source directory must contain `manifest.json`, `birds/`, and `perches/`.
Its parent must contain `birdnet_aliases.json` and `birdnet_labels_v2.4.txt`.
The script uses Apple's built-in Core Graphics and ImageIO frameworks; it does
not add a runtime dependency to the website. Before preparing the full
collection, generate a targeted preview of the blackbird, blue tit, European
stonechat, and pine bough with:

```bash
swift -O scripts/prepare_fugleramme_artwork.swift .temporary/assets/artwork .temporary/artwork-preview --preview
```

The preview output contains only those four examples. The generator softens
pale, smooth pixels near transparent edges toward the paper color before JPEG
encoding. It preserves textured feather and branch detail and flattens
transparent areas onto the same paper color.

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
and dark browser appearances. Collage data and URL settings received controlled
JavaScriptCore checks. The full collage and Fugleramme rendering have not yet
received a complete browser pass. Safari automation and the physical iPad 2
were unavailable in the current environment.

The unrelated repository server-synchronization shell check is not required to
run or host this static application.

## License

The application source code is available under the [MIT License](LICENSE).
Artwork has separate terms; see [artwork sources and reuse](docs/artwork.md).
