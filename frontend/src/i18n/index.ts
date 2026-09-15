import et, { type Locale } from "./et";

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Paths<T> = T extends string
  ? never
  : { [K in keyof T & string]: T[K] extends string ? K : Join<K, Paths<T[K]>> }[keyof T & string];

export type TKey = Paths<Locale>;
type Vars = Record<string, string | number | undefined | null>;

const locales: Record<string, Locale> = { et };
let current: Locale = et;

export function setLocale(code: string) {
  current = locales[code] ?? et;
}

function lookup(key: string): string | undefined {
  const parts = key.split(".");
  let node: unknown = current;
  for (const p of parts) {
    if (node && typeof node === "object" && p in (node as Record<string, unknown>)) node = (node as Record<string, unknown>)[p];
    else return undefined;
  }
  return typeof node === "string" ? node : undefined;
}

/** Translate a dotted key with optional `{var}` interpolation. Unknown keys fall back to the key itself. */
export function t(key: TKey, vars?: Vars): string {
  const raw = lookup(key) ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] === undefined || vars[k] === null ? "" : String(vars[k])));
}

/** Translate with a dynamic tail (e.g. enum values); falls back to the tail itself. */
export function tEnum(prefix: string, value: string | null | undefined): string {
  if (!value) return t("common.none");
  return lookup(`${prefix}.${value}`) ?? value;
}
