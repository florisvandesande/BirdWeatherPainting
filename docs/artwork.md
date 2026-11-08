# Artwork sources and reuse

Open the **i** button at the lower right of the painting for the displayed
artwork's credit and other available local artwork.

## Fugleramme Classic collection

The painting uses the local Fugleramme PNG collection at
`assets/artwork/birds/` and `assets/artwork/perches/`. BirdWeather's scientific
names are matched through the included BirdNET alias map; displayed common
names continue to come from BirdWeather translations. Single-bird mode keeps
its existing detection behavior. If a bird image is missing or fails to load,
a random perch from `assets/artwork/perches/` is shown instead of a remote
BirdWeather species image. In a collage, the perch takes that species' place
and its common and scientific names stay visible.

When the selected station or nearby area has no detections, the painting uses a
random local perch. In an empty collage, only the perch is visible. While data
loads, a random perch appears in the painting area. The PNGs keep transparent
backgrounds, are resized to a maximum edge of 600 pixels, and have embedded
source metadata removed. The adapted artwork is available under CC BY-SA 4.0.

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
