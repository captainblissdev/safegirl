import { telHref, telName } from "../content/telHref";
import { DANGER_LINE_CALL_ABOVE } from "../content/uiText";
import { GBV_HELPLINE } from "../offline/helpContent";

/**
 * The global footer line, on every screen: the GBV helpline as a
 * tap-to-call link built from the helpline constant. On screens with the
 * ask bar it sits directly above the bar; elsewhere it closes the page.
 * On a reply that already shows the GBV call button, it points to that
 * button instead of repeating the number in the same view.
 */
export default function DangerLine({
  callButtonAbove = false,
}: {
  callButtonAbove?: boolean;
}) {
  if (callButtonAbove) {
    return <p className="danger-line">{DANGER_LINE_CALL_ABOVE}</p>;
  }
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
