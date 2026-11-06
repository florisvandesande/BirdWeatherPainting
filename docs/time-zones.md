# Collage calendar days

Station collages use the time zone returned by BirdWeather. iOS 9 Safari lacks
the browser time-zone API used by newer browsers, so the app includes a small
table of UTC offsets and the instants when they change. It can distinguish both
copies of the repeated hour when clocks go back. Nearby collages use the device
calendar and time zone.

The table covers 2025 through 2036 in UTC and comes from
[IANA Time Zone Database 2026f](https://www.iana.org/time-zones/releases/2026f).
The compiled zone definitions come from IANA's public-domain data. If BirdWeather
omits a station's zone or the current instant falls outside the table, the app
shows a message pointing to Settings. The latest-bird view remains available.

## Refresh the time-zone table

Check for a new release when governments change time-zone rules. This maintenance
step requires Python 3.8 or later, `make`, a C compiler, and the unpacked IANA
source release. The website loads the checked-in table directly.

From the repository root, run the following command, substituting your unpacked
release path for `/path/to/tzdb-2026f`.

```bash
python3 scripts/generate-collage-time-zones.py /path/to/tzdb-2026f assets/collage-zone-data.js
git diff --check
git diff -- assets/collage-zone-data.js
```

The generator builds the release's `zic` compiler and `zdump` inspector,
compiles the named zones and aliases, and exports the offset at the start of the
coverage window followed by each transition's UTC timestamp and new offset.
Zones with identical offsets share one series. When extending the coverage
window, update the year bounds in the generator and the description above.
