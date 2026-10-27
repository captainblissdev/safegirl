"""V4 integration, end to end (V4 integration plan, step 5).

Run from the repository root (.venv; Node on PATH; Windows, for the
memory reading):

    .venv/Scripts/python.exe research/v4/integration_e2e.py

It starts ml_service (uvicorn) and the gateway (node server.js, with
AUTH_DISABLED=true and no .env file) as child processes on spare ports,
first with V4_TRIAGE_ENABLED unset and then with it set to "true". For
each run it measures:

- startup time of each process (until /health answers, and for
  ml_service with the flag on, until it reports v4 "ok");
- working-set memory of each process, with its child processes, after
  startup and after the queries;
- the first request after startup (a synthetic warm-up query),
  reported separately;
- latency of each of the 58 dev queries through POST /api/query
  (median and 95th percentile).

With the flag on, it also sends every V4 training seed and compares the
live reply route (safety / help / held / ask / abstain / answer) with
research/v4/triage_sim.py for the dev queries and the seeds. This is an
equivalence check, not an accuracy claim: the seeds are training data,
and triage_sim has no retrieval or relevance gate. Each mismatch is
given a reason (gate, retrieval, fallback or other) by id.

It also times the e5 tensor check (ml_service's e5_mismatch) on its own.

Writes research/v4/results/integration_e2e.json and .md: aggregates and
ids only, never query text. Dev queries are used for equivalence and
timing only, never for tuning.
"""

from __future__ import annotations

import csv
import importlib.util
import json
import os
import platform
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
ML_DIR = REPO / "ml_service"
GW_DIR = REPO / "app" / "gateway"
DEV_SET = REPO / "resources" / "eval" / "retrieval_eval_set.csv"
ML_PORT, GW_PORT = 8012, 3026
WARMUP = "warm up request for the timing run"
OUT = HERE / "results" / "integration_e2e"

KIND_TO_ROUTE = {"referral": "safety", "help": "help", "held-topic": "held", "vague": "ask", "abstain": "abstain",
                 "answer-scoped": "answer", "answer-unscoped": "answer"}
SIM_TO_ROUTE = {"referral": "safety", "help": "help", "held": "held", "ask": "ask", "abstain": "abstain",
                "answer": "answer"}


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def dev_items():
    with open(DEV_SET, encoding="utf-8-sig", newline="") as f:
        return [(f"DEV-{r['id']}", r["query"]) for r in csv.DictReader(f)]


def seed_items():
    cv = _load("cv_common", HERE / "cv_common.py")
    return [(s["id"], s["text"]) for s in cv.load_data()["seeds"]]


def http(method, url, body=None, timeout=60):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, json.loads(r.read().decode("utf-8"))


def wait_for(url, ready=lambda body: True, limit=300):
    """Seconds until GET url answers 200 and ready(body), or raise."""
    start = time.perf_counter()
    while time.perf_counter() - start < limit:
        try:
            status, body = http("GET", url, timeout=5)
            if status == 200 and ready(body):
                return time.perf_counter() - start
        except (urllib.error.URLError, ConnectionError, TimeoutError, json.JSONDecodeError):
            pass
        time.sleep(0.25)
    raise RuntimeError(f"{url} did not become ready in {limit} s")


def working_set_mb(pid):
    """Windows working set of a process and all its descendants, in MB, or
    None. Descendants matter: a venv's python.exe is a launcher that runs
    the real interpreter as a child process."""
    try:
        out = subprocess.run(["powershell", "-NoProfile", "-Command",
                              "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,WorkingSetSize"
                              " | ConvertTo-Csv -NoTypeInformation"],
                             capture_output=True, text=True, check=True).stdout
        rows = [r for r in csv.DictReader(out.splitlines()) if r.get("ProcessId")]
        children, size = {}, {}
        for r in rows:
            children.setdefault(int(r["ParentProcessId"]), []).append(int(r["ProcessId"]))
            size[int(r["ProcessId"])] = int(r["WorkingSetSize"] or 0)
        if pid not in size:
            return None
        total, todo, seen = 0, [pid], set()
        while todo:
            p = todo.pop()
            if p in seen:
                continue
            seen.add(p)
            total += size.get(p, 0)
            todo.extend(children.get(p, []))
        return round(total / 2 ** 20, 1)
    except (subprocess.CalledProcessError, ValueError, KeyError):
        return None


