# Accessibility and performance evidence (redesign step 9)

Measured on 20 October 2026, branch `fix/ui-redesign`, on a production
build served by `vite preview`, with the live gateway (`AUTH_DISABLED=true`
on the command line, relevance gate on, thresholds unchanged) and
`ml_service` (checkpoint v3). Synthetic queries only. Firebase anonymous
sign-in was answered in the test browser with a synthetic token; no
request reached Google.

## Tools and versions

| Tool | Version | Used for |
|---|---|---|
| Chrome (headless) | 155.0.8059.80 | every check |
| puppeteer-core | 23.11.1 | driving the browser, scripted checks |
| axe-core | 4.10.2 (devDependency of `app/interface`) | WCAG 2.0, 2.1, 2.2 A/AA and best-practice rules |
| Lighthouse | 12.3.0 | performance, accessibility, best practices, SEO (mobile defaults: simulated throttling, mobile emulation) |
| Lighthouse | 11.7.1 | the PWA (installable) checks, which 12 removed |
| Node.js | v24.18.1 | scripts |

Scripts: `scripts/a11y-check.mjs` and `scripts/lighthouse.mjs` (they need
puppeteer-core and Lighthouse installed beside them; neither is a
project dependency).

## Screens and queries

splash; Home; Help sheet; Topic list (STIs and HIV); answer (KB-S5, "Can
STIs be cured, and can they harm me if I leave them?"); clarify ("Am I
okay?"); held A ("the condom broke last night"), B ("how do I get rid of
the pregnancy"), C ("my period is late this month"); help ("Where can I
get help?"); referral ("someone touched me"); no answer ("can my dog eat
chocolate biscuits"); Talk to a person ("Am I okay?", "hmm", "Am I
okay?"); limited mode (the browser set offline, then "what is PrEP");
quick exit (behaviour only: there is no screen to scan).

## Results by screen

"Before fixes" is the first run, on commit `b801de1`
(`a11y-checks-before-fixes.json`); everything else is the final run, after
the step 9 fixes (`a11y-checks.json`).

| Screen | Tool | Width | Result | File |
|---|---|---|---|---|
| splash | axe-core 4.10.2 | 390px | pass, 0 violations | `axe/splash-390.json` |
| splash | axe-core 4.10.2 | 320px | pass, 0 violations | `axe/splash-320.json` |
| splash | scripted (puppeteer) | 390px | one h1: True; Tab reaches 3/3, focus ring on all: True, focus hidden: 0; targets under 44px: 0; live regions with reply text: 0 | `a11y-checks.json` |
| splash | scripted (puppeteer) | 200% zoom (195px) | horizontal scroll: False (before fixes: 195 in 195px); overlaps: 0; focus hidden: 0 | `zoom/splash-zoom200.png` |
| splash | scripted (puppeteer) | text-only 200% | horizontal scroll: False (before fixes: 390 in 390px); overlaps: 0; text that grew: 1 of 13 | `zoom/splash-text200.png` |
| home | axe-core 4.10.2 | 390px | pass, 0 violations | `axe/home-390.json` |
| home | axe-core 4.10.2 | 320px | pass, 0 violations | `axe/home-320.json` |
| home | scripted (puppeteer) | 390px | one h1: True; Tab reaches 9/9, focus ring on all: True, focus hidden: 0; targets under 44px: 0; live regions with reply text: 0 | `a11y-checks.json` |
| home | scripted (puppeteer) | 200% zoom (195px) | horizontal scroll: False (before fixes: 299 in 299px); overlaps: 0; focus hidden: 0 | `zoom/home-zoom200.png` |
| home | scripted (puppeteer) | text-only 200% | horizontal scroll: False (before fixes: 443 in 443px); overlaps: 0; text that grew: 8 of 21 | `zoom/home-text200.png` |
| help-sheet | axe-core 4.10.2 | 390px | pass, 0 violations | `axe/help-sheet-390.json` |
| help-sheet | axe-core 4.10.2 | 320px | pass, 0 violations | `axe/help-sheet-320.json` |
| help-sheet | scripted (puppeteer) | 390px | one h1: True; Tab reaches 10/10, focus ring on all: True, focus hidden: 0; targets under 44px: 0; live regions with reply text: 0 | `a11y-checks.json` |
| help-sheet | scripted (puppeteer) | 200% zoom (195px) | horizontal scroll: False (before fixes: 299 in 299px); overlaps: 0; focus hidden: 0 | `zoom/help-sheet-zoom200.png` |
| help-sheet | scripted (puppeteer) | text-only 200% | horizontal scroll: False (before fixes: 443 in 443px); overlaps: 0; text that grew: 26 of 43 | `zoom/help-sheet-text200.png` |
| topic-list | axe-core 4.10.2 | 390px | pass, 0 violations | `axe/topic-list-390.json` |
| topic-list | axe-core 4.10.2 | 320px | pass, 0 violations | `axe/topic-list-320.json` |
| topic-list | scripted (puppeteer) | 390px | one h1: True; Tab reaches 10/10, focus ring on all: True, focus hidden: 0; targets under 44px: 0; live regions with reply text: 0 | `a11y-checks.json` |
| topic-list | scripted (puppeteer) | 200% zoom (195px) | horizontal scroll: False (before fixes: 299 in 299px); overlaps: 0; focus hidden: 0 | `zoom/topic-list-zoom200.png` |
| topic-list | scripted (puppeteer) | text-only 200% | horizontal scroll: False (before fixes: 443 in 443px); overlaps: 0; text that grew: 9 of 15 | `zoom/topic-list-text200.png` |
| answer | axe-core 4.10.2 | 390px | pass, 0 violations | `axe/answer-390.json` |
| answer | axe-core 4.10.2 | 320px | pass, 0 violations | `axe/answer-320.json` |
| answer | scripted (puppeteer) | 390px | one h1: True; Tab reaches 8/8, focus ring on all: True, focus hidden: 0; targets under 44px: 0; live regions with reply text: 0 | `a11y-checks.json` |
| answer | scripted (puppeteer) | 200% zoom (195px) | horizontal scroll: False (before fixes: 299 in 299px); overlaps: 0; focus hidden: 0 | `zoom/answer-zoom200.png` |
| answer | scripted (puppeteer) | text-only 200% | horizontal scroll: False (before fixes: 443 in 443px); overlaps: 0; text that grew: 11 of 19 | `zoom/answer-text200.png` |
| clarify | axe-core 4.10.2 | 390px | pass, 0 violations | `axe/clarify-390.json` |
| clarify | axe-core 4.10.2 | 320px | pass, 0 violations | `axe/clarify-320.json` |
| clarify | scripted (puppeteer) | 390px | one h1: True; Tab reaches 9/9, focus ring on all: True, focus hidden: 0; targets under 44px: 0; live regions with reply text: 0 | `a11y-checks.json` |
| clarify | scripted (puppeteer) | 200% zoom (195px) | horizontal scroll: False (before fixes: 299 in 299px); overlaps: 0; focus hidden: 0 | `zoom/clarify-zoom200.png` |
| clarify | scripted (puppeteer) | text-only 200% | horizontal scroll: False (before fixes: 443 in 443px); overlaps: 0; text that grew: 9 of 18 | `zoom/clarify-text200.png` |
| held-a | axe-core 4.10.2 | 390px | pass, 0 violations | `axe/held-a-390.json` |
| held-a | axe-core 4.10.2 | 320px | pass, 0 violations | `axe/held-a-320.json` |
| held-a | scripted (puppeteer) | 390px | one h1: True; Tab reaches 7/7, focus ring on all: True, focus hidden: 0; targets under 44px: 0; live regions with reply text: 0 | `a11y-checks.json` |
| held-a | scripted (puppeteer) | 200% zoom (195px) | horizontal scroll: False (before fixes: 299 in 299px); overlaps: 0; focus hidden: 0 | `zoom/held-a-zoom200.png` |
| held-a | scripted (puppeteer) | text-only 200% | horizontal scroll: False (before fixes: 443 in 443px); overlaps: 0; text that grew: 9 of 15 | `zoom/held-a-text200.png` |
| held-b | axe-core 4.10.2 | 390px | pass, 0 violations | `axe/held-b-390.json` |
| held-b | axe-core 4.10.2 | 320px | pass, 0 violations | `axe/held-b-320.json` |
| held-b | scripted (puppeteer) | 390px | one h1: True; Tab reaches 7/7, focus ring on all: True, focus hidden: 0; targets under 44px: 0; live regions with reply text: 0 | `a11y-checks.json` |
| held-b | scripted (puppeteer) | 200% zoom (195px) | horizontal scroll: False (before fixes: 299 in 299px); overlaps: 0; focus hidden: 0 | `zoom/held-b-zoom200.png` |
| held-b | scripted (puppeteer) | text-only 200% | horizontal scroll: False (before fixes: 443 in 443px); overlaps: 0; text that grew: 9 of 15 | `zoom/held-b-text200.png` |
| held-c | axe-core 4.10.2 | 390px | pass, 0 violations | `axe/held-c-390.json` |
| held-c | axe-core 4.10.2 | 320px | pass, 0 violations | `axe/held-c-320.json` |
| held-c | scripted (puppeteer) | 390px | one h1: True; Tab reaches 7/7, focus ring on all: True, focus hidden: 0; targets under 44px: 0; live regions with reply text: 0 | `a11y-checks.json` |
| held-c | scripted (puppeteer) | 200% zoom (195px) | horizontal scroll: False (before fixes: 299 in 299px); overlaps: 0; focus hidden: 0 | `zoom/held-c-zoom200.png` |
| held-c | scripted (puppeteer) | text-only 200% | horizontal scroll: False (before fixes: 443 in 443px); overlaps: 0; text that grew: 9 of 15 | `zoom/held-c-text200.png` |
| help | axe-core 4.10.2 | 390px | pass, 0 violations | `axe/help-390.json` |
| help | axe-core 4.10.2 | 320px | pass, 0 violations | `axe/help-320.json` |
| help | scripted (puppeteer) | 390px | one h1: True; Tab reaches 8/8, focus ring on all: True, focus hidden: 0; targets under 44px: 0; live regions with reply text: 0 | `a11y-checks.json` |
| help | scripted (puppeteer) | 200% zoom (195px) | horizontal scroll: False (before fixes: 299 in 299px); overlaps: 0; focus hidden: 0 | `zoom/help-zoom200.png` |
| help | scripted (puppeteer) | text-only 200% | horizontal scroll: False (before fixes: 443 in 443px); overlaps: 0; text that grew: 8 of 17 | `zoom/help-text200.png` |
| referral | axe-core 4.10.2 | 390px | pass, 0 violations | `axe/referral-390.json` |
| referral | axe-core 4.10.2 | 320px | pass, 0 violations | `axe/referral-320.json` |
| referral | scripted (puppeteer) | 390px | one h1: True; Tab reaches 7/7, focus ring on all: True, focus hidden: 0; targets under 44px: 0; live regions with reply text: 0 | `a11y-checks.json` |
| referral | scripted (puppeteer) | 200% zoom (195px) | horizontal scroll: False (before fixes: 299 in 299px); overlaps: 0; focus hidden: 0 | `zoom/referral-zoom200.png` |
| referral | scripted (puppeteer) | text-only 200% | horizontal scroll: False (before fixes: 443 in 443px); overlaps: 0; text that grew: 7 of 16 | `zoom/referral-text200.png` |
| no-answer | axe-core 4.10.2 | 390px | pass, 0 violations | `axe/no-answer-390.json` |
| no-answer | axe-core 4.10.2 | 320px | pass, 0 violations | `axe/no-answer-320.json` |
| no-answer | scripted (puppeteer) | 390px | one h1: True; Tab reaches 9/9, focus ring on all: True, focus hidden: 0; targets under 44px: 0; live regions with reply text: 0 | `a11y-checks.json` |
| no-answer | scripted (puppeteer) | 200% zoom (195px) | horizontal scroll: False (before fixes: 299 in 299px); overlaps: 0; focus hidden: 0 | `zoom/no-answer-zoom200.png` |
| no-answer | scripted (puppeteer) | text-only 200% | horizontal scroll: False (before fixes: 443 in 443px); overlaps: 0; text that grew: 9 of 19 | `zoom/no-answer-text200.png` |
| person | axe-core 4.10.2 | 390px | pass, 0 violations | `axe/person-390.json` |
| person | axe-core 4.10.2 | 320px | pass, 0 violations | `axe/person-320.json` |
| person | scripted (puppeteer) | 390px | one h1: True; Tab reaches 10/10, focus ring on all: True, focus hidden: 0; targets under 44px: 0; live regions with reply text: 0 | `a11y-checks.json` |
| person | scripted (puppeteer) | 200% zoom (195px) | horizontal scroll: False (before fixes: 299 in 299px); overlaps: 0; focus hidden: 0 | `zoom/person-zoom200.png` |
| person | scripted (puppeteer) | text-only 200% | horizontal scroll: False (before fixes: 443 in 443px); overlaps: 0; text that grew: 10 of 16 | `zoom/person-text200.png` |
| limited-mode | axe-core 4.10.2 | 390px | pass, 0 violations | `axe/limited-mode-390.json` |
| limited-mode | axe-core 4.10.2 | 320px | pass, 0 violations | `axe/limited-mode-320.json` |
| limited-mode | scripted (puppeteer) | 390px | one h1: True; Tab reaches 5/5, focus ring on all: True, focus hidden: 0; targets under 44px: 0; live regions with reply text: 0 | `a11y-checks.json` |
| limited-mode | scripted (puppeteer) | 200% zoom (195px) | horizontal scroll: False (before fixes: 299 in 299px); overlaps: 0; focus hidden: 0 | `zoom/limited-mode-zoom200.png` |
| limited-mode | scripted (puppeteer) | text-only 200% | horizontal scroll: False (before fixes: 443 in 443px); overlaps: 0; text that grew: 12 of 12 | `zoom/limited-mode-text200.png` |

**Keyboard, Help sheet and quick exit** (final run): focus moves into the
Help sheet: True; Tab stays inside it (it is modal):
True; Escape closes it: True, and focus
returns to the `btn-help` button; then Escape twice exits to
`https://www.google.com/`. Exit from an answer replaces the page with
`https://www.google.com/`. No control has a positive `tabindex`, CSS `order` or a
reversed flex direction, so Tab order is DOM order.

**Reduced motion:** with `prefers-reduced-motion: reduce`, no animation
or transition runs on the splash, while a reply loads, or on the clarify
screen with its sparkle (0, 0, 0). Without it, only the three loading
dots animate.

**Structure:** one h1 and one `main` on every screen, one `header`
(none on the splash, which has its own Exit), no `nav`. The ask bar is
named "Type your question" (Home), "Ask something else" (Topic list and
reply screens) or "Ask a question" (the plain view). `html lang="en"`.

**Live regions:** one polite region, outside the screens, says "New
answer." or "New reply: …" once per reply; it never holds reply text.
In limited mode the offline banner is also a status region.

**Phone links:** every `tel:` link's accessible name names the service,
read from Chrome's accessibility tree, for example "1195, GBV helpline",
"Call 116, Childline Kenya", "999, Emergency", "Call 1195 GBV helpline.
For violence or abuse." (before the fixes the bare-number links were
named only "1195", "999", "112", "Call 1195", "Call 116").

