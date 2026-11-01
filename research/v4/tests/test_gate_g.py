"""Tests for the frozen gate (g) and its loader (gate_refit/gate_g.py):
the committed file matches its sidecar and G1's routing, and applying it
reproduces the in-sample decisions recorded at freezing on the 107
retrieved development items (gate_refit/frozen/gate_g_insample.csv)."""

import csv
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from tests.support import V4, load

gg = load("gate_refit/gate_g")
FROZEN = V4 / "gate_refit" / "frozen"
ROUTING_ID = "57c6a5b638ab24b22beacbf50a2e1d6ef5741ec7dd45eeb6ed583949452a418a"


class FrozenGateG(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.gate = gg.load()
        with open(FROZEN / "gate_g_insample.csv", encoding="utf-8", newline="") as f:
            cls.rows = list(csv.DictReader(f))

    def test_spec(self):
        self.assertEqual(self.gate.features, ["s1", "margin", "agree", "v4_p"])
        self.assertEqual(self.gate.routing, ROUTING_ID)
        self.assertEqual(self.gate.threshold, 0.5)
        self.assertEqual(self.gate.spec["knowledge_base"]["name"], "kb62")
        self.assertEqual(self.gate.spec["knowledge_base"]["embed_mode"], "question")

    def test_reproduces_in_sample_decisions(self):
        self.assertEqual(len(self.rows), self.gate.spec["training"]["retrieved_items"])
        decisions = [self.gate.serves(r, routing=ROUTING_ID) for r in self.rows]
        self.assertEqual(decisions, [r["serve"] == "1" for r in self.rows])
        self.assertEqual(sum(decisions), self.gate.spec["training"]["in_sample_serves"])
        for r in self.rows:
            self.assertAlmostEqual(self.gate.probability(r), float(r["p"]), places=12)

    def test_features(self):
        f = gg.features(0.9, 0.85, "sti", 0.7, "sti")
        self.assertAlmostEqual(f["margin"], 0.05)
        self.assertEqual((f["agree"], f["s1"], f["v4_p"]), (1.0, 0.9, 0.7))
        self.assertEqual(gg.features(0.9, 0.85, "sti", 0.7, "general")["agree"], 0.0)

    def test_refuses_other_routing(self):
        with self.assertRaises(gg.FrozenGateError):
            self.gate.serves(self.rows[0], routing="0" * 64)

    def test_refuses_changed_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            for name in ("gate_g.json", "gate_g.sha256"):
                shutil.copy(FROZEN / name, Path(tmp) / name)
            spec = json.loads((Path(tmp) / "gate_g.json").read_text(encoding="utf-8"))
            spec["decision"]["threshold"] = 0.4
            (Path(tmp) / "gate_g.json").write_text(json.dumps(spec, indent=1) + "\n", encoding="utf-8")
            with self.assertRaises(gg.FrozenGateError):
                gg.load(Path(tmp) / "gate_g.json")


if __name__ == "__main__":
    unittest.main()
