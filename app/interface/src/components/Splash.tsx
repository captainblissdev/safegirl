import DangerLine from "./DangerLine";
import { LogoMark } from "./Icons";

/**
 * Splash: the once-per-session privacy and safety disclaimer (FR-05),
 * shown before any query (see splashSession.ts). It replaces the earlier
 * disclaimer screen and keeps its privacy line ("We don't save your
 * questions or your answers.").
 *
 * A dark surface: everything on it is white (4.5:1 or more against both
 * ends of the plum-to-orchid gradient), and its focus ring is white
 * (.surface-dark). It makes no claim that content is clinician reviewed.
 */

interface Props {
  onContinue: () => void;
}

export default function Splash({ onContinue }: Props) {
  return (
    <main className="screen splash-screen">
      <section className="splash surface-dark" aria-labelledby="splash-title">
        <LogoMark size={64} />
        <h1 id="splash-title" className="splash-wordmark">
          SafeGirl
        </h1>
        <p className="splash-tagline">
          Honest answers about your body, health and growing up.
        </p>

        <ul className="splash-promises">
          <li>
            <strong>Anonymous.</strong> We never ask for your name.
          </li>
          <li>
            <strong>Real guidance.</strong> Answers come from Kenyan Ministry of
            Health and WHO sources.
          </li>
          <li>
            <strong>Not a doctor.</strong> This can&apos;t diagnose you. A nurse
            or clinic can.
          </li>
        </ul>

        <p className="splash-privacy">
          We don&apos;t save your questions or your answers.
        </p>

        <button className="btn-splash" type="button" onClick={onContinue}>
          I understand, continue
        </button>

        <DangerLine />
      </section>
    </main>
  );
}
