import path from "node:path";
import type { Plugin } from "vite";

/**
 * Knowledge-base set for the bundled offline copy and Topic list.
 *
 * By default the app bundles src/offline/Kbdata.json and
 * src/content/kbQuestions.json (the 21-entry base) and this returns no
 * plugin at all, so the default build is unchanged. Only when the build
 * or dev server is started with VITE_KB_SET=kb62 in the environment are
 * those two imports redirected to Kbdata_kb62.json and
 * kbQuestions_kb62.json (the 62 approved entries), which sit next to
 * them. The sources keep importing the default files, so the tests always
 * see the 21-entry base.
 */
export const KB62_REDIRECTS: Readonly<Record<string, string>> = {
  [path.join("src", "offline", "Kbdata.json")]: path.join(
    "src",
    "offline",
    "Kbdata_kb62.json",
  ),
  [path.join("src", "content", "kbQuestions.json")]: path.join(
    "src",
    "content",
    "kbQuestions_kb62.json",
  ),
};

/** The redirect for a resolved module id, or null. */
export function kb62Target(root: string, id: string): string | null {
  const rel = path.relative(root, id.split("?")[0]);
  const target = KB62_REDIRECTS[rel];
  return target ? path.join(root, target) : null;
}

/** The plugin for this build: null unless kbSet is exactly "kb62". */
export function kbSetPlugin(
  kbSet: string | undefined,
  root: string,
): Plugin | null {
  if (kbSet !== "kb62") {
    return null;
  }
  return {
    name: "safegirl-kb-set-kb62",
    enforce: "pre",
    async resolveId(source, importer, options) {
      const resolved = await this.resolve(source, importer, {
        ...options,
        skipSelf: true,
      });
      const target = resolved && kb62Target(root, resolved.id);
      return target ?? null;
    },
  };
}
