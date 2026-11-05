import { HARNESS_IDS, type HarnessId, type ItemUsage, type OverlapGroup, type ScannedItem } from '../model.js';

// 0.5, after dropping generic modifiers (design/notes/write/…). Lowering it merged unrelated filler skills.
export const OVERLAP_THRESHOLD = 0.5;

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'in', 'on', 'for', 'to', 'of', 'is', 'it', 'its', 'be', 'as', 'at', 'by',
  'we', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'not', 'no', 'nor', 'so',
  'than', 'too', 'very', 'can', 'will', 'just', 'you', 'our', 'they', 'he', 'she', 'his', 'her', 'i', 'me', 'my',
  'what', 'which', 'who', 'how', 'where', 'why', 'there', 'here', 'all', 'each', 'few', 'more', 'most', 'other',
  'some', 'such', 'only', 'own', 'same', 'then', 'once', 'over', 'under', 'again', 'these', 'those', 'between',
  'both', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'through',
  'use', 'used', 'using', 'when', 'user', 'users', 'asks', 'ask', 'skill', 'skills', 'agent', 'agents', 'claude',
  'codex', 'cursor', 'opencode', 'task', 'tasks', 'help', 'helps', 'also', 'any', 'should', 'wants', 'want', 'this',
  'that', 'with', 'from', 'your', 'their', 'them', 'into', 'about', 'request', 'requests', 'mention', 'mentions', 'covers',
  'note', 'notes', 'minute', 'minutes', 'write', 'writer', 'writes', 'list', 'listing', 'lists', 'take', 'taken',
  'structured', 'structure', 'capture', 'distinctive', 'production', 'grade', 'polished', 'polish', 'choice',
  'choices', 'space', 'spacing', 'strong', 'design', 'designer',
]);

export type AnalyzedItemDraft = ScannedItem & { usage: ItemUsage; weightTotal: number };

export function tokenizeForSimilarity(text: string): string[] {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).flatMap((token) => {
    if (token.length < 3 || STOPWORDS.has(token)) return [];
    const stemmed = stem(token);
    if (stemmed.length < 3 || STOPWORDS.has(stemmed)) return [];
    return [stemmed];
  });
}

function stem(token: string): string {
  for (const suffix of ['ing', 'ed', 'es', 's']) {
    if (token.endsWith(suffix) && token.length - suffix.length >= 4) return token.slice(0, -suffix.length);
  }
  return token;
}

export function findOverlaps(items: AnalyzedItemDraft[]): OverlapGroup[] {
  const groups: OverlapGroup[] = [];
  const seen = new Set<string>();
  for (const harness of HARNESS_IDS) {
    const loaded = items.filter((item) => item.loadedBy.includes(harness));
    for (const group of groupsFor(harness, loaded)) {
      const key = [...group.itemIds].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      groups.push(group);
    }
  }
  groups.sort((a, b) => {
    const harnessOrder = HARNESS_IDS.indexOf(a.harness) - HARNESS_IDS.indexOf(b.harness);
    if (harnessOrder !== 0) return harnessOrder;
    return smallestName(a, items).localeCompare(smallestName(b, items));
  });
  return groups.map((group, index) => ({ ...group, id: `og${index + 1}` }));
}

function smallestName(group: OverlapGroup, items: AnalyzedItemDraft[]): string {
  const names = group.itemIds.map((id) => items.find((item) => item.id === id)?.qualifiedName ?? id);
  return names.sort((a, b) => a.localeCompare(b))[0] ?? '';
}

function groupsFor(harness: HarnessId, items: AnalyzedItemDraft[]): OverlapGroup[] {
  const docs = items.map((item) => tokenizeForSimilarity(`${item.name} ${item.description}`));
  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const term of new Set(doc)) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const n = items.length;
  const vectors = docs.map((doc) => {
    const tf = new Map<string, number>();
    for (const term of doc) tf.set(term, (tf.get(term) ?? 0) + 1);
    const weight = new Map<string, number>();
    for (const [term, count] of tf) {
      const idf = Math.log(n / (df.get(term) ?? 1));
      if (idf !== 0) weight.set(term, count * idf);
    }
    return weight;
  });
  const parent = items.map((_, index) => index);
  const find = (index: number): number => {
    const next = parent[index] ?? index;
    if (next === index) return index;
    const root = find(next);
    parent[index] = root;
    return root;
  };
  const scores = new Map<string, number>();
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const left = items[i];
      const right = items[j];
      if (!left || !right) continue;
      if (left.plugin && right.plugin && left.plugin.key === right.plugin.key) continue;
      const sameName = left.name.toLowerCase() === right.name.toLowerCase();
      const score = sameName ? 1 : cosine(vectors[i] ?? new Map(), vectors[j] ?? new Map());
      if (!sameName && score < OVERLAP_THRESHOLD) continue;
      parent[find(i)] = find(j);
      scores.set(pairKey(i, j), score);
    }
  }
  const buckets = new Map<number, number[]>();
  for (let i = 0; i < items.length; i++) {
    const root = find(i);
    buckets.set(root, [...(buckets.get(root) ?? []), i]);
  }
  const groups: OverlapGroup[] = [];
  for (const indexes of buckets.values()) {
    if (indexes.length < 2) continue;
    const members = indexes.map((index) => items[index]).filter((item): item is AnalyzedItemDraft => Boolean(item));
    let best = 0;
    for (let a = 0; a < indexes.length; a++) {
      for (let b = a + 1; b < indexes.length; b++) {
        best = Math.max(best, scores.get(pairKey(indexes[a] ?? 0, indexes[b] ?? 0)) ?? 0);
      }
    }
    const survivor = [...members].sort(compareSurvivor)[0];
    if (!survivor) continue;
    groups.push({
      id: '',
      harness,
      itemIds: members.map((item) => item.id).sort((a, b) => {
        const an = items.find((item) => item.id === a)?.qualifiedName ?? a;
        const bn = items.find((item) => item.id === b)?.qualifiedName ?? b;
        return an.localeCompare(bn);
      }),
      survivorId: survivor.id,
      score: Math.round(best * 100) / 100,
    });
  }
  return groups;
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let left = 0;
  let right = 0;
  for (const value of a.values()) left += value * value;
  for (const value of b.values()) right += value * value;
  for (const [term, value] of a) {
    const other = b.get(term);
    if (other) dot += value * other;
  }
  if (left === 0 || right === 0) return 0;
  return dot / Math.sqrt(left * right);
}

function compareSurvivor(a: AnalyzedItemDraft, b: AnalyzedItemDraft): number {
  const count = (b.usage.count ?? -1) - (a.usage.count ?? -1);
  if (count !== 0) return count;
  const builtin = Number(b.scope === 'builtin') - Number(a.scope === 'builtin');
  if (builtin !== 0) return builtin;
  const used = (b.usage.lastUsed ?? '').localeCompare(a.usage.lastUsed ?? '');
  if (used !== 0) return used;
  if (a.weightTotal !== b.weightTotal) return a.weightTotal - b.weightTotal;
  return a.qualifiedName.localeCompare(b.qualifiedName);
}