**Contrast:** all 109 token pairs in `styles/tokens.test.ts` pass, listed
with their ratios in `contrast.txt`. The lowest: topic tile edges 3.02 to
3.09, control border 3.10, clarify topic button edge 3.45, topic pill
edge 3.68, 116 button edge 3.80 (all edges, 3:1 needed); the rose heart
on the splash tile 3.86 (graphic); white on the splash glass 4.52 and
orchid text 4.55 (text, 4.5:1 needed). axe reports colour contrast as
"incomplete" on gradients and translucent surfaces, which it cannot
resolve; those pairs are the ones calculated from the tokens.

## Lighthouse (mobile), three runs each, all reported

| Page | Tool and mode | Run | Performance | Accessibility | Best practices | SEO | PWA | Notes | Files |
|---|---|---|---|---|---|---|---|---|---|
| Home | lighthouse 12.3.0, navigation | 1 | 98 | 100 | 100 | 91 | – | FCP 1.8 s, LCP 2.0 s, TBT 0 ms, CLS 0.023 | `lighthouse/home-run1.report.{json,html}` |
| Answer | lighthouse 12.3.0, time span + snapshot | 1 | 100 (time span) | 100 | 100 | 80 | – | TBT 50 ms, CLS 0.002, INP 30 ms | `lighthouse/answer-flow-run1.report.{json,html}` |
| Home | lighthouse 11.7.1, PWA only | 1 | – | – | – | – | 100 | installable manifest, splash screen, themed omnibox, content width, viewport, maskable icon: all pass | `lighthouse/home-pwa-lh11-run1.report.{json,html}` |
| Home | lighthouse 12.3.0, navigation | 2 | 98 | 100 | 100 | 91 | – | FCP 1.8 s, LCP 2.0 s, TBT 0 ms, CLS 0.023 | `lighthouse/home-run2.report.{json,html}` |
| Answer | lighthouse 12.3.0, time span + snapshot | 2 | 100 (time span) | 100 | 100 | 80 | – | TBT 50 ms, CLS 0.002, INP 30 ms | `lighthouse/answer-flow-run2.report.{json,html}` |
| Home | lighthouse 11.7.1, PWA only | 2 | – | – | – | – | 100 | installable manifest, splash screen, themed omnibox, content width, viewport, maskable icon: all pass | `lighthouse/home-pwa-lh11-run2.report.{json,html}` |
| Home | lighthouse 12.3.0, navigation | 3 | 98 | 100 | 100 | 91 | – | FCP 1.8 s, LCP 2.0 s, TBT 0 ms, CLS 0.023 | `lighthouse/home-run3.report.{json,html}` |
| Answer | lighthouse 12.3.0, time span + snapshot | 3 | 100 (time span) | 100 | 100 | 80 | – | TBT 60 ms, CLS 0.002, INP 30 ms | `lighthouse/answer-flow-run3.report.{json,html}` |
| Home | lighthouse 11.7.1, PWA only | 3 | – | – | – | – | 100 | installable manifest, splash screen, themed omnibox, content width, viewport, maskable icon: all pass | `lighthouse/home-pwa-lh11-run3.report.{json,html}` |

