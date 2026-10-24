"""Build convex collision outlines from the visible alpha silhouettes of gems."""

from pathlib import Path
import json
import math
import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
FILES = [
    "gem-1-candy.png", "gem-2-pumpkin.png", "gem-3-ghost.png", "gem-4-bat.png",
    "gem-5-witch-moon.png", "gem-6-potion.png", "gem-7-blood-moon.png", "gem-8-star.png",
    "gem-9-skull-diamond.png", "gem-10-crown.png", "gem-11-jack-o-lantern.png",
]


def cross(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def hull(points):
    points = sorted(set(points))
    lower, upper = [], []
    for point in points:
        while len(lower) > 1 and cross(lower[-2], lower[-1], point) <= 0:
            lower.pop()
        lower.append(point)
    for point in reversed(points):
        while len(upper) > 1 and cross(upper[-2], upper[-1], point) <= 0:
            upper.pop()
        upper.append(point)
    return lower[:-1] + upper[:-1]


outlines = []
for filename in FILES:
    image = np.asarray(Image.open(ROOT / "assets" / filename).convert("RGBA"))
    alpha = image[::4, ::4, 3]
    yy, xx = np.nonzero(alpha > 96)
    xx = (xx * 4 - image.shape[1] / 2) / (image.shape[1] / 2)
    yy = (yy * 4 - image.shape[0] / 2) / (image.shape[0] / 2)
    support = []
    for step in range(24):
        angle = 2 * math.pi * step / 24
        index = np.argmax(xx * math.cos(angle) + yy * math.sin(angle))
        support.append((round(float(xx[index]), 3), round(float(yy[index]), 3)))
    outline = hull(support)
    outlines.append(outline)
    print(filename, len(outline), outline)

(ROOT / "gem-hulls.js").write_text("const GEM_HULLS = " + json.dumps(outlines) + ";\n", encoding="utf-8")
