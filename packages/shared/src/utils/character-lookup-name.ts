// How Game Mode matches a generated card, a `who=` target or a stored sheet to a character by
// name. Shared so the setup wizard predicts the match exactly as the server will make it.
export function normalizeCharacterLookupName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}
