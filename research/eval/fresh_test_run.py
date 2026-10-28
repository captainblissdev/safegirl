"""The one-shot fresh-set test of the KB scale validation (docs/decision-log.md,
"KB scale validation: gate and ranking (PRE-REGISTRATION)" items 6 and 7,
and the amendment "KB scale validation: test arms").

Both arms run with V4 triage, in the gateway's order: Safety Net, generic
help, held topic and vague rule (gate_candidates_routes.js, the gateway's
own modules); then V4 (a vague label gets the clarifying question; a
non-topic label or a top probability below 0.45 abstains; a topic label
retrieves, scoped to its class at 0.5 or above, unscoped below); then the
arm's gate.

  Arm A  the 21-entry base (development's knowledge_base.json), full
         embed mode, the current gate (unscoped top-1 at least 0.8439)
  Arm B  the 62-entry base (this tree), question embed mode, the frozen
         gate_v2 (research/eval/gate_v2/frozen_gate_v2.json)

Before computing anything it checks: the fresh questions file and its
logged SHA-256; that the labels file has fresh_kit.js's schema and
exactly fresh_test_v1's source rows (its SHA-256 is recorded); the
frozen gate_v2, V4 and both KB hashes. It then creates a permanent lock
(KB_SCALE_TEST_RUN.lock) next to the labels file and refuses to run if
the lock already exists: the test runs once.

It writes per-question outcomes and the aggregate (criteria (a) to (d)
and the verdict) to --out, outside the repository: source rows, entry
ids and counts only, no question text. With --save-aggregate it also
copies the aggregate into research/v4/results/.

Usage:
  .venv/Scripts/python.exe -I research/eval/fresh_test_run.py
      --labels C:/.../fresh_test_v1_labels.csv --out C:/.../run
      [--fresh C:/Users/cindy/fresh/fresh_test_v1.csv] [--save-aggregate]
  .venv/Scripts/python.exe -I research/eval/fresh_test_run.py --dry-run
      (synthetic questions and labels in a temporary folder)
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "research" / "eval"))
from gate_candidates import logistic_serves, read_csv, routes as gateway_routes, split_ids  # noqa: E402

HASHES = {
    "fresh_test_v1": "667A547C06CDF6B097061D6F096A1585339B3193F439240D98BC202036157C54",
    "gate_v2": "ad6895a120b538e4cc751ebe4de8944aace640c268e0013f981d29ceabe4bafc",
    "v4": "89eee2b41634c896d7e03b49d184680c843df183f1e628bd71fb0fb9ee96ecdd",
    "kb21": "e78a82afd10491fdc81d98bb2fca43119312be6908af7c4372ee2778d9dc1e30",
    "kb62": "1b53efad82587063462d24efa9a436c2e20df007ad86b8623429b73a12885ff0",
}
KB21_REF = "development"
FRESH = Path(r"C:\Users\cindy\fresh\fresh_test_v1.csv")
GATE_V2 = REPO / "research" / "eval" / "gate_v2" / "frozen_gate_v2.json"
V4_FROZEN = REPO / "research" / "v4" / "frozen" / "v4_hybrid_c10.json"
KB62 = REPO / "ml_service" / "knowledge_base.json"
LOCK_NAME = "KB_SCALE_TEST_RUN.lock"
LABEL_COLUMNS = ["source_row", "group", "acceptable_entry_ids", "expected", "expected_class", "notes"]
OFF_TOPIC_GROUPS = ("Not about reproductive health at all", "Too vague to answer")
TOPICS = {"contraception", "sti", "pregnancy", "general"}
V4_T_ACT, SCOPED, GATE_A = 0.45, 0.5, 0.8439
SAFETY_TESTS = ("test/safetyNet.test.js", "test/offlineSafetyParity.test.js", "test/heldTopics.test.js",
                "test/heldEntries.test.js", "test/helpSignposting.test.js")
OUTCOMES = ("correct_answer", "wrong_answer", "correct_abstain", "missed_answer")


class CheckFailed(RuntimeError):
    pass


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256(path) -> str:
    return sha256_bytes(Path(path).read_bytes())


# --------------------------------------------------------------- checks

def check_hash(name, actual, expected):
    if actual.lower() != expected.lower():
        raise CheckFailed(f"{name}: SHA-256 {actual} is not the logged {expected}")


def check_sidecar(path: Path, expected: str, name: str):
    sidecar = path.with_suffix(".sha256")
    recorded = sidecar.read_text(encoding="utf-8").split()[0]
    check_hash(f"{name} sidecar", recorded, expected)
    check_hash(name, sha256(path), expected)


def kb21_bytes() -> bytes:
    return subprocess.run(["git", "show", f"{KB21_REF}:ml_service/knowledge_base.json"], cwd=REPO,
                          capture_output=True, check=True).stdout


def check_labels(labels_rows, header, fresh_rows):
    """The labels file must have fresh_kit.js's schema and exactly the
    fresh questions' source rows."""
    if header != LABEL_COLUMNS:
        raise CheckFailed(f"labels header {header} is not {LABEL_COLUMNS}")
    rows = [r["source_row"] for r in labels_rows]
    if len(rows) != len(set(rows)):
        raise CheckFailed("labels file repeats a source row")
    if set(rows) != {r["source_row"] for r in fresh_rows}:
        raise CheckFailed("labels file does not cover exactly the fresh questions' source rows")
    for r in labels_rows:
        if r["expected"] not in ("ANSWER", "NONE_FITS"):
            raise CheckFailed(f"source row {r['source_row']}: expected must be ANSWER or NONE_FITS")
        if (r["expected"] == "ANSWER") != bool(split_ids(r["acceptable_entry_ids"])):
            raise CheckFailed(f"source row {r['source_row']}: expected and acceptable ids disagree")


