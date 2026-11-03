/**
 * Splits a reply for display only: the first sentence becomes the h1 and
 * the rest a paragraph under it. The first sentence runs up to and
 * including the first ".", "?" or "!" that is followed by a space.
 * Nothing is added, removed or reordered:
 * first + " " + rest is always the original text. With no second
 * sentence, rest is null and the whole reply is the h1.
 */
export function splitReply(text: string): {
  first: string;
  rest: string | null;
} {
  const match = /[.?!] /.exec(text);
  if (!match) return { first: text, rest: null };
  const end = match.index + 1;
  return { first: text.slice(0, end), rest: text.slice(end + 1) };
}

/**
 * Splits off a text's last sentence, for display only (the held group C
 * callout, H2-B): it starts after the last ".", "?" or "!" that is
 * followed by a space. As with splitReply, nothing is added, removed or
 * reordered: head + " " + last is always the original text. With one
 * sentence only, there is nothing to split and the result is null.
 */
export function splitLastSentence(
  text: string,
): { head: string; last: string } | null {
  const matches = [...text.matchAll(/[.?!] /g)];
  if (matches.length === 0) return null;
  const end = (matches[matches.length - 1].index ?? 0) + 1;
  return { head: text.slice(0, end), last: text.slice(end + 1) };
}
