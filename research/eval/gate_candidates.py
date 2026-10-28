"""Gate and ranking candidates for the 62-entry KB, built and selected on
the development items only (docs/decision-log.md, "KB scale validation:
gate and ranking (PRE-REGISTRATION)").

For each of the 75 relabelled development items (35 dev questions, 40
gate-set items; the 6 distress items are not scored, leaving 69) this
computes, in full and question embed mode with ml_service's own
KnowledgeBaseRetriever: the score of every entry, the keyword (BM25)
score of every entry, V3's class and confidence (the ml_service
checkpoint, as /classify computes them) and V4's class and confidence
(research/v4/v4_infer.py with the retriever's e5). The gateway's rules
before classification (Safety Net, help, held topic, vague) come from
gate_candidates_routes.js.

It first reproduces the saved K5 numbers (k5_{full,question}_relabelled.json:
the dev replies and the gate-set counts) and stops if they differ. It
then scores exactly six pipelines by leave-one-out cross-validation:

  P0  full mode, the current gate (0.8439)
  P1  full mode, threshold recalibrated
  P2  question mode, threshold recalibrated
  P3  question mode, logistic gate on top-1 score, margin and V4 agreement
  P4  question mode, hybrid keyword/dense ranking, threshold recalibrated
  P5  question mode, hybrid ranking, logistic gate

In every pipeline V3 still routes (abstain below 0.35, scoped at 0.5 or
above, unscoped between), as in production with V4 off; V4 is only the
agreement signal of P3 and P5. With V4 off, P3 and P5 fall back to a
logistic gate on score and margin only, also fitted and reported. The
pre-registered selection rule picks the winner, which is frozen to
research/eval/gate_v2/frozen_gate_v2.json (with a .sha256 sidecar).
Nothing is wired into production. Outputs hold ids and numbers only.

Usage (no services needed):
  .venv/Scripts/python.exe -I research/eval/gate_candidates.py
      --labels DEV_LABELS.csv --gate GATE_LABELS.csv
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "research" / "eval" / "gate_v2"
RESULTS = REPO / "research" / "v4" / "results"

ABSTAIN, SCOPED, GATE = 0.35, 0.5, 0.8439
HYBRID_WEIGHTS = (0.05, 0.1, 0.2, 0.3, 0.5)
LR_C = 1.0
BOOTSTRAP, SEED = 10_000, 20261028
PIPELINES = ("P0", "P1", "P2", "P3", "P4", "P5")
# Fitted-parameter level for the tie rule (fixed before any result):
# P0 none; P1, P2 one threshold; P4 weight and threshold; P3 logistic
# regression; P5 weight and logistic regression.
COMPLEXITY = {"P0": 0, "P1": 1, "P2": 1, "P4": 2, "P3": 3, "P5": 4}
MODE = {"P0": "full", "P1": "full", "P2": "question", "P3": "question", "P4": "question", "P5": "question"}

STOPWORDS = set("""a an and are as at be been but by can could do does did for from had has have how
i if in is it its me my of on or our so than that the their them then there these they this to
too was we were what when where which who why will with would you your am im dont""".split())


# --------------------------------------------------------------- items

def read_csv(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def split_ids(value):
    return [s.strip() for s in re.split(r"[;|]", value or "") if s.strip()]


def gate_acceptable(row):
    also = re.search(r"also acceptable: ([^;\s]+(?:;[^;\s]+)*)", row.get("notes") or "")
    return split_ids(row.get("likely_entry")) + (split_ids(also.group(1)) if also else [])


def load_items(labels_path, gate_path):
    """The 75 development items: id, set, text, expected, acceptable, scored."""
    eval_rows = {r["id"]: r for r in read_csv(REPO / "resources" / "eval" / "retrieval_eval_set.csv")}
    items = []
    for label in read_csv(labels_path):
        if label["expected_class"] == "none":
            continue
        row = eval_rows[label["id"]]
        behaviour = [b.strip() for b in row["expected_behavior"].split("|")]
        expected = "not_referral" if "NOT_REFERRAL" in behaviour else ("answer" if "ANSWER" in behaviour else "abstain")
        items.append({"id": label["id"], "set": "dev", "text": row["query"], "expected": expected,
                      "acceptable": split_ids(label["acceptable_entry_ids"]), "scored": True})
    for row in read_csv(gate_path):
        expected = {"ANSWER": "answer", "NOT_KB_ANSWER": "abstain", "REFERRAL_OR_SIGNPOST": "referral"}[row["expected"]]
        items.append({"id": row["id"], "set": "gate", "text": row["query"], "expected": expected,
                      "acceptable": gate_acceptable(row), "scored": expected != "referral"})
    return items


def routes(items):
    run = subprocess.run(["node", str(REPO / "research" / "eval" / "gate_candidates_routes.js")],
                         input=json.dumps([{"id": i["id"], "text": i["text"]} for i in items]),
                         capture_output=True, text=True, encoding="utf-8", check=True)
    return json.loads(run.stdout)


# --------------------------------------------------------------- scoring

def tokens(text):
    return [t for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in STOPWORDS]


class BM25:
    """Okapi BM25 over the entries' question and content (k1 1.5, b 0.75)."""

    def __init__(self, docs, k1=1.5, b=0.75):
        self.docs = [tokens(d) for d in docs]
        self.k1, self.b = k1, b
        self.avg = sum(map(len, self.docs)) / len(self.docs)
        n = len(self.docs)
        df = {}
        for d in self.docs:
            for t in set(d):
                df[t] = df.get(t, 0) + 1
        self.idf = {t: math.log(1 + (n - c + 0.5) / (c + 0.5)) for t, c in df.items()}

    def scores(self, query):
        q = tokens(query)
        out = np.zeros(len(self.docs))
        for j, d in enumerate(self.docs):
            for t in q:
                f = d.count(t)
                if f:
                    out[j] += self.idf[t] * f * (self.k1 + 1) / (f + self.k1 * (1 - self.b + self.b * len(d) / self.avg))
        return out


