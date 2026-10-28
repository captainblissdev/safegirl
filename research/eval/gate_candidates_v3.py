"""Reranker candidates P6 and P7 (docs/decision-log.md, "KB scale
validation: reranker candidate"), scored with the six earlier pipelines on
the development items only.

gate_candidates.py is used unchanged (its SHA-256 is recorded in
frozen_gate_v2.json). This module adds:

  P6  question mode; the cross-encoder reranks the top 10 entries (the
      top 10 of V3's class when the query is scoped); the reranked top
      entry is served when its rerank score passes a threshold
      recalibrated within each leave-one-out fold
  P7  as P6, with a logistic gate on the rerank top-1 score, the rerank
      margin (top-1 minus top-2) and agreement between V4's class and the
      served entry's class; with V4 off, on score and margin only

Q13 and V16 are the same question text and count as one: V16 is removed
from scoring and training, leaving 68 scored items. All eight pipelines
are scored on the 68 by leave-one-out with the registered utility and
selection rule (complexity order P0; P1, P2; P4, P6; P3; P5, P7). The
cross-encoder is `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` at a pinned
revision, loaded offline; its weights' SHA-256 is checked. If the winner
is not P3 it is frozen as research/eval/gate_v2/frozen_gate_v3.json with
a .sha256 sidecar. Outputs hold ids and numbers only.

Usage (no services needed; the reranker must be in the local cache):
  HF_HUB_OFFLINE=1 .venv/Scripts/python.exe -I research/eval/gate_candidates_v3.py
      --labels DEV_LABELS.csv --gate GATE_LABELS.csv
"""

from __future__ import annotations

import argparse
import hashlib
import json
import statistics
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gate_candidates as gc  # noqa: E402

REPO = gc.REPO
OUT = gc.OUT
RERANKER = {
    "model": "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1",
    "revision": "1427fd652930e4ba29e8149678df786c240d8825",
    "weights_sha256": "5daeca2481a76b5976a2bdc32f0a78532b6716da4f8cd3ff59460ef8d2f359b4",
    "top_k": 10,
    "input": "query paired with the entry's question",
}
DUPLICATES = {"V16": "Q13"}
PIPELINES = ("P0", "P1", "P2", "P3", "P4", "P5", "P6", "P7")
COMPLEXITY = {"P0": 0, "P1": 1, "P2": 1, "P4": 2, "P6": 2, "P3": 3, "P5": 4, "P7": 4}
LATENCY_BUDGET_MS = 250


# --------------------------------------------------------------- reranker

def load_reranker():
    """The pinned cross-encoder, after checking its weights' hash."""
    from huggingface_hub import hf_hub_download
    from sentence_transformers import CrossEncoder
    weights = hf_hub_download(RERANKER["model"], "model.safetensors", revision=RERANKER["revision"])
    digest = hashlib.sha256(Path(weights).read_bytes()).hexdigest()
    if digest != RERANKER["weights_sha256"]:
        raise RuntimeError(f"reranker weights SHA-256 {digest} is not the logged one")
    return CrossEncoder(RERANKER["model"], revision=RERANKER["revision"], device="cpu")


def candidates(f, top_k=RERANKER["top_k"]):
    """The entry indices the reranker sees for one item: the top_k by dense
    score, within V3's class when the item is scoped."""
    order = np.argsort(-f["dense"], kind="stable")
    if f["v3_conf"] >= gc.SCOPED:
        order = [j for j in order if f["classes"][j] == f["v3_class"]]
    return list(order[:top_k])


def add_rerank_scores(items, feats, reranker, questions):
    """Rerank scores (entry index -> score) for every retrieved item, in
    question mode."""
    for it in items:
        f = feats["question"][it["id"]]
        if f["route"] != "retrieve" or f["v3_conf"] < gc.ABSTAIN:
            f["rerank"] = None
            continue
        cand = candidates(f)
        scores = reranker.predict([(it["text"], questions[j]) for j in cand], batch_size=len(cand))
        f["rerank"] = {int(j): float(s) for j, s in zip(cand, np.ravel(scores))}


