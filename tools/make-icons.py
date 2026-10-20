#!/usr/bin/env python3
"""Draws the app icons in icons/ (needs Pillow and fontTools:
pip install pillow fonttools).

The icon is the "Corner": the top-left corner of a crossword, two squares
by two, on parchment inside a forest-green frame with a gold keyline. C and
H (set in Instrument Serif, the masthead's typeface) sit on the diagonal,
with a black square, a gold square and the clue number 1.

Writes the PNG icons, icons/logo.svg (the full mark, as outlines) and
icons/favicon.svg (a simpler, bolder version for browser tabs).
The font, tools/fonts/InstrumentSerif-Regular.ttf, is under the SIL Open
Font License (tools/fonts/InstrumentSerif-OFL.txt)."""
import os
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = os.path.join(os.path.dirname(__file__), '..')
FONT = os.path.join(os.path.dirname(__file__), 'fonts', 'InstrumentSerif-Regular.ttf')
FOREST, PARCHMENT, SQUARE, GOLD, INK = '#2F5A43', '#EFE5CC', '#FBF5E6', '#E3B64C', '#2A241C'

# Everything is laid out on a 120-unit canvas.
GRID = (20, 20, 80)  # x, y, size of the 2x2 corner


def glyph_path(char, cx, baseline, size):
    """SVG path data for one glyph, centred on cx, sitting on baseline."""
    font = TTFont(FONT)
    upm = font['head'].unitsPerEm
    name = font.getBestCmap()[ord(char)]
    glyphs = font.getGlyphSet()
    scale = size / upm
    width = glyphs[name].width * scale
    pen = SVGPathPen(glyphs)
    glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, cx - width / 2, baseline)))
    return pen.getCommands()


def svg(simple=False):
    x, y, s = GRID
    half = s / 2
    weight = 2.2 if simple else 1.1  # outline stroke that thickens the hairlines
    parts = [
        f'<rect width="120" height="120" rx="26" fill="{FOREST}"/>',
        f'<rect x="9" y="9" width="102" height="102" rx="19" fill="{PARCHMENT}"' + ('' if simple else f' stroke="{GOLD}" stroke-width="2.5"') + '/>',
        f'<rect x="{x}" y="{y}" width="{s}" height="{s}" fill="{SQUARE}"/>',
        f'<rect x="{x + half}" y="{y}" width="{half}" height="{half}" fill="{INK}"/>',
        f'<rect x="{x}" y="{y + half}" width="{half}" height="{half}" fill="{GOLD}"/>',
        f'<g fill="none" stroke="{INK}" stroke-width="{3 if simple else 2}"><rect x="{x}" y="{y}" width="{s}" height="{s}"/><path d="M{x + half} {y}v{s}M{x} {y + half}h{s}"/></g>',
    ]
    letter = 40 if simple else 36
    for char, cx, base in (('C', x + half / 2, y + half - 8), ('H', x + half * 1.5, y + s - 8)):
        d = glyph_path(char, cx, base, letter)
        parts.append(f'<path d="{d}" fill="{INK}" stroke="{INK}" stroke-width="{weight}" stroke-linejoin="round"/>')
    if not simple:
        parts.append(f'<path d="{glyph_path("1", x + 5, y + 10, 9)}" fill="{INK}" stroke="{INK}" stroke-width="0.5"/>')
    body = ''.join(parts)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">{body}</svg>\n'


def png(size, maskable=False, simple=False):
    """Rasterises the design with Pillow, drawn large and scaled down."""
    k = 8
    S = size * k
    u = S / 120  # one canvas unit in pixels
    img = Image.new('RGB', (S, S), FOREST)
    d = ImageDraw.Draw(img)
    off = 0
    if maskable:
        # Android may crop to a circle: keep the green ground and shrink the
        # rest into the safe zone.
        u *= 0.8
        off = (S - 120 * u) / 2
    P = lambda v: off + v * u  # noqa: E731
    if not maskable:
        d.rounded_rectangle([0, 0, S, S], radius=26 * u, fill=FOREST)
    d.rounded_rectangle([P(9), P(9), P(111), P(111)], radius=19 * u, fill=PARCHMENT, outline=GOLD, width=max(1, round(2.5 * u)))
    x, y, s = GRID
    half = s / 2
    d.rectangle([P(x), P(y), P(x + s), P(y + s)], fill=SQUARE)
    d.rectangle([P(x + half), P(y), P(x + s), P(y + half)], fill=INK)
    d.rectangle([P(x), P(y + half), P(x + half), P(y + s)], fill=GOLD)
    line = max(1, round((3 if simple else 2) * u))
    d.rectangle([P(x), P(y), P(x + s), P(y + s)], outline=INK, width=line)
    d.line([P(x + half), P(y), P(x + half), P(y + s)], fill=INK, width=line)
    d.line([P(x), P(y + half), P(x + s), P(y + half)], fill=INK, width=line)
    letter = (40 if simple else 36) * u
    font = ImageFont.truetype(FONT, round(letter))
    thick = max(1, round((2.2 if simple else 1.1) * u / 2))
    for char, cx, base in (('C', x + half / 2, y + half - 8), ('H', x + half * 1.5, y + s - 8)):
        d.text((P(cx), P(base)), char, font=font, fill=INK, anchor='ms', stroke_width=thick, stroke_fill=INK)
    if not simple:
        d.text((P(x + 3), P(y + 10)), '1', font=ImageFont.truetype(FONT, round(9 * u)), fill=INK, anchor='ls', stroke_width=max(1, round(0.3 * u)), stroke_fill=INK)
    return img.resize((size, size), Image.LANCZOS)


def save(img, name):
    img.save(os.path.join(ROOT, 'icons', name), optimize=True)


if __name__ == '__main__':
    save(png(192), 'icon-192.png')
    save(png(512), 'icon-512.png')
    save(png(512, maskable=True), 'icon-maskable-512.png')
    save(png(180), 'apple-touch-icon.png')
    save(png(48, simple=True), 'favicon-48.png')
    with open(os.path.join(ROOT, 'icons', 'logo.svg'), 'w') as f:
        f.write(svg())
    with open(os.path.join(ROOT, 'icons', 'favicon.svg'), 'w') as f:
        f.write(svg(simple=True))
    print('Wrote icons/')