def normalised(kw):
    """Keyword scores scaled to [0, 1] by the query's best entry (0 if none)."""
    top = kw.max()
    return kw / top if top > 0 else kw


# --------------------------------------------------------------- pipelines

def decision(item, f, w=0.0):
    """What the item's ranking gives before the gate: (live entry, top-1
    score, margin, live entry's class) or None when no entry is retrieved
    (an earlier rule answers, or V3 abstains)."""
    if f["route"] != "retrieve" or f["v3_conf"] < ABSTAIN:
        return None
    score = f["dense"] + w * f["kw"]
    order = np.argsort(-score, kind="stable")
    top1, top2 = score[order[0]], score[order[1]]
    if f["v3_conf"] >= SCOPED:
        in_class = [j for j in order if f["classes"][j] == f["v3_class"]]
        live = in_class[0]
    else:
        live = order[0]
    return {"entry": f["ids"][live], "s1": float(top1), "margin": float(top1 - top2),
            "agree": float(f["v4_class"] == f["classes"][live]), "entry_class": f["classes"][live]}


def outcome(item, route, served):
    """success and category for an item given what was served (None: nothing)."""
    if item["expected"] == "not_referral":
        success = route != "referral"
    elif item["expected"] == "answer":
        success = served is not None and served in item["acceptable"]
    else:
        success = served is None
    if served is not None:
        category = "correct_answer" if success else "wrong_answer"
    else:
        category = "correct_abstain" if success else "missed_answer"
    return success, category


def serve_outcomes(item, route, d):
    """(success if served, success if not) for a retrieved item."""
    return outcome(item, route, d["entry"])[0], outcome(item, route, None)[0]


def calibrate_threshold(rows):
    """Threshold maximising successes on rows of (s1, ok_served, ok_abstain);
    ties to fewer wrong answers served, then the middle candidate."""
    s = sorted({r[0] for r in rows})
    candidates = [-math.inf] + [(a + b) / 2 for a, b in zip(s, s[1:])] + [math.inf]
    scored = []
    for t in candidates:
        util = sum((ok_s if s1 >= t else ok_a) for s1, ok_s, ok_a in rows)
        wrong = sum(1 for s1, ok_s, _ in rows if s1 >= t and not ok_s)
        scored.append((util, -wrong, t))
    best = max((u, w) for u, w, _ in scored)
    tied = [t for u, w, t in scored if (u, w) == best]
    return tied[len(tied) // 2]


def fit_logistic(x, y):
    """Standardised logistic regression; a constant model if y has one class."""
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=int)
    if len(set(y.tolist())) < 2:
        return {"constant": int(y[0]) if len(y) else 0}
    scaler = StandardScaler().fit(x)
    model = LogisticRegression(C=LR_C, max_iter=1000).fit(scaler.transform(x), y)
    return {"mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist(),
            "coef": model.coef_[0].tolist(), "intercept": float(model.intercept_[0])}


