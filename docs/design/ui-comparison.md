# Interface vs the approved wireframes

The interface was re-themed on `feature/ui-theme` (14 October 2026) to
follow the approved SafeGirl wireframes: calm, warm, mobile-first, plain
English, purple and lavender, no alarm colours.

## The wireframes

![SafeGirl wireframes](ui-wireframes.png)

`docs/design/ui-wireframes.png` had not been added to the repository when
the re-theme was done, so the palette was not sampled from the image. It
uses the agreed starting values (primary gradient `#5b2fc7` to `#8b3fe0`,
deep text `#2a1457`, page `#f7f2ff`, lilac `#efe6fc`, border `#d9c9f3`,
white cards) and was refined by eye. Re-check it against the image once
it is added.

## The interface now

Taken from the production build at 390px (phone) and 1280px (desktop).

| Screen | 390px | 1280px |
|---|---|---|
| Session start / disclaimer | ![](screenshots/01-disclaimer-390.png) | ![](screenshots/01-disclaimer-1280.png) |
| Chat with a reply | ![](screenshots/02-chat-reply-390.png) | ![](screenshots/02-chat-reply-1280.png) |
| "Need help now?" panel | ![](screenshots/03-help-panel-390.png) | ![](screenshots/03-help-panel-1280.png) |
| Limited-mode notice | ![](screenshots/04-limited-mode-390.png) | ![](screenshots/04-limited-mode-1280.png) |
| Referral | ![](screenshots/05-referral-390.png) | ![](screenshots/05-referral-1280.png) |
| Session end | ![](screenshots/06-session-end-390.png) | ![](screenshots/06-session-end-1280.png) |

How they were taken: headless Chrome against `vite preview`, with
`ml_service` and a local gateway (authentication disabled). The answers
are real. Firebase anonymous sign-in was answered by a stub in the test
browser, because the local Firebase configuration was not available; the
limited-mode shots block `/api/query` to simulate an unreachable service.

## Deliberate differences from the wireframe

| What | Wireframe | Interface | Why |
|---|---|---|---|
| Greeting | "Hi, I'm here to listen. Ask me anything about your body, your health, or what's on your mind." | "Hi, I'm here to help. Ask me a question about your body or your health." plus "I can answer questions about contraception, STIs, pregnancy and periods. I'm not a doctor or a counsellor." | "Ask me anything" and "what's on your mind" invite emotional-support and crisis messages that SafeGirl cannot handle; the scope line sets expectations before the first question. See `docs/decision-log.md` (2026-10-14). |
| Privacy wording | "We don't keep anything after you leave" (disclaimer); "Nothing was saved" (session end) | "We don't save your questions or your answers." / "Your questions and answers were not saved." | The old lines were not literally true: an anonymous Firebase user ID and an SDK heartbeat do exist. The new lines were checked against everything that is stored. See `docs/decision-log.md` (2026-10-14). |
| "Need help now?" button | Help options appear only on the referral screen and, on wide screens, in the side panel | A "Need help now?" button in the header of every screen opens the help options | Help should be one tap away at any time, not only after the Safety Net flags a message, and on phones the side panel is not visible. |
| "Periods" chip | "General" | "Periods" | The chip's example question is about periods, and the greeting's scope line names periods. Only the label changed. See `docs/decision-log.md` (2026-10-14). |
| Limited-mode notice | Not in the wireframe | "Limited mode: I can't reach the full service right now, so this answer is general." above an answer from the offline fallback | Without it, a general offline answer looks like the full service's answer. It appears whenever the online request fails or times out. |
| Support options on the referral screen | Support options panel | The same panel as "Need help now?", from the same content module as the referral message | One source for the numbers, so the referral, the panel and the side panel can never disagree. The numbers are still unverified. |
