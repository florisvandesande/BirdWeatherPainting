#!/usr/bin/env python3
"""Create a square preview PNG and multiresolution macOS ICNS from character art."""
import argparse
from pathlib import Path

try:
    from PIL import Image
except ImportError as exc:
    raise SystemExit("Missing Pillow; install scripts/requirements.txt") from exc

p = argparse.ArgumentParser()
p.add_argument("--source", required=True)
p.add_argument("--out-dir", required=True)
p.add_argument("--basename", default="AppIcon")
p.add_argument("--occupancy", type=float, default=0.88)
a = p.parse_args()

if not 0.5 <= a.occupancy <= 0.95:
    raise SystemExit("--occupancy must be between 0.5 and 0.95")
out = Path(a.out_dir)
out.mkdir(parents=True, exist_ok=True)
source = Image.open(a.source).convert("RGBA")
canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
edge = round(1024 * a.occupancy)
source.thumbnail((edge, edge), Image.Resampling.LANCZOS)
canvas.alpha_composite(source, ((1024 - source.width) // 2, (1024 - source.height) // 2))
canvas.save(out / f"{a.basename}.png")
canvas.save(out / f"{a.basename}.icns", format="ICNS")
print(f"Built {a.basename}.png and {a.basename}.icns")
