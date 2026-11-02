import { SPLASH_HELPLINE, SPLASH_HELPLINE_TEXT } from "../content/uiText";
import { telHref, telName } from "../content/telHref";
import { GBV_HELPLINE } from "../offline/helpContent";
import { PhoneIcon } from "./Icons";

/**
 * The solid helpline button of the splash and Home: "In danger? Call
 * 1195 · free, 24 hours", a tap-to-call link built from the helpline
 * constant. The class sets its look (.splash-helpline, .home-helpline);
 * on narrow phones the separator dot is dropped and "free, 24 hours"
 * gets its own line.
 */
export default function HelplineButton({ className }: { className: string }) {
  return (
    <a
      className={className}
      href={telHref(GBV_HELPLINE)}
      aria-label={telName(GBV_HELPLINE, SPLASH_HELPLINE_TEXT)}
    >
      <PhoneIcon size={18} />
      <span>{SPLASH_HELPLINE.lead}</span>{" "}
      <strong>{SPLASH_HELPLINE.call}</strong>{" "}
      <span className="splash-helpline-dot" aria-hidden="true">
        ·
      </span>
      <span className="splash-helpline-tail">{SPLASH_HELPLINE.tail}</span>
    </a>
  );
}
