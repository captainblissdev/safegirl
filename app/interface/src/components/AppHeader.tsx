import { useEffect, useRef, useState } from "react";
import { CloseIcon, LogoMark } from "./Icons";
import SupportContent from "./SupportContent";

interface Props {
  /** Quick exit (quickExit.ts). */
  onExit: () => void;
}

/**
 * Header shown on every screen (AppShell): the gradient logo mark and the
 * "SafeGirl" wordmark, a Help button and an Exit button. Exit is always
 * visible and never in a menu.
 *
 * PLACEHOLDER until Step 3 of the redesign: Help still opens the existing
 * support panel (SupportContent). Step 3 replaces it with the Help sheet.
 */
export default function AppHeader({ onExit }: Props) {
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
        <span className="wordmark">
          Safe<span className="wordmark-girl">Girl</span>
        </span>
      </span>

      <div className="header-actions">
        <button
          ref={openButtonRef}
          className="btn-help"
          type="button"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(true)}
        >
          Help
        </button>

        <button className="btn-exit" type="button" onClick={onExit}>
          Exit
        </button>
      </div>

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
              <h2 id="help-dialog-title">Help</h2>
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
