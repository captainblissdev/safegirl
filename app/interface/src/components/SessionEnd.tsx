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
      <section className="card" aria-labelledby="session-end-title">
        <div className="end-icon" aria-hidden="true">
          &#127793;
        </div>

        <h2 id="session-end-title">Session ended.</h2>

        <p>Nothing was saved on this device.</p>

        <p className="soft-note">
          Take care of yourself.
          <br />
          We&apos;re here whenever you need us.
        </p>
      </section>

      <button
        className="btn-primary"
        type="button"
        onClick={onStartNew}
      >
        Start new session &#8635;
      </button>
    </main>
  );
}