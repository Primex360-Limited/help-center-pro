from PIL import Image
from pathlib import Path

assets = Path(__file__).resolve().parents[1] / "src" / "assets"


def knock_black(src_name, dst_name, threshold=28, soft=18):
    src = assets / src_name
    img = Image.open(src).convert("RGBA")
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if r <= threshold and g <= threshold and b <= threshold:
                darkness = max(r, g, b)
                if darkness <= threshold - soft:
                    pixels[x, y] = (r, g, b, 0)
                else:
                    t = (darkness - (threshold - soft)) / float(soft or 1)
                    pixels[x, y] = (r, g, b, int(a * t))
    out = assets / dst_name
    img.save(out, "PNG")
    print(f"wrote {out.name} ({w}x{h})")


knock_black("signup-agent.png", "signup-agent-clear.png", threshold=32, soft=20)
knock_black("signup-pill-email.png", "signup-pill-email-clear.png", threshold=40, soft=16)
knock_black("signup-pill-chat.png", "signup-pill-chat-clear.png", threshold=40, soft=16)
knock_black("signup-pill-call.png", "signup-pill-call-clear.png", threshold=40, soft=16)
print("done")