Notes:

- Home was loaded as a navigation with the splash already seen this
  session (the report's DOM holds Home's h1), so the scores are for Home.
- The answer screen cannot be loaded by URL, so it was measured as a
  user flow: a time span while asking (performance there covers only
  TBT, CLS and INP), then a snapshot of the answer screen (accessibility,
  best practices, SEO). A snapshot has no performance metrics; the
  report's performance value for it (0) is not a score and is left out.
- SEO 91 on Home and 80 on the snapshot: the one failing audit is
  `robots-txt` (audit UI-18, open). It weighs more in a snapshot, which
  runs fewer SEO audits.
- In every Lighthouse 12 run the "Largest Contentful Paint element"
  audit errored inside Lighthouse ("Cannot read properties of undefined
  (reading 'frame_sequence')"); the LCP time itself was measured.

## Not tested

- Real screen readers: NVDA, JAWS, VoiceOver (iOS, macOS), TalkBack.
  Names, roles and live regions were read from the DOM and Chrome's
  accessibility tree only.
- Real phones and tablets, and browsers other than Chrome (Safari,
  Firefox, Samsung Internet). Phones were emulated in desktop Chrome.
- Users, including users with disabilities: no usability or
  accessibility testing with people.
- Slow or flaky networks: Lighthouse's simulated throttling only; no
  measured 3G or offline-to-online transitions beyond the limited-mode
  screen.
- Voice control, switch access, Windows high-contrast or forced colours,
  and platform text scaling on Android or iOS (only Chrome's default font
  size was changed, for the text-only 200% check).
- The wide-screen layout (1024px and up) and the sign-in error state.
