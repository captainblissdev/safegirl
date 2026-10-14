import { useEffect, useRef, useState } from "react";
import { CloseIcon, LogoMark } from "./Icons";
import SupportContent from "./SupportContent";

/**
 * Header shown on every screen, with a standing "Need help now?" button.
 * The button opens a panel listing the help options, so they are always
 * one tap away, not only after the Safety Net flags a query.
 */
export default function AppHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const close = () => {
    setIsOpen(false);
    openButtonRef.current?.focus();
  };

  return (
    <header className="app-header">
      <span className="brand">
        <LogoMark />
        SafeGirl
      </span>

      <button
        ref={openButtonRef}
        className="btn-help"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
      >
        Need help now?
      </button>

      {isOpen && (
        <div className="help-overlay" onClick={close}>
          <div
            className="help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="help-dialog-head">
              <h2 id="help-dialog-title">Need help now?</h2>
              <button
                ref={closeButtonRef}
                className="btn-close"
                type="button"
                onClick={close}
                aria-label="Close help"
              >
                <CloseIcon size={20} />
              </button>
            </div>

            <SupportContent />
          </div>
        </div>
      )}
    </header>
  );
}
