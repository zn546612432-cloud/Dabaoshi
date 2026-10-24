"""Extract eight non-overlapping actor sprites from a transparent 4x2 atlas.

Unlike a rectangular grid crop, alpha-connected extraction keeps hands, tails
and wings that extend past a nominal cell boundary. All frames use one scale
and the same bottom-center anchor, following the sprite-pipeline skill.
"""

from collections import deque
from pathlib import Path
import argparse

from PIL import Image, ImageChops, ImageFilter


def components(image: Image.Image):
    width, height = image.size
    alpha = image.getchannel("A").tobytes()
    seen = bytearray(width * height)
    result = []
    for start in range(width * height):
        if alpha[start] <= 24 or seen[start]:
            continue
        queue = deque([start])
        seen[start] = 1
        indices = []
        x0 = y0 = 10**9
        x1 = y1 = 0
        while queue:
            index = queue.popleft()
            x, y = index % width, index // width
            indices.append(index)
            x0, y0 = min(x0, x), min(y0, y)
            x1, y1 = max(x1, x), max(y1, y)
            for xx, yy in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1),
                           (x - 1, y - 1), (x + 1, y - 1),
                           (x - 1, y + 1), (x + 1, y + 1)):
                neighbor = yy * width + xx
                if (0 <= xx < width and 0 <= yy < height and
                        alpha[neighbor] > 24 and not seen[neighbor]):
                    seen[neighbor] = 1
                    queue.append(neighbor)
        if len(indices) > 10000:
            result.append((indices, (x0, y0, x1 + 1, y1 + 1)))
    if len(result) != 8:
        raise ValueError(f"Expected 8 actor components, found {len(result)}")
    return sorted(result, key=lambda item: (item[1][1] >= height // 2,
                                            (item[1][0] + item[1][2]) / 2))


def extract(image: Image.Image, out_dir: Path):
    actors = components(image)
    size = 512
    max_width = max(box[2] - box[0] for _, box in actors)
    max_height = max(box[3] - box[1] for _, box in actors)
    scale = min(480 / max_width, 480 / max_height)
    out_dir.mkdir(parents=True, exist_ok=True)
    width = image.width
    for number, (indices, box) in enumerate(actors, 1):
        x0, y0, x1, y1 = box
        local_width, local_height = x1 - x0, y1 - y0
        mask_bytes = bytearray(local_width * local_height)
        for index in indices:
            x, y = index % width, index // width
            mask_bytes[(y - y0) * local_width + x - x0] = 255
        mask = Image.frombytes("L", (local_width, local_height), bytes(mask_bytes))
        mask = mask.filter(ImageFilter.MaxFilter(5))
        cropped = image.crop(box)
        cropped.putalpha(ImageChops.multiply(cropped.getchannel("A"), mask))
        scaled = cropped.resize((round(local_width * scale), round(local_height * scale)),
                                Image.Resampling.LANCZOS)
        frame = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        frame.alpha_composite(scaled, ((size - scaled.width) // 2, size - scaled.height - 16))
        frame.save(out_dir / f"{number:02d}.png")
        print(f"{number:02d}: source={box}, alpha_pixels={len(indices)}, output={scaled.size}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("atlas", type=Path)
    parser.add_argument("out_dir", type=Path)
    args = parser.parse_args()
    extract(Image.open(args.atlas).convert("RGBA"), args.out_dir)
