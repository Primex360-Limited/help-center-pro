from PIL import Image
from pathlib import Path

assets = Path(__file__).resolve().parents[1] / "src" / "assets"
src = assets / "helpcentre-pro-mark.png"
img = Image.open(src).convert("RGBA")
pixels = img.load()
w, h = img.size

# Recolor: dark plate -> transparent, white/light glyphs -> brand blue,
# existing blue bubble stays/boosted.
BLUE = (21, 112, 239, 255)
for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        brightness = (r + g + b) / 3
        # near-black background
        if brightness < 40:
            pixels[x, y] = (0, 0, 0, 0)
            continue
        # already blue-ish chat bubble / accents
        if b > r + 20 and b > g + 10 and brightness > 40:
            pixels[x, y] = BLUE
            continue
        # white / light glyph strokes -> blue
        if brightness > 160:
            pixels[x, y] = BLUE
            continue
        # mid greys (anti-alias) -> blue with partial alpha
        alpha = int(min(255, (brightness / 160) * 255))
        pixels[x, y] = (21, 112, 239, alpha)

out = assets / "helpcentre-pro-mark-blue.png"
img.save(out, "PNG")
print(f"wrote {out.name} ({w}x{h})")
