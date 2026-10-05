/** `candidate` é mais nova que `current`? Compara número a número (0.10.0 > 0.9.9). */
export function isNewer(candidate: string, current: string): boolean {
  const parse = (v: string) =>
    v
      .replace(/^v/, "")
      .split(".")
      .map((n) => Number.parseInt(n, 10) || 0);
  const a = parse(candidate);
  const b = parse(current);
  const length = Math.max(a.length, b.length);
  const diff = Array.from({ length }, (_, i) => (a[i] ?? 0) - (b[i] ?? 0)).find((d) => d !== 0);
  return (diff ?? 0) > 0;
}
