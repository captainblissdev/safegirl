import { useEffect, useRef } from "react";

/**
 * Focus a reply's h1 when it arrives (and again for each new reply, by
 * key). Used by the reply screens and the referral screen.
 */
export function useFocusOnArrival(key: string) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [key]);
  return ref;
}
