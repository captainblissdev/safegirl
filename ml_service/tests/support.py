"""Shared setup for the ml_service tests: start the real app in-process
(V3 checkpoint, knowledge base, e5) with a chosen V4_TRIAGE_ENABLED value,
and the synthetic requests the snapshots use.

Each call to load_app imports app.py as a fresh module, because the flag
is read at import time. Run from the repository root:

    .venv/Scripts/python.exe -I -m unittest discover -s ml_service/tests -t ml_service
"""

import importlib.util
import os
import sys
import uuid
from pathlib import Path

ML = Path(__file__).resolve().parents[1]
REPO = ML.parent
SNAPSHOT = ML / "tests" / "snapshots" / "flag_off.json"

# Author-written synthetic queries; none comes from a user, a test set or
# the sealed set.
QUERIES = [
    "how do condoms work",
    "can i get pregnant if i have sex on my period",
    "what are the signs of an sti",
    "where can i find a youth friendly clinic",
    "is it normal to have cramps before my period",
    "what is the weather tomorrow",
    "am i okay",
]

# (method, path, json body) for each snapshotted request, in order.
REQUESTS = (
    [("get", "/health", None), ("get", "/openapi.json", None)]
    + [("post", "/classify", {"text": q}) for q in QUERIES]
    + [("post", "/retrieve", {"query": q}) for q in QUERIES]
    + [("post", "/retrieve", {"query": QUERIES[0], "intent": "contraception", "top_k": 2})]
    + [
        ("post", "/classify", {"text": "   "}),
        ("post", "/classify", {"text": ""}),
        ("post", "/classify", {"text": "a" * 2001}),
        ("post", "/retrieve", {"query": "test", "intent": "out_of_scope"}),
        ("post", "/retrieve", {"query": "test", "top_k": 11}),
        ("post", "/triage", {"text": QUERIES[0]}),
    ]
)


def load_app(flag=None):
    """Import ml_service/app.py as a new module with V4_TRIAGE_ENABLED set
    to flag (None = unset). Returns the module."""
    os.environ["MODEL_DIR"] = str(ML / "final")
    os.environ["KB_PATH"] = str(ML / "knowledge_base.json")
    if flag is None:
        os.environ.pop("V4_TRIAGE_ENABLED", None)
    else:
        os.environ["V4_TRIAGE_ENABLED"] = flag
    if str(ML) not in sys.path:
        sys.path.insert(0, str(ML))
    name = f"ml_app_{uuid.uuid4().hex}"
    spec = importlib.util.spec_from_file_location(name, ML / "app.py")
    module = importlib.util.module_from_spec(spec)
    # Pydantic resolves the app's annotations through sys.modules.
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def capture(client):
    """[{request, status, body}] for every snapshotted request; body is the
    exact response text."""
    out = []
    for method, path, body in REQUESTS:
        response = client.get(path) if method == "get" else client.post(path, json=body)
        out.append({"request": f"{method.upper()} {path}", "status": response.status_code,
                    "body": response.content.decode("utf-8")})
    return out
