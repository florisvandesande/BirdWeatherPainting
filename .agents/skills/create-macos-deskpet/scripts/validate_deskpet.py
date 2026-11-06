#!/usr/bin/env python3
"""Validate deskpet atlas, metadata, bundle resources, icon, and frame gutters."""
import argparse
import hashlib
import json
import plistlib
import subprocess
from pathlib import Path

try:
    from PIL import Image
except ImportError as exc:
    raise SystemExit("Missing Pillow; install scripts/requirements.txt") from exc

p = argparse.ArgumentParser()
p.add_argument("--json", required=True)
p.add_argument("--assets-dir", required=True)
p.add_argument("--app")
p.add_argument("--minimum-gutter", type=int, default=16)
a = p.parse_args()

metadata_path = Path(a.json)
assets_dir = Path(a.assets_dir)
meta = json.loads(metadata_path.read_text(encoding="utf-8"))
atlas_path = assets_dir / meta["spritesheetPath"]
atlas = Image.open(atlas_path).convert("RGBA")
assert atlas.size == (meta["sheet"]["width"], meta["sheet"]["height"]), "Atlas dimensions do not match JSON"
cell_w, cell_h = meta["cell"]["width"], meta["cell"]["height"]
required = {"idle", "blink", "walk", "turn", "wave", "hug", "happy", "sit", "sleep", "stumble", "attention", "pickedUp"}
assert required <= set(meta["animations"]), "Required animations missing"
assert meta["animations"]["walk"]["movementSpeed"] > 0, "Walk movementSpeed must be positive"
walking = meta.get("autonomousWalking")
assert isinstance(walking, dict), "autonomousWalking configuration missing"
min_distance = walking.get("minDistanceFraction")
max_distance = walking.get("maxDistanceFraction")
left_zone = walking.get("leftTurnZoneEnd")
right_zone = walking.get("rightTurnZoneStart")
assert all(isinstance(value, (int, float)) for value in (min_distance, max_distance, left_zone, right_zone)), "Walking fractions must be numeric"
assert 0 < min_distance <= max_distance <= 1, "Walking distances must satisfy 0 < min <= max <= 1"
assert 0 <= left_zone < right_zone <= 1, "Direction zones must satisfy 0 <= left < right <= 1"
checked = 0
for name, animation in meta["animations"].items():
    for index in range(animation["frameCount"]):
        col = animation["firstFrame"] + index
        row = animation["row"]
        frame = atlas.crop((col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h))
        bbox = frame.getchannel("A").getbbox()
        assert bbox, f"Empty frame: {name} {index}"
        gutter = min(bbox[0], cell_w - bbox[2], bbox[1], cell_h - bbox[3])
        assert gutter >= a.minimum_gutter, f"Unsafe {gutter}px gutter: {name} {index}"
        checked += 1

if a.app:
    app = Path(a.app)
    resources = app / "Contents" / "Resources"
    plist_path = app / "Contents" / "Info.plist"
    plist = plistlib.loads(plist_path.read_bytes())
    assert plist.get("CFBundleIconFile"), "CFBundleIconFile missing"
    icon_name = plist["CFBundleIconFile"]
    icon_path = resources / (icon_name if icon_name.endswith(".icns") else icon_name + ".icns")
    assert icon_path.exists(), "Bundled ICNS missing"
    bundled_atlas = resources / meta["spritesheetPath"]
    bundled_json = resources / "pet.json"
    assert bundled_atlas.exists() and bundled_json.exists(), "Bundled assets missing"
    digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    assert digest(atlas_path) == digest(bundled_atlas), "Loose and bundled atlas differ"
    assert json.loads(bundled_json.read_text(encoding="utf-8")) == meta, "Loose and bundled metadata differ"
    subprocess.run(["codesign", "--verify", "--deep", "--strict", str(app)], check=True)

print(
    f"Validated {checked} non-empty frames with >= {a.minimum_gutter}px gutter; "
    f"autonomous walks {min_distance:.0%}–{max_distance:.0%}, "
    f"direction zones {left_zone:.0%}/{right_zone:.0%}"
)
