"""The one-shot round 2 gate test (docs/decision-log.md, "Round 2:
pre-registration of the one-shot gate test (1 Nov 2026)" and "Round 2
labels locked (2026-11-01)").

Arms, all with V4 triage routing in the gateway's order (Safety Net,
help, held topic, vague rule, then V4), as in G1 and the fresh test:

  A  KB-21 (full embed mode)      + the current gate: top-1 >= 0.8439
  B  KB-62 (question embed mode)  + the frozen gate (g)
  C  KB-21 (full embed mode)      + the frozen gate (g)

Features and routing come from gate_refit.build_tables and the outcome
rules from gate_refit.outcome, the code that reproduced fresh-test arms
A and B exactly. An item's acceptable entries are its labelled best and
acceptable ids that exist in the arm's base; an item whose correct
entries are all outside the 21-entry base therefore counts, in arms A
and C, as a correct abstain when nothing is served and as a wrong answer
when something is.

Before computing anything it checks, and aborts with a message if any
fails: the label file's SHA-256 equals the one in the "Round 2 labels
locked" entry and the file is read-only; gate_g.json's SHA-256 is the
frozen one (and its sidecar matches); the routing id is 57c6a5b638ab...
for every arm; the questions file's SHA-256 equals the post-dedupe hash
in the pre-registration; the lock file does not exist. It then takes the
lock (exclusive create) and runs once: a second run is refused.

Outputs, to --out (outside the repository): aggregate.json (counts,
shares, McNemar exact p, the five conditions, the unsure-excluded
sensitivity analysis) and per_item.csv (ids, routes, served entry ids and
outcome codes; no text). Nothing printed holds question or label text.

Real run (once):
  HF_HUB_OFFLINE=1 .venv/Scripts/python.exe -I research/v4/gate_refit/round2_run.py
      --questions C:/Users/cindy/round2/work/questions_dedup.csv
      --labels C:/Users/cindy/round2/locked/labelling_worksheet_labelled_sha256-<hash>.csv
      --gate research/v4/gate_refit/frozen/gate_g.json
      --lock C:/Users/cindy/round2/results/ROUND2_RUN.lock
      --out C:/Users/cindy/round2/results

Dry run (dummy files; expected hashes given on the command line, the real
questions file, lock path and results folder refused):
  ... round2_run.py --dry-run --questions DUMMY_Q --labels DUMMY_L --gate ... --lock DUMMY_LOCK
      --out DUMMY_OUT --expect-labels-sha256 H1 --expect-questions-sha256 H2
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
import math
import os
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
DECISION_LOG = REPO / "docs" / "decision-log.md"
GATE_SHA256 = "f63142ced7ccd2d8b83966a4260debe56deb87eab5f6f987334429f91947023b"
ROUTING_ID = "57c6a5b638ab24b22beacbf50a2e1d6ef5741ec7dd45eeb6ed583949452a418a"
REAL_QUESTIONS_SHA256 = "012eb198a35794450f50121a279d4fe810af68c10c56ef473edcef8aadcd0858"
REAL_OUT = Path(r"C:\Users\cindy\round2\results")
REAL_LOCK = REAL_OUT / "ROUND2_RUN.lock"
LABELS_SECTION = "## Round 2 labels locked"
PREREG_SECTION = "## Round 2: pre-registration of the one-shot gate test"
TAGS = ("vague", "offtopic", "uncovered", "held", "distress", "twopart", "unsure")
OUTCOMES = ("correct_answer", "wrong_answer", "correct_abstain", "missed_answer")
ARMS = {"A": ("kb21", "current"), "B": ("kb62", "g"), "C": ("kb21", "g")}
PAIRS = (("A", "B"), ("A", "C"), ("C", "B"))
SHARE_MIN = 0.60
SAFETY_TESTS = ("test/safetyNet.test.js", "test/offlineSafetyParity.test.js", "test/heldTopics.test.js",
                "test/heldEntries.test.js", "test/helpSignposting.test.js")


class CheckFailed(RuntimeError):
    pass


# --------------------------------------------------------------- checks

def sha256(path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def log_section(text: str, heading: str) -> str:
    start = text.find(heading)
    if start < 0:
        raise CheckFailed(f"decision log has no section '{heading}'")
    end = text.find("\n## ", start + len(heading))
    return text[start:end if end >= 0 else len(text)]


def logged_hashes(log_text: str) -> dict:
    """The label-file hash from the label-lock entry and the post-dedupe
    hash from the pre-registration."""
    labels = re.search(r"SHA-256\s*`([0-9a-f]{64})`", log_section(log_text, LABELS_SECTION))
    questions = re.search(r"post-dedupe sha256 ([0-9a-f]{64})", log_section(log_text, PREREG_SECTION))
    if not labels or not questions:
        raise CheckFailed("decision log does not record the label or post-dedupe hash")
    return {"labels": labels.group(1), "questions": questions.group(1)}


def is_read_only(path) -> bool:
    return not os.access(path, os.W_OK)


def preflight(args, expected: dict, routing: str | None, gate_routing: str | None) -> list:
    """Every check before the run; raises CheckFailed with all failures."""
    fails = []
    for name, path in (("questions", args.questions), ("labels", args.labels), ("gate", args.gate)):
        if not Path(path).is_file():
            fails.append(f"{name} file not found: {path}")
    if not fails:
        if sha256(args.labels) != expected["labels"]:
            fails.append("label file SHA-256 is not the expected hash (in a real run, the decision log's)")
        if not is_read_only(args.labels):
            fails.append("label file is not read-only")
        if sha256(args.gate) != GATE_SHA256:
            fails.append("gate_g.json SHA-256 is not the frozen gate's")
        if sha256(args.questions) != expected["questions"]:
            fails.append("questions file SHA-256 is not the post-dedupe hash")
    if Path(args.lock).exists():
        fails.append(f"lock file exists ({args.lock}): the run has already been made")
    if routing is not None and routing != ROUTING_ID:
        fails.append(f"routing id {routing[:12]} is not {ROUTING_ID[:12]}")
    if gate_routing is not None and gate_routing != ROUTING_ID:
        fails.append(f"frozen gate routing {gate_routing[:12]} is not {ROUTING_ID[:12]}")
    if fails:
        raise CheckFailed("; ".join(fails))
    return fails


def dry_run_guard(args):
    """--dry-run may not touch the real files; overrides need --dry-run."""
    overrides = args.expect_labels_sha256 or args.expect_questions_sha256
    if not args.dry_run:
        if overrides:
            raise CheckFailed("expected-hash overrides are only allowed with --dry-run")
        return
    if not (args.expect_labels_sha256 and args.expect_questions_sha256):
        raise CheckFailed("--dry-run needs --expect-labels-sha256 and --expect-questions-sha256")
    if Path(args.questions).is_file() and sha256(args.questions) == REAL_QUESTIONS_SHA256:
        raise CheckFailed("--dry-run refuses the real round 2 questions file")
    if Path(args.lock).resolve() == REAL_LOCK.resolve():
        raise CheckFailed("--dry-run refuses the real lock path")
    if Path(args.out).resolve() == REAL_OUT.resolve():
        raise CheckFailed("--dry-run refuses the real results folder")


def take_lock(lock: Path, record: dict):
    try:
        with open(lock, "x", encoding="utf-8") as f:
            json.dump(record, f, indent=1)
    except FileExistsError:
        raise CheckFailed(f"lock file exists ({lock}): the run has already been made")


# --------------------------------------------------------------- inputs

def read_csv(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def tag_of(notes: str) -> str:
    notes = (notes or "").strip().lower()
    return re.split(r"[\s:;,.]+", notes, maxsplit=1)[0] if notes else ""


def load_items(questions_path, labels_path):
    """Items {id, set, text, acceptable, should_ask, scored, tag}; label
    columns only from the label file (its question column is not used)."""
    labels = {}
    for r in read_csv(labels_path):
        rid = (r.get("item_id") or r.get("id") or "").strip()
        best = (r.get("best_entry_id") or "").strip()
        acc = [a.strip() for a in (r.get("acceptable_entry_ids") or "").split(";") if a.strip()]
        labels[rid] = {"acceptable": ([best] if best else []) + acc, "tag": tag_of(r.get("notes"))}
    items = []
    for q in read_csv(questions_path):
        rid = q["r2_id"]
        if rid not in labels:
            raise CheckFailed(f"question {rid} has no label")
        lab = labels.pop(rid)
        items.append({"id": rid, "set": "round2", "text": q["question_text"], "acceptable": lab["acceptable"],
                      "should_ask": lab["tag"] == "vague", "scored": True, "tag": lab["tag"]})
    if labels:
        raise CheckFailed(f"{len(labels)} labelled ids are not in the questions file")
    return items


# --------------------------------------------------------------- scoring

def outcome(served, acceptable):
    """As fresh_test_run.py and gate_refit.py."""
    if served is not None:
        return "correct_answer" if served in acceptable else "wrong_answer"
    return "missed_answer" if acceptable else "correct_abstain"


def decide(row, gate_kind, gate, routing):
    """(served entry or None, kind) for one arm's row."""
    if row["routing"] != routing:
        raise CheckFailed(f"row {row['id']} was built with a different routing")
    if not row["retrieved"]:
        return None, row["route"]
    serve = row["s1"] >= 0.8439 if gate_kind == "current" else gate.serves(row, routing=routing)
    return (row["live_entry"], "served") if serve else (None, "gate_abstain")


