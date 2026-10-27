"""Flag-off behaviour of ml_service, pinned before the V4 /triage work.

With V4_TRIAGE_ENABLED unset, /health, /openapi.json, /classify and
/retrieve must answer exactly as recorded in snapshots/flag_off.json
(status and body, byte for byte), and /triage must not exist. The
snapshot was recorded from the code before any V4 change, with the real
V3 checkpoint, knowledge base and e5 on this machine; float values can
differ on other hardware, so re-record there before relying on it.

Record (only when the flag-off behaviour is meant to change, with a
decision-log note):

    .venv/Scripts/python.exe -I ml_service/tests/test_flag_off_snapshots.py --record
"""

import json
import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tests import support  # noqa: E402


class FlagOffSnapshots(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app_module = support.load_app(flag=None)
        with TestClient(cls.app_module.app) as client:
            cls.captured = support.capture(client)

    def test_identical_to_snapshot(self):
        expected = json.loads(support.SNAPSHOT.read_text(encoding="utf-8"))
        self.assertEqual(len(self.captured), len(expected))
        for got, want in zip(self.captured, expected):
            self.assertEqual(got, want, want["request"])

    def test_triage_not_available(self):
        triage = [c for c in self.captured if c["request"] == "POST /triage"]
        self.assertEqual([c["status"] for c in triage], [404])


def record():
    module = support.load_app(flag=None)
    with TestClient(module.app) as client:
        captured = support.capture(client)
    support.SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
    support.SNAPSHOT.write_text(json.dumps(captured, indent=1, ensure_ascii=False) + "\n", encoding="utf-8",
                                newline="\n")
    print(f"recorded {len(captured)} responses")


if __name__ == "__main__":
    if "--record" in sys.argv:
        record()
    else:
        unittest.main()
