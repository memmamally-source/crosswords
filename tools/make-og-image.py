#!/usr/bin/env python3
"""Draws icons/og-image.png, the 1200 x 630 preview shown when a link to the
site is shared (needs Pillow). Uses the logo from make-icons.py."""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..')
INK, PAPER, GOLD, SOFT = (27, 37, 64), (255, 253, 248), (224, 177, 61), (201, 207, 221)
FONTS = '/usr/share/fonts/truetype/dejavu/'

scale = 2
W, H = 1200 * scale, 630 * scale
img = Image.new('RGB', (W, H), INK)
d = ImageDraw.Draw(img)

# The logo: an across word and a down word crossing at a gold square.
cell, gap, x0, y0 = 52 * scale, 6 * scale, 96 * scale, 150 * scale
for i in range(4):
    for row, col in [(1, i), (i, 2)]:
        x, y = x0 + col * (cell + gap), y0 + row * (cell + gap)
        d.rounded_rectangle([x, y, x + cell, y + cell], radius=6 * scale, fill=GOLD if (row, col) == (1, 2) else PAPER)

serif = lambda size: ImageFont.truetype(FONTS + 'DejaVuSerif-Bold.ttf', size * scale)
sans = lambda size: ImageFont.truetype(FONTS + 'DejaVuSans-Bold.ttf', size * scale)
tx = 380 * scale
d.text((tx, 150 * scale), 'Crossword Hub', font=serif(76), fill=PAPER)
d.text((tx, 262 * scale), 'A crossword for every obsession.', font=serif(36), fill=GOLD)
d.text((tx, 340 * scale), 'Free daily crosswords, a daily Mini,', font=sans(28), fill=SOFT)
d.text((tx, 382 * scale), 'themed puzzles and the Brutal Challenge.', font=sans(28), fill=SOFT)
d.text((96 * scale, 520 * scale), 'How few hints will you need?', font=serif(34), fill=PAPER)

img.resize((1200, 630), Image.LANCZOS).save(os.path.join(ROOT, 'icons', 'og-image.png'), optimize=True)
print('Wrote icons/og-image.png')
