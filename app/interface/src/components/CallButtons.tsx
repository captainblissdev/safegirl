import { telHref, telName } from "../content/telHref";
import {
  CHILDLINE_KENYA,
  EMERGENCY_NUMBERS,
  GBV_HELPLINE,
  SUPPORT_SECTIONS,
} from "../offline/helpContent";
import { PhoneIcon } from "./Icons";

/**
 * Call buttons for the held-topic, help and referral replies: the GBV
 * helpline first, then Childline Kenya. Each is a tap-to-call link built
 * from the helpline constants, and its description is the constant's own
 * label and note (SUPPORT_SECTIONS); no number or wording is typed here.
 */

/** The label and note SUPPORT_SECTIONS gives a number. */
function describe(number: string): string {
  const contact = SUPPORT_SECTIONS.flatMap((section) => section.contacts).find(
    (item) => item.numbers.includes(number),
  );
  return contact ? `${contact.label}. ${contact.note}` : "";
}

interface Props {
  /** "held": in the held screen's white card. "support": full width
   *  under the help or referral card. */
  surface: "held" | "support";
}

export default function CallButtons({ surface }: Props) {
  return (
    <ul className={`call-buttons call-buttons--${surface}`}>
      {[GBV_HELPLINE, CHILDLINE_KENYA].map((number, index) => (
        <li key={number}>
          <a
            className={`call-button ${index === 0 ? "call-button--main" : "call-button--second"}`}
            href={telHref(number)}
          >
            <PhoneIcon size={20} />
            <span className="call-button-text">
              <span className="call-button-number">Call {number}</span>
              <span className="call-button-note">{describe(number)}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * "In immediate danger? Call …", both emergency numbers from the
 * constants; with lead, the question is bold (same words).
 */
export function EmergencyLine({ lead = false }: { lead?: boolean }) {
  const [first, second] = EMERGENCY_NUMBERS;
  return (
    <p className="emergency-line">
      {lead ? <strong>In immediate danger?</strong> : "In immediate danger?"}{" "}
      Call{" "}
      <a href={telHref(first)} aria-label={telName(first)}>
        {first}
      </a>{" "}
      or{" "}
      <a href={telHref(second)} aria-label={telName(second)}>
        {second}
      </a>
      .
    </p>
  );
}
