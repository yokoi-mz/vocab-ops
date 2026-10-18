export function normalizeLemma(lemma: string): string {
  return lemma
    .normalize("NFC")
    .toLowerCase()
    .replace(/[’`´]/g, "'")
    .replace(/[¡!¿?.,;:"«»“”()]/g, "")
    .replace(/-+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}
