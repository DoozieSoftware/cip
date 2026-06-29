/** Minimal class-name joiner — replaces the need for `clsx`/`classnames`. */
export type ClassValue = string | number | false | null | undefined | ClassValue[];

export function cx(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const v of inputs) {
    if (!v && v !== 0) continue;
    if (Array.isArray(v)) {
      const inner = cx(...v);
      if (inner) out.push(inner);
    } else if (typeof v === 'string' || typeof v === 'number') {
      out.push(String(v));
    }
  }
  return out.join(' ');
}
