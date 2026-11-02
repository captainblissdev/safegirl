import * as React from "react";
import type { ReactElement, ReactNode } from "react";

/**
 * Test helpers for the interface's component tests, which have no DOM
 * library: call a component with a minimal stand-in for React's hooks
 * (useState, useRef, useEffect), walk the elements it returns, call its
 * handlers as a tap would, and record every browser-storage write.
 */

export type AnyElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

/**
 * Calls the component as a function with stand-in hooks. State and refs
 * persist across renders of the same harness; effects are not run (as on
 * the server). Child components are not rendered: they stay elements,
 * whose props can be read and called. Returns a render function.
 */
export function harness<P extends object>(
  component: (props: P) => unknown,
  props: P,
) {
  const internals = (
    React as unknown as {
      __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: {
        ReactCurrentDispatcher: { current: unknown };
      };
    }
  ).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  const slots: unknown[] = [];
  let cursor = 0;
  const dispatcher = {
    useState: (initial: unknown) => {
      const i = cursor++;
      if (!(i in slots)) {
        slots[i] =
          typeof initial === "function"
            ? (initial as () => unknown)()
            : initial;
      }
      const set = (next: unknown) => {
        slots[i] =
          typeof next === "function"
            ? (next as (current: unknown) => unknown)(slots[i])
            : next;
      };
      return [slots[i], set];
    },
    useRef: (initial: unknown) => {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { current: initial };
      return slots[i];
    },
    useEffect: () => undefined,
  };
  return (next: Partial<P> = {}) => {
    cursor = 0;
    const saved = internals.ReactCurrentDispatcher.current;
    internals.ReactCurrentDispatcher.current = dispatcher;
    try {
      return component({ ...props, ...next }) as AnyElement;
    } finally {
      internals.ReactCurrentDispatcher.current = saved;
    }
  };
}

/** Every element in the tree (the component's own markup). */
export function elements(node: ReactNode): AnyElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement(node)) return [];
  const el = node as AnyElement;
  return [el, ...elements(el.props.children)];
}

export const byClass = (tree: AnyElement, name: string) =>
  elements(tree).filter((el) => el.props.className === name);

export const textOf = (node: ReactNode): string =>
  Array.isArray(node)
    ? node.map(textOf).join("")
    : typeof node === "string"
      ? node
      : React.isValidElement(node)
        ? textOf((node as AnyElement).props.children)
        : "";

/** Recording fakes for every browser store, installed for fn. */
export function recordingStorage(fn: () => void): string[] {
  const writes: string[] = [];
  const store = (name: string) => ({
    getItem: () => null,
    setItem: (key: string) => writes.push(`${name}.setItem(${key})`),
    removeItem: (key: string) => writes.push(`${name}.removeItem(${key})`),
    clear: () => writes.push(`${name}.clear()`),
    key: () => null,
    length: 0,
  });
  const g = globalThis as Record<string, unknown>;
  const keys = ["localStorage", "sessionStorage", "indexedDB", "document"];
  const saved = keys.map((k) => [k, g[k]] as const);
  g.localStorage = store("localStorage");
  g.sessionStorage = store("sessionStorage");
  g.indexedDB = {
    open: (name: string) => writes.push(`indexedDB.open(${name})`),
    deleteDatabase: (name: string) => writes.push(`indexedDB.delete(${name})`),
  };
  g.document = {
    get cookie() {
      return "";
    },
    set cookie(value: string) {
      writes.push(`document.cookie=${value}`);
    },
  };
  try {
    fn();
  } finally {
    for (const [k, v] of saved) g[k] = v;
  }
  return writes;
}