def start_services(flag_on):
    base = {k: v for k, v in os.environ.items() if k != "V4_TRIAGE_ENABLED"}
    flag = {"V4_TRIAGE_ENABLED": "true"} if flag_on else {}
    ml_env = {**base, **flag, "MODEL_DIR": "./final", "KB_PATH": "./knowledge_base.json"}
    gw_env = {**base, **flag, "AUTH_DISABLED": "true", "PORT": str(GW_PORT),
              "CLASSIFIER_SERVICE_URL": f"http://127.0.0.1:{ML_PORT}"}
    gw_env.pop("NODE_ENV", None)
    devnull = subprocess.DEVNULL

    t0 = time.perf_counter()
    ml = subprocess.Popen([sys.executable, "-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", str(ML_PORT)],
                          cwd=ML_DIR, env=ml_env, stdout=devnull, stderr=devnull)
    ready = (lambda b: b.get("status") == "ok" and b.get("v4") == "ok") if flag_on else \
        (lambda b: b.get("status") == "ok")
    try:
        ml_startup = wait_for(f"http://127.0.0.1:{ML_PORT}/health", ready)
    except RuntimeError:
        ml.kill()
        raise
    gw = subprocess.Popen(["node", "server.js"], cwd=GW_DIR, env=gw_env, stdout=devnull, stderr=devnull)
    try:
        gw_startup = wait_for(f"http://127.0.0.1:{GW_PORT}/health")
    except RuntimeError:
        gw.kill()
        ml.kill()
        raise
    return ml, gw, {"ml_service_s": round(ml_startup, 2), "gateway_s": round(gw_startup, 2),
                    "both_s": round(time.perf_counter() - t0, 2)}


def stop(*procs):
    for p in procs:
        p.terminate()
    for p in procs:
        try:
            p.wait(timeout=20)
        except subprocess.TimeoutExpired:
            p.kill()


def query(text):
    t = time.perf_counter()
    status, body = http("POST", f"http://127.0.0.1:{GW_PORT}/api/query", {"text": text})
    return (time.perf_counter() - t) * 1000, status, body


def latency_stats(ms):
    ordered = sorted(ms)
    p95 = ordered[min(len(ordered) - 1, int(round(0.95 * (len(ordered) - 1))))]
    return {"n": len(ms), "median_ms": round(statistics.median(ms), 1), "p95_ms": round(p95, 1),
            "max_ms": round(max(ms), 1), "method": "client wall time per POST /api/query, sequential; p95 = "
                                                  "nearest rank on the sorted values"}


def run(flag_on, devs, seeds):
    ml, gw, startup = start_services(flag_on)
    try:
        memory_after_start = {"ml_service_mb": working_set_mb(ml.pid), "gateway_mb": working_set_mb(gw.pid)}
        first_ms, _, _ = query(WARMUP)
        replies, timings = {}, []
        for item_id, text in devs:
            ms, status, body = query(text)
            timings.append(ms)
            replies[item_id] = {"status": status, "kind": body.get("kind"),
                                "relevanceGate": body.get("relevanceGate"),
                                "retrievalScope": body.get("retrievalScope"),
                                "classifierSource": body.get("classifierSource")}
        if flag_on:
            for item_id, text in seeds:
                _, status, body = query(text)
                replies[item_id] = {"status": status, "kind": body.get("kind"),
                                    "relevanceGate": body.get("relevanceGate"),
                                    "retrievalScope": body.get("retrievalScope"),
                                    "classifierSource": body.get("classifierSource")}
        memory_after_queries = {"ml_service_mb": working_set_mb(ml.pid), "gateway_mb": working_set_mb(gw.pid)}
    finally:
        stop(gw, ml)
    return {"startup": startup, "memory_after_startup": memory_after_start,
            "memory_after_queries": memory_after_queries, "first_request_ms": round(first_ms, 1),
            "latency_dev": latency_stats(timings)}, replies


def mismatch_reason(live, sim_route):
    if live["classifierSource"] not in (None, "v4"):
        return f"fallback ({live['classifierSource']})"
    if live["kind"] == "abstain" and sim_route == "answer":
        if live["relevanceGate"] == "abstained":
            return "gate"
        return "retrieval"
    return "other"


def equivalence(replies, items):
    ts = _load("triage_sim", HERE / "triage_sim.py")
    sim = {r["id"]: r for r in ts.simulate(items)}
    out = {"compared": 0, "matching": 0, "mismatches": []}
    for item_id, _ in items:
        live_route = KIND_TO_ROUTE.get(replies[item_id]["kind"])
        sim_route = SIM_TO_ROUTE[sim[item_id]["v4_kind"]]
        out["compared"] += 1
        if live_route == sim_route:
            out["matching"] += 1
        else:
            out["mismatches"].append({"id": item_id, "live": live_route, "sim": sim_route,
                                      "reason": mismatch_reason(replies[item_id], sim_route)})
    reasons = {}
    for m in out["mismatches"]:
        reasons[m["reason"]] = reasons.get(m["reason"], 0) + 1
    out["mismatch_reasons"] = reasons
    return out