def take_lock(lock: Path, record: dict):
    """Create the one-run lock; refuse if it exists."""
    try:
        with open(lock, "x", encoding="utf-8") as f:
            json.dump(record, f, indent=2)
    except FileExistsError:
        raise CheckFailed(f"{lock} exists: the fresh test has already been run once")


def header_of(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        return next(csv.reader(f))


# --------------------------------------------------------------- arms

def arm_acceptable(labelled, kb_ids):
    """The labelled acceptable ids that exist in an arm's base (ids unchanged)."""
    return [i for i in labelled if i in kb_ids]


def route_v4(route, v4_label, v4_conf):
    """'retrieve_scoped', 'retrieve_unscoped', or what answers instead."""
    if route != "retrieve":
        return route
    if v4_label == "vague":
        return "clarify"
    if v4_label not in TOPICS or v4_conf < V4_T_ACT:
        return "v4_abstain"
    return "retrieve_scoped" if v4_conf >= SCOPED else "retrieve_unscoped"


def retrieve(scores, ids, classes, how, v4_label):
    """Live entry and gate signals from one arm's scores."""
    order = np.argsort(-scores, kind="stable")
    s1, s2 = float(scores[order[0]]), float(scores[order[1]])
    live = next(j for j in order if classes[j] == v4_label) if how == "retrieve_scoped" else order[0]
    return {"entry": ids[live], "s1": s1, "margin": s1 - s2, "agree": float(v4_label == classes[live])}


def gate_a(d):
    return d["s1"] >= GATE_A


def gate_b(d, frozen):
    p = frozen["params"]
    return logistic_serves(p["logistic"], [d["s1"], d["margin"], d["agree"]] if p["with_v4"] else [d["s1"], d["margin"]])


def outcome(served, acceptable):
    if served is not None:
        return "correct_answer" if served in acceptable else "wrong_answer"
    return "missed_answer" if acceptable else "correct_abstain"


# --------------------------------------------------------------- criteria

def mcnemar_exact(b, c):
    """Two-sided exact McNemar p on discordant counts b and c (None if b + c is 0)."""
    n = b + c
    if n == 0:
        return None
    k = min(b, c)
    p = 2 * sum(math.comb(n, i) for i in range(k + 1)) / 2 ** n
    return min(1.0, p)


def paired(a_flags, b_flags):
    both = sum(1 for x, y in zip(a_flags, b_flags) if x and y)
    only_a = sum(1 for x, y in zip(a_flags, b_flags) if x and not y)
    only_b = sum(1 for x, y in zip(a_flags, b_flags) if y and not x)
    neither = sum(1 for x, y in zip(a_flags, b_flags) if not x and not y)
    return {"both": both, "only_arm_a": only_a, "only_arm_b": only_b, "neither": neither,
            "mcnemar_exact_p": mcnemar_exact(only_a, only_b)}


def criteria(per_q, d_tests_pass, v4_unchanged):
    a = [q["arm_a"]["outcome"] for q in per_q]
    b = [q["arm_b"]["outcome"] for q in per_q]
    off = [k for k, q in enumerate(per_q) if q["group"] in OFF_TOPIC_GROUPS]
    no_entry = lambda o: o in ("correct_abstain", "missed_answer")  # noqa: E731
    counts = {arm: {o: outs.count(o) for o in OUTCOMES} for arm, outs in (("arm_a", a), ("arm_b", b))}
    ca = [no_entry(a[k]) for k in off]
    cb = [no_entry(b[k]) for k in off]
    res = {
        "a": {"arm_a": counts["arm_a"]["correct_answer"], "arm_b": counts["arm_b"]["correct_answer"],
              "paired": paired([o == "correct_answer" for o in a], [o == "correct_answer" for o in b])},
        "b": {"arm_a": counts["arm_a"]["wrong_answer"], "arm_b": counts["arm_b"]["wrong_answer"],
              "paired": paired([o == "wrong_answer" for o in a], [o == "wrong_answer" for o in b])},
        "c": {"questions": len(off), "arm_a": sum(ca), "arm_b": sum(cb), "paired": paired(ca, cb)},
        "d": {"safety_held_help_tests_pass": d_tests_pass, "v4_hash_unchanged": v4_unchanged},
    }
    res["a"]["holds"] = res["a"]["arm_b"] >= res["a"]["arm_a"]
    res["b"]["holds"] = res["b"]["arm_b"] <= res["b"]["arm_a"]
    res["c"]["holds"] = res["c"]["arm_b"] >= res["c"]["arm_a"]
    res["d"]["holds"] = bool(d_tests_pass and v4_unchanged)
    verdict = all(res[k]["holds"] for k in "abcd")
    return counts, res, ("the 62-entry base replaces the 21 in the demo" if verdict else "the demo stays on 21 entries")


def run_safety_tests():
    run = subprocess.run(["node", "--require", "./test/clearFlags.js", "--test", *SAFETY_TESTS],
                         cwd=REPO / "app" / "gateway", capture_output=True, text=True, encoding="utf-8")
    fail = next((ln for ln in run.stdout.splitlines() if ln.startswith("ℹ fail")), "ℹ fail ?")
    return run.returncode == 0, fail.replace("ℹ ", "")


# --------------------------------------------------------------- run

def run(questions, labels, kb21_path, out: Path, d_tests):
    """Both arms on the questions. questions: [{source_row, text}];
    labels: {source_row: row}. Returns the aggregate."""
    sys.path.insert(0, str(REPO / "ml_service"))
    sys.path.insert(0, str(REPO / "research" / "v4"))
    from retrieval import QUERY_PREFIX, KnowledgeBaseRetriever
    import v4_infer

    frozen = json.loads(GATE_V2.read_text(encoding="utf-8"))
    route_of = gateway_routes([{"id": q["source_row"], "text": q["text"]} for q in questions])
    texts = [q["text"] for q in questions]
    arms = {"arm_a": KnowledgeBaseRetriever(kb21_path, "full"), "arm_b": KnowledgeBaseRetriever(KB62, "question")}
    model = arms["arm_b"].model
    v4 = None

    def embed(ts):
        e = v4.spec["embedding"]
        return model.encode([e["prefix"] + t for t in ts], normalize_embeddings=e["normalize"])

    v4 = v4_infer.load(embed=embed)
    probs = v4.predict_proba(texts)
    q_emb = model.encode([QUERY_PREFIX + t for t in texts], convert_to_numpy=True, normalize_embeddings=True)

    per_q = []
    for k, q in enumerate(questions):
        j = int(np.argmax(probs[k]))
        v4_label, v4_conf = v4.classes[j], float(probs[k][j])
        label = labels[q["source_row"]]
        labelled = split_ids(label["acceptable_entry_ids"])
        how = route_v4(route_of[q["source_row"]], v4_label, v4_conf)
        row = {"source_row": int(q["source_row"]), "group": label["group"], "route": how, "v4_label": v4_label,
               "v4_confidence": round(v4_conf, 4)}
        for arm, r in arms.items():
            ids = [e["id"] for e in r.entries]
            classes = [e["class"] for e in r.entries]
            acceptable = arm_acceptable(labelled, set(ids))
            served, gate = None, None
            if how.startswith("retrieve"):
                d = retrieve(r.embeddings @ q_emb[k], ids, classes, how, v4_label)
                gate = gate_a(d) if arm == "arm_a" else gate_b(d, frozen)
                served = d["entry"] if gate else None
            row[arm] = {"served": served, "gate_passed": gate, "acceptable": acceptable,
                        "outcome": outcome(served, acceptable)}
        per_q.append(row)

    d_pass, d_detail = d_tests() if callable(d_tests) else (bool(d_tests), "given")
    v4_unchanged = sha256(V4_FROZEN) == HASHES["v4"]
    counts, crit, verdict = criteria(per_q, d_pass, v4_unchanged)
    aggregate = {"questions": len(per_q), "counts": counts, "criteria": crit, "verdict": verdict,
                 "d_tests": d_detail, "routes": {r: sum(1 for q in per_q if q["route"] == r)
                                                 for r in sorted({q["route"] for q in per_q})}}
    out.mkdir(parents=True, exist_ok=True)
    (out / "per_question.json").write_text(json.dumps(per_q, indent=2) + "\n", encoding="utf-8")
    (out / "aggregate.json").write_text(json.dumps(aggregate, indent=2) + "\n", encoding="utf-8")
    return aggregate


SYNTHETIC = [
    ("How long does the contraceptive implant last?", "Contraception", "KB-C8", ""),
    ("Can I get pregnant the first time I have sex?", "Pregnancy", "KB-P1", ""),
    ("How do I know if I have an STI?", "STIs and HIV", "KB-S4", ""),
    ("Is it normal for my periods to be irregular?", "Periods, puberty, hygiene", "KB-G3", "KB-G14"),
    ("What is the capital of Kenya?", "Not about reproductive health at all", "", ""),
    ("help me", "Too vague to answer", "", ""),
    ("How do I fix my bicycle chain?", "Not about reproductive health at all", "", ""),
    ("Where can I get a pregnancy test?", "Pregnancy", "KB-P8", ""),
]


def dry_run():
    tmp = Path(tempfile.mkdtemp(prefix="fresh-test-dry-"))
    try:
        questions = [{"source_row": str(k), "text": t} for k, (t, *_r) in enumerate(SYNTHETIC, 1)]
        labels = {}
        for k, (_t, group, best, also) in enumerate(SYNTHETIC, 1):
            ids = [i for i in [best, *split_ids(also)] if i]
            labels[str(k)] = {"source_row": str(k), "group": group, "acceptable_entry_ids": ";".join(ids),
                              "expected": "ANSWER" if ids else "NONE_FITS", "expected_class": "", "notes": ""}
        check_sidecar(GATE_V2, HASHES["gate_v2"], "gate_v2")
        check_sidecar(V4_FROZEN, HASHES["v4"], "V4")
        kb21 = kb21_bytes()
        check_hash("21-entry KB", sha256_bytes(kb21), HASHES["kb21"])
        check_hash("62-entry KB", sha256(KB62), HASHES["kb62"])
        kb21_path = tmp / "kb21.json"
        kb21_path.write_bytes(kb21)
        take_lock(tmp / LOCK_NAME, {"dry_run": True})
        try:
            take_lock(tmp / LOCK_NAME, {"dry_run": True})
            raise AssertionError("the lock did not refuse a second run")
        except CheckFailed:
            pass
        aggregate = run(questions, labels, kb21_path, tmp / "out", run_safety_tests)
        per_q = json.loads((tmp / "out" / "per_question.json").read_text(encoding="utf-8"))
        print("DRY RUN (synthetic questions and labels; lock in a temporary folder, refused a second run)")
        for q in per_q:
            print(f"  row {q['source_row']}: {q['route']}, V4 {q['v4_label']} {q['v4_confidence']} | "
                  f"A {q['arm_a']['served']} {q['arm_a']['outcome']} | B {q['arm_b']['served']} {q['arm_b']['outcome']}")
        print(json.dumps(aggregate, indent=1))
        return 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def inside_repo(path) -> bool:
    try:
        Path(path).resolve().relative_to(REPO)
        return True
    except ValueError:
        return False


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--labels")
    ap.add_argument("--out")
    ap.add_argument("--fresh", default=str(FRESH))
    ap.add_argument("--save-aggregate", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)
    try:
        if args.dry_run:
            return dry_run()
        if not args.labels or not args.out:
            raise CheckFailed("--labels and --out are required (or --dry-run)")
        if inside_repo(args.out) or inside_repo(args.labels):
            raise CheckFailed("--labels and --out must be outside the repository")
        labels_path, out = Path(args.labels), Path(args.out)
        lock = labels_path.parent / LOCK_NAME
        if lock.exists():
            raise CheckFailed(f"{lock} exists: the fresh test has already been run once")
        check_hash("fresh_test_v1.csv", sha256(args.fresh), HASHES["fresh_test_v1"])
        fresh_rows = read_csv(args.fresh)
        labels_rows = read_csv(labels_path)
        check_labels(labels_rows, header_of(labels_path), fresh_rows)
        check_sidecar(GATE_V2, HASHES["gate_v2"], "gate_v2")
        check_sidecar(V4_FROZEN, HASHES["v4"], "V4")
        kb21 = kb21_bytes()
        check_hash("21-entry KB", sha256_bytes(kb21), HASHES["kb21"])
        check_hash("62-entry KB", sha256(KB62), HASHES["kb62"])
        record = {"started": dt.datetime.now(dt.timezone.utc).isoformat(), "labels_sha256": sha256(labels_path),
                  "fresh_sha256": HASHES["fresh_test_v1"], "gate_v2_sha256": HASHES["gate_v2"],
                  "v4_sha256": HASHES["v4"], "kb21_sha256": HASHES["kb21"], "kb62_sha256": HASHES["kb62"]}
        take_lock(lock, record)
    except CheckFailed as error:
        print(f"Refused: {error}")
        return 2

    out.mkdir(parents=True, exist_ok=True)
    kb21_path = out / "kb21_knowledge_base.json"
    kb21_path.write_bytes(kb21)
    questions = [{"source_row": r["source_row"], "text": r["question_text"]} for r in fresh_rows]
    labels = {r["source_row"]: r for r in labels_rows}
    aggregate = run(questions, labels, kb21_path, out, run_safety_tests)
    aggregate["lock"] = record
    (out / "aggregate.json").write_text(json.dumps(aggregate, indent=2) + "\n", encoding="utf-8")
    if args.save_aggregate:
        dest = REPO / "research" / "v4" / "results" / "kb_scale_test_aggregate.json"
        shutil.copyfile(out / "aggregate.json", dest)
        print(f"Aggregate saved to {dest.relative_to(REPO)}")
    print(json.dumps({k: aggregate[k] for k in ("questions", "counts", "criteria", "verdict")}, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
