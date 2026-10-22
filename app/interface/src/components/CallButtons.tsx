import { contactNote, telHref, telName } from "../content/telHref";
import {
  CHILDLINE_KENYA,
  EMERGENCY_NUMBERS,
  GBV_HELPLINE,
} from "../offline/helpContent";
import { PhoneIcon } from "./Icons";

/**
 * Call buttons for the held-topic, help and referral replies: the GBV
 * helpline first, then Childline Kenya. Each is a tap-to-call link built
 * from the helpline constants, and its description is the constant's own
 * label and note (SUPPORT_SECTIONS); no number or wording is typed here.
 */

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
            <PhoneIcon size={surface === "support" ? 26 : 20} />
            <span className="call-button-text">
              <span className="call-button-number">Call {number}</span>
              <span className="call-button-note">{contactNote(number)}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * "In immediate danger? Call …", both emergency numbers from the
 * constants. With lead (the help and referral screens), the question is
 * bold and the numbers are plain text: the two buttons under the line
 * (EmergencyButtons) are the tap targets, so nothing is a link twice.
 */
export function EmergencyLine({ lead = false }: { lead?: boolean }) {
  const [first, second] = EMERGENCY_NUMBERS;
  if (lead) {
    return (
      <p className="emergency-line">
        <strong>In immediate danger?</strong> Call {first} or {second}.
      </p>
    );
  }
  return (
    <p className="emergency-line">
      In immediate danger? Call{" "}
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

/** Two tap-to-call buttons, one per emergency number, from the constants. */
export function EmergencyButtons() {
  return (
    <ul className="emergency-buttons">
      {EMERGENCY_NUMBERS.map((number) => (
        <li key={number}>
          <a
            className="emergency-button"
            href={telHref(number)}
            aria-label={telName(number)}
          >
            <PhoneIcon size={20} />
            {number}
          </a>
        </li>
      ))}
    </ul>
  );
}