def logistic_serves(model, x):
    if "constant" in model:
        return bool(model["constant"])
    z = (np.asarray(x) - np.array(model["mean"])) / np.array(model["scale"])
    p = 1 / (1 + math.exp(-(float(z @ np.array(model["coef"])) + model["intercept"])))
    return p >= 0.5


def gate_features(d, with_v4=True):
    return [d["s1"], d["margin"], d["agree"]] if with_v4 else [d["s1"], d["margin"]]


def fit(pipeline, train, feats, with_v4=True):
    """Parameters of a pipeline fitted on training items."""
    mode = MODE[pipeline]
    if pipeline == "P0":
        return {"threshold": GATE, "w": 0.0}
    weights = HYBRID_WEIGHTS if pipeline in ("P4", "P5") else (0.0,)
    best = None
    for w in weights:
        rows, xs, ys = [], [], []
        for it in train:
            f = feats[mode][it["id"]]
            d = decision(it, f, w)
            if d is None:
                continue
            ok_s, ok_a = serve_outcomes(it, f["route"], d)
            rows.append((d["s1"], ok_s, ok_a, d))
        if pipeline in ("P1", "P2", "P4"):
            t = calibrate_threshold([(s1, ok_s, ok_a) for s1, ok_s, ok_a, _ in rows])
            params = {"threshold": t, "w": w}
            serves = [s1 >= t for s1, _, _, _ in rows]
        else:
            model = fit_logistic([gate_features(d, with_v4) for *_, d in rows], [int(ok_s) for _, ok_s, _, _ in rows])
            params = {"logistic": model, "w": w, "with_v4": with_v4}
            serves = [logistic_serves(model, gate_features(d, with_v4)) for *_, d in rows]
        util = sum((ok_s if sv else ok_a) for (_, ok_s, ok_a, _), sv in zip(rows, serves))
        wrong = sum(1 for (_, ok_s, _, _), sv in zip(rows, serves) if sv and not ok_s)
        key = (util, -wrong, -w)
        if best is None or key > best[0]:
            best = (key, params)
    return best[1]


def apply(pipeline, params, item, feats):
    """(served entry or None, kind) for one item under fitted parameters."""
    f = feats[MODE[pipeline]][item["id"]]
    if f["route"] != "retrieve":
        return None, f["route"]
    d = decision(item, f, params["w"])
    if d is None:
        return None, "v3_abstain"
    if "threshold" in params:
        serve = d["s1"] >= params["threshold"]
    else:
        serve = logistic_serves(params["logistic"], gate_features(d, params["with_v4"]))
    return (d["entry"], "answer") if serve else (None, "gate_abstain")


def loo(pipeline, items, feats, with_v4=True):
    """Leave-one-out outcomes over the scored items."""
    scored = [i for i in items if i["scored"]]
    out = []
    for k, it in enumerate(scored):
        params = fit(pipeline, scored[:k] + scored[k + 1:], feats, with_v4)
        served, kind = apply(pipeline, params, it, feats)
        success, category = outcome(it, feats[MODE[pipeline]][it["id"]]["route"], served)
        out.append({"id": it["id"], "served": served, "kind": kind, "success": success, "category": category})
    return out


def summary(results):
    cats = [r["category"] for r in results]
    return {"score": sum(r["success"] for r in results), "of": len(results),
            "correct_answers": cats.count("correct_answer"), "wrong_answers_served": cats.count("wrong_answer"),
            "correct_abstains": cats.count("correct_abstain"), "missed_answers": cats.count("missed_answer")}


def bootstrap_difference(a, b, n=BOOTSTRAP, seed=SEED):
    """95% percentile interval of sum(a) - sum(b) over item resamples."""
    a, b = np.asarray(a, dtype=float), np.asarray(b, dtype=float)
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, len(a), size=(n, len(a)))
    diffs = a[idx].sum(axis=1) - b[idx].sum(axis=1)
    return [float(np.percentile(diffs, 2.5)), float(np.percentile(diffs, 97.5))]


def select(summaries):
    """The pre-registered rule: highest LOO score; within one item of the
    best, the simpler pipeline, then fewer wrong answers served, then the
    lower number."""
    best = max(s["score"] for s in summaries.values())
    near = [p for p, s in summaries.items() if s["score"] >= best - 1]
    return min(near, key=lambda p: (COMPLEXITY[p], summaries[p]["wrong_answers_served"], PIPELINES.index(p)))


