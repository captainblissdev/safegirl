import type { RefObject } from "react";
import { ASK_LABEL, ASK_SEND_NAME } from "../content/uiText";
import { ArrowUpIcon, SendIcon } from "./Icons";

/**
 * The ask bar: one labelled text input and a send button. The chat
 * renders exactly one: inside the hero on Home ("hero"), at the bottom
 * once the conversation has started ("bar"). Submitting always goes to
 * the chat's own send handler, so every question runs the full pipeline.
 */

interface Props {
  variant: "hero" | "bar";
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  placeholder: string;
  inputRef: RefObject<HTMLInputElement>;
  /** Overrides the variant's visible-to-screen-readers label. */
  label?: string;
}

const COPY = {
  hero: { label: ASK_LABEL, send: ASK_SEND_NAME },
  bar: { label: "Ask a question", send: "Send question" },
} as const;

export default function AskBar({
  variant,
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  inputRef,
  label,
}: Props) {
  const copy = COPY[variant];
  const field = (
    <>
      <input
        ref={inputRef}
        id="chat-input"
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onSubmit();
          }
        }}
        disabled={disabled}
        autoComplete="off"
      />

      <button
        className="btn-send"
        type="button"
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        aria-label={copy.send}
      >
        {variant === "hero" ? <ArrowUpIcon /> : <SendIcon />}
      </button>
    </>
  );

  return variant === "hero" ? (
    <div className="ask-card">
      <label className="ask-card-label" htmlFor="chat-input">
        {label ?? copy.label}
      </label>
      <div className="ask-field">{field}</div>
    </div>
  ) : (
    <div className="input-row">
      <label className="sr-only" htmlFor="chat-input">
        {label ?? copy.label}
      </label>
      {field}
    </div>
  );
}