def e5_check_seconds():
    """Time ml_service's e5_mismatch on the e5 model loaded as the
    retriever loads it (median of 3)."""
    from sentence_transformers import SentenceTransformer

    sys.path.insert(0, str(ML_DIR))
    os.environ.pop("V4_TRIAGE_ENABLED", None)
    app = _load("ml_app_timing", ML_DIR / "app.py")
    frozen = json.loads((HERE / "frozen" / "v4_hybrid_c10.json").read_bytes())["embedding"]
    model = SentenceTransformer(frozen["model"])
    times, reason = [], None
    for _ in range(3):
        t = time.perf_counter()
        reason = app.e5_mismatch(model, frozen)
        times.append(time.perf_counter() - t)
    return {"median_s": round(statistics.median(times), 2), "runs": [round(x, 2) for x in times],
            "result": "match" if reason is None else reason}


def markdown(result):
    lines = ["# V4 integration, end to end", "",
             "Synthetic warm-up query, the 58 dev queries and the 380 V4 training seeds; ids only. Seeds are "
             "training data: the route comparison is an equivalence check, not an accuracy claim. Nothing was "
             "tuned.", "",
             "## Startup, memory and latency", "",
             "| | Flag off | Flag on |", "|---|---|---|"]
    off, on = result["flag_off"], result["flag_on"]
    rows = [("ml_service startup (s)", off["startup"]["ml_service_s"], on["startup"]["ml_service_s"]),
            ("gateway startup (s)", off["startup"]["gateway_s"], on["startup"]["gateway_s"]),
            ("ml_service memory after startup (MB)", off["memory_after_startup"]["ml_service_mb"],
             on["memory_after_startup"]["ml_service_mb"]),
            ("ml_service memory after queries (MB)", off["memory_after_queries"]["ml_service_mb"],
             on["memory_after_queries"]["ml_service_mb"]),
            ("gateway memory after queries (MB)", off["memory_after_queries"]["gateway_mb"],
             on["memory_after_queries"]["gateway_mb"]),
            ("first request (ms)", off["first_request_ms"], on["first_request_ms"]),
            ("dev queries, median (ms)", off["latency_dev"]["median_ms"], on["latency_dev"]["median_ms"]),
            ("dev queries, 95th percentile (ms)", off["latency_dev"]["p95_ms"], on["latency_dev"]["p95_ms"]),
            ("dev queries, max (ms)", off["latency_dev"]["max_ms"], on["latency_dev"]["max_ms"])]
    lines += [f"| {name} | {a} | {b} |" for name, a, b in rows]
    e5 = result["e5_tensor_check"]
    lines += ["", f"e5 tensor check at startup (flag on only): median {e5['median_s']} s over 3 runs; result: "
                  f"{e5['result']}.", "",
              "The flag-off run goes first, so it starts from a colder disk cache: its startup and first request "
              "include that, and the startup difference between the two runs is not the cost of V4. The e5 "
              "tensor check above is the measured startup cost V4 adds.", "",
              "## Route equivalence with triage_sim (flag on)", "",
              "| Set | Compared | Matching | Mismatch reasons |", "|---|---|---|---|"]
    for name in ("dev", "seeds"):
        eq = result["equivalence"][name]
        lines.append(f"| {name} | {eq['compared']} | {eq['matching']} | {eq['mismatch_reasons'] or 'none'} |")
    for name in ("dev", "seeds"):
        mm = result["equivalence"][name]["mismatches"]
        if mm:
            lines += ["", f"{name} mismatches (id: live / triage_sim, reason):", ""]
            lines += [f"- {m['id']}: {m['live']} / {m['sim']}, {m['reason']}" for m in mm]
    env = result["environment"]
    lines += ["", f"Machine: {env['machine']}; Python {env['python']}; Node {env['node']}; git {env['git']}."]
    return "\n".join(lines) + "\n"


def main():
    devs, seeds = dev_items(), seed_items()
    off, _ = run(False, devs, seeds)
    on, replies = run(True, devs, seeds)
    result = {
        "flag_off": off,
        "flag_on": on,
        "e5_tensor_check": e5_check_seconds(),
        "equivalence": {"dev": equivalence(replies, devs), "seeds": equivalence(replies, seeds)},
        "statuses_not_200": sorted(i for i, r in replies.items() if r["status"] != 200),
        "environment": {
            "machine": platform.processor() or platform.machine(), "python": platform.python_version(),
            "node": subprocess.run(["node", "--version"], capture_output=True, text=True).stdout.strip(),
            "git": subprocess.run(["git", "-C", str(REPO), "rev-parse", "--short", "HEAD"], capture_output=True,
                                  text=True).stdout.strip()},
    }
    OUT.with_suffix(".json").write_text(json.dumps(result, indent=1) + "\n", encoding="utf-8", newline="\n")
    md = markdown(result)
    OUT.with_suffix(".md").write_text(md, encoding="utf-8", newline="\n")
    print(md)
    return 0


if __name__ == "__main__":
    sys.exit(main())
