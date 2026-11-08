# Artwork sources and reuse

Open the **i** button at the lower right of the painting for the current artwork's credit, other available artwork, and the list of missing illustrations. Choose **Select list** and use your device's Copy command to collect the species names and BirdWeather IDs. The list stays in browser storage on that device and contains only species identifiers and names. Clearing the site's browser data clears the list. If the browser blocks storage, the list is available while the page stays open.

## Fugleramme Classic collection

The painting uses the local Fugleramme PNG collection at
`assets/artwork/birds/` and `assets/artwork/perches/`. BirdWeather's scientific
names are matched through the included BirdNET alias map; displayed common
names continue to come from BirdWeather translations. Single-bird mode keeps
its existing presentation and detection behavior. If a local image is missing,
the existing historical-plate and credited BirdWeather fallbacks remain
available.

When the selected station or nearby area has no detections, the painting uses a
random local perch. The heading reads “Perch” and the caption explains that it
is an empty branch. The PNGs keep transparent backgrounds, are resized to a
maximum edge of 1,200 pixels, and have embedded source metadata removed. The
adapted artwork is available under CC BY-SA 4.0.

Collage mode also uses body masses from `bird_sizes.csv` and visible-image
bounds from `geometry.json` when sizing and packing birds. Its labels use the
selected-language common name plus the scientific name. The artwork information
page credits the collection preparer and shows each image's source tag, direct
source URL, Fugleramme attribution ledger, and CC BY-SA 4.0 licence. The source
manifest gives a source tag and direct URL, but may not identify the exact
original work title or an individual artist.

The downloaded WebP inputs and BirdNET name files live in the ignored
`.temporary/asset/` directory and are not needed at runtime.

## Preparing artwork

When the supplied files are available under `.temporary/asset/artwork/`, run:

```bash
swift scripts/prepare_collage_artwork.swift .temporary/asset/artwork assets/artwork
```

The source folder must include `manifest.json`, `birds/`, and `perches/`; its
parent must include `birdnet_aliases.json` and `birdnet_labels_v2.4.txt`. The
script preserves `geometry.json` and `bird_sizes.csv` and writes the PNGs and
catalog to the output directory. The source WebP folder is currently absent,
so no collage PNGs can be generated or visually checked from this checkout.

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
3. Add its scientific name and credit to the historical catalogue in [artwork.js](../assets/artwork.js). Verify that the expected image appears for the species and that its individual source and licence links open from the information page.
