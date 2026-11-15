# Kopa Life logo: a pin-shaped "O" in Nigerian green with a white band (green-white-green), plus a wordmark set in Inter Display Black (outlined to paths).
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
import os
OUT = '/home/claude/nysc-survival/public/brand'
f = TTFont('/usr/share/fonts/opentype/inter/InterDisplay-Black.otf'); gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f['head'].unitsPerEm
def word(text, track=-30):
    x = 0; parts = []
    for ch in text:
        g = cmap[ord(ch)]; pen = SVGPathPen(gs); gs[g].draw(pen)
        parts.append(f'<path transform="translate({x} 0)" d="{pen.getCommands()}"/>'); x += gs[g].width + track
    return ''.join(parts), x - track
# the mark: a map pin whose head is a ring ("O"), banded green-white-green; khaki dot = you
def mark(size=512, bg=True):
    s = size / 512
    pin = 'M256 70c-92 0-166 72-166 162 0 118 140 214 158 226a14 14 0 0 0 16 0c18-12 158-108 158-226 0-90-74-162-166-162z'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="{size}" height="{size}">
<defs><clipPath id="pc"><path d="{pin}"/></clipPath><linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
{'<rect width="512" height="512" rx="112" fill="#0b1a12"/>' if bg else ''}
<g clip-path="url(#pc)"><rect x="60" y="60" width="140" height="420" fill="#1f9d55"/><rect x="200" y="60" width="112" height="420" fill="#f6f1e4"/><rect x="312" y="60" width="140" height="420" fill="#1f9d55"/><rect x="60" y="60" width="392" height="420" fill="url(#sh)"/></g>
<circle cx="256" cy="232" r="70" fill="#0b1a12"/><circle cx="256" cy="232" r="36" fill="#c9b78a"/>
</svg>'''
open(f'{OUT}/kopalife-mark.svg', 'w').write(mark(512, True))
open(f'{OUT}/kopalife-mark-transparent.svg', 'w').write(mark(512, False))
# wordmark: mark + "kopa life"
paths, w = word('kopa life', -40)
bp = BoundsPen(gs); gs[cmap[ord('o')]].draw(bp); xmin, ymin, xmax, ymax = bp.bounds; xh = ymax - ymin
H = 200; sc = H * 0.40 / xh; markW = H
cy = H * 232 / 512   # pin head centre
def lockup(ink):
    W = int(markW + 18 + w * sc + 6)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<g transform="scale({markW/512})">{mark(512, False).split('>',1)[1].rsplit('</svg>',1)[0]}</g>
<g fill="{ink}" transform="translate({markW + 10} {cy + xh*sc/2}) scale({sc} {-sc})">{paths}</g>
</svg>'''
open(f'{OUT}/kopalife-logo-light.svg', 'w').write(lockup('#f6f1e4'))
open(f'{OUT}/kopalife-logo-dark.svg', 'w').write(lockup('#0b1a12'))
print('ok')
