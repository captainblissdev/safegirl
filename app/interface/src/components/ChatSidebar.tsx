/**
 * Left sidebar for wide screens (CSS shows it from 1024px): a "New chat"
 * button and a reminder that the session is anonymous.
 */

interface Props {
  onNewChat: () => void;
}

export default function ChatSidebar({ onNewChat }: Props) {
  return (
    <aside className="chat-sidebar" aria-label="Session">
      <button className="btn-primary" type="button" onClick={onNewChat}>
        New chat
      </button>

      <section className="anon-card" aria-labelledby="anon-card-title">
        <h2 id="anon-card-title">You&apos;re anonymous</h2>
        <p>
          No login or account. We don&apos;t save your questions or your
          answers.
        </p>
      </section>
    </aside>
  );
}
