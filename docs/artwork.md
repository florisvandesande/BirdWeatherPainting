# Artwork sources and reuse

Open the **i** button at the lower right of the painting for the current artwork's credit, other available artwork, and the list of missing illustrations. Choose **Select list** and use your device's Copy command to collect the species names and BirdWeather IDs. The list stays in browser storage on that device and contains only species identifiers and names. Clearing the site's browser data clears the list. If the browser blocks storage, the list is available while the page stays open.

## Fugleramme Classic collection

The painting checks the local Fugleramme image collection first. The committed
collection contains 1,355 bird illustrations grouped under 787 scientific
names and nine perches. When several illustrations match a species, one is
chosen for the current page session. BirdWeather's scientific names are matched
through the included BirdNET alias map; the displayed common name continues to
come from BirdWeather's translations.

When the selected station or nearby area has no detections, the painting uses a
random perch from the local collection and keeps that perch while the page is
open. The heading reads “Perch” and the caption explains that it is an empty
branch. These images work without requesting an artwork image from a third-party
host.

The source files supplied for this app were WebP. The app prepares a light and a
dark JPEG for each illustration, with a maximum edge of 600 pixels for older
Safari. It removes embedded source metadata and places transparent pixels on
the matching `#f0ece6` light or `#171512` dark canvas. The welcome, settings,
painting, and artwork-information surfaces use the same canvas color in each
appearance. Browsers without a dark appearance preference use the light artwork
and canvas. The source drawings can include a pale contour around the subject;
that contour remains, while the rectangular matte matches the canvas. The
adapted artwork is available under CC BY-SA 4.0.

The paired dark images add 83.7 MiB to the committed collection. At runtime,
each visible artwork requests only the version for the current appearance. A
collage of up to 32 illustrations therefore requests one image per illustration,
not both versions. Changing appearance replaces the currently displayed
version.
The daily-species information page lists each unique species heard from the
selected source today. It uses the translated common name and scientific name,
and expands one species at a time to show the available artwork source,
collection, creator, and licence details. It does not display the artwork
change summary. In latest-bird mode, the page runs the existing daily scan when
opened; in today-collage mode, it uses the scan already loaded for the collage.

For Fugleramme images, the available credit includes the collection preparer,
per-image source tag and direct original-source link, Fugleramme attribution
ledger, and CC BY-SA 4.0 licence. The provided per-image manifest has only a
source tag and direct source URL; tags can group several historical works. It
does not give an exact original work title or individual artist for every
image. The subject label is not an original work title, and the app does not
infer a specific artist from a group tag. Check the linked source record and
ledger for details when they are available.
The separate
[Fugleramme attribution note](../assets/plates/ATTRIBUTION.md) describes the
changes and the image catalogue.

The downloaded WebP inputs and BirdNET name files live in the ignored
`.temporary/assets/` directory and are not needed at runtime. If those source
files are available, regenerate the committed images and catalogue on macOS
with Swift and Apple's ImageIO framework:

```bash
swift -O scripts/prepare_fugleramme_artwork.swift .temporary/assets/artwork assets/plates
```

The script expects `birdnet_aliases.json` and `birdnet_labels_v2.4.txt` beside
the `artwork` directory. It keeps a per-image original source URL in
`assets/plates/catalog.json`. To preview the high-contrast blackbird and blue tit,
the detailed European stonechat, and the fine needles on a pine bough, use the
targeted sample set:

```bash
swift -O scripts/prepare_fugleramme_artwork.swift .temporary/assets/artwork .temporary/artwork-preview --preview
```

The generator scales each WebP to at most 600 pixels and tracks its transparent
edge while compositing it onto either `#f0ece6` or `#171512`. Before JPEG
encoding, it blends smooth, near-paper colors within a narrow edge band toward
the selected background. Textured color variation is preserved to protect
feathers, twigs, and needles. The preview command uses the same processing as a
full generation, but writes only the four named examples in both colors.

## Historical plates

The four plates are from *Nederlandsche vogelen* by Christiaan Andreas Sepp and Jan Christiaan Sepp, as credited on the individual illustration records. The source collection is KB, the National Library of the Netherlands, shelf marks KW 1047 B 10–14. The [KB describes the original work and its production](https://www.kb.nl/en/discover-admire/masterpieces/nederlandsche-vogelen).

Each individual scan is marked [Public Domain Mark 1.0](https://creativecommons.org/publicdomain/mark/1.0/). The KB explains the permissions for its donated scans in its [Wikimedia reuse policy](https://www.kb.nl/over-ons/projecten/wikipedia-wikimedia).

| Species | Title and plate | Individual source and rights record |
| --- | --- | --- |
| European robin (*Erithacus rubecula*) | Roodborst, volume I, plate 48 | [KB scan 086b](https://commons.wikimedia.org/wiki/File:Nederlandsche_vogelen_%28KB%29_-_Erithacus_rubecula_%28086b%29.jpg) |
| Common blackbird (*Turdus merula*) | Merel, volume I, plate 10 | [KB scan 016f](https://commons.wikimedia.org/wiki/File:Nederlandsche_vogelen_%28KB%29_-_Turdus_merula_%28016f%29.jpg) |
| Great tit (*Parus major*) | Koolmees, volume II, plate 60 | [KB scan 112b](https://commons.wikimedia.org/wiki/File:Nederlandsche_vogelen_%28KB%29_-_Parus_major_%28112b%29.jpg) |
| Eurasian blue tit (*Cyanistes caeruleus*) | Pimpelmees, volume I, plate 24 | [KB scan 044b](https://commons.wikimedia.org/wiki/File:Nederlandsche_vogelen_%28KB%29_-_Cyanistes_caeruleus_%28044b%29.jpg) |

Each local image keeps the full plate and its sRGB color profile. The JPEGs were resized from 880 × 1,342 to 655 × 1,000 pixels and encoded at JPEG quality 75 with macOS `sips`. Camera metadata was removed. The unedited files and the rights statements remain available through the linked source records. The site uses system fonts.

## BirdWeather fallback

When neither the Fugleramme collection nor a historical plate matches, the painting can use a raster image served from BirdWeather's species media path. It requires a matching species ID, a creator credit, and an exact match between an accepted Creative Commons licence label and its official URL. Accepted labels are CC BY and CC BY-SA versions 2.0, 2.5, 3.0, and 4.0, CC0 1.0, and Public Domain Mark 1.0. The painting displays these images as supplied and includes a link to the delivered image, the applicable licence, and any creator link supplied in the credit. When the credit is incomplete or the image fails to load, the species name and a botanical ornament are displayed.

## Adding a historical plate

1. Review the reuse terms for the individual file and keep its source record. Choose a work with a public-domain mark or a reuse licence whose obligations you can satisfy. Record its creator, title, source, licence, and licence URL.
2. Save an optimized JPEG in `assets/plates/`. To resize a file to a maximum edge of 1,000 pixels on macOS, run `sips -s format jpeg -s formatOptions 75 -Z 1000 original.jpg --out assets/plates/example-bird.jpg`. Check the result at display size and record any further edits.
3. Add its scientific name and credit to the historical catalogue in [artwork.js](../assets/artwork.js). Verify that the expected image appears for the species and that its individual source and licence links open in the species row's expanded details.
