/** Junta classes do Tailwind ignorando as vazias ou desligadas. */
export function cx(...parts: readonly (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
