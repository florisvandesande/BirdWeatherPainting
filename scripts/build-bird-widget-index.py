#!/usr/bin/env python3
"""Build the small public artwork lookup used by the external bird widget."""

import json
import os
import re
import sys


LICENSE_URL = "https://creativecommons.org/licenses/by-sa/4.0/"
ATTRIBUTION_URL = "https://github.com/arnegiacomo/fugleramme/blob/main/assets/artwork/classic/ATTRIBUTION.md"
CREATOR_URL = "https://github.com/arnegiacomo/fugleramme"
SAFE_ARTWORK_PATH = re.compile(r"^(?:birds|perches)/[a-z0-9_-]+\.png$")


def fail(message):
    raise SystemExit(f"Error: {message}")


def normalize(value):
    return re.sub(r"\s+", " ", re.sub(r"[_-]+", " ", value.strip().lower()))


def main():
    if len(sys.argv) != 3:
        fail("Usage: build-bird-widget-index.py <catalog.json> <artwork-directory>")

    catalog_path = os.path.abspath(sys.argv[1])
    artwork_root = os.path.abspath(sys.argv[2])
    output_path = os.path.join(artwork_root, "widget-index.json")

    try:
        with open(catalog_path, "r", encoding="utf-8") as catalog_file:
            catalog = json.load(catalog_file)
    except (OSError, json.JSONDecodeError) as error:
        fail(f"Could not read artwork catalogue: {error}")

    source_birds = catalog.get("birds")
    source_aliases = catalog.get("aliases")
    source_perches = catalog.get("perches")
    if not isinstance(source_birds, dict) or not isinstance(source_aliases, dict) or not isinstance(source_perches, list):
        fail("The artwork catalogue must contain birds, aliases, and perches.")

    birds = {}
    for name, entry in source_birds.items():
        if not isinstance(name, str) or not isinstance(entry, dict):
            continue
        image_paths = []
        for image in entry.get("images", []):
            path = image.get("path") if isinstance(image, dict) else None
            if not isinstance(path, str) or not SAFE_ARTWORK_PATH.fullmatch(path) or not path.startswith("birds/"):
                continue
            if os.path.isfile(os.path.join(artwork_root, path)) and path not in image_paths:
                image_paths.append(path)
        if image_paths:
            birds[normalize(name)] = image_paths

    aliases = {}
    for alias, canonical in source_aliases.items():
        if isinstance(alias, str) and isinstance(canonical, str):
            aliases[normalize(alias)] = normalize(canonical)

    perches = []
    for perch in source_perches:
        path = perch.get("path") if isinstance(perch, dict) else None
        if isinstance(path, str) and SAFE_ARTWORK_PATH.fullmatch(path) and path.startswith("perches/"):
            if os.path.isfile(os.path.join(artwork_root, path)) and path not in perches:
                perches.append(path)

    if not birds or not perches:
        fail("The artwork catalogue has no available bird images or perches.")

    index = {
        "version": 1,
        "license": catalog.get("license"),
        "licenseUrl": LICENSE_URL,
        "attributionUrl": ATTRIBUTION_URL,
        "creator": catalog.get("creator"),
        "creatorUrl": CREATOR_URL,
        "birds": birds,
        "aliases": aliases,
        "perches": perches,
    }
    try:
        with open(output_path, "w", encoding="utf-8", newline="\n") as index_file:
            json.dump(index, index_file, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
            index_file.write("\n")
    except OSError as error:
        fail(f"Could not write the bird widget index: {error}")

    print(f"Prepared widget artwork index with {len(birds)} species and {len(perches)} perches.")


if __name__ == "__main__":
    main()
