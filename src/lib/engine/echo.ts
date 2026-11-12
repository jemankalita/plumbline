// When the caption and the words on its image break the same rule with the same words, a person
// sees one finding, not two. The image copy is folded into the caption finding, which says so.

import type { Finding, Severity } from "../types";

/** Image findings about words on the picture are quoted like this by the vision pass. */
const IMAGE_TEXT = /^Text on the image: “([\s\S]+)”$/;
const RANK: Record<Severity, number> = { blocker: 0, warning: 1, suggestion: 2 };
const ECHO_NOTE = "The same words are on the image, so change them there too.";

/** Compares words, not case or punctuation: "Quick-Kart" and "QUICK KART" match. */
const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const keyOf = (citeId: string, words: string) => `${citeId}|${squash(words)}`;

function imageWords(f: Finding): string | null {
  if (f.start >= 0) return null;
  return IMAGE_TEXT.exec(f.quote)?.[1] ?? null;
}

export function mergeImageEchoes(findings: readonly Finding[]): Finding[] {
  const inText = new Map<string, Finding>();
  for (const f of findings) {
    if (f.start >= 0) inText.set(keyOf(f.cites.id, f.quote), f);
  }

  // For each caption finding with a twin on the image, remember the most serious severity of the pair.
  const echoed = new Map<string, Severity>();
  const kept = findings.filter((f) => {
    const words = imageWords(f);
    if (words === null) return true;
    const twin = inText.get(keyOf(f.cites.id, words));
    if (!twin) return true;
    const worst = echoed.get(twin.id) ?? twin.severity;
    echoed.set(twin.id, RANK[f.severity] < RANK[worst] ? f.severity : worst);
    return false;
  });

  return kept.map((f) => {
    const severity = echoed.get(f.id);
    return severity ? { ...f, severity, message: `${f.message} ${ECHO_NOTE}` } : f;
  });
}
