"""Loader for the frozen gate (g) (docs/decision-log.md, "Gate (g) frozen",
2026-11-01): a logistic gate on the unscoped top-1 score, the margin, the
agreement between V4's class and the class of the unscoped top-1 entry,
and V4's top probability, fitted by freeze_gate.py on KB-62 in question
embed mode under V4 triage routing.

The gate decides only for an item V4 sends to retrieval: it serves the
live entry when serves() is True and abstains otherwise. Nothing here is
wired into production.

    import gate_g
    gate = gate_g.load()
    gate.serves(gate_g.features(s1, s2, v4_class, v4_p, top1_class), routing=ROUTING_ID)
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
FROZEN = HERE / "frozen" / "gate_g.json"


class FrozenGateError(RuntimeError):
    pass


def _sha256(path: Path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def features(s1: float, s2: float, v4_class: str, v4_p: float, top1_class: str) -> dict:
    """The gate's inputs, as gate_refit.py builds them: s1 and s2 are the
    unscoped top-1 and top-2 cosine scores; top1_class is the class of the
    unscoped top-1 entry."""
    return {"s1": float(s1), "margin": float(s1) - float(s2), "agree": float(v4_class == top1_class),
            "v4_p": float(v4_p)}


class FrozenGate:
    def __init__(self, spec: dict):
        self.spec = spec
        m = spec["model"]
        self.features = list(spec["features"])
        self.mean, self.scale = np.array(m["mean"]), np.array(m["scale"])
        self.coef, self.intercept = np.array(m["coef"]), float(m["intercept"])
        self.threshold = float(spec["decision"]["threshold"])
        self.routing = spec["routing"]["id"]
        if not (len(self.features) == len(self.mean) == len(self.scale) == len(self.coef)):
            raise FrozenGateError("feature list and coefficients differ in length")

    def probability(self, row: dict) -> float:
        z = (np.array([float(row[f]) for f in self.features]) - self.mean) / self.scale
        return 1 / (1 + math.exp(-(float(z @ self.coef) + self.intercept)))

    def serves(self, row: dict, routing: str | None = None) -> bool:
        """True: serve the live entry; False: abstain. A routing id other
        than the one the gate was fitted under is refused."""
        if routing is not None and routing != self.routing:
            raise FrozenGateError(f"routing {routing[:12]} is not the gate's {self.routing[:12]}")
        return self.probability(row) >= self.threshold


def load(path: Path = FROZEN, sidecar: Path | None = None) -> FrozenGate:
    """Load the frozen gate after checking it against its .sha256 sidecar."""
    path = Path(path)
    sidecar = Path(sidecar) if sidecar else path.with_suffix(".sha256")
    if not sidecar.exists():
        raise FrozenGateError(f"no sidecar hash file {sidecar.name}")
    expected = sidecar.read_text(encoding="utf-8").split()[0]
    if _sha256(path) != expected:
        raise FrozenGateError(f"{path.name} does not match its sidecar hash")
    return FrozenGate(json.loads(path.read_bytes()))