# --------------------------------------------------------------- features

def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def compute_features(items, route_of):
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer
    sys.path.insert(0, str(REPO / "ml_service"))
    from retrieval import QUERY_PREFIX, KnowledgeBaseRetriever

    kb_path = REPO / "ml_service" / "knowledge_base.json"
    texts = [i["text"] for i in items]

    # V3, as ml_service's /classify computes it.
    tok = AutoTokenizer.from_pretrained(REPO / "ml_service" / "final")
    v3 = AutoModelForSequenceClassification.from_pretrained(REPO / "ml_service" / "final").eval()
    id2label = {int(k): str(v).lower() for k, v in v3.config.id2label.items()}
    v3_out = []
    for t in texts:
        enc = tok(t.strip(), return_tensors="pt", truncation=True, padding=True, max_length=64)
        with torch.inference_mode():
            p = torch.softmax(v3(**enc).logits, dim=-1)[0]
        k = int(torch.argmax(p).item())
        v3_out.append((id2label[k], float(p[k])))

    feats, retriever = {}, None
    for mode in ("full", "question"):
        retriever = KnowledgeBaseRetriever(kb_path, mode)
        entries = retriever.entries
        q = retriever.model.encode([QUERY_PREFIX + t for t in texts], convert_to_numpy=True, normalize_embeddings=True)
        dense = q @ retriever.embeddings.T
        bm25 = BM25([e["title"] + " " + e["content"] for e in entries])
        feats[mode] = {}
        for i, it in enumerate(items):
            feats[mode][it["id"]] = {
                "route": route_of[it["id"]], "ids": [e["id"] for e in entries], "classes": [e["class"] for e in entries],
                "dense": dense[i].astype(float), "kw": normalised(bm25.scores(it["text"])),
                "v3_class": v3_out[i][0], "v3_conf": v3_out[i][1],
            }

    # V4 with the retriever's e5, as ml_service's load_v4 does.
    sys.path.insert(0, str(REPO / "research" / "v4"))
    import v4_infer
    v4 = None

    def embed(ts):
        e = v4.spec["embedding"]
        return retriever.model.encode([e["prefix"] + t for t in ts], normalize_embeddings=e["normalize"])

    v4 = v4_infer.load(embed=embed)
    probs = v4.predict_proba(texts)
    for i, it in enumerate(items):
        k = int(np.argmax(probs[i]))
        for mode in feats:
            feats[mode][it["id"]]["v4_class"] = v4.classes[k]
            feats[mode][it["id"]]["v4_conf"] = float(probs[i][k])
    return feats


# --------------------------------------------------------------- K5 check

def reproduce_k5(items, feats):
    """The saved K5 replies and gate counts, from the features; returns a
    list of mismatches (empty when everything matches)."""
    problems, report = [], {}
    for mode in ("full", "question"):
        saved = json.load(open(RESULTS / f"k5_{mode}_relabelled.json", encoding="utf-8"))
        dev_saved = {q["id"]: q for q in saved["dev"]["per_question"]}
        correct = 0
        for it in [i for i in items if i["set"] == "dev"]:
            f = feats[mode][it["id"]]
            d = decision(it, f)
            served = d["entry"] if d and d["s1"] >= GATE else None
            s = dev_saved[it["id"]]
            if served != s["entry"]:
                problems.append(f"{mode} {it['id']}: served {served}, K5 {s['entry']}")
            success, _ = outcome(it, f["route"], served)
            correct += success
            if int(np.argmax(f["dense"])) != f["ids"].index(s["unscoped_top1"]):
                problems.append(f"{mode} {it['id']}: unscoped top-1 differs from K5")
        if correct != saved["dev"]["correct"]:
            problems.append(f"{mode}: dev correct {correct}, K5 {saved['dev']['correct']}")
        gate_saved = saved["gate_set"]
        counts = {"correct_below_gate": [], "wrong_passing_gate": [], "off_topic_passing_gate": []}
        for it in [i for i in items if i["set"] == "gate" and i["expected"] != "referral"]:
            f = feats[mode][it["id"]]
            j = int(np.argmax(f["dense"]))
            score, top = float(f["dense"][j]), f["ids"][j]
            if it["expected"] == "abstain":
                if score >= GATE:
                    counts["off_topic_passing_gate"].append(it["id"])
            elif top in it["acceptable"]:
                if score < GATE:
                    counts["correct_below_gate"].append(it["id"])
            elif score >= GATE:
                counts["wrong_passing_gate"].append(it["id"])
        for k, v in counts.items():
            if sorted(v) != sorted(gate_saved[k]):
                problems.append(f"{mode} gate set {k}: {sorted(v)} vs K5 {sorted(gate_saved[k])}")
        report[mode] = {"dev_correct": correct, **{k: len(v) for k, v in counts.items()}}
    return problems, report


