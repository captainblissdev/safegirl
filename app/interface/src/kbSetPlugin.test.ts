/**
 * Tests for the build-time knowledge-base set (kbSetPlugin.ts): no plugin
 * unless VITE_KB_SET is exactly "kb62", so the default build is unchanged;
 * with it, the two bundled copies are redirected to their kb62 files,
 * which hold the 62 approved entries and none of the 4 pending ones.
 *
 * Run: tsx src/kbSetPlugin.test.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { kb62Target, kbSetPlugin } from "../kbSetPlugin";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const PENDING = ["KB-C6", "KB-C14", "KB-S19", "KB-C22"];

function check(name: string, fn: () => void) {
  fn();
  console.log(`PASS: ${name}`);
}

check("no plugin by default or for any other value", () => {
  for (const value of [undefined, "", "62", "KB62", "kb21", "true"]) {
    assert.equal(kbSetPlugin(value, ROOT), null, String(value));
  }
});

check("a plugin for exactly kb62", () => {
  const plugin = kbSetPlugin("kb62", ROOT);
  assert.ok(plugin);
  assert.equal(plugin.name, "safegirl-kb-set-kb62");
});

check("redirects the two bundled copies, and nothing else", () => {
  assert.equal(
    kb62Target(ROOT, path.join(ROOT, "src", "offline", "Kbdata.json")),
    path.join(ROOT, "src", "offline", "Kbdata_kb62.json"),
  );
  assert.equal(
    kb62Target(ROOT, path.join(ROOT, "src", "content", "kbQuestions.json")),
    path.join(ROOT, "src", "content", "kbQuestions_kb62.json"),
  );
  assert.equal(
    kb62Target(ROOT, path.join(ROOT, "src", "offline", "pipeline.ts")),
    null,
  );
});

check("the kb62 copies hold the 62 approved entries", () => {
  const read = (rel: string): unknown =>
    JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
  const kbdata = Object.values(
    read("src/offline/Kbdata_kb62.json") as Record<string, { kbId: string }[]>,
  ).flat();
  const questions = (
    read("src/content/kbQuestions_kb62.json") as { questions: { id: string }[] }
  ).questions;
  assert.equal(kbdata.length, 62);
  assert.equal(questions.length, 62);
  for (const id of PENDING) {
    assert.ok(!kbdata.some((e) => e.kbId === id), id);
    assert.ok(!questions.some((q) => q.id === id), id);
  }
});

console.log("\nAll KB set plugin tests passed.");
