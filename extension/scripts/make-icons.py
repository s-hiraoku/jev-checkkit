#!/usr/bin/env python3
from pathlib import Path
import struct
import zlib


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def png(size: int, pixels: list[tuple[int, int, int]]) -> bytes:
    raw = b""
    for y in range(size):
        raw += b"\x00"
        for x in range(size):
            raw += bytes(pixels[y * size + x])
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def icon(size: int) -> bytes:
    paper = (231, 237, 242)
    ink = (52, 85, 120)
    mark = (23, 32, 51)
    pixels: list[tuple[int, int, int]] = []
    cx = cy = (size - 1) / 2
    outer = size * 0.42
    inner = size * 0.28
    for y in range(size):
        for x in range(size):
            dx = x - cx
            dy = y - cy
            r = (dx * dx + dy * dy) ** 0.5
            if inner < r <= outer:
                pixels.append(ink)
            elif abs(dx) < size * 0.07 and -size * 0.16 < dy < size * 0.2:
                pixels.append(mark)
            else:
                pixels.append(paper)
    return png(size, pixels)


def main() -> None:
    dest = Path(__file__).resolve().parents[1] / "public"
    dest.mkdir(exist_ok=True)
    for size in (16, 32, 48, 128):
        (dest / f"icon-{size}.png").write_bytes(icon(size))


if __name__ == "__main__":
    main()
