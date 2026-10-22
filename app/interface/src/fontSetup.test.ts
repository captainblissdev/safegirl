import { existsSync, readFileSync, statSync } from "node:fs";

/**
 * Guards the self-hosted Nunito setup: a Latin-only WOFF2 loaded with
 * font-display: swap from the app bundle (never from Google), precached by
 * the service worker, with its licence in the repository.
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }

  console.log(`  PASS: ${message}`);
}

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
const FONT = new URL(
  "./assets/fonts/nunito-latin-wght-normal.woff2",
  import.meta.url,
);
const LICENCE = new URL("./assets/fonts/Nunito-OFL.txt", import.meta.url);

console.log("Test 1: the font file is a Latin-subset WOFF2 in the repository");
{
  assert(existsSync(FONT), "the font file exists");
  const signature = readFileSync(FONT).subarray(0, 4).toString("latin1");
  assert(signature === "wOF2", "it is a WOFF2 file");
  assert(statSync(FONT).size < 60_000, "it is a small subset (under 60 kB)");
}

console.log("\nTest 2: the @font-face is self-hosted, swap, Latin-only");
{
  const css = read("./index.css");
  const face = /@font-face\s*\{[^}]*\}/.exec(css)?.[0] ?? "";

  assert(face.includes('font-family: "Nunito"'), "declares Nunito");
  assert(face.includes("font-display: swap"), "uses font-display: swap");
  assert(
    face.includes('url("./assets/fonts/nunito-latin-wght-normal.woff2")') &&
      face.includes('format("woff2")'),
    "loads the bundled WOFF2",
  );
  assert(face.includes("unicode-range"), "declares a Latin unicode-range");
  const weights = /font-weight:\s*(\d+)\s+(\d+);/.exec(face);
  assert(
    weights !== null && Number(weights[1]) <= 400 && Number(weights[2]) >= 900,
    "one variable file covers weights 400 to 900",
  );
  assert(
    !/fonts\.(googleapis|gstatic)\.com/.test(css + read("../index.html")),
    "nothing is loaded from Google Fonts",
  );
}

console.log("\nTest 3: the service worker precaches WOFF2 files");
{
  const config = read("../vite.config.ts");
  assert(
    /globPatterns:\s*\["[^"]*woff2[^"]*"\]/.test(config),
    "globPatterns includes woff2",
  );
}

console.log("\nTest 4: the font's licence is in the repository");
{
  assert(existsSync(LICENCE), "Nunito-OFL.txt exists");
  assert(
    read("./assets/fonts/Nunito-OFL.txt").includes("SIL Open Font License"),
    "it is the SIL Open Font License",
  );
}

console.log("\nAll font setup tests passed.");
