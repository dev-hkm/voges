const RISK_WEIGHT = { low: 1, medium: 2, high: 3 };

function normalize(value = '') {
  return String(value).toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function terms(value) {
  return new Set(normalize(value).split(' ').filter((word) => word.length >= 3));
}

function sourceText(pattern) {
  return [pattern.name, pattern.description, ...(pattern.script_examples || []), ...(pattern.red_flags || [])].join(' ');
}

/**
 * Deterministic advisory matching. The only banking-scam knowledge supplied to
 * this function is the reviewed luadao.json dataset; the algorithm deliberately
 * does not contain a second, hard-coded list of scam keywords.
 */
export function evaluateScamRisk(userRequest, knowledge = []) {
  const requestTerms = terms(userRequest);
  if (requestTerms.size === 0) return { level: 'none', matched_patterns: [], recommendation: '', verification_questions: [] };

  const documentFrequency = new Map();
  for (const pattern of knowledge) {
    for (const term of terms(sourceText(pattern))) documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
  }

  const matches = knowledge.map((pattern) => {
    const matchedTerms = [...requestTerms].filter((term) => terms(sourceText(pattern)).has(term) && (documentFrequency.get(term) || 0) <= Math.max(4, knowledge.length / 3));
    return { pattern, matchedTerms };
  }).filter(({ matchedTerms }) => matchedTerms.length >= 2)
    .sort((a, b) => (RISK_WEIGHT[b.pattern.risk_level] || 0) - (RISK_WEIGHT[a.pattern.risk_level] || 0) || b.matchedTerms.length - a.matchedTerms.length)
    .slice(0, 3);

  if (!matches.length) return { level: 'none', matched_patterns: [], recommendation: '', verification_questions: [] };

  const highest = matches.reduce((best, item) => Math.max(best, RISK_WEIGHT[item.pattern.risk_level] || 0), 0);
  const level = highest >= 3 ? 'high' : highest === 2 ? 'medium' : 'low';
  const matchedPatterns = matches.map(({ pattern, matchedTerms }) => ({
    id: pattern.id,
    name: pattern.name,
    category: pattern.category,
    risk_level: pattern.risk_level,
    matched_terms: matchedTerms,
    red_flags: (pattern.red_flags || []).slice(0, 2),
  }));
  const primary = matches[0].pattern;

  return {
    level,
    matched_patterns: matchedPatterns,
    recommendation: primary.assistant_safe_response || '',
    verification_questions: (primary.red_flags || []).slice(0, 2).map((flag) => `Can you confirm: ${flag}`),
  };
}
