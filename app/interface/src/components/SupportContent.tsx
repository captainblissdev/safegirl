import { SUPPORT_SECTIONS } from "../offline/helpContent";

/**
 * The help options shared by the "Need help now?" panel and the wide-screen
 * "Need more support?" panel. The numbers come from offline/helpContent.ts,
 * the module the referral messages use, so they are never duplicated.
 */
export default function SupportContent() {
  return (
    <div className="support-content">
      {SUPPORT_SECTIONS.map((section) => (
        <section key={section.title} className="support-section">
          <h3>{section.title}</h3>
          <ul>
            {section.contacts.map((contact) => (
              <li key={contact.label}>
                <span className="support-label">{contact.label}</span>
                {contact.numbers.length > 0 && (
                  <span className="support-numbers">
                    {contact.numbers.map((number, index) => (
                      <span key={number}>
                        {index > 0 && " or "}
                        <a href={`tel:${number}`}>{number}</a>
                      </span>
                    ))}
                  </span>
                )}
                <span className="support-note">{contact.note}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
