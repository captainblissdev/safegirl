"""V4 triage simulator: the reply kind V4 and the M2 baseline would give.

Run from the repository root (.venv, CPU; Node on PATH):

    .venv/Scripts/python.exe -I research/v4/triage_sim.py INPUT.csv --out OUTPUT.csv

INPUT.csv has the columns id and text. OUTPUT.csv has one row per item:
id, v4_kind, baseline_kind, upstream_fired, then v4_class,
v4_confidence and baseline_class for description. No text is written
or printed; the console gets counts only.

The measure is docs/decision-log.md, "V4 pre-registration: deviation 4
(2026-10-27), system-level measure":

- the gateway's real upstream rules run first (triage_sim.js, in
  backend.js order): Safety Net -> referral, generic help -> help, held
  topic -> held, vague-query rule -> ask;
- otherwise V4 (the frozen e5 hybrid via v4_infer): top probability
  below t_act 0.45 -> abstain, vague -> ask, out_of_scope -> abstain,
  topic class -> answer;
- otherwise the baseline under M2 (cv_baseline.m2): out_of_scope ->
  abstain, vague -> ask, topic class -> answer.

There is no retrieval, entry matching or relevance gate. Every setting
is pinned here; nothing is read from environment variables.
"""

from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
NODE_RUNNER = HERE / "triage_sim.js"
T_ACT = 0.45
TOPICS = ("contraception", "sti", "pregnancy", "general")
UPSTREAM_KIND = {"referral": "referral", "help": "help", "held_A": "held", "held_B": "held", "held_C": "held",
                 "vague_rule": "ask"}
COLUMNS = ["id", "v4_kind", "baseline_kind", "upstream_fired", "v4_class", "v4_confidence", "baseline_class"]


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def classifier_kind(cls: str, confidence: float | None = None) -> str:
    """The reply kind for a classifier result when no upstream rule
    fired. confidence is None for the baseline, which has none."""
    if confidence is not None and confidence < T_ACT:
        return "abstain"
    if cls == "vague":
        return "ask"
    if cls == "out_of_scope":
        return "abstain"
    if cls in TOPICS:
        return "answer"
    raise ValueError(f"unknown class {cls!r}")


def decide(upstream: str, v4_class: str, v4_confidence: float, baseline_class: str) -> tuple[str, str]:
    """(v4_kind, baseline_kind) for one item."""
    if upstream:
        kind = UPSTREAM_KIND[upstream]
        return kind, kind
    return classifier_kind(v4_class, v4_confidence), classifier_kind(baseline_class)


def run_upstream(items) -> dict:
    """{id: upstream result} from the Node runner; texts go over stdin only."""
    payload = json.dumps([{"id": i, "text": t} for i, t in items])
    done = subprocess.run(["node", str(NODE_RUNNER)], input=payload, capture_output=True, text=True,
                          encoding="utf-8", check=False)
    if done.returncode != 0:
        # stderr can only hold a stack trace; it never echoes the input.
        raise RuntimeError(f"triage_sim.js failed with exit code {done.returncode}")
    return {r["id"]: r["upstream"] for r in json.loads(done.stdout)}


def simulate(items, model=None) -> list[dict]:
    """Rows for (id, text) pairs. model is a loaded v4_infer model."""
    items = list(items)
    ids = [i for i, _ in items]
    if len(set(ids)) != len(ids):
        raise ValueError("duplicate ids")
    if model is None:
        model = _load("v4_infer", HERE / "v4_infer.py").load()
    assert model.t_act == T_ACT, "the frozen model's t_act differs from the pinned T_ACT"
    m2 = _load("cv_baseline", HERE / "cv_baseline.py").m2
    upstream = run_upstream(items)
    proba = model.predict_proba([t for _, t in items])
    rows = []
    for (item_id, text), p in zip(items, proba):
        top = int(p.argmax())
        v4_class, v4_conf = model.classes[top], float(p[top])
        base_class = m2(text)
        v4_kind, base_kind = decide(upstream[item_id], v4_class, v4_conf, base_class)
        rows.append({"id": item_id, "v4_kind": v4_kind, "baseline_kind": base_kind,
                     "upstream_fired": upstream[item_id], "v4_class": v4_class,
                     "v4_confidence": f"{v4_conf:.6f}", "baseline_class": base_class})
    return rows


def read_items(path: Path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        missing = {"id", "text"} - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"input needs the columns id and text; missing {sorted(missing)}")
        return [(r["id"], r["text"]) for r in reader]


def write_rows(rows, path: Path):
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("input", type=Path, help="CSV with columns id, text")
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args(argv)
    rows = simulate(read_items(args.input))
    write_rows(rows, args.out)
    print(f"{len(rows)} items; upstream fired on {sum(1 for r in rows if r['upstream_fired'])}")
    print("v4_kind:", dict(Counter(r["v4_kind"] for r in rows)))
    print("baseline_kind:", dict(Counter(r["baseline_kind"] for r in rows)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
