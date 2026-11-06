#!/usr/bin/env python3
"""Build a normalized transparent deskpet atlas, metadata JSON, and preview."""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

try:
    import numpy as np
    from PIL import Image, ImageDraw
except ImportError as exc:
    raise SystemExit(
        "Missing Pillow/NumPy. Install scripts/requirements.txt into an isolated "
        "environment, or use a Python runtime that already provides them."
    ) from exc


def args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--config", required=True, help="Deskpet build configuration JSON")
    p.add_argument("--strips-dir", required=True, help="Directory containing transparent strips")
    p.add_argument("--out-dir", required=True)
    p.add_argument("--cell-size", type=int, default=256)
    p.add_argument("--minimum-gutter", type=int, default=16)
    p.add_argument("--webp", action="store_true", help="Also emit a lossless WebP atlas")
    return p.parse_args()


def slug(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value or "deskpet"


def alpha_bbox(image: Image.Image):
    return image.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()


def isolated_figures(image: Image.Image, expected: int) -> list[tuple[Image.Image, tuple[int, int, int, int]]]:
    alpha = np.asarray(image.getchannel("A"))
    occupied = (alpha > 8).sum(axis=0) > 2
    segments: list[tuple[int, int]] = []
    start = None
    for x, present in enumerate(occupied):
        if present and start is None:
            start = x
        if start is not None and (not present or x == len(occupied) - 1):
            end = x if not present else x + 1
            if end - start > 20:
                segments.append((start, end))
            start = None
    if len(segments) != expected:
        raise SystemExit(
            f"Expected {expected} separated figures, found {len(segments)}. "
            "Regenerate the strip with wider transparent gutters: {segments}"
        )
    result = []
    for left, right in segments:
        left, right = max(0, left - 14), min(image.width, right + 14)
        slot = image.crop((left, 0, right, image.height))
        box = alpha_bbox(slot)
        if box is None:
            raise SystemExit("Empty frame detected")
        pad = 10
        crop_box = (
            max(0, box[0] - pad), max(0, box[1] - pad),
            min(slot.width, box[2] + pad), min(slot.height, box[3] + pad),
        )
        result.append((slot.crop(crop_box), (crop_box[0] + left, crop_box[1], crop_box[2] + left, crop_box[3])))
    return result


def checker(draw: ImageDraw.ImageDraw, box, tile=12):
    left, top, right, bottom = box
    for y in range(top, bottom, tile):
        for x in range(left, right, tile):
            color = "#e1e6eb" if ((x // tile) + (y // tile)) % 2 else "#f5f7f9"
            draw.rectangle((x, y, min(x + tile, right), min(y + tile, bottom)), fill=color)


def main() -> None:
    a = args()
    config_path, strips_dir, out_dir = Path(a.config), Path(a.strips_dir), Path(a.out_dir)
    config = json.loads(config_path.read_text(encoding="utf-8"))
    sequences = config["animations"]
    required = {"idle", "blink", "walk", "turn", "wave", "hug", "happy", "sit", "sleep", "stumble", "attention", "pickedUp"}
    missing = sorted(required - {item["name"] for item in sequences})
    if missing:
        raise SystemExit(f"Missing required animations: {', '.join(missing)}")
    walking = config.get("autonomousWalking", {
        "minDistanceFraction": 0.10,
        "maxDistanceFraction": 0.70,
        "leftTurnZoneEnd": 0.25,
        "rightTurnZoneStart": 0.75,
    })
    try:
        min_distance = float(walking["minDistanceFraction"])
        max_distance = float(walking["maxDistanceFraction"])
        left_zone = float(walking["leftTurnZoneEnd"])
        right_zone = float(walking["rightTurnZoneStart"])
    except (KeyError, TypeError, ValueError) as exc:
        raise SystemExit("autonomousWalking must contain four numeric fraction values") from exc
    if not 0 < min_distance <= max_distance <= 1:
        raise SystemExit("Walking distances must satisfy 0 < minDistanceFraction <= maxDistanceFraction <= 1")
    if not 0 <= left_zone < right_zone <= 1:
        raise SystemExit("Direction zones must satisfy 0 <= leftTurnZoneEnd < rightTurnZoneStart <= 1")
    walking = {
        "minDistanceFraction": min_distance,
        "maxDistanceFraction": max_distance,
        "leftTurnZoneEnd": left_zone,
        "rightTurnZoneStart": right_zone,
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    cell = a.cell_size
    max_frames = max(int(item["frames"]) for item in sequences)
    raw = {}
    for item in sequences:
        path = strips_dir / item["file"]
        frames = isolated_figures(Image.open(path).convert("RGBA"), int(item["frames"]))
        raw[item["name"]] = frames

    atlas = Image.new("RGBA", (cell * max_frames, cell * len(sequences)), (0, 0, 0, 0))
    animations = {}
    for row, item in enumerate(sequences):
        frames = raw[item["name"]]
        images = [f[0] for f in frames]
        boxes = [f[1] for f in frames]
        baseline = max(b[3] for b in boxes)
        base_height = max(1, images[0].height - 20)
        max_content = cell - 2 * max(a.minimum_gutter, 20)
        scale = min(190 / base_height, max_content / max(i.width for i in images), max_content / max(i.height for i in images))
        for column, (frame, box) in enumerate(zip(images, boxes)):
            size = (max(1, round(frame.width * scale)), max(1, round(frame.height * scale)))
            frame = frame.resize(size, Image.Resampling.LANCZOS)
            canvas = Image.new("RGBA", (cell, cell), (0, 0, 0, 0))
            x = (cell - size[0]) // 2
            lift = round((baseline - box[3]) * scale)
            y = cell - max(a.minimum_gutter, 20) - size[1] - lift
            canvas.alpha_composite(frame, (x, y))
            bbox = alpha_bbox(canvas)
            if bbox is None:
                raise SystemExit(f"Empty output frame: {item['name']} {column}")
            gutter = min(bbox[0], cell - bbox[2], bbox[1], cell - bbox[3])
            if gutter < a.minimum_gutter:
                raise SystemExit(f"Unsafe {gutter}px gutter in {item['name']} frame {column}; require {a.minimum_gutter}px")
            atlas.alpha_composite(canvas, (column * cell, row * cell))
        animations[item["name"]] = {
            "row": row, "firstFrame": 0, "frameCount": len(frames),
            "fps": float(item["fps"]), "loop": bool(item["loop"]),
            "movementSpeed": float(item.get("movementSpeed", 0)),
        }

    pet_slug = slug(config["displayName"])
    atlas_name = f"{pet_slug}-spritesheet.png"
    atlas.save(out_dir / atlas_name, "PNG", optimize=True)
    if a.webp:
        atlas.save(out_dir / f"{pet_slug}-spritesheet.webp", "WEBP", lossless=True, quality=100, method=6)

    preview_cell, label_width, header = 132, 150, 38
    preview = Image.new("RGB", (label_width + preview_cell * max_frames, header + preview_cell * len(sequences)), "#eef1f4")
    draw = ImageDraw.Draw(preview)
    checker(draw, (label_width, header, preview.width, preview.height))
    draw.text((12, 11), f"{config['displayName']} DeskPet — animation preview", fill="#252b32")
    for row, item in enumerate(sequences):
        top = header + row * preview_cell
        draw.rectangle((0, top, label_width, top + preview_cell), fill="#303943")
        draw.text((12, top + 54), item["name"], fill="white")
        for col in range(int(item["frames"])):
            frame = atlas.crop((col * cell, row * cell, (col + 1) * cell, (row + 1) * cell))
            frame.thumbnail((preview_cell - 8, preview_cell - 8), Image.Resampling.LANCZOS)
            preview.paste(frame, (label_width + col * preview_cell + 4, top + 4), frame)
    preview.save(out_dir / f"{pet_slug}-spritesheet-preview.png", "PNG", optimize=True)

    metadata = {
        "schemaVersion": 2, "id": config.get("id", pet_slug), "displayName": config["displayName"],
        "description": config.get("description", "Animated macOS deskpet"), "spritesheetPath": atlas_name,
        "sheet": {"width": atlas.width, "height": atlas.height, "columns": max_frames, "rows": len(sequences)},
        "cell": {"width": cell, "height": cell},
        "anchor": {"x": 0.5, "y": (cell - max(a.minimum_gutter, 20)) / cell, "meaning": "bottom-center foot anchor"},
        "animations": animations,
        "transitions": config.get("transitions", {}),
        "spontaneousWeights": config.get("spontaneousWeights", {}),
        "autonomousWalking": walking,
        "interactionDefaults": config.get("interactionDefaults", {}),
        "reminderDefaults": config.get("reminderDefaults", {"enabled": False, "intervalMinutes": 45, "water": True, "break": True, "encouragement": True}),
    }
    (out_dir / f"{pet_slug}-pet.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Built {len(sequences)} animations in {atlas_name}")


if __name__ == "__main__":
    main()