def mcnemar_exact(b, c):
    n = b + c
    if n == 0:
        return None
    return min(1.0, 2 * sum(math.comb(n, i) for i in range(min(b, c) + 1)) / 2 ** n)


def paired(x, y):
    only_x = sum(1 for a, b in zip(x, y) if a and not b)
    only_y = sum(1 for a, b in zip(x, y) if b and not a)
    return {"both": sum(1 for a, b in zip(x, y) if a and b), "only_first": only_x, "only_second": only_y,
            "neither": sum(1 for a, b in zip(x, y) if not a and not b), "mcnemar_exact_p": mcnemar_exact(only_x, only_y)}


def arm_counts(outs, kinds):
    c = {o: outs.count(o) for o in OUTCOMES}
    served = c["correct_answer"] + c["wrong_answer"]
    retrieved = sum(1 for k in kinds if k in ("served", "gate_abstain"))
    return {**c, "items": len(outs), "served": served,
            "served_correct_share": round(c["correct_answer"] / served, 4) if served else None,
            "abstain_or_ask": len(outs) - served, "abstain_rate": round((len(outs) - served) / len(outs), 4) if outs else None,
            "retrieved": retrieved, "gate_abstains": sum(1 for k in kinds if k == "gate_abstain")}


def analyse(per_item, tests_pass):
    """Counts, paired tests and the five conditions over per-item rows."""
    counts = {a: arm_counts([r[f"{a}_outcome"] for r in per_item], [r[f"{a}_kind"] for r in per_item]) for a in ARMS}
    pairs = {}
    for x, y in PAIRS:
        pairs[f"{x}_vs_{y}"] = {
            "correct_answer": paired([r[f"{x}_outcome"] == "correct_answer" for r in per_item],
                                     [r[f"{y}_outcome"] == "correct_answer" for r in per_item]),
            "wrong_answer": paired([r[f"{x}_outcome"] == "wrong_answer" for r in per_item],
                                   [r[f"{y}_outcome"] == "wrong_answer" for r in per_item])}
    c3 = [r for r in per_item if r["tag"] in ("offtopic", "vague")]
    no_answer = lambda r, a: r[f"{a}_outcome"] in ("correct_abstain", "missed_answer")  # noqa: E731
    share_b = counts["B"]["served_correct_share"]
    conditions = {
        "1 wrong answers served B <= A": counts["B"]["wrong_answer"] <= counts["A"]["wrong_answer"],
        "2 correct answers B >= A": counts["B"]["correct_answer"] >= counts["A"]["correct_answer"],
        "3 offtopic and vague abstained or asked B >= A":
            sum(no_answer(r, "B") for r in c3) >= sum(no_answer(r, "A") for r in c3),
        "4 served-correct share B >= 0.60": share_b is not None and share_b >= SHARE_MIN,
        "5 safety, held-topic and help tests pass": bool(tests_pass),
    }
    return {"counts": counts, "pairs": pairs,
            "condition_3_items": {"n": len(c3), "A": sum(no_answer(r, "A") for r in c3),
                                  "B": sum(no_answer(r, "B") for r in c3)},
            "conditions": {k: "PASS" if v else "FAIL" for k, v in conditions.items()},
            "verdict": "B replaces A" if all(conditions.values()) else "the demo stays on A (21 entries, gate 0.8439)"}


