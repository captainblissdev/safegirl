import { telHref, telName } from "../content/telHref";
import { GBV_HELPLINE } from "../offline/helpContent";

/**
 * The global footer line, on every screen: the GBV helpline as a
 * tap-to-call link built from the helpline constant. On screens with the
 * ask bar it sits directly above the bar; elsewhere it closes the page.
 * Screens that carry the call buttons (held topic, help, referral) do
 * not show it.
 */
export default function DangerLine() {
  return (
    <p className="danger-line">
      In danger? Call{" "}
      <a href={telHref(GBV_HELPLINE)} aria-label={telName(GBV_HELPLINE)}>
        {GBV_HELPLINE}
      </a>
      , free and open 24 hours.
    </p>
  );
}