# --------------------------------------------------------------- main

def provenance(kb_path):
    from huggingface_hub import try_to_load_from_cache
    path = try_to_load_from_cache("intfloat/multilingual-e5-small", "model.safetensors")
    revision = re.search(r"snapshots[\\/]([0-9a-f]{40})", str(path)) if isinstance(path, str) else None
    return {
        "e5": {"model": "intfloat/multilingual-e5-small", "revision": revision.group(1) if revision else None,
               "weights_sha256": sha256(path) if isinstance(path, str) else None},
        "v3_checkpoint_sha256": {n: sha256(REPO / "ml_service" / "final" / n) for n in ("model.safetensors", "config.json")},
        "v4_frozen_sha256": sha256(REPO / "research" / "v4" / "frozen" / "v4_hybrid_c10.json"),
        "kb_sha256": sha256(kb_path),
        "code_sha256": {p: sha256(REPO / p) for p in (
            "research/eval/gate_candidates.py", "research/eval/gate_candidates_routes.js", "ml_service/retrieval.py")},
    }


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--labels", required=True)
    ap.add_argument("--gate", required=True)
    args = ap.parse_args(argv)

    items = load_items(args.labels, args.gate)
    scored = [i for i in items if i["scored"]]
    assert len(items) == 75 and len(scored) == 69, (len(items), len(scored))
    route_of = routes(items)
    feats = compute_features(items, route_of)

    problems, k5 = reproduce_k5(items, feats)
    if problems:
        print("K5 not reproduced; stopping:")
        for p in problems:
            print(" ", p)
        return 1
    print("K5 reproduced:", json.dumps(k5))

    per_item, summaries = {}, {}
    for p in PIPELINES:
        per_item[p] = loo(p, items, feats)
        summaries[p] = summary(per_item[p])
    fallback = {p: summary(loo(p, items, feats, with_v4=False)) for p in ("P3", "P5")}
    base = [r["success"] for r in per_item["P0"]]
    for p in PIPELINES:
        summaries[p]["diff_to_P0"] = summaries[p]["score"] - summaries["P0"]["score"]
        summaries[p]["diff_to_P0_95ci"] = bootstrap_difference([r["success"] for r in per_item[p]], base)
    winner = select(summaries)

    params = fit(winner, scored, feats)
    frozen = {
        "name": "gate_v2", "pipeline": winner, "mode": MODE[winner], "params": params,
        "v4_off_fallback": fit(winner, scored, feats, with_v4=False) if winner in ("P3", "P5") else None,
        "routing": {"v3_abstain_below": ABSTAIN, "v3_scoped_at": SCOPED},
        "bm25": {"k1": 1.5, "b": 0.75, "text": "question + content", "stopwords": sorted(STOPWORDS)},
        "selected_on": "75 relabelled development items (69 scored), leave-one-out",
        "provenance": provenance(REPO / "ml_service" / "knowledge_base.json"),
    }
    OUT.mkdir(parents=True, exist_ok=True)
    frozen_path = OUT / "frozen_gate_v2.json"
    frozen_path.write_text(json.dumps(frozen, indent=2) + "\n", encoding="utf-8", newline="\n")
    digest = sha256(frozen_path)
    (OUT / "frozen_gate_v2.sha256").write_text(f"{digest}  frozen_gate_v2.json\n", encoding="utf-8", newline="\n")

    result = {
        "items": {"total": len(items), "scored": len(scored),
                  "routes": {r: sum(1 for i in scored if route_of[i["id"]] == r) for r in sorted(set(route_of.values()))}},
        "k5_reproduced": k5, "pipelines": summaries, "v4_off_fallback": fallback,
        "winner": winner, "frozen_sha256": digest,
        "per_item": {p: [{k: r[k] for k in ("id", "served", "kind", "category")} for r in per_item[p]] for p in PIPELINES},
    }
    (OUT / "selection.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"pipelines": summaries, "v4_off_fallback": fallback, "winner": winner,
                      "frozen_sha256": digest, "routes": result["items"]["routes"]}, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
