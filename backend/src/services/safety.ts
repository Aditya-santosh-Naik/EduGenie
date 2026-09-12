// Deterministic content gate for student queries.
//
// This used to ask the LLM to classify every query, which cost a full extra
// inference before each explanation and — on a small local model — rejected
// ordinary school topics ("blackhole", "World War II", "cell division").
// A keyword gate is instant, predictable, and does not block real coursework.

/** Phrases that describe carrying out harm, not learning about a subject. */
const BLOCKED_PATTERNS: RegExp[] = [
  /\bhow\s+to\s+(make|build|synthesi[sz]e|cook)\b.{0,30}\b(bomb|explosive|meth|methamphetamine|napalm|nerve\s+agent|poison|silencer)\b/i,
  /\b(build|make|construct)\s+a\s+(pipe\s+)?bomb\b/i,
  /\bhow\s+to\s+(kill|murder|stab|strangle|behead)\s+(someone|a\s+person|people|him|her|them)\b/i,
  /\bhow\s+to\s+(hurt|harm|injure)\s+(myself|yourself|someone)\b/i,
  /\b(commit|how\s+to)\s+suicide\b|\bkill\s+myself\b|\bend\s+my\s+life\b/i,
  /\bhow\s+to\s+(buy|make|cook|sell)\s+(meth|cocaine|heroin|fentanyl|lsd|mdma)\b/i,
  /\b(child|minor|underage)\s+(porn|sexual|nude)/i,
  /\bhow\s+to\s+(hack|ddos)\s+(into\s+)?(someone|my\s+school|a\s+bank|his|her|their)\b/i,
  /\bexplicit\s+sex\b|\bporn(ography)?\b|\bnudes?\b/i
];

/** Shown instead of a generic refusal so the student knows what to do next. */
const SELF_HARM = /\b(suicide|kill\s+myself|end\s+my\s+life|hurt\s+myself|self\s*-?\s*harm)\b/i;

export async function isSafe(input: string): Promise<{ safe: boolean; reason?: string }> {
  const query = input.trim();

  // An empty or trivially short query is not a safety problem.
  if (query.length < 2) return { safe: true };

  if (SELF_HARM.test(query)) {
    return {
      safe: false,
      reason:
        "If you're struggling, please talk to someone you trust or a local helpline. " +
        "I'm not the right place for this, but you deserve real support."
    };
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(query)) {
      return { safe: false, reason: 'This topic is outside what EduGenie can teach.' };
    }
  }

  // Everything else — including biology, history, chemistry, war, disease and
  // other subjects taught in school — is allowed.
  return { safe: true };
}
