// Admins can write rule patterns. A badly built pattern can hang the server, so these are refused.

const MAX_PATTERN_LENGTH = 300;
const NESTED_QUANTIFIER = /\((?:[^()\\]|\\.)*[+*}](?:[^()\\]|\\.)*\)\s*[+*{]/;
const BACKREFERENCE = /\\[1-9]/;
const REPEATED_ALTERNATION = /\((?:[^()\\]|\\.)*\|(?:[^()\\]|\\.)*\)\s*[+*{]/;

/** Says why a pattern can't be used, or null when it is fine. */
export function patternProblem(pattern: string, flags = "gi"): string | null {
  if (pattern.length > MAX_PATTERN_LENGTH) return `Keep patterns under ${MAX_PATTERN_LENGTH} characters.`;
  try {
    new RegExp(pattern, flags);
  } catch {
    return "That pattern isn't a valid regular expression.";
  }
  if (NESTED_QUANTIFIER.test(pattern) || REPEATED_ALTERNATION.test(pattern) || BACKREFERENCE.test(pattern)) {
    return "That pattern could make checks hang. Avoid repeats inside repeats, like (a+)+.";
  }
  return null;
}
