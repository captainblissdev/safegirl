import { LeafIcon, RefreshIcon } from "./Icons";

/**
 * Session End screen.
 *
 * Satisfies FR-06.
 *
 * Starting a new session must fully reset the in-memory state
 * maintained by App.tsx, including the chat log and current screen.
 * No frontend session record is created or stored locally.
 */

interface Props {
  onStartNew: () => void;
}

export default function SessionEnd({ onStartNew }: Props) {
  return (
    <main className="screen">
      <section className="card card--end" aria-labelledby="session-end-title">
        <span className="icon-circle icon-circle--large">
          <LeafIcon size={32} />
        </span>

        <h1 id="session-end-title">Session ended.</h1>

        <p>Your questions and answers were not saved.</p>

        <p className="soft-note">
          Take care of yourself.
          <br />
          We&apos;re here whenever you need us.
        </p>
      </section>

      <button className="btn-primary" type="button" onClick={onStartNew}>
        Start new session <RefreshIcon size={20} />
      </button>
    </main>
  );
}
