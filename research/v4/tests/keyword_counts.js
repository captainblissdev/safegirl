#!/usr/bin/env node
/**
 * Node side of the keyword-count comparison (test_keyword_parity.py).
 *
 * Reads a JSON array of {id, text} on stdin and writes
 * {keywords, items}: the gateway's KEYWORDS lists, and for each item the
 * matched keywords per class from KeywordBaselineClassifier.classify and
 * the text lowercased by JavaScript. KEYWORDS is not exported, so it is
 * read by evaluating the module source in a fresh function scope; the
 * classifier itself is used unchanged. The output goes to the Python
 * test only and is never printed.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const FILE = path.join(__dirname, "..", "..", "..", "app", "gateway", "src", "fallback", "keywordClassifier.js");
const { KeywordBaselineClassifier } = require(FILE);

function keywordLists() {
  const source = fs.readFileSync(FILE, "utf8");
  const scope = { exports: {} };
  // eslint-disable-next-line no-new-func
  return new Function("module", "exports", "require", `${source}\nreturn KEYWORDS;`)(scope, scope.exports, require);
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  const classifier = new KeywordBaselineClassifier();
  const items = JSON.parse(input).map(({ id, text }) => ({
    id,
    matched: classifier.classify(text).matchedKeywords,
    lower: text.toLowerCase(),
  }));
  process.stdout.write(JSON.stringify({ keywords: keywordLists(), items }));
});
