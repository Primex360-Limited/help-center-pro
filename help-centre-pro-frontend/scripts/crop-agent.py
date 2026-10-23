from PIL import Image
from pathlib import Path

assets = Path(__file__).resolve().parents[1] / "src" / "assets"
src = assets / "signup-agent-clear.png"
img = Image.open(src).convert("RGBA")

# Tight crop to opaque content, then small padding so desk/icons aren't flush.
bbox = img.getbbox()
if not bbox:
    raise SystemExit("no opaque content")

pad = 12
l, t, r, b = bbox
l = max(0, l - pad)
t = max(0, t - pad)
r = min(img.width, r + pad)
b = min(img.height, b + pad)
cropped = img.crop((l, t, r, b))

out = assets / "signup-agent-framed.png"
cropped.save(out, "PNG")
print(f"wrote {out.name} {img.size} -> {cropped.size} bbox={bbox}")
