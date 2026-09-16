#!/usr/bin/env python3
"""Generate simple PNG icons for the extension (no PIL dependency)."""
import os
import struct
import zlib

BG = (23, 43, 77)      # dark slate
GREEN = (27, 127, 27)  # added
RED = (199, 58, 58)    # removed
BLUE = (11, 87, 208)   # accent

STRIPES = [(0, GREEN), (1, BLUE), (2, RED), (3, GREEN), (4, BLUE)]


def chunk(kind, data):
    c = struct.pack('>I', len(data)) + kind + data
    c += struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    return c


def make_png(size, path):
    raw = b''
    mid = size // 2
    for y in range(size):
        raw += b'\x00'
        for x in range(size):
            if size < 32:
                color = BG
            else:
                band = y * 5 // size
                color = dict(STRIPES)[band] if x > size // 5 else BG
            raw += bytes(color)
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', ihdr)
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)
    print('wrote ' + path)


def main():
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'icons')
    os.makedirs(out, exist_ok=True)
    for size in (16, 48, 128):
        make_png(size, os.path.join(out, '%d.png' % size))


if __name__ == '__main__':
    main()