#!/usr/bin/env python3
"""Draws the app icons in icons/ (run once; needs Pillow: pip install pillow).
The design matches the logo: an across word and a down word crossing at one
gold square (the "hub"), on a navy tile."""
import os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..')
INK, PAPER, GOLD = (27, 37, 64), (255, 253, 248), (212, 161, 42)


def draw(size, mark_fraction):
    """mark_fraction: how much of the icon the crossing spans."""
    scale = 4  # draw large, then shrink for smooth edges
    s = size * scale
    img = Image.new('RGB', (s, s), INK)
    d = ImageDraw.Draw(img)
    span = s * mark_fraction
    gap = span * 0.04
    cell = (span - 3 * gap) / 4
    x0 = y0 = (s - span) / 2
    radius = cell * 0.12
    across_row, down_col = 1, 2  # the across word sits on row 1, the down word in column 2
    for i in range(4):
        squares = [(across_row, i), (i, down_col)]
        for row, col in squares:
            x = x0 + col * (cell + gap)
            y = y0 + row * (cell + gap)
            colour = GOLD if (row, col) == (across_row, down_col) else PAPER
            d.rounded_rectangle([x, y, x + cell, y + cell], radius=radius, fill=colour)
    return img.resize((size, size), Image.LANCZOS)


def save(img, name):
    img.save(os.path.join(ROOT, 'icons', name), optimize=True)


save(draw(192, 0.76), 'icon-192.png')
save(draw(512, 0.76), 'icon-512.png')
# Maskable icons may be cropped to a circle, so keep the grid inside the safe zone.
save(draw(512, 0.6), 'icon-maskable-512.png')
save(draw(180, 0.72), 'apple-touch-icon.png')
print('Wrote icons/')
