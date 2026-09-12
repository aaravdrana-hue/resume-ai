#!/usr/bin/env python3
"""Render the Resume mark to PNG icons.

The mark is two paper layers — the saved state behind, the current one in
front — matching the SVG in popup.html. Drawn from the 20x20 viewBox the
design system uses, supersampled 8x and downsampled for clean edges.

Run:  python3 extension/icons/make-icons.py
"""

from PIL import Image, ImageDraw

INK = (10, 12, 11, 255)  # #0A0C0B  page
ASH = (111, 132, 120, 255)  # #6F8478  superseded layer
ROYAL = (20, 107, 58, 255)  # #146B3A  current and confirmed
ROYAL_BRIGHT = (63, 191, 117, 255)  # #3FBF75  live indicator

SS = 8  # supersample factor
VIEWBOX = 20.0
SIZES = (16, 32, 48, 128)


def render(size: int) -> Image.Image:
    px = size * SS
    img = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Ink plate so the mark holds up on light and dark toolbars alike.
    d.rounded_rectangle([0, 0, px - 1, px - 1], radius=px * 0.22, fill=INK)

    u = px / VIEWBOX  # one viewBox unit in device pixels

    def layer(x, y, w, h, r, fill, outline, stroke):
        d.rounded_rectangle(
            [x * u, y * u, (x + w) * u, (y + h) * u],
            radius=r * u,
            fill=fill,
            outline=outline,
            width=max(1, round(stroke * u)),
        )

    if size >= 48:
        # Full mark: back layer is what was saved, front is where you are now.
        layer(2.5, 5.5, 12, 12, 3, None, ASH, 1.5)
        layer(5.5, 2.5, 12, 12, 3, ROYAL, ROYAL_BRIGHT, 1.25)
    else:
        # At 16-32px the two layers collapse into mush, so carry the identity
        # with one bold layer instead: bigger, thicker edge, still royal.
        layer(3.5, 3.5, 13, 13, 3.6, ROYAL, ROYAL_BRIGHT, 2)

    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    import pathlib

    out = pathlib.Path(__file__).parent
    for s in SIZES:
        path = out / f"icon{s}.png"
        render(s).save(path)
        print(f"wrote {path.name}")
