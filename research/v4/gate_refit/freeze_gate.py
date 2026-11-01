"""Freeze gate candidate (g) (docs/decision-log.md, "Gate (g) frozen",
2026-11-01), selected by the pre-registered rule in "Gate refit under V4
routing (PRE-REGISTRATION)": fewest wrong answers served on KB-62.

Refits (g) once on all 150 scored development items with exactly the G1
method: gate_refit.py's feature tables (KB-62, question embed mode, V4
triage routing), its fit() for candidate "g" (standardised logistic
regression, C = 1, target "serving the live entry would be correct") and
its decision rule (serve at p >= 0.5). It stops unless the routing id is
G1's and the fresh-test arms reproduce.

Writes research/v4/gate_refit/frozen/:
  gate_g.json          the fitted gate (coefficients, features, threshold,
                       routing id, provenance)
  gate_g.sha256        its SHA-256 sidecar
  gate_g_insample.csv  ids, the four features and the in-sample decision
                       of an independent scikit-learn refit, for the tests
Ids and numbers only; no question text.

Usage (no services needed; e5 must be in the local cache):
  HF_HUB_OFFLINE=1 .venv/Scripts/python.exe -I research/v4/gate_refit/freeze_gate.py
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parents[0]))
import gate_g  # noqa: E402
import gate_refit as gr  # noqa: E402

ROUTING_ID = "57c6a5b638ab24b22beacbf50a2e1d6ef5741ec7dd45eeb6ed583949452a418a"
BASE = "kb62"
CANDIDATE = "g"
OUT = HERE / "frozen"
FEATURE_DEFINITIONS = {
    "s1": "cosine score of the unscoped top-1 entry (query 'query: ' prefix, entries 'passage: ' + question, "
          "both normalised)",
    "margin": "unscoped top-1 score minus unscoped top-2 score",
    "agree": "1.0 if V4's predicted class equals the class of the unscoped top-1 entry, else 0.0",
    "v4_p": "V4's top class probability",
}


def sklearn_refit(x, y):
    """An independent fit with the same settings as gate_refit.fit_logistic,
    returning the fitted parameters and in-sample (decision, probability)."""
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler

    scaler = StandardScaler().fit(x)
    model = LogisticRegression(C=gr.LR_C, max_iter=1000).fit(scaler.transform(x), y)
    p = model.predict_proba(scaler.transform(x))[:, list(model.classes_).index(1)]
    return scaler, model, p


def main():
    import sklearn
    import v4_infer

    gr.check_hash("V4", gr.sha256(gr.V4_FROZEN), gr.HASHES["v4"])
    args = argparse.Namespace(**gr.DEFAULTS)
    items = gr.load_items(args)
    model, spec = gr.load_model()
    v4 = v4_infer.load(embed=lambda ts: model.encode([spec["prefix"] + t for t in ts],
                                                     normalize_embeddings=spec["normalize"]))
    routing = gr.routing_fingerprint()
    if routing != ROUTING_ID:
        raise gr.RoutingMismatch(f"routing {routing[:12]} is not G1's {ROUTING_ID[:12]}")
    tables = gr.build_tables(items, model, v4, routing)
    repro = gr.reproduce_fresh(tables, routing)

    scored = [r for r in tables[BASE] if r["scored"]]
    params = gr.fit(CANDIDATE, scored, routing)["logistic"]
    feats = gr.CANDIDATES[CANDIDATE][1]
    retrieved = [r for r in scored if r["retrieved"]]
    x = np.array([[r[f] for f in feats] for r in retrieved], dtype=float)
    y = np.array([int(gr.ok_served(r)) for r in retrieved])
    scaler, sk, p = sklearn_refit(x, y)
    for name, a, b in (("mean", params["mean"], scaler.mean_), ("scale", params["scale"], scaler.scale_),
                       ("coef", params["coef"], sk.coef_[0]), ("intercept", [params["intercept"]], sk.intercept_)):
        if not np.allclose(a, b, rtol=0, atol=1e-12):
            raise gr.CheckFailed(f"G1 fit and independent refit differ in {name}")
    decisions = p >= 0.5
    g1 = [gr.serves(CANDIDATE, {"logistic": params}, r) for r in retrieved]
    if list(decisions) != g1:
        raise gr.CheckFailed("in-sample decisions differ between G1's rule and the independent refit")

    kb62 = gr.git_bytes(gr.KB_COMMIT, "ml_service/knowledge_base.json")
    head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=gr.REPO, capture_output=True, text=True).stdout.strip()
    frozen = {
        "name": "gate_g",
        "candidate": CANDIDATE,
        "description": gr.CANDIDATES[CANDIDATE][0],
        "selected_by": "docs/decision-log.md, 'Gate refit under V4 routing (PRE-REGISTRATION)': fewest wrong answers "
                       "served on KB-62 by leave-one-out (research/v4/gate_refit/results_counts.csv)",
        "features": feats,
        "feature_definitions": {f: FEATURE_DEFINITIONS[f] for f in feats},
        "model": {"type": "logistic regression on standardised features", "C": gr.LR_C, "max_iter": 1000,
                  "mean": params["mean"], "scale": params["scale"], "coef": params["coef"],
                  "intercept": params["intercept"]},
        "decision": {"threshold": 0.5, "rule": "serve the live entry if p >= threshold, else abstain; only for "
                                               "items V4 routes to retrieval"},
        "routing": {"id": routing, "mode": "V4 triage in the gateway's order (Safety Net, help, held topic, vague "
                                           "rule, then V4)", "v4_t_act": gr.V4_T_ACT, "scoped_at": gr.SCOPED,
                    "v4_sha256": gr.HASHES["v4"]},
        "knowledge_base": {"name": BASE, "embed_mode": gr.BASES[BASE], "source": f"{gr.KB_COMMIT}:ml_service/knowledge_base.json",
                           "sha256": hashlib.sha256(kb62).hexdigest(), "entries": len(json.loads(kb62))},
        "embedding": {"model": spec["model"], "revision": spec["revision"], "weights_sha256": spec["weights_sha256"]},
        "training": {"scored_items": len(scored), "retrieved_items": len(retrieved), "positives": int(y.sum()),
                     "target": "serving the live entry would be correct", "fresh_reproduction": list(map(list, repro.values())),
                     "in_sample_serves": int(decisions.sum())},
        "provenance": {"frozen_on": dt.date.today().isoformat(), "git_head": head,
                       "gate_refit_sha256": gr.sha256(HERE / "gate_refit.py"),
                       "freeze_gate_sha256": gr.sha256(Path(__file__)), "scikit_learn": sklearn.__version__},
    }
    OUT.mkdir(exist_ok=True)
    blob = (json.dumps(frozen, indent=1) + "\n").encode("utf-8")
    (OUT / "gate_g.json").write_bytes(blob)
    digest = hashlib.sha256(blob).hexdigest()
    (OUT / "gate_g.sha256").write_bytes(f"{digest}  gate_g.json\n".encode())

    with open(OUT / "gate_g_insample.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["id", *feats, "p", "serve"])
        for r, pi, d in zip(retrieved, p, decisions):
            w.writerow([r["id"], *(repr(float(r[ft])) for ft in feats), repr(float(pi)), int(d)])

    loaded = gate_g.load(OUT / "gate_g.json")
    if [loaded.serves(r, routing=routing) for r in retrieved] != list(decisions):
        raise gr.CheckFailed("the frozen file does not reproduce the in-sample decisions")
    print(f"gate_g.json sha256 {digest}; retrieved {len(retrieved)}, positives {int(y.sum())}, "
          f"in-sample serves {int(decisions.sum())}; routing {routing[:12]}; fresh reproduction {repro}")


if __name__ == "__main__":
    main()
