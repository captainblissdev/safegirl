import { ArrowRightIcon, LockIcon, PlusIcon, ShieldIcon } from "./Icons";

/**
 * Session Start / Disclaimer screen.
 *
 * Satisfies FR-05 by appearing before any query is processed and
 * NFR-04 by providing no login or account-creation option.
 *
 * Layout follows the approved wireframe; the privacy line differs on
 * purpose (see docs/design/ui-comparison.md).
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
            <span className="icon-circle">
              <ShieldIcon />
            </span>
            You&apos;re safe here, no login needed
          </li>

          <li>
            <span className="icon-circle">
              <LockIcon />
            </span>
            We don&apos;t save your questions or your answers.
          </li>

          <li>
            <span className="icon-circle">
              <PlusIcon />
            </span>
            We&apos;re here to help, but a doctor or nurse can too.
          </li>
        </ul>
      </section>

      <button className="btn-primary" type="button" onClick={onContinue}>
        Continue <ArrowRightIcon size={20} />
      </button>
    </main>
  );
}