def rerank_decision(item, f):
    """Live entry and gate signals from the reranked candidates, or None."""
    if f.get("rerank") is None:
        return None
    ranked = sorted(f["rerank"].items(), key=lambda kv: (-kv[1], kv[0]))
    (j1, s1), (_, s2) = ranked[0], ranked[1]
    return {"entry": f["ids"][j1], "s1": s1, "margin": s1 - s2,
            "agree": float(f["v4_class"] == f["classes"][j1]), "entry_class": f["classes"][j1]}


# --------------------------------------------------------------- P6, P7

def fit_rerank(pipeline, train, feats, with_v4=True):
    rows = []
    for it in train:
        f = feats["question"][it["id"]]
        d = rerank_decision(it, f)
        if d is None:
            continue
        ok_s, ok_a = gc.serve_outcomes(it, f["route"], d)
        rows.append((d, ok_s, ok_a))
    if pipeline == "P6":
        return {"threshold": gc.calibrate_threshold([(d["s1"], ok_s, ok_a) for d, ok_s, ok_a in rows])}
    x = [gc.gate_features(d, with_v4) for d, _, _ in rows]
    return {"logistic": gc.fit_logistic(x, [int(ok_s) for _, ok_s, _ in rows]), "with_v4": with_v4}


def apply_rerank(params, item, feats):
    f = feats["question"][item["id"]]
    if f["route"] != "retrieve":
        return None, f["route"]
    d = rerank_decision(item, f)
    if d is None:
        return None, "v3_abstain"
    if "threshold" in params:
        serve = d["s1"] >= params["threshold"]
    else:
        serve = gc.logistic_serves(params["logistic"], gc.gate_features(d, params["with_v4"]))
    return (d["entry"], "answer") if serve else (None, "gate_abstain")


def loo(pipeline, scored, feats, with_v4=True):
    """Leave-one-out outcomes over the scored items for any of the eight."""
    out = []
    for k, it in enumerate(scored):
        train = scored[:k] + scored[k + 1:]
        if pipeline in ("P6", "P7"):
            params = fit_rerank(pipeline, train, feats, with_v4)
            served, kind = apply_rerank(params, it, feats)
            route = feats["question"][it["id"]]["route"]
        else:
            params = gc.fit(pipeline, train, feats, with_v4)
            served, kind = gc.apply(pipeline, params, it, feats)
            route = feats[gc.MODE[pipeline]][it["id"]]["route"]
        success, category = gc.outcome(it, route, served)
        out.append({"id": it["id"], "served": served, "kind": kind, "success": success, "category": category})
    return out


def select(summaries):
    """The registered rule with the amended complexity order."""
    best = max(s["score"] for s in summaries.values())
    near = [p for p, s in summaries.items() if s["score"] >= best - 1]
    return min(near, key=lambda p: (COMPLEXITY[p], summaries[p]["wrong_answers_served"], PIPELINES.index(p)))


def synthetic_latency(reranker, runs=30):
    """Median and p90 of reranking 10 synthetic entry-question pairs."""
    q = "how long does a library card last"
    qs = ["How long is a library card valid, and how do I renew it?", "Can I borrow e-books with my card?",
          "What are the library opening hours?", "How do I join a reading club?", "Is there a fee for a lost card?",
          "Can children get their own card?", "How many books can I borrow at once?", "Do I need ID to register?",
          "Can I use the computers without a card?", "How do I return a book late?"]
    pairs = [(q, x) for x in qs]
    for _ in range(3):
        reranker.predict(pairs)
    times = []
    for _ in range(runs):
        t = time.perf_counter()
        reranker.predict(pairs, batch_size=10)
        times.append((time.perf_counter() - t) * 1000)
    times.sort()
    return {"runs": runs, "median_ms": round(statistics.median(times)), "p90_ms": round(times[int(0.9 * runs) - 1])}


# --------------------------------------------------------------- main

