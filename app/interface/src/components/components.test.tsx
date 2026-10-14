import { renderToStaticMarkup } from "react-dom/server";
import {
  CHILDLINE_KENYA,
  EMERGENCY_NUMBERS,
  GBV_HELPLINE,
} from "../offline/helpContent";
import AppHeader from "./AppHeader";
import SupportContent from "./SupportContent";

/**
 * Render tests for the interface components, using react-dom/server:
 * no browser and no DOM library.
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }

  console.log(`  PASS: ${message}`);
}

console.log("Test 1: the help options list every number from helpContent");
{
  const html = renderToStaticMarkup(<SupportContent />);

  for (const number of [...EMERGENCY_NUMBERS, GBV_HELPLINE, CHILDLINE_KENYA]) {
    assert(
      html.includes(`href="tel:${number}"`),
      `${number} is a tap-to-call link`,
    );
  }
  assert(
    html.includes("Go to a health facility"),
    "advises going to a health facility",
  );
  for (const title of [
    "Local health services",
    "Confidential helplines",
    "Emergency guidance",
  ]) {
    assert(html.includes(title), `has the "${title}" section`);
  }
  assert(
    !/verified/i.test(html),
    "says nothing about the numbers being verified",
  );
}

console.log("\nTest 2: the header has a standing 'Need help now?' button");
{
  const html = renderToStaticMarkup(<AppHeader />);

  assert(html.includes("Need help now?"), "the button is present");
  assert(
    html.includes('aria-haspopup="dialog"'),
    "it is announced as opening a dialog",
  );
  assert(!html.includes('role="dialog"'), "the panel starts closed");
}

console.log("\nAll component tests passed.");
