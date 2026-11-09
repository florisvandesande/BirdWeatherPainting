# Bird widget for florisvandesande.com

This standalone widget renders the latest BirdWeather detection from station
8089 with a local Fugleramme PNG. Its source lives outside the painting app's
runtime. The widget itself runs in the reader's browser; it does not need a
backend, a BirdWeather token, or browser storage.

## Add it to a blog page

Put this empty element where the bird should appear:

```html
<div id="bird"></div>
```

Copy the contents of `bird-widget.js` into a `<script>` element at the bottom
of that page, after the `#bird` element. The script fills that element with an
image, its Latin name, and a small Fugleramme attribution link. Style the
`.bird`, `.bird img`, `.bird-name`, and `.bird-credit` classes in the blog if
needed.

## Settings and data flow

- Change `stationId` near the top of `bird-widget.js` to use another public
  BirdWeather station.
- Each page load requests one latest detection from BirdWeather's public
  GraphQL endpoint and downloads the compact artwork index from GitHub Pages.
- The artwork index maps scientific names and taxonomy aliases to the local
  PNG paths. It is generated during the Pages build from
  `assets/artwork/catalog.json` and is published at
  `https://florisvandesande.github.io/BirdWeatherPainting/assets/artwork/widget-index.json`.
- Loading and empty states show a perch without a name. If a detected species
  has no local PNG, a perch is shown with that species' Latin name.
- Fugleramme attribution and the CC BY-SA 4.0 licence remain linked in the
  rendered widget.

The `.temporary/` directory is ignored by Git and is not included in the
GitHub Pages artifact. Copy the widget source into the blog page to use it.