def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--labels", required=True)
    ap.add_argument("--gate", required=True)
    args = ap.parse_args(argv)

    items = gc.load_items(args.labels, args.gate)
    for it in items:
        if it["id"] in DUPLICATES:
            it["scored"] = False
    scored = [i for i in items if i["scored"]]
    assert len(scored) == 68, len(scored)
    route_of = gc.routes(items)
    feats = gc.compute_features(items, route_of)
    problems, k5 = gc.reproduce_k5(items, feats)
    if problems:
        print("K5 not reproduced; stopping:")
        for p in problems:
            print(" ", p)
        return 1
    print("K5 reproduced:", json.dumps(k5))

    reranker = load_reranker()
    kb = json.loads((REPO / "ml_service" / "knowledge_base.json").read_text(encoding="utf-8"))
    assert [e["id"] for e in kb] == feats["question"][scored[0]["id"]]["ids"]
    add_rerank_scores(items, feats, reranker, [e["title"] for e in kb])

    per_item, summaries = {}, {}
    for p in PIPELINES:
        per_item[p] = loo(p, scored, feats)
        summaries[p] = gc.summary(per_item[p])
    base = [r["success"] for r in per_item["P0"]]
    for p in PIPELINES:
        summaries[p]["diff_to_P0"] = summaries[p]["score"] - summaries["P0"]["score"]
        summaries[p]["diff_to_P0_95ci"] = gc.bootstrap_difference([r["success"] for r in per_item[p]], base)
    fallback = {p: gc.summary(loo(p, scored, feats, with_v4=False)) for p in ("P3", "P5", "P7")}
    winner = select(summaries)
    latency = synthetic_latency(reranker) if winner in ("P6", "P7") else None
    earlier = json.loads((OUT / "selection.json").read_text(encoding="utf-8"))["pipelines"]

    frozen_sha = None
    if winner != "P3":
        if winner in ("P6", "P7"):
            params = fit_rerank(winner, scored, feats)
            off = fit_rerank(winner, scored, feats, with_v4=False) if winner == "P7" else None
        else:
            params = gc.fit(winner, scored, feats)
            off = gc.fit(winner, scored, feats, with_v4=False) if winner == "P5" else None
        frozen = {
            "name": "gate_v3", "pipeline": winner, "mode": "question" if winner != "P1" else "full",
            "params": params, "v4_off_fallback": off,
            "reranker": RERANKER if winner in ("P6", "P7") else None,
            "routing": {"v3_abstain_below": gc.ABSTAIN, "v3_scoped_at": gc.SCOPED},
            "fallback_if_reranker_fails": "P3 (frozen_gate_v2.json)" if winner in ("P6", "P7") else None,
            "selected_on": "75 relabelled development items, 68 scored (V16 counted with Q13), leave-one-out",
            "latency_synthetic": latency,
            "provenance": {**gc.provenance(REPO / "ml_service" / "knowledge_base.json"),
                           "code_sha256_v3": {p: gc.sha256(REPO / p) for p in (
                               "research/eval/gate_candidates.py", "research/eval/gate_candidates_v3.py",
                               "research/eval/gate_candidates_routes.js", "ml_service/retrieval.py")}},
        }
        path = OUT / "frozen_gate_v3.json"
        path.write_text(json.dumps(frozen, indent=2) + "\n", encoding="utf-8", newline="\n")
        frozen_sha = gc.sha256(path)
        (OUT / "frozen_gate_v3.sha256").write_text(f"{frozen_sha}  frozen_gate_v3.json\n", encoding="utf-8", newline="\n")

    result = {
        "items": {"total": len(items), "scored": len(scored), "removed_as_duplicate": DUPLICATES},
        "k5_reproduced": k5, "reranker": RERANKER, "pipelines": summaries, "v4_off_fallback": fallback,
        "earlier_69_item_scores": {p: {k: earlier[p][k] for k in ("score", "of")} for p in earlier},
        "winner": winner, "winner_latency_synthetic": latency, "frozen_gate_v3_sha256": frozen_sha,
        "per_item": {p: [{k: r[k] for k in ("id", "served", "kind", "category")} for r in per_item[p]] for p in PIPELINES},
    }
    (OUT / "selection_v3.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"pipelines": summaries, "v4_off_fallback": fallback, "winner": winner,
                      "latency": latency, "frozen_gate_v3_sha256": frozen_sha}, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
