#!/usr/bin/env python3
"""Draws the app icons in icons/ (run once; needs Pillow: pip install pillow).
The design matches the favicon: a 2x2 crossword grid, one square in yellow."""
import os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..')
INK, PAPER, GOLD = (18, 18, 18), (255, 255, 255), (242, 194, 48)


def draw(size, grid_fraction):
    """grid_fraction: how much of the icon the 2x2 grid spans."""
    scale = 4  # draw large, then shrink for smooth edges
    s = size * scale
    img = Image.new('RGB', (s, s), INK)
    d = ImageDraw.Draw(img)
    grid = s * grid_fraction
    gap = grid * 0.08
    cell = (grid - gap) / 2
    x0 = y0 = (s - grid) / 2
    radius = cell * 0.06
    for row in range(2):
        for col in range(2):
            x = x0 + col * (cell + gap)
            y = y0 + row * (cell + gap)
            colour = GOLD if (row, col) == (1, 1) else PAPER
            d.rounded_rectangle([x, y, x + cell, y + cell], radius=radius, fill=colour)
    return img.resize((size, size), Image.LANCZOS)


def save(img, name):
    img.save(os.path.join(ROOT, 'icons', name), optimize=True)


save(draw(192, 0.62), 'icon-192.png')
save(draw(512, 0.62), 'icon-512.png')
# Maskable icons may be cropped to a circle, so keep the grid inside the safe zone.
save(draw(512, 0.5), 'icon-maskable-512.png')
save(draw(180, 0.6), 'apple-touch-icon.png')
print('Wrote icons/')
