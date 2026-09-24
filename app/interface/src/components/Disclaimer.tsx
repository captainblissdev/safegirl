/**
 * Session Start / Disclaimer screen.
 *
 * Satisfies FR-05 by appearing before any query is processed and
 * NFR-04 by providing no login or account-creation option.
 *
 * The wording matches the current UI wireframe specification.
 */

interface Props {
  onContinue: () => void;
}

export default function Disclaimer({ onContinue }: Props) {
  return (
    <main className="screen">
      <section className="card" aria-labelledby="disclaimer-title">
        <h2 id="disclaimer-title">You&apos;re in a safe space</h2>

        <ul className="principle-list">
          <li>
            <span className="icon" aria-hidden="true">
              &#128274;
            </span>
            You&apos;re safe here — no login needed
          </li>

          <li>
            <span className="icon" aria-hidden="true">
              &#127793;
            </span>
            We don&apos;t keep anything after you leave
          </li>

          <li>
            <span className="icon" aria-hidden="true">
              &#10010;
            </span>
            We&apos;re here to help, but a doctor or nurse can too
          </li>
        </ul>
      </section>

      <button className="btn-primary" type="button" onClick={onContinue}>
        Continue &rarr;
      </button>
    </main>
  );
}
