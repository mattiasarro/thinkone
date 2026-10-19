import type { Proposal } from "@/types/api";

export const UNCERTAIN = 0.8;
export type FieldKey = `parameter:${number}` | `key_date:${number}` | `party:${number}`;

export function uncertainKeys(p: Proposal): FieldKey[] {
  const keys: FieldKey[] = [];
  p.parameters.forEach((x, i) => { if (x.confidence < UNCERTAIN) keys.push(`parameter:${i}`); });
  p.key_dates.forEach((x, i) => { if (x.confidence < UNCERTAIN) keys.push(`key_date:${i}`); });
  p.parties.forEach((x, i) => { if (x.confidence < UNCERTAIN) keys.push(`party:${i}`); });
  return keys;
}
