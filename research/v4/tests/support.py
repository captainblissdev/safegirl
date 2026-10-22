"""Shared helpers for the V4 tooling tests: load a script by path (the
scripts are run with python -I, so they are not importable packages), a
fake embedder, and a small synthetic repository layout."""

import csv
import importlib.util
import re
from pathlib import Path

import numpy as np

V4 = Path(__file__).resolve().parents[1]


def load(name):
    spec = importlib.util.spec_from_file_location(name, V4 / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def fake_embed(texts):
    """Bag of words hashed into 64 dimensions: the same words in any order
    give cosine 1; texts with no word in common give 0."""
    out = np.zeros((len(texts), 64))
    for i, text in enumerate(texts):
        for word in re.findall(r"\w+", text.lower()):
            out[i, sum(map(ord, word)) % 64] += 1
    norms = np.linalg.norm(out, axis=1, keepdims=True)
    return out / np.where(norms == 0, 1, norms)


def fake_rules(texts):
    """Held topic for 'heldword', Safety Net for 'alarmword'."""
    return [
        {
            "held": "A" if "heldword" in t.lower() else None,
            "safety": "abuse" if "alarmword" in t.lower() else None,
        }
        for t in texts
    ]


def write_csv(path, header, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)


def make_repo(root):
    """A tiny repository with every file the checker reads. Words are
    chosen so that nothing below overlaps by accident."""
    res = Path(root) / "resources"
    write_csv(
        res / "seeds" / "seeds.csv",
        ["seed_id", "class", "text"],
        [
            ["SEED-STI-01", "sti", "Alpha bravo charlie delta echo?"],
            ["SEED-GEN-01", "general", "Kilo lima mike november oscar?"],
        ],
    )
    write_csv(
        res / "reviewed" / "sti_v3_paraphrases.csv",
        ["seed_id", "paraphrase_id", "class", "text"],
        [["SEED-STI-01", "SEED-STI-01-P1", "sti", "Foxtrot golf hotel india juliet?"]],
    )
    write_csv(
        res / "test" / "independent_test_set.csv",
        ["class", "text"],
        [["sti", "Secret dr04 papa quebec romeo?"], ["general", "Secret dr04 sierra tango?"]],
    )
    write_csv(
        res / "eval" / "relevance_validation.csv",
        ["id", "query", "group", "expected", "likely_entry", "notes"],
        [["V01", "Uniform victor whiskey xray yankee?", "in_scope", "ANSWER", "", ""]],
    )
    write_csv(
        res / "eval" / "retrieval_eval_set.csv",
        ["id", "query", "group"],
        [["Q01", "Zulu amber bronze copper dune?", "clear"]],
    )
    kb = res / "knowledge_base"
    kb.mkdir(parents=True, exist_ok=True)
    (kb / "sti.md").write_text(
        "# STIs\n\n## KB-S1\n- **User question:** Alpha bravo charlie delta echo?\n"
        "- **Answer:** A.\n- **Source:** S.\n- **Status:** approved\n\n"
        "## KB-S2\n- **User question:** Ember flint garnet hazel iris?\n"
        "- **Answer:** A.\n- **Source:** S.\n- **Status:** pending\n"
        "\n---\n\n## KB-S9\n- **User question:** Held one?\n",
        encoding="utf-8",
    )
    return Path(root)


SEED_HEADER = [
    "seed_id",
    "text",
    "primary_class",
    "secondary_class",
    "style",
    "boundary",
    "source",
    "notes",
]


def seed(sid, text, cls="sti", style="formal", source="KB-S1", secondary="", boundary=""):
    return [sid, text, cls, secondary, style, boundary, source, ""]
