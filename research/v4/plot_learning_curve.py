"""Draw research/v4/results/cv_learning_curve.png from cv_learning_curve.json.

Run from the repository root. It needs Pillow, which .venv lacks and
.venv-train has (nothing is installed for this):

    .venv-train/Scripts/python.exe -I research/v4/plot_learning_curve.py

Macro-F1 (mean over 5 folds, sd bars) against the mean number of
training seeds per class. One series, so no legend box; the title names
it, and the table in cv_learning_curve.md is the data view.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
SRC = HERE / "results" / "cv_learning_curve.json"
OUT = HERE / "results" / "cv_learning_curve.png"

# reference palette, light mode
SURFACE, INK, INK_2, GRID, SERIES = "#fcfcfb", "#0b0b0b", "#52514e", "#e4e3df", "#2a78d6"
W, H = 1800, 1000
LEFT, RIGHT, TOP, BOTTOM = 170, 80, 170, 150
Y_MIN, Y_MAX, Y_STEP = 0.70, 1.00, 0.05
X_MIN, X_MAX = 0, 60


def font(size):
    return ImageFont.load_default(size=size)


def main():
    rows = json.loads(SRC.read_text(encoding="utf-8"))["rows"]
    img = Image.new("RGB", (W, H), SURFACE)
    d = ImageDraw.Draw(img)

    def px(x):
        return LEFT + (x - X_MIN) / (X_MAX - X_MIN) * (W - LEFT - RIGHT)

    def py(y):
        return TOP + (Y_MAX - y) / (Y_MAX - Y_MIN) * (H - TOP - BOTTOM)

    d.text((LEFT, 50), "Learning curve: e5 hybrid (C 10), CV macro-F1", fill=INK, font=font(40))
    d.text((LEFT, 104), "Mean over 5 folds, bars = 1 sd. Held-out seeds only; training seeds subsampled per class.",
           fill=INK_2, font=font(26))

    y = Y_MIN
    while y <= Y_MAX + 1e-9:
        d.line([(LEFT, py(y)), (W - RIGHT, py(y))], fill=GRID, width=2)
        d.text((LEFT - 20, py(y)), f"{y:.2f}", fill=INK_2, font=font(26), anchor="rm")
        y += Y_STEP
    d.line([(LEFT, py(Y_MIN)), (W - RIGHT, py(Y_MIN))], fill=INK_2, width=2)
    for x in range(X_MIN, X_MAX + 1, 10):
        d.text((px(x), py(Y_MIN) + 20), str(x), fill=INK_2, font=font(26), anchor="mt")
    d.text(((LEFT + W - RIGHT) / 2, H - 50), "Mean training seeds per class", fill=INK_2, font=font(28), anchor="ms")
    d.text((LEFT - 20, TOP - 30), "Macro-F1", fill=INK_2, font=font(28), anchor="rs")

    pts = [(px(r["mean_seeds_per_class_overall"]), py(r["macro_f1_mean"])) for r in rows]
    for r, (x, _) in zip(rows, pts):
        lo, hi = r["macro_f1_mean"] - r["macro_f1_sd"], r["macro_f1_mean"] + r["macro_f1_sd"]
        d.line([(x, py(lo)), (x, py(hi))], fill=SERIES, width=3)
        d.line([(x - 10, py(lo)), (x + 10, py(lo))], fill=SERIES, width=3)
        d.line([(x - 10, py(hi)), (x + 10, py(hi))], fill=SERIES, width=3)
    d.line(pts, fill=SERIES, width=4, joint="curve")
    for x, y in pts:
        d.ellipse([x - 9, y - 9, x + 9, y + 9], fill=SERIES, outline=SURFACE, width=3)
    # direct labels on the two ends only, each to the right of its point
    for r, (x, y), dx, anchor in ((rows[0], pts[0], 18, "lt"), (rows[-1], pts[-1], 18, "lt")):
        d.text((x + dx, y + 14), f"{r['macro_f1_mean']:.3f} ({r['size']:.0%} of seeds)", fill=INK, font=font(26),
               anchor=anchor)

    img.save(OUT, optimize=True)
    print(f"wrote {OUT.relative_to(HERE.parents[1])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
