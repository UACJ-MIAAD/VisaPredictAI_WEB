// Resolve every continuation against the preceding effective query, so a third
// turn such as "and DFF?" retains the country/category from the first two.
import {isPriorityQuery} from "./priority-check.mjs";

export function resolveConversationQuery(
  query: string,
  previous: string[],
  merge: (prev: string, fragment: string) => string = (prev, fragment) => `${prev} ${fragment}`,
): string {
  let resolved = "";
  for (const turn of [...previous, query]) {
    const q = turn.trim();
    const fragment = q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^[¿¡\s]+|[?!.,\s]+$/g, "");
    const entityOnly = /^(?:(?:para|for|en|in)\s+)?(?:mexico|india|china|filipinas|philippines|resto del mundo|all chargeability|fad|dff|final action(?: dates)?|dates for filing|accion final|presentacion|f[ ._-]?\d(?:[ ._-]?[ab])?|eb[ ._-]?\d(?:[ _-][a-z]+)*)$/.test(fragment) || q === "ROW";
    const priorityFollowUp=isPriorityQuery(resolved) && /^(?:¿?\s*)?(?:(?:entonces|so)\s+)?(?:(?:ya\s+)?me toca|ya estoy al corriente|todav[ií]a no|am i current|does that mean i am current)[?!.\s]*$/i.test(q);
    const follows = priorityFollowUp || /^(¿?\s*y\b|¿?\s*and\b|pero|adem[aá]s|tambi[eé]n|also|but)\b/i.test(q) ||
      entityOnly;
    resolved = follows && resolved ? merge(resolved, q) : q;
  }
  return resolved;
}
