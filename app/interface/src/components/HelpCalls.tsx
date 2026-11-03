import { contactNote, telHref, telName } from "../content/telHref";
import { GBV_HELP_SHEET_NOTE } from "../content/uiText";
import {
  CHILDLINE_KENYA,
  EMERGENCY_NUMBERS,
  GBV_HELPLINE,
} from "../offline/helpContent";
import { PhoneIcon } from "./Icons";

/**
 * The call buttons shared by the Help sheet and the referral screen
 * (HS1, RF1). Every number and tap-to-call link comes from the helpline
 * constants; none is typed here. The GBV note rests on Cindy's phone
 * check, recorded in docs/decision-log.md ("Quick exit"); the Childline
 * note is the SUPPORT_SECTIONS constant, word for word (the Childline
 * wording decision in docs/decision-log.md).
 */

/** The two emergency numbers: solid rose buttons, side by side. */
export function DangerCalls() {
  return (
    <div className="help-danger-calls">
      {EMERGENCY_NUMBERS.map((number) => (
        <a
          key={number}
          className="help-danger-call"
          href={telHref(number)}
          aria-label={telName(number, `Call ${number}`)}
        >
          <PhoneIcon size={20} />
          <span>Call {number}</span>
        </a>
      ))}
    </div>
  );
}

/** The GBV helpline, then Childline Kenya: white cards with a Call pill. */
export function HelplineCards() {
  const lines = [
    { number: GBV_HELPLINE, note: GBV_HELP_SHEET_NOTE },
    { number: CHILDLINE_KENYA, note: contactNote(CHILDLINE_KENYA) },
  ];
  return (
    <ul className="help-lines">
      {lines.map(({ number, note }) => (
        <li key={number} className="help-line">
          <span className="help-line-icon" aria-hidden="true">
            <PhoneIcon size={20} />
          </span>
          <span className="help-line-text">
            <span className="help-line-number">{number}</span>
            <span className="help-line-note">{note}</span>
          </span>
          <a
            className="help-line-call"
            href={telHref(number)}
            aria-label={telName(number, `Call ${number}`)}
          >
            Call
          </a>
        </li>
      ))}
    </ul>
  );
}
