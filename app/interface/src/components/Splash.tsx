import { useState } from "react";
import {
  greetingFor,
  SPLASH_HELPLINE,
  SPLASH_HELPLINE_TEXT,
  SPLASH_TOPIC_STARTERS,
} from "../content/uiText";
import { telHref, telName } from "../content/telHref";
import { GBV_HELPLINE } from "../offline/helpContent";
import {
  ArrowRightIcon,
  CloseIcon,
  InfoIcon,
  LockIcon,
  PhoneIcon,
  ShieldHeartMark,
  SmallLockIcon,
} from "./Icons";

/**
 * Splash: the once-per-session privacy and safety disclaimer (FR-05),
 * shown before any query (see splashSession.ts). A full-bleed screen of
 * its own, with no app header and no Help button. Its Quick exit pill
 * behaves as before; double Escape works here too (App listens on the
 * window on every screen).
 *
 * English only. The greeting follows the device clock (wording only).
 * The topic chips are a convenience: see SPLASH_TOPIC_STARTERS.
 *
 * A dark surface (.surface-dark): white focus ring. Every text pair is
 * checked against the gradient in styles/tokens.test.ts. It makes no
 * claim that content is clinician reviewed.
 */

/** A small page icon for the "Guided by MoH and WHO" promise. */
function DocumentIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4" />
      <path d="M10 12h5" />
      <path d="M10 16h5" />
    </svg>
  );
}

/** One five-petal flower, centred at (x, y), petals of radius r. */
function Flower({
  x,
  y,
  r,
  tone,
}: {
  x: number;
  y: number;
  r: number;
  tone: "pink" | "white";
}) {
  // Five petals, 72 degrees apart (computed: the source types no 3-digit run).
  const petals = [0, 1, 2, 3, 4].map((i) => i * 72);
  return (
    <g
      className={`splash-flower splash-flower--${tone}`}
      transform={`translate(${x} ${y})`}
    >
      {petals.map((angle) => (
        <ellipse
          key={angle}
          cx={0}
          cy={-r}
          rx={r * 0.62}
          ry={r}
          transform={`rotate(${angle})`}
        />
      ))}
      <circle className="splash-flower-centre" r={r * 0.42} />
    </g>
  );
}

/** A cluster of three flowers: decoration only, never behind content. */
function Flowers({ where }: { where: "top" | "chips" }) {
  return (
    <svg
      className={`splash-flowers splash-flowers--${where}`}
      viewBox="0 0 80 96"
      aria-hidden="true"
      focusable="false"
    >
      <Flower x={50} y={30} r={15} tone="pink" />
      <Flower x={20} y={62} r={8} tone="white" />
      <Flower x={62} y={78} r={7} tone="pink" />
    </svg>
  );
}

interface Props {
  onContinue: () => void;
  /** Quick exit (quickExit.ts). */
  onExit: () => void;
  /** The time the greeting is worded for; defaults to now (tests pass one). */
  now?: Date;
}

export default function Splash({ onContinue, onExit, now }: Props) {
  const [isHowOpen, setIsHowOpen] = useState(false);
  const greeting = greetingFor(now ?? new Date());

  return (
    <main className="splash-screen surface-dark" aria-labelledby="splash-title">
      <div className="splash-decor" aria-hidden="true">
        <span className="splash-glow splash-glow--pink" />
        <span className="splash-glow splash-glow--light" />
      </div>

      <div className="splash-topbar">
        <button className="btn-exit-pill" type="button" onClick={onExit}>
          <CloseIcon size={18} /> Quick exit
        </button>
      </div>

      <div className="splash-head">
        <div className="splash-brand">
          <ShieldHeartMark variant="splash" size={56} />
          <p className="splash-wordmark">SafeGirl</p>
        </div>
        <p className="splash-greeting">{greeting}</p>
        <h1 id="splash-title" className="splash-headline">
          Honest answers. No judgment.
        </h1>
        <Flowers where="top" />
      </div>

      <ul className="splash-promises">
        <li>
          <span className="promise-icon">
            <LockIcon size={20} strokeWidth={2.2} />
          </span>
          <span>
            <strong>Anonymous.</strong> No name asked.
          </span>
        </li>
        <li>
          <span className="promise-icon">
            <DocumentIcon />
          </span>
          <span>
            <strong>Guided by</strong> MoH and WHO.
          </span>
        </li>
        <li>
          <span className="promise-icon">
            <InfoIcon size={20} strokeWidth={2.2} />
          </span>
          <span>
            <strong>Not a doctor.</strong> A nurse can help.
          </span>
        </li>
      </ul>

      <section className="splash-question" aria-labelledby="splash-question">
        <h2 id="splash-question" className="splash-question-title">
          What&apos;s on your mind today?
        </h2>
        <p className="splash-sub">Tap one to start, or skip.</p>
        <div className="splash-chips-row">
          <div className="splash-chips" role="group" aria-label="Topics">
            {SPLASH_TOPIC_STARTERS.map(({ label }) => (
              <button
                key={label}
                className="splash-chip"
                type="button"
                aria-pressed={false}
              >
                {label}
              </button>
            ))}
          </div>
          <Flowers where="chips" />
        </div>
      </section>

      <div className="splash-bottom">
        <p className="splash-lockline">
          <SmallLockIcon size={16} />
          <span>We don&apos;t store your questions.</span>
          <button
            className="splash-learn"
            type="button"
            aria-expanded={isHowOpen}
            aria-controls="splash-how"
            onClick={() => setIsHowOpen((open) => !open)}
          >
            Learn how
          </button>
        </p>
        <p id="splash-how" className="splash-how" hidden={!isHowOpen}>
          Your questions and answers stay in this tab&apos;s memory only. They
          are not saved on your phone or on our server, and they are gone when
          you close or refresh the page. You never give your name.
        </p>
        <button className="btn-splash" type="button" onClick={onContinue}>
          I understand, continue <ArrowRightIcon size={20} />
        </button>
        <a
          className="splash-helpline"
          href={telHref(GBV_HELPLINE)}
          aria-label={telName(GBV_HELPLINE, SPLASH_HELPLINE_TEXT)}
        >
          <PhoneIcon size={18} />
          <span>{SPLASH_HELPLINE.lead}</span>{" "}
          <strong>{SPLASH_HELPLINE.call}</strong>{" "}
          <span>{SPLASH_HELPLINE.tail}</span>
        </a>
      </div>
    </main>
  );
}
