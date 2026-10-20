/**
 * Query sets for the vague-query rule tests (vagueQuery.test.js) and the
 * offline parity test (offlineSafetyParity.test.js), read from the
 * repository rather than copied: the development set, the DR-04 test
 * set and the interface's example questions.
 */

const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const REPO = path.join(__dirname, "..", "..", "..", "..");

/** The vague test queries the rule must answer itself. */
const VAGUE_QUERIES = [
  "Am I okay?",
  "Is this normal?",
  "I feel strange",
  "Can I ask you something?",
  "I'm worried",
  "What should I do?",
  "Do I have it?",
  "hmm",
];

/** Minimal CSV reader: quoted fields, commas inside quotes, CRLF. */
function readCsv(file) {
  const rows = [];
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const fields = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && quoted && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = !quoted;
      } else if (ch === "," && !quoted) {
        fields.push(field);
        field = "";
      } else {
        field += ch;
      }
    }
    fields.push(field);
    rows.push(fields);
  }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const DEV_ROWS = readCsv(
  path.join(
    REPO,
    "resources",
    "eval",
    "retrieval_eval_set_labels_2026-10-15.csv",
  ),
);

/** All 58 development-set queries. */
const DEV_ALL = DEV_ROWS.map((row) => row.query);

/** The 35 development-set queries with a class label. */
const DEV_LABELLED = DEV_ROWS.filter(
  (row) => row.expected_class !== "none",
).map((row) => row.query);

/** The 31 DR-04 test queries. */
const DR04 = readCsv(
  path.join(REPO, "resources", "test", "independent_test_set.csv"),
).map((row) => row.text);

/** The 13 distinct example questions the interface offers. */
async function loadExampleQuestions() {
  const uiText = await import(
    pathToFileURL(
      path.join(REPO, "app", "interface", "src", "content", "uiText.ts"),
    ).href
  );
  return [
    ...new Set([
      ...uiText.TOPIC_EXAMPLES.map((example) => example.question),
      ...Object.values(uiText.SUGGESTIONS)
        .flat()
        .map((suggestion) => suggestion.question),
    ]),
  ];
}

module.exports = {
  DEV_ALL,
  DEV_LABELLED,
  DR04,
  VAGUE_QUERIES,
  loadExampleQuestions,
};
