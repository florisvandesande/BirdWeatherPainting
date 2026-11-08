# Artwork sources and reuse

Open the **i** button at the lower right of the painting for the current artwork's credit, other available artwork, and the list of missing illustrations. Choose **Select list** and use your device's Copy command to collect the species names and BirdWeather IDs. The list stays in browser storage on that device and contains only species identifiers and names. Clearing the site's browser data clears the list. If the browser blocks storage, the list is available while the page stays open.

## Fugleramme Classic collection

The painting uses the local Fugleramme PNG collection at
`assets/artwork/birds/` and `assets/artwork/perches/`. BirdWeather's scientific
names are matched through the included BirdNET alias map; displayed common
names continue to come from BirdWeather translations. Single-bird mode keeps
its existing presentation and detection behavior. If a local image is missing,
the credited BirdWeather fallback remains available.

When the selected station or nearby area has no detections, the painting uses a
random local perch. The heading reads “Perch” and the caption explains that it
is an empty branch. The PNGs keep transparent backgrounds, are resized to a
maximum edge of 1,200 pixels, and have embedded source metadata removed. The
adapted artwork is available under CC BY-SA 4.0.

Collage mode also uses body masses from `bird_sizes.csv` and visible-image
bounds from `geometry.json` when sizing and packing birds. Its labels use the
selected-language common name plus the scientific name. The artwork information
page credits the collection preparer and shows each image's source tag, direct
source URL, Fugleramme attribution ledger, and CC BY-SA 4.0 licence. The
committed catalogue is authoritative for these source records and any image
geometry. It may not identify the exact original work title or individual
artist.

The downloaded WebP inputs live in the ignored `.temporary/assets/artwork/`
directory and are not needed at runtime.

## Preparing artwork

When the supplied files are available under `.temporary/assets/artwork/`, run:

```bash
swift scripts/prepare_collage_artwork.swift .temporary/assets/artwork assets/artwork
```

The source folder must include `birds/` and `perches/`. The script reads the
committed catalogue and supporting data in `assets/artwork/`, converts the
WebPs to transparent PNGs capped at a 600-pixel longest edge, and changes only
image path extensions in the catalogue. The runtime PNGs are committed, so the
ignored source WebPs are not needed by a fresh clone.

## BirdWeather fallback

When the Fugleramme catalogue has no matching species or local PNG, the
painting can use a raster image served from BirdWeather's species media path.
It requires a matching species ID, a creator credit, and an exact match between
an accepted Creative Commons licence label and its official URL. Accepted
labels are CC BY and CC BY-SA versions 2.0, 2.5, 3.0, and 4.0, CC0 1.0, and
Public Domain Mark 1.0. The painting displays these images as supplied and
includes a link to the delivered image, the applicable licence, and any creator
link supplied in the credit. When the credit is incomplete or the image fails
to load, the species name and a botanical ornament are displayed.
