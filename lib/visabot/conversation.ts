// Resolve every continuation against the preceding effective query, so a third
// turn such as "and DFF?" retains the country/category from the first two.
export function resolveConversationQuery(
  query: string,
  previous: string[],
  merge: (prev: string, fragment: string) => string = (prev, fragment) => `${prev} ${fragment}`,
): string {
  let resolved = "";
  for (const turn of [...previous, query]) {
    const q = turn.trim();
    const wc = q.split(/\s+/).length;
    const follows = /^(¿?\s*y\b|¿?\s*and\b|pero|adem[aá]s|tambi[eé]n|also|but)\b/i.test(q) ||
      (wc <= 2 && !/\?|qu[eé]|cu[aá]|c[oó]mo|what|how|which|why|when/i.test(q));
    resolved = follows && resolved ? merge(resolved, q) : q;
  }
  return resolved;
}
