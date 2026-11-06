"""Regenerate the browser's offset table from an unpacked IANA tzdb release."""

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory


FIRST_YEAR = 2025
AFTER_LAST_YEAR = 2037
ZONE_FILES = (
    'africa', 'antarctica', 'asia', 'australasia', 'europe',
    'northamerica', 'southamerica', 'etcetera', 'factory', 'backward',
)


def offset_seconds(value):
    """Decode the signed HH[MM[SS]] offset printed by zdump -i."""
    digits = value[1:].ljust(6, '0')
    seconds = int(digits[:2]) * 3600 + int(digits[2:4]) * 60 + int(digits[4:])
    return -seconds if value[0] == '-' else seconds


def read_offsets(dump):
    rows = [line.split() for line in dump.splitlines() if line and not line.startswith('TZ=')]
    yield offset_seconds(rows[0][2])
    for date, clock, offset, *_ in rows[1:]:
        clock = ':'.join((clock.split(':') + ['00', '00'])[:3])
        wall_time = datetime.fromisoformat(date + 'T' + clock).replace(tzinfo=timezone.utc)
        seconds = offset_seconds(offset)
        yield int(wall_time.timestamp()) - seconds
        yield seconds


def generate(source, output):
    subprocess.run(['make', 'zic', 'zdump'], cwd=source, check=True)
    version = (source / 'version').read_text().strip()
    with TemporaryDirectory() as directory:
        subprocess.run([source / 'zic', '-d', directory, *ZONE_FILES], cwd=source, check=True)
        compiled = Path(directory)
        zones = {}
        indexes = {}
        series = []
        for zone in sorted(compiled.rglob('*')):
            if not zone.is_file():
                continue
            dump = subprocess.check_output([
                source / 'zdump', '-i', '-c', f'{FIRST_YEAR},{AFTER_LAST_YEAR}', ':' + str(zone),
            ], text=True)
            offsets = tuple(read_offsets(dump))
            if offsets not in indexes:
                indexes[offsets] = len(series)
                series.append(offsets)
            zones[zone.relative_to(compiled).as_posix()] = indexes[offsets]
    encode = lambda value: json.dumps(value, separators=(',', ':'), ensure_ascii=True)
    output.write_text(
        f'// IANA tzdb {version}, {FIRST_YEAR} through {AFTER_LAST_YEAR - 1}. Generated. See docs/time-zones.md.\n'
        'window.BirdWeatherZoneData = {\n'
        f'    first: Date.UTC({FIRST_YEAR}, 0, 1),\n'
        f'    end: Date.UTC({AFTER_LAST_YEAR}, 0, 1),\n'
        '    zones: {\n' + ',\n'.join('        ' + ','.join(
            encode(name) + ':' + str(zones[name]) for name in list(zones)[index:index + 8]
        ) for index in range(0, len(zones), 8)) + '\n    },\n'
        '    series: [\n' + ',\n'.join('        ' + encode(offsets) for offsets in series) + '\n    ]\n};\n',
        encoding='utf-8',
    )


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('tzdb', type=Path, help='Unpacked IANA tzdb source directory')
    parser.add_argument('output', type=Path, help='Output JavaScript path')
    args = parser.parse_args()
    generate(args.tzdb.resolve(), args.output)