def run_safety_tests():
    run = subprocess.run(["node", "--require", "./test/clearFlags.js", "--test", *SAFETY_TESTS],
                         cwd=REPO / "app" / "gateway", capture_output=True, text=True, encoding="utf-8")
    grab = lambda k: next((ln.split()[-1] for ln in run.stdout.splitlines() if ln.startswith(f"ℹ {k} ")), "?")  # noqa: E731
    return run.returncode == 0, {"tests": grab("tests"), "pass": grab("pass"), "fail": grab("fail")}


# --------------------------------------------------------------- run

def run(args, items, tables, gate, routing, tests):
    per_item = []
    rows = {base: {r["id"]: r for r in tables[base]} for base in ("kb21", "kb62")}
    for it in items:
        rec = {"id": it["id"], "tag": it["tag"], "route": rows["kb21"][it["id"]]["route"],
               "correct_entry_only_in_kb62": bool(it["acceptable"]) and not rows["kb21"][it["id"]]["acceptable"]}
        for arm, (base, kind) in ARMS.items():
            row = rows[base][it["id"]]
            served, how = decide(row, kind, gate, routing)
            rec.update({f"{arm}_served": served or "", f"{arm}_kind": how,
                        f"{arm}_outcome": outcome(served, row["acceptable"])})
        per_item.append(rec)
    tests_pass, test_counts = tests()
    result = analyse(per_item, tests_pass)
    sens_items = [r for r in per_item if r["tag"] != "unsure"]
    result["sensitivity_without_unsure"] = {"items": len(sens_items), **analyse(sens_items, tests_pass)}
    result.update({"items": len(per_item), "safety_tests": test_counts,
                   "kb21_items_correct_entry_only_in_kb62": sum(r["correct_entry_only_in_kb62"] for r in per_item),
                   "routes": {k: sum(1 for r in per_item if r["route"] == k) for k in sorted({r["route"] for r in per_item})},
                   "tags": {t: sum(1 for r in per_item if r["tag"] == t) for t in TAGS},
                   "routing_id": routing, "gate_sha256": GATE_SHA256, "dry_run": bool(args.dry_run)})
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "aggregate.json").write_text(json.dumps(result, indent=1) + "\n", encoding="utf-8")
    fields = ["id", "tag", "route", "correct_entry_only_in_kb62"] + [f"{a}_{k}" for a in ARMS for k in ("served", "kind", "outcome")]
    with open(out / "per_item.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator="\n")
        w.writeheader()
        w.writerows(per_item)
    return result


def report(result):
    print(f"{'DRY RUN, ' if result['dry_run'] else ''}items {result['items']}; routes {result['routes']}; "
          f"items whose correct entry is only in KB-62: {result['kb21_items_correct_entry_only_in_kb62']}")
    for arm, c in result["counts"].items():
        print(f"arm {arm}: correct {c['correct_answer']}, wrong served {c['wrong_answer']}, correct abstain/ask "
              f"{c['correct_abstain']}, missed {c['missed_answer']}; served-correct share {c['served_correct_share']}; "
              f"abstain rate {c['abstain_rate']} (gate abstains {c['gate_abstains']} of {c['retrieved']} retrieved)")
    for pair, p in result["pairs"].items():
        print(f"{pair}: McNemar exact p correct {p['correct_answer']['mcnemar_exact_p']}, "
              f"wrong {p['wrong_answer']['mcnemar_exact_p']}")
    for k, v in result["conditions"].items():
        print(f"condition {k}: {v}")
    print(f"safety, held-topic and help tests: {result['safety_tests']}")
    s = result["sensitivity_without_unsure"]
    print(f"sensitivity without unsure ({s['items']} items): " + "; ".join(
        f"{a} correct {c['correct_answer']} wrong {c['wrong_answer']}" for a, c in s["counts"].items())
        + f"; verdict {s['verdict']}")
    print(f"verdict: {result['verdict']}")


def main(argv=None, tests=run_safety_tests):
    ap = argparse.ArgumentParser(description="One-shot round 2 gate test.")
    for name in ("questions", "labels", "gate", "lock", "out"):
        ap.add_argument(f"--{name}", type=Path, required=True)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--expect-labels-sha256")
    ap.add_argument("--expect-questions-sha256")
    args = ap.parse_args(argv)
    try:
        dry_run_guard(args)
        if args.dry_run:
            expected = {"labels": args.expect_labels_sha256, "questions": args.expect_questions_sha256}
        else:
            expected = logged_hashes(DECISION_LOG.read_text(encoding="utf-8"))
        preflight(args, expected, None, None)
        sys.path.insert(0, str(HERE))
        sys.path.insert(0, str(HERE.parent))
        import gate_g
        import gate_refit as gr

        gate = gate_g.load(args.gate)
        routing = gr.routing_fingerprint()
        preflight(args, expected, routing, gate.routing)
        items = load_items(args.questions, args.labels)
    except CheckFailed as e:
        print(f"ABORT: {e}")
        return 2
    except Exception as e:  # a frozen-gate or KB check in the loaders
        print(f"ABORT: {type(e).__name__}: {e}")
        return 2

    take_lock(Path(args.lock), {"started": dt.datetime.now(dt.timezone.utc).isoformat(), "dry_run": args.dry_run,
                                "labels_sha256": sha256(args.labels), "questions_sha256": sha256(args.questions),
                                "gate_sha256": GATE_SHA256, "routing_id": routing})
    import v4_infer

    model, spec = gr.load_model()
    v4 = v4_infer.load(embed=lambda ts: model.encode([spec["prefix"] + t for t in ts],
                                                     normalize_embeddings=spec["normalize"]))
    tables = gr.build_tables(items, model, v4, routing)
    for base, rows in tables.items():
        gr.require_routing(rows, routing, f"arm rows {base}")
    result = run(args, items, tables, gate, routing, tests)
    lock = json.loads(Path(args.lock).read_text(encoding="utf-8"))
    lock.update({"finished": dt.datetime.now(dt.timezone.utc).isoformat(),
                 "aggregate_sha256": sha256(Path(args.out) / "aggregate.json"),
                 "per_item_sha256": sha256(Path(args.out) / "per_item.csv")})
    Path(args.lock).write_text(json.dumps(lock, indent=1), encoding="utf-8")
    report(result)
    return 0


if __name__ == "__main__":
    sys.exit(main())
