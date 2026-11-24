"""Gate (g) parity: the live pipeline against the research harness
(docs/decision-log.md, "Gate (g) wired behind a flag").

Harness side: gate_refit.py's KB-62 feature table (question embed mode,
V4 triage routing 57c6a5b638ab) and the frozen gate (gate_g.py): an item
is served its live entry when it reaches retrieval and the gate serves.

Live side: a real ml_service started on a spare port with the 62-entry
base written from git (kb/merge-60 9ae43bb, hash checked; the same file
the harness reads), RETRIEVAL_EMBED_MODE=question and V4_TRIAGE_ENABLED=
true; then gate_g_parity.js runs every item through the gateway's
pipeline with GATE_G_ENABLED=true. The default knowledge base is not
changed.

Compares, on the 150 scored development items, the serve-or-abstain
decision and the served entry id. Prints counts and disagreeing ids only
and writes the comparison (ids only) to --out.

With --demo-config the live side uses the demo's 62-entry configuration
instead: ml_service serves the repository's ml_service/knowledge_base_kb62.json
(hash checked) and the gateway runs with KB_SET=kb62, so entries are looked
up through the gateway's own loader (scripts/demo.ps1 -Kb 62).

Usage (no other ml_service on the port; e5 in the local cache):
  HF_HUB_OFFLINE=1 .venv/Scripts/python.exe -I research/v4/gate_refit/gate_g_parity.py [--demo-config]
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
import gate_g  # noqa: E402
import gate_refit as gr  # noqa: E402

REPO = gr.REPO
PORT = 8011


def harness(items):
    import v4_infer

    model, spec = gr.load_model()
    v4 = v4_infer.load(embed=lambda ts: model.encode([spec["prefix"] + t for t in ts],
                                                     normalize_embeddings=spec["normalize"]))
    routing = gr.routing_fingerprint()
    if routing != gate_g.load().routing:
        raise gr.RoutingMismatch("harness routing is not the frozen gate's")
    gate = gate_g.load()
    rows = gr.build_tables(items, model, v4, routing)["kb62"]
    return {r["id"]: (r["live_entry"] if r["retrieved"] and gate.serves(r, routing=routing) else None) for r in rows}


def start_ml(kb_path: Path):
    env = {**os.environ, "MODEL_DIR": "./final", "KB_PATH": str(kb_path), "RETRIEVAL_EMBED_MODE": "question",
           "V4_TRIAGE_ENABLED": "true", "HF_HUB_OFFLINE": "1"}
    proc = subprocess.Popen([str(REPO / ".venv" / "Scripts" / "python.exe"), "-m", "uvicorn", "app:app",
                             "--host", "127.0.0.1", "--port", str(PORT)], cwd=REPO / "ml_service", env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    deadline = time.time() + 600
    while time.time() < deadline:
        if proc.poll() is not None:
            raise RuntimeError("ml_service exited during start-up")
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/health", timeout=3) as r:
                health = json.loads(r.read())
            if health.get("status") == "ok" and health.get("v4") == "ok" and health.get("kb_entries") == 62:
                return proc, health
        except OSError:
            pass
        time.sleep(2)
    proc.terminate()
    raise RuntimeError("ml_service did not become healthy with V4 and 62 entries")


def live(items, kb_path: Path, demo_config: bool = False):
    env = {**os.environ, "CLASSIFIER_SERVICE_URL": f"http://127.0.0.1:{PORT}", "GATE_G_ENABLED": "true",
           "V4_TRIAGE_ENABLED": "true", "AUTH_DISABLED": "true", "CLASSIFIER_TIMEOUT_MS": "60000"}
    for name in ("GENERATION_ENABLED", "GEMINI_API_KEY", "RELEVANCE_GATE", "KB_SET"):
        env.pop(name, None)
    if demo_config:
        env["KB_SET"] = "kb62"
    kb = None if demo_config else str(kb_path)
    run = subprocess.run(["node", str(HERE / "gate_g_parity.js")], cwd=REPO,
                         input=json.dumps({"kb": kb, "items": [{"id": i["id"], "text": i["text"]} for i in items]}),
                         capture_output=True, text=True, encoding="utf-8", env=env)
    if run.returncode != 0:
        raise RuntimeError(f"gate_g_parity.js failed: {run.stderr.strip()[:300]}")
    return json.loads(run.stdout)


def main(argv=None):
    ap = argparse.ArgumentParser()
    for k, v in gr.DEFAULTS.items():
        ap.add_argument(f"--{k.replace('_', '-')}", type=Path, default=v)
    ap.add_argument("--demo-config", action="store_true")
    args = ap.parse_args(argv)
    items = gr.load_items(args)
    scored = [i for i in items if i["scored"]]
    expected = harness(items)

    if args.demo_config:
        kb_bytes = (REPO / "ml_service" / "knowledge_base_kb62.json").read_bytes()
    else:
        kb_bytes = gr.git_bytes(gr.KB_COMMIT, "ml_service/knowledge_base.json")
    gr.check_hash("kb62", gr.sha256_bytes(kb_bytes), gr.HASHES["kb62"])
    with tempfile.TemporaryDirectory() as tmp:
        kb_path = (REPO / "ml_service" / "knowledge_base_kb62.json") if args.demo_config else Path(tmp) / "kb62.json"
        if not args.demo_config:
            kb_path.write_bytes(kb_bytes)
        proc, health = start_ml(kb_path)
        try:
            got = live(items, kb_path, args.demo_config)
        finally:
            proc.terminate()
            proc.wait(timeout=60)

    rows, agree = [], 0
    for it in scored:
        h, l = expected[it["id"]], got[it["id"]]["served"]
        same = h == l
        agree += same
        rows.append({"id": it["id"], "harness": h, "live": l, "agree": same,
                     "live_kind": got[it["id"]]["kind"], "live_source": got[it["id"]]["source"]})
    decision_agree = sum((r["harness"] is None) == (r["live"] is None) for r in rows)
    names = [str(r["live_source"]) for r in rows]  # None: answered before classification
    sources = {s: names.count(s) for s in sorted(set(names))}
    result = {"scored": len(rows), "serve_or_abstain_agree": decision_agree, "served_entry_agree": agree,
              "disagree_ids": [r["id"] for r in rows if not r["agree"]],
              "harness_served": sum(r["harness"] is not None for r in rows),
              "live_served": sum(r["live"] is not None for r in rows), "live_classifier_sources": sources,
              "ml_service_health": {k: health.get(k) for k in ("status", "v4", "kb_entries", "model_version")},
              "rows": rows}
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "gate_g_parity.json").write_text(json.dumps(result, indent=1), encoding="utf-8")
    print(f"{'demo config (repo kb62 file, KB_SET=kb62); ' if args.demo_config else ''}scored {len(rows)}; serve-or-abstain agree {decision_agree}; decision and entry agree {agree}; "
          f"harness served {result['harness_served']}, live served {result['live_served']}; "
          f"live classifier sources {sources}; disagree ids {result['disagree_ids']}")
    return 0 if agree == len(rows) else 1


if __name__ == "__main__":
    sys.exit(main())
