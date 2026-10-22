import { SOURCES_LINE } from "../content/uiText";
import DangerLine from "./DangerLine";
import {
  ArrowRightIcon,
  LockIcon,
  ShieldHeartMark,
  ShieldIcon,
  Sparkle,
  SpeechIcon,
} from "./Icons";

/**
 * Splash: the once-per-session privacy and safety disclaimer (FR-05),
 * shown before any query (see splashSession.ts). A full-bleed screen of
 * its own, with no app header and no Help button. It keeps the earlier
 * disclaimer's privacy line ("We don't save your questions or your
 * answers.") and has its own Exit pill; double Escape works here too
 * (App listens on the window on every screen).
 *
 * A dark surface (.surface-dark): white focus ring. Every text pair is
 * checked against the lightest part of the gradient, with the glows on
 * top, in styles/tokens.test.ts. It makes no claim that content is
 * clinician reviewed.
 */

interface Props {
  onContinue: () => void;
  /** Quick exit (quickExit.ts). */
  onExit: () => void;
}

export default function Splash({ onContinue, onExit }: Props) {
  return (
    <main className="splash-screen surface-dark" aria-labelledby="splash-title">
      <div className="splash-decor" aria-hidden="true">
        <span className="splash-glow splash-glow--rose" />
        <span className="splash-glow splash-glow--orchid" />
        <span className="splash-sparkle splash-sparkle--large">
          <Sparkle size={30} />
        </span>
        <span className="splash-sparkle splash-sparkle--small">
          <Sparkle size={18} />
        </span>
      </div>

      <button className="btn-exit-pill" type="button" onClick={onExit}>
        Exit
      </button>

      <div className="splash-top">
        <ShieldHeartMark variant="splash" size={84} />
        <h1 id="splash-title" className="splash-wordmark">
          SafeGirl
        </h1>
        <p className="splash-tagline">
          Honest answers about your body, health and growing up.
        </p>
      </div>

      <ul className="splash-promises">
        <li>
          <span className="promise-icon promise-icon--lock">
            <LockIcon size={22} strokeWidth={2.2} />
          </span>
          <span>
            <strong>Anonymous.</strong> We never ask for your name.
          </span>
        </li>
        <li>
          <span className="promise-icon promise-icon--speech">
            <SpeechIcon size={22} strokeWidth={2.2} />
          </span>
          <span>
            <strong>Real guidance.</strong> {SOURCES_LINE}
          </span>
        </li>
        <li>
          <span className="promise-icon promise-icon--shield">
            <ShieldIcon size={22} strokeWidth={2.2} />
          </span>
          <span>
            <strong>Not a doctor.</strong> This can&apos;t diagnose you. A nurse
            or clinic can.
          </span>
        </li>
      </ul>

      <div className="splash-bottom">
        <p className="splash-privacy">
          We don&apos;t save your questions or your answers.
        </p>
        <button className="btn-splash" type="button" onClick={onContinue}>
          I understand, continue <ArrowRightIcon size={20} />
        </button>
        <DangerLine />
      </div>
    </main>
  );
}
