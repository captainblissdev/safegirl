/**
 * SafeGirl -- held-topic patterns for the offline pipeline
 *
 * src/content/heldTopics.json is the one hand-written file of held-topic
 * patterns. The gateway reads it directly (src/heldTopics.js); this
 * script checks its form and copies the groups into the generated block
 * of the offline copy (app/interface/src/offline/queryRules.ts), so both
 * use the same patterns. A gateway test fails if the copy is out of date.
 *
 *     node scripts/build-held-topics.js           # write the offline copy
 *     node scripts/build-held-topics.js --check   # exit 1 if it is stale
 */

const fs = require("node:fs");
const path = require("node:path");

const SOURCE_FILE = path.join(
  __dirname,
  "..",
  "src",
  "content",
  "heldTopics.json",
);

const OFFLINE_FILE = path.join(
  __dirname,
  "..",
  "..",
  "interface",
  "src",
  "offline",
  "queryRules.ts",
);

const BLOCK_START = "// BEGIN GENERATED HELD TOPICS";
const BLOCK_END = "// END GENERATED HELD TOPICS";

// A single word, a phrase ("a b") or a word set ("a+b"), never mixed.
const PATTERN_FORM = /^[a-z0-9]+(( [a-z0-9]+)*|(\+[a-z0-9]+)*)$/;

/**
 * The groups of src/content/heldTopics.json as { id, patterns }. Throws
 * if a group lacks an id, name or criterion, or a pattern is malformed
 * or listed twice.
 */
function readHeldTopicGroups() {
  const { groups } = JSON.parse(fs.readFileSync(SOURCE_FILE, "utf8"));
  const seen = new Set();
  return groups.map((group) => {
    if (!group.id || !group.name || !group.criterion) {
      throw new Error(
        "Every held-topic group needs an id, a name and a criterion",
      );
    }
    for (const pattern of group.patterns) {
      if (!PATTERN_FORM.test(pattern)) {
        throw new Error(
          `Held-topic pattern not in normalised form: "${pattern}"`,
        );
      }
      if (seen.has(pattern)) {
        throw new Error(`Held-topic pattern listed twice: "${pattern}"`);
      }
      seen.add(pattern);
    }
    return { id: group.id, patterns: group.patterns };
  });
}

/** queryRules.ts source with its held-topic block holding these groups. */
function renderOffline(source, groups = readHeldTopicGroups()) {
  const start = source.indexOf(BLOCK_START);
  const end = source.indexOf(BLOCK_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`No generated held-topic block in ${OFFLINE_FILE}`);
  }
  const block = [
    `${BLOCK_START}: written by`,
    "// app/gateway/scripts/build-held-topics.js from",
    "// app/gateway/src/content/heldTopics.json; do not edit by hand.",
    "export const HELD_TOPIC_GROUPS: readonly HeldTopicGroup[] = [",
    ...groups.flatMap((group) => [
      "  {",
      `    id: "${group.id}",`,
      "    patterns: [",
      ...group.patterns.map((pattern) => `      "${pattern}",`),
      "    ],",
      "  },",
    ]),
    "];",
    "",
  ].join("\n");
  return source.slice(0, start) + block + source.slice(end);
}

function main(argv) {
  const source = fs.readFileSync(OFFLINE_FILE, "utf8");
  const text = renderOffline(source);

  if (argv.includes("--check")) {
    if (source !== text) {
      console.error(
        "The offline held-topic patterns are out of date. Run: node scripts/build-held-topics.js",
      );
      return 1;
    }
    console.log("The offline held-topic patterns are up to date.");
    return 0;
  }

  fs.writeFileSync(OFFLINE_FILE, text);
  const groups = readHeldTopicGroups();
  console.log(
    `Wrote ${groups.length} held-topic groups (${groups
      .map((group) => `${group.id}: ${group.patterns.length}`)
      .join(", ")} patterns) to the offline queryRules.ts`,
  );
  return 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = {
  readHeldTopicGroups,
  renderOffline,
  OFFLINE_FILE,
  SOURCE_FILE,
};
