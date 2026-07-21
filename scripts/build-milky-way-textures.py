#!/usr/bin/env python3
"""Build browser-ready Milky Way sky textures from the ESO TIFF master."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def save_webp(source: Image.Image, destination: Path, width: int, quality: int) -> None:
    height = width // 2
    image = source if source.size == (width, height) else source.resize((width, height), Image.Resampling.LANCZOS)
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(
        destination,
        "WEBP",
        quality=quality,
        method=6,
        icc_profile=source.info.get("icc_profile"),
        exif=source.info.get("exif", b""),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="2:1 equirectangular TIFF master")
    parser.add_argument("output_dir", type=Path, help="destination texture directory")
    parser.add_argument("--quality", type=int, default=88, help="WebP quality (default: 88)")
    args = parser.parse_args()

    with Image.open(args.source) as opened:
        source = opened.convert("RGB")
        width, height = source.size
        if width != height * 2:
            raise SystemExit(f"Expected a 2:1 equirectangular image; received {width}x{height}")

        save_webp(source, args.output_dir / "milky-way-4096.webp", 4096, args.quality)
        save_webp(source, args.output_dir / f"milky-way-{width}.webp", width, args.quality)


if __name__ == "__main__":
    main()
