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
