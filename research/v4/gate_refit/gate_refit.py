"""Gate refit under V4 routing, development only (docs/decision-log.md,
"Gate refit under V4 routing (PRE-REGISTRATION)", 2026-11-01).

For the 157 development items (75 relabelled: 35 dev questions and 40
gate items; 82 fresh-test questions) this builds one feature table per
knowledge base, always under V4 triage routing in the gateway's order:

  KB-21  ml_service/knowledge_base.json on this branch, full embed mode
  KB-62  ml_service/knowledge_base.json at kb/merge-60 9ae43bb, question
         embed mode (read with git show, hash checked)

Before scoring it reproduces the fresh test: candidate (a) on KB-21 must
give arm A's counts and frozen gate v2 on KB-62 must give arm B's; it stops
otherwise. It then scores the eight pre-registered candidates by
leave-one-out on each base, and asserts that every fit and every
evaluation use the same routing. Nothing here is wired into production
and no gate is chosen.

Outputs: research/v4/gate_refit/results_counts.csv and summary.md (ids,
counts and numbers only); the feature tables and per-item outcomes go to
--out, outside the repository. No question text is printed or written.

Usage (no services needed; e5 must be in the local cache):
  HF_HUB_OFFLINE=1 .venv/Scripts/python.exe -I research/v4/gate_refit/gate_refit.py
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

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
KB_COMMIT = "9ae43bbec4f57141440d6722e7bac1312583f551"  # kb/merge-60
HASHES = {
    "fresh_test_v1": "667a547c06cdf6b097061d6f096a1585339b3193f439240d98bc202036157c54",
    "fresh_labels": "71b7bd8f79ecacb4d6bdd5cfd31ca92604479d928e51f3b474e645975cb4e6b1",
    "gate_v2": "ad6895a120b538e4cc751ebe4de8944aace640c268e0013f981d29ceabe4bafc",
    "v4": "89eee2b41634c896d7e03b49d184680c843df183f1e628bd71fb0fb9ee96ecdd",
    "kb21": "e78a82afd10491fdc81d98bb2fca43119312be6908af7c4372ee2778d9dc1e30",
    "kb62": "1b53efad82587063462d24efa9a436c2e20df007ad86b8623429b73a12885ff0",
}
DEFAULTS = {
    "dev_labels": Path(r"C:\Users\cindy\relabel\out\retrieval_eval_set_labels_kb62.csv"),
    "gate_labels": Path(r"C:\Users\cindy\relabel\out\relevance_validation_kb62.csv"),
    "fresh": Path(r"C:\Users\cindy\fresh\fresh_test_v1.csv"),
    "fresh_labels": Path(r"C:\Users\cindy\fresh_kit\out\fresh_test_v1_labels.csv"),
    "out": Path(r"C:\Users\cindy\gate_refit_out"),
}
V4_FROZEN = REPO / "research" / "v4" / "frozen" / "v4_hybrid_c10.json"
ROUTES_JS = HERE / "routes.js"
GATEWAY_RULE_FILES = ("safetyNet.js", "helpSignposting.js", "heldTopics.js", "vagueQuery.js",
                      "content/heldTopics.json", "content/healthTerms.json", "content/extraHealthTerms.json")
TOPICS = {"contraception", "sti", "pregnancy", "general"}
V4_T_ACT, SCOPED, GATE_A = 0.45, 0.5, 0.8439
LR_C = 1.0
SHOULD_ASK_GROUP = "Too vague to answer"
OUTCOMES = ("correct_answer", "wrong_answer", "correct_abstain", "missed_answer")
ARM_EXPECTED = {"kb21_a": (17, 21, 38, 6), "kb62_gate_v2": (24, 29, 21, 8)}
BASES = {"kb21": "full", "kb62": "question"}

CANDIDATES = {
    "a": ("current gate: top-1 >= 0.8439", None),
    "b": ("top-1, threshold refitted", ["s1"]),
    "c": ("top-1 + margin", ["s1", "margin"]),
    "d": ("top-1 + V4 top probability", ["s1", "v4_p"]),
    "e": ("top-1 + margin + V4 top probability", ["s1", "margin", "v4_p"]),
    "f": ("top-1 + margin + agreement (V4 vs unscoped top-1)", ["s1", "margin", "agree"]),
    "g": ("(f) + V4 top probability", ["s1", "margin", "agree", "v4_p"]),
    "h": ("live entry score + gap to top-1", ["s_live", "gap"]),
}
SIGNALS = ("s1", "s2", "margin", "v4_p", "agree", "agree_live", "s_live", "gap", "v4_class", "top1_class")


class CheckFailed(RuntimeError):
    pass


class RoutingMismatch(AssertionError):
    pass


# --------------------------------------------------------------- inputs

def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256(path) -> str:
    return sha256_bytes(Path(path).read_bytes())


def check_hash(name, actual, expected):
    if actual.lower() != expected.lower():
        raise CheckFailed(f"{name}: SHA-256 {actual} is not the logged {expected}")


def git_bytes(ref, path) -> bytes:
    return subprocess.run(["git", "show", f"{ref}:{path}"], cwd=REPO, capture_output=True, check=True).stdout


def read_csv(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def split_ids(value):
    return [s.strip() for s in re.split(r"[;|]", value or "") if s.strip()]


def gate_acceptable(row):
    """likely_entry plus any "also acceptable: ..." ids in the notes (as gate_candidates.py)."""
    also = re.search(r"also acceptable: ([^;\s]+(?:;[^;\s]+)*)", row.get("notes") or "")
    return split_ids(row.get("likely_entry")) + (split_ids(also.group(1)) if also else [])


def load_items(args):
    """The 157 development items: id, set, text, acceptable, should_ask, scored, why."""
    queries = {r["id"]: r["query"] for r in read_csv(REPO / "resources" / "eval" / "retrieval_eval_set.csv")}
    items = []
    for r in read_csv(args.dev_labels):
        if r["expected_class"] == "none":
            continue
        items.append({"id": r["id"], "set": "dev", "text": queries[r["id"]],
                      "acceptable": split_ids(r["acceptable_entry_ids"]), "should_ask": False,
                      "scored": True, "why": ""})
    for r in read_csv(args.gate_labels):
        referral = r["expected"] == "REFERRAL_OR_SIGNPOST"
        items.append({"id": r["id"], "set": "gate", "text": r["query"], "acceptable": gate_acceptable(r),
                      "should_ask": False, "scored": not referral, "why": "distress (referral)" if referral else ""})
    check_hash("fresh_test_v1.csv", sha256(args.fresh), HASHES["fresh_test_v1"])
    check_hash("fresh labels", sha256(args.fresh_labels), HASHES["fresh_labels"])
    labels = {r["source_row"]: r for r in read_csv(args.fresh_labels)}
    for r in read_csv(args.fresh):
        lab = labels[r["source_row"]]
        items.append({"id": f"F{int(r['source_row']):03d}", "set": "fresh", "text": r["question_text"],
                      "acceptable": split_ids(lab["acceptable_entry_ids"]),
                      "should_ask": lab["group"] == SHOULD_ASK_GROUP, "scored": True, "why": ""})
    first = {}
    for it in items:
        if it["text"] in first:
            it["scored"], it["why"] = False, f"same text as {first[it['text']]}"
        first.setdefault(it["text"], it["id"])
    if len(items) != 157:
        raise CheckFailed(f"{len(items)} development items, expected 157")
    return items


# --------------------------------------------------------------- routing

def routing_fingerprint() -> str:
    """One id for everything that decides an item's route: the gateway's
    rule files, routes.js, the V4 model hash and the V4 thresholds."""
    parts = {f: sha256(REPO / "app" / "gateway" / "src" / f) for f in GATEWAY_RULE_FILES}
    parts.update({"routes.js": sha256(ROUTES_JS), "v4": sha256(V4_FROZEN),
                  "t_act": V4_T_ACT, "scoped": SCOPED, "mode": "v4_triage"})
    return sha256_bytes(json.dumps(parts, sort_keys=True).encode())


def gateway_routes(items):
    run = subprocess.run(["node", str(ROUTES_JS)], input=json.dumps([{"id": i["id"], "text": i["text"]} for i in items]),
                         capture_output=True, text=True, encoding="utf-8", check=True, cwd=REPO)
    return json.loads(run.stdout)


def route_v4(route, v4_label, v4_conf):
    """'retrieve_scoped', 'retrieve_unscoped', or what answers instead (as fresh_test_run.py)."""
    if route != "retrieve":
        return route
    if v4_label == "vague":
        return "clarify"
    if v4_label not in TOPICS or v4_conf < V4_T_ACT:
        return "v4_abstain"
    return "retrieve_scoped" if v4_conf >= SCOPED else "retrieve_unscoped"


# --------------------------------------------------------------- features

def load_model():
    from huggingface_hub import try_to_load_from_cache
    from sentence_transformers import SentenceTransformer

    spec = json.loads(V4_FROZEN.read_bytes())["embedding"]
    weights = try_to_load_from_cache(spec["model"], spec["weights_file"], revision=spec["revision"])
    if not isinstance(weights, str) or sha256(weights) != spec["weights_sha256"]:
        raise CheckFailed("the cached e5 weights are not the ones frozen with V4")
    return SentenceTransformer(spec["model"], revision=spec["revision"]), spec


def kb_entries(name):
    data = (REPO / "ml_service" / "knowledge_base.json").read_bytes() if name == "kb21" else \
        git_bytes(KB_COMMIT, "ml_service/knowledge_base.json")
    check_hash(name, sha256_bytes(data), HASHES[name])
    return json.loads(data)


def passage(entry, mode):
    """As ml_service/retrieval.py passage_text (kb/merge-60)."""
    return "passage: " + (entry["title"] if mode == "question" else entry["title"] + ". " + entry["content"])


def label_of(item, acceptable, live):
    if item["should_ask"]:
        return "should-ask"
    if not acceptable:
        return "off-topic"
    return "correct" if live in acceptable else "wrong"


def build_tables(items, model, v4, routing):
    """One feature table per base, each row tagged with the routing id."""
    texts = [it["text"] for it in items]
    route_of = gateway_routes(items)
    probs = v4.predict_proba(texts)
    q = model.encode(["query: " + t for t in texts], normalize_embeddings=True, convert_to_numpy=True)
    tables = {}
    for base, mode in BASES.items():
        entries = kb_entries(base)
        ids = [e["id"] for e in entries]
        classes = [e["class"] for e in entries]
        emb = model.encode([passage(e, mode) for e in entries], normalize_embeddings=True, convert_to_numpy=True)
        rows = []
        for k, it in enumerate(items):
            j = int(np.argmax(probs[k]))
            v4_class, v4_p = v4.classes[j], float(probs[k][j])
            how = route_v4(route_of[it["id"]], v4_class, v4_p)
            acceptable = [a for a in it["acceptable"] if a in set(ids)]
            row = {"id": it["id"], "set": it["set"], "scored": it["scored"], "routing": routing, "route": how,
                   "v4_class": v4_class, "v4_p": v4_p, "acceptable": acceptable, "retrieved": how.startswith("retrieve")}
            if row["retrieved"]:
                scores = emb @ q[k]
                order = np.argsort(-scores, kind="stable")
                live = next(i for i in order if classes[i] == v4_class) if how == "retrieve_scoped" else order[0]
                s1, s2 = float(scores[order[0]]), float(scores[order[1]])
                row.update({"s1": s1, "s2": s2, "margin": s1 - s2, "top1_entry": ids[order[0]],
                            "top1_class": classes[order[0]], "agree": float(v4_class == classes[order[0]]),
                            "live_entry": ids[live], "s_live": float(scores[live]), "gap": s1 - float(scores[live]),
                            "agree_live": float(v4_class == classes[live])})
            row["label"] = label_of(it, acceptable, row.get("live_entry"))
            rows.append(row)
        tables[base] = rows
    return tables


# --------------------------------------------------------------- candidates

def ok_served(row):
    return row["label"] == "correct"


def ok_abstain(row):
    return not row["acceptable"]


def outcome(served, acceptable):
    if served is not None:
        return "correct_answer" if served in acceptable else "wrong_answer"
    return "missed_answer" if acceptable else "correct_abstain"


def calibrate_threshold(rows):
    """Threshold maximising successes on (s1, ok_served, ok_abstain);
    ties to fewer wrong answers served, then the middle candidate
    (gate_candidates.py's rule)."""
    s = sorted({r[0] for r in rows})
    cands = [-math.inf] + [(a + b) / 2 for a, b in zip(s, s[1:])] + [math.inf]
    scored = []
    for t in cands:
        util = sum((oks if s1 >= t else oka) for s1, oks, oka in rows)
        wrong = sum(1 for s1, oks, _ in rows if s1 >= t and not oks)
        scored.append((util, -wrong, t))
    best = max((u, w) for u, w, _ in scored)
    tied = [t for u, w, t in scored if (u, w) == best]
    return tied[len(tied) // 2]


def fit_logistic(x, y):
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler

    x, y = np.asarray(x, dtype=float), np.asarray(y, dtype=int)
    if len(set(y.tolist())) < 2:
        return {"constant": int(y[0]) if len(y) else 0}
    scaler = StandardScaler().fit(x)
    model = LogisticRegression(C=LR_C, max_iter=1000).fit(scaler.transform(x), y)
    return {"mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist(),
            "coef": model.coef_[0].tolist(), "intercept": float(model.intercept_[0])}


def logistic_serves(model, x):
    if "constant" in model:
        return bool(model["constant"])
    z = (np.asarray(x, dtype=float) - np.array(model["mean"])) / np.array(model["scale"])
    return 1 / (1 + math.exp(-(float(z @ np.array(model["coef"])) + model["intercept"]))) >= 0.5


def require_routing(rows, routing, stage):
    bad = [r["id"] for r in rows if r["routing"] != routing]
    if bad:
        raise RoutingMismatch(f"{stage}: {len(bad)} rows were built with a different routing than {routing[:12]}")


def fit(letter, train, routing):
    require_routing(train, routing, "fit")
    feats = CANDIDATES[letter][1]
    rows = [r for r in train if r["retrieved"]]
    if letter == "a":
        return {"threshold": GATE_A}
    if letter == "b":
        return {"threshold": calibrate_threshold([(r["s1"], ok_served(r), ok_abstain(r)) for r in rows])}
    return {"logistic": fit_logistic([[r[f] for f in feats] for r in rows], [int(ok_served(r)) for r in rows])}


def serves(letter, params, row):
    if "threshold" in params:
        return row["s1"] >= params["threshold"]
    return logistic_serves(params["logistic"], [row[f] for f in CANDIDATES[letter][1]])


def apply(letter, params, row, routing):
    require_routing([row], routing, "evaluate")
    if not row["retrieved"]:
        return None, row["route"]
    return (row["live_entry"], "served") if serves(letter, params, row) else (None, "gate_abstain")


def loo(letter, rows, routing):
    scored = [r for r in rows if r["scored"]]
    out = []
    for k, r in enumerate(scored):
        params = fit(letter, scored[:k] + scored[k + 1:], routing)
        served, kind = apply(letter, params, r, routing)
        out.append({"id": r["id"], "served": served, "kind": kind, "outcome": outcome(served, r["acceptable"])})
    return out


def counts(results):
    c = {o: sum(1 for r in results if r["outcome"] == o) for o in OUTCOMES}
    served = c["correct_answer"] + c["wrong_answer"]
    retrieved = sum(1 for r in results if r["kind"] in ("served", "gate_abstain"))
    gate_abst = sum(1 for r in results if r["kind"] == "gate_abstain")
    return {**c, "scored": len(results), "served": served,
            "served_correct_share": round(c["correct_answer"] / served, 4) if served else None,
            "retrieved": retrieved, "gate_abstains": gate_abst,
            "gate_abstain_share_of_retrieved": round(gate_abst / retrieved, 4) if retrieved else None,
            "no_answer_total": len(results) - served}


# --------------------------------------------------------------- checks

def reproduce_fresh(tables, routing):
    """(a) on KB-21 and frozen gate v2 on KB-62 over all 82 fresh items."""
    gate_v2 = json.loads(git_bytes(KB_COMMIT, "research/eval/gate_v2/frozen_gate_v2.json"))
    check_hash("gate_v2", sha256_bytes(git_bytes(KB_COMMIT, "research/eval/gate_v2/frozen_gate_v2.json")),
               HASHES["gate_v2"])
    got = {}
    fresh21 = [r for r in tables["kb21"] if r["set"] == "fresh"]
    res = [{"outcome": outcome(apply("a", {"threshold": GATE_A}, r, routing)[0], r["acceptable"])} for r in fresh21]
    got["kb21_a"] = tuple(sum(1 for x in res if x["outcome"] == o) for o in OUTCOMES)
    p = gate_v2["params"]
    assert p["with_v4"], "gate v2 was frozen with V4 agreement"
    res = []
    for r in (x for x in tables["kb62"] if x["set"] == "fresh"):
        require_routing([r], routing, "reproduce")
        served = r["live_entry"] if r["retrieved"] and logistic_serves(
            p["logistic"], [r["s1"], r["margin"], r["agree_live"]]) else None
        res.append(outcome(served, r["acceptable"]))
    got["kb62_gate_v2"] = tuple(res.count(o) for o in OUTCOMES)
    for k, v in got.items():
        if v != ARM_EXPECTED[k]:
            raise CheckFailed(f"fresh-test reproduction {k}: got {v}, logged {ARM_EXPECTED[k]}")
    return got


def constant_signals(rows):
    """Signals with one value over the scored retrieved rows (and over the scoped ones)."""
    out = {}
    for scope, sel in (("retrieved", lambda r: True), ("scoped", lambda r: r["route"] == "retrieve_scoped")):
        rr = [r for r in rows if r["scored"] and r["retrieved"] and sel(r)]
        out[scope] = {"n": len(rr), "constant": [s for s in SIGNALS if len({r[s] for r in rr}) <= 1],
                      "distinct": {s: len({r[s] for r in rr}) for s in SIGNALS},
                      "zeros": {s: sum(1 for r in rr if r[s] == 0) for s in ("agree", "agree_live", "gap")}}
    return out


# --------------------------------------------------------------- outputs

def write_csv(path, rows, fields):
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator="\n", extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def summary_md(meta, table, consts, repro):
    L = ["# Gate refit under V4 routing (development only)", "",
         "Pre-registration: docs/decision-log.md, \"Gate refit under V4 routing (PRE-REGISTRATION)\", "
         "2026-11-01. Development evidence, not a test; no gate is chosen or deployed. Ids and counts only.", "",
         f"Items: {meta['items']} development items ({meta['by_set']}); scored {meta['scored']} "
         f"(not scored: {meta['not_scored']}). Bases: KB-21 full mode, KB-62 question mode "
         f"(kb/merge-60 {KB_COMMIT[:7]}). Routing: V4 triage, gateway order, id {meta['routing'][:12]}; "
         "the same routing is asserted for every fit and evaluation.", "",
         f"Routes of the scored items (same for both bases): {meta['routes']}.", "",
         f"Fresh-test reproduction before scoring: (a) on KB-21 {repro['kb21_a']} = arm A; frozen gate v2 on "
         f"KB-62 {repro['kb62_gate_v2']} = arm B (correct, wrong served, correct abstain or ask, missed).", "",
         "## Leave-one-out counts", "",
         "| Base | Cand. | Gate | Correct | Wrong served | Correct abstain/ask | Missed | Served correct | "
         "Gate abstains (of retrieved) | Rank |",
         "|---|---|---|---|---|---|---|---|---|---|"]
    for r in table:
        share = "n/a" if r["served_correct_share"] is None else f"{r['served_correct_share']:.3f}"
        L.append(f"| {r['base']} | {r['candidate']} | {r['description']} | {r['correct_answer']} | {r['wrong_answer']} | "
                 f"{r['correct_abstain']} | {r['missed_answer']} | {share} | {r['gate_abstains']} of {r['retrieved']} | "
                 f"{r['rank']} |")
    L += ["", "Rank: the pre-registered reporting rule within each base (fewest wrong answers served, then most "
          "correct answers, then the earlier letter). Reporting only.", "", "## Constant signals", ""]
    for base, c in consts.items():
        for scope, v in c.items():
            L.append(f"- {base}, {scope} items (n = {v['n']}): constant: "
                     f"{', '.join(v['constant']) if v['constant'] else 'none'}; distinct values "
                     f"{', '.join(f'{k} {n}' for k, n in v['distinct'].items() if k in ('agree', 'agree_live', 'v4_class'))}; "
                     f"items at 0: {', '.join(f'{k} {n}' for k, n in v['zeros'].items())}.")
    L += ["", "agree_live (V4 class against the served entry's class, gate v2's signal) is constant on scoped "
          "items and varies only on the unscoped ones; gap (h) is 0 whenever the served entry is the unscoped "
          "top-1."]
    a62 = next(r for r in table if r["base"] == "kb62" and r["candidate"] == "a")
    fewer = [r["candidate"] for r in table if r["base"] == "kb62" and r["wrong_answer"] < a62["wrong_answer"]]
    L += ["", "## Against the current gate on KB-62", "",
          f"(a) serves {a62['wrong_answer']} wrong answers on KB-62. Candidates serving fewer: "
          f"{', '.join(fewer) if fewer else 'none'}.", ""]
    return "\n".join(L)


def main(argv=None):
    ap = argparse.ArgumentParser()
    for k, v in DEFAULTS.items():
        ap.add_argument(f"--{k.replace('_', '-')}", type=Path, default=v)
    args = ap.parse_args(argv)
    sys.path.insert(0, str(REPO / "research" / "v4"))
    import v4_infer

    check_hash("V4", sha256(V4_FROZEN), HASHES["v4"])
    items = load_items(args)
    model, spec = load_model()
    v4 = v4_infer.load(embed=lambda ts: model.encode([spec["prefix"] + t for t in ts],
                                                     normalize_embeddings=spec["normalize"]))
    routing = routing_fingerprint()
    tables = build_tables(items, model, v4, routing)
    repro = reproduce_fresh(tables, routing)

    table, per_item = [], []
    for base, rows in tables.items():
        res = {}
        for letter in CANDIDATES:
            out = loo(letter, rows, routing)
            res[letter] = counts(out)
            per_item += [{"base": base, "candidate": letter, **o} for o in out]
        order = sorted(CANDIDATES, key=lambda l: (res[l]["wrong_answer"], -res[l]["correct_answer"], l))
        for letter in CANDIDATES:
            table.append({"base": base, "candidate": letter, "description": CANDIDATES[letter][0],
                          "rank": order.index(letter) + 1, **res[letter]})
    if routing != routing_fingerprint():
        raise RoutingMismatch("the routing inputs changed during the run")

    consts = {b: constant_signals(rows) for b, rows in tables.items()}
    scored = [it for it in items if it["scored"]]
    meta = {"items": len(items), "by_set": ", ".join(f"{s} {sum(1 for i in items if i['set'] == s)}"
                                                     for s in ("dev", "gate", "fresh")),
            "scored": len(scored), "routing": routing,
            "not_scored": "; ".join(f"{i['id']} ({i['why']})" for i in items if not i["scored"]),
            "routes": ", ".join(f"{k} {v}" for k, v in sorted(
                {r: sum(1 for x in tables['kb21'] if x['scored'] and x['route'] == r)
                 for r in {x['route'] for x in tables['kb21']}}.items()))}

    fields = ["base", "candidate", "description", "scored", "correct_answer", "wrong_answer", "correct_abstain",
              "missed_answer", "served", "served_correct_share", "retrieved", "gate_abstains",
              "gate_abstain_share_of_retrieved", "no_answer_total", "rank"]
    write_csv(HERE / "results_counts.csv", table, fields)
    (HERE / "summary.md").write_text(summary_md(meta, table, consts, repro), encoding="utf-8")

    args.out.mkdir(parents=True, exist_ok=True)
    ffields = ["id", "set", "scored", "route", "retrieved", "v4_class", "v4_p", "s1", "s2", "margin", "top1_entry",
               "top1_class", "agree", "live_entry", "s_live", "gap", "agree_live", "acceptable", "label", "routing"]
    for base, rows in tables.items():
        write_csv(args.out / f"features_{base}.csv",
                  [{**r, "acceptable": ";".join(r["acceptable"])} for r in rows], ffields)
    write_csv(args.out / "loo_per_item.csv", per_item, ["base", "candidate", "id", "served", "kind", "outcome"])
    (args.out / "constant_signals.json").write_text(json.dumps(consts, indent=1), encoding="utf-8")

    print(f"items {len(items)}, scored {len(scored)}; routing {routing[:12]}; reproduction {repro}")
    for r in table:
        print(f"{r['base']} {r['candidate']}: correct {r['correct_answer']}, wrong {r['wrong_answer']}, "
              f"abstain/ask {r['correct_abstain']}, missed {r['missed_answer']}, share {r['served_correct_share']}, "
              f"gate abstains {r['gate_abstains']}/{r['retrieved']}, rank {r['rank']}")
    for b, c in consts.items():
        print(b, {s: v["constant"] for s, v in c.items()})


if __name__ == "__main__":
    main()
