export function inferIntentFromText(text) {
  if (!text || typeof text !== 'string') return 'balanced';
  const t = text.toLowerCase();

  const debugKeywords = ['fix', 'bug', 'error', 'crash', 'fail', 'fixes', 'debug', 'bugfix', 'issue'];
  const refactorKeywords = ['refactor', 'clean', 'restructure', 'reorganize', 'simplify', 'architecture'];
  const qualityKeywords = ['optimize', 'performance', 'secure', 'security', 'tests', 'test', 'robust', 'maintain'];
  const speedKeywords = ['fast', 'quick', 'prototype', 'mvp', 'minimal', 'simple', 'quickly'];

  // Prioritize debug -> refactor -> quality -> speed
  if (debugKeywords.some((k) => t.includes(k))) return 'debug';
  if (refactorKeywords.some((k) => t.includes(k))) return 'refactor';
  if (qualityKeywords.some((k) => t.includes(k))) return 'quality';
  if (speedKeywords.some((k) => t.includes(k))) return 'speed';

  return 'balanced';
}

export default inferIntentFromText;
