/**
 * Rotation of Home's ask-pill placeholder. The placeholder is only a
 * placeholder: it is not a live region and screen readers do not hear it
 * change; the input keeps its own label. With reduced motion it never
 * rotates.
 */

export interface RotationDeps {
  /** How many examples there are. */
  count: number;
  /** Milliseconds between changes. */
  intervalMs: number;
  /** True when the device asks for reduced motion. */
  reducedMotion: boolean;
  /** Called with the index of the example to show. */
  onChange: (index: number) => void;
  setInterval: (callback: () => void, ms: number) => unknown;
  clearInterval: (handle: unknown) => void;
}

/**
 * Start rotating from example 0 to the next every intervalMs, wrapping
 * around. Returns a function that stops it. Does nothing when motion is
 * reduced or there is only one example.
 */
export function startPlaceholderRotation(deps: RotationDeps): () => void {
  if (deps.reducedMotion || deps.count < 2) {
    return () => undefined;
  }

  let index = 0;
  const handle = deps.setInterval(() => {
    index = (index + 1) % deps.count;
    deps.onChange(index);
  }, deps.intervalMs);

  return () => deps.clearInterval(handle);
}

/** True when the browser reports prefers-reduced-motion: reduce. */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
