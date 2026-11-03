/**
 * "Message someone I trust" on the referral screen (RF1): an sms: link
 * that opens the phone's messages app with a short message filled in and
 * no recipient, so she picks the person. Nothing is sent by SafeGirl and
 * nothing is stored; the link is only followed if she taps it.
 *
 * The form "sms:?&body=…" is the one that both Android and iOS read
 * (iOS takes "&body", Android "?body"; the empty query covers both).
 */

/** The message filled in, exactly. */
export const TRUSTED_MESSAGE_BODY = "Can you call me?";

/** The sms: link for a body, with no recipient. */
export function smsHref(body: string): string {
  return `sms:?&body=${encodeURIComponent(body)}`;
}

/** The referral screen's link: sms:?&body=Can%20you%20call%20me%3F */
export const TRUSTED_MESSAGE_HREF = smsHref(TRUSTED_MESSAGE_BODY);
