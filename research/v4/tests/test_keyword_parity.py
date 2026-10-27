"""Keyword-count comparison, Node vs Python (V4 integration plan, step 2).

NON-BLOCKING: it reports mismatches and does not fail on them. For the
five baseline classes it compares the gateway's
KeywordBaselineClassifier (app/gateway/src/fallback/keywordClassifier.js,
matchedKeywords lengths) with explain_baseline
(research/experiments/baseline_classifier.py, scores), over every seed,
every paraphrase, the 58 dev queries (an equivalence check only, never
for tuning) and the synthetic edge cases. The report names ids, never
text. Neither classifier is changed.

V4 computes its keyword features in Python only (v4_infer and, at
training time, cv_hybrid), so a Node/Python mismatch does not change
V4's inputs; it matters only for the gateway's own keyword fallback.
"""

import csv
import json
import re
import subprocess
import unittest
from collections import Counter, defaultdict

from tests import edge_cases
from tests.support import V4, load

cv = load("cv_common")
baseline = load("cv_baseline").baseline
RUNNER = V4 / "tests" / "keyword_counts.js"
DEV_SET = cv.REPO / "resources" / "eval" / "retrieval_eval_set.csv"
CLASSES = ("gbv", "sti", "contraception", "pregnancy", "general")


def items():
    data = cv.load_data()
    out = [("seed", x["id"], x["text"]) for x in data["seeds"]]
    out += [("paraphrase", x["id"], x["text"]) for x in data["paraphrases"]]
    with open(DEV_SET, encoding="utf-8-sig", newline="") as f:
        out += [("dev", f"DEV-{r['id']}", r["query"]) for r in csv.DictReader(f)]
    out += [("edge", f"EDGE-{cid}", text) for cid, text in edge_cases.all_cases()]
    return out


def node_side(rows):
    done = subprocess.run(["node", str(RUNNER)], input=json.dumps([{"id": i, "text": t} for _, i, t in rows]),
                          capture_output=True, text=True, encoding="utf-8", check=True)
    return json.loads(done.stdout)


def diagnose(text, node_lower, keyword, node_lists, py_lists):
    """Why one keyword is matched on one side only."""
    if node_lower != text.lower():
        return "lowercasing differs (JS toLowerCase vs Python lower)"
    in_node = any(keyword in v for v in node_lists.values())
    in_py = any(keyword in v for v in py_lists.values())
    if in_node != in_py:
        return "keyword list differs"
    pattern = r"\b" + re.escape(keyword) + r"\b"
    if bool(re.search(pattern, text.lower(), re.ASCII)) != bool(re.search(pattern, text.lower())):
        return "word boundary: ASCII-only \\b (JS) vs Unicode \\b (Python)"
    return "other"


def compare():
    rows = items()
    node = node_side(rows)
    node_lists, py_lists = node["keywords"], baseline.KEYWORDS
    per_class = Counter()
    patterns = defaultdict(set)
    ids = defaultdict(set)
    for (source, item_id, text), n in zip(rows, node["items"]):
        assert n["id"] == item_id
        py = baseline.explain_baseline(text)
        for c in CLASSES:
            node_kw = set(n["matched"].get(c, []))
            py_kw = set(py["matched_keywords"].get(c, []))
            if len(node_kw) != py["scores"][c]:
                per_class[c] += 1
                ids[source].add(item_id)
                for k in sorted(node_kw ^ py_kw):
                    patterns[diagnose(text, n["lower"], k, node_lists, py_lists)].add(item_id)
    list_diff = {}
    for c in CLASSES:
        only_node = sorted(set(node_lists.get(c, [])) - set(py_lists.get(c, [])))
        only_py = sorted(set(py_lists.get(c, [])) - set(node_lists.get(c, [])))
        if only_node or only_py:
            list_diff[c] = {"only_node": only_node, "only_python": only_py}
    return {"items": Counter(s for s, _, _ in rows), "per_class": per_class, "patterns": patterns, "ids": ids,
            "keyword_list_differences": list_diff}


class KeywordCountComparison(unittest.TestCase):
    """Reports; does not fail on mismatches."""

    def test_report(self):
        r = compare()
        self.assertEqual(r["items"]["dev"], 58)
        self.assertEqual(r["items"]["seed"], 380)
        lines = ["", "Keyword-count comparison, Node vs Python (non-blocking):",
                 f"  items: {dict(r['items'])}",
                 f"  mismatching items per class: {dict(r['per_class']) or 'none'}",
                 f"  keyword lists that differ: {r['keyword_list_differences'] or 'none'}"]
        for pattern, item_ids in sorted(r["patterns"].items()):
            lines.append(f"  pattern '{pattern}': {len(item_ids)} items: {sorted(item_ids)}")
        for source, item_ids in sorted(r["ids"].items()):
            lines.append(f"  {source} ids with a mismatch: {sorted(item_ids)}")
        print("\n".join(lines))

    def test_deterministic(self):
        rows = [("edge", f"EDGE-{cid}", t) for cid, t in edge_cases.all_cases()]
        self.assertEqual(node_side(rows), node_side(rows))


if __name__ == "__main__":
    unittest.main()
