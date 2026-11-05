import { createHash } from 'node:crypto';
import { computeTotals } from '../../src/analyze/totals.js';
import { computeWeights, countTokens } from '../../src/analyze/weight.js';
import type { ScanResult } from '../../src/model.js';
import { toPosix } from '../../src/util/paths.js';

export function normalizeResult(result: ScanResult, home: string): ScanResult {
  const posix = toPosix(home).replace(/\/+$/, '');
  const cloned = JSON.parse(JSON.stringify(result)) as ScanResult;
  const walk = (value: unknown): unknown => {
    if (typeof value === 'string') {
      const replaced = value.split(home).join('<HOME>').split(posix).join('<HOME>');
      return replaced.replace(/\\/g, '/');
    }
    if (Array.isArray(value)) return value.map((entry) => walk(entry));
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(value)) out[key] = walk(entry);
      return out;
    }
    return value;
  };
  const normalized = walk(cloned) as ScanResult;
  const ids = new Map<string, string>();
  for (const item of normalized.items) {
    const next = createHash('sha1').update(item.parkPath).digest('hex').slice(0, 12);
    ids.set(item.id, next);
    item.id = next;
  }
  const mapId = (id: string) => ids.get(id) ?? id;
  for (const item of normalized.items) {
    item.duplicateOf = item.duplicateOf.map(mapId);
    if (item.overlapGroupId) item.overlapGroupId = item.overlapGroupId;
  }
  for (const group of normalized.overlapGroups) {
    group.itemIds = group.itemIds.map(mapId);
    group.survivorId = mapId(group.survivorId);
  }
  for (const item of normalized.items) {
    const weights = computeWeights(item);
    item.weight = weights.weight;
    item.weightTotal = weights.weightTotal;
  }
  normalized.items.sort((a, b) => b.weightTotal - a.weightTotal || a.qualifiedName.localeCompare(b.qualifiedName));
  for (const harness of normalized.harnesses) {
    const loaded = normalized.items.filter((item) => item.loadedBy.includes(harness.harness));
    harness.weight = loaded.reduce((sum, item) => sum + (item.weight[harness.harness] ?? 0), 0);
    harness.deadWeight = loaded
      .filter((item) => item.verdict !== 'KEEP')
      .reduce((sum, item) => sum + (item.weight[harness.harness] ?? 0), 0);
    if (harness.listing) harness.listing.tokens = countTokens(harness.listing.text);
  }
  normalized.totals = computeTotals(normalized.items, normalized.harnesses, normalized.overlapGroups);
  normalized.durationMs = 0;
  normalized.tool.version = '0.0.0-test';
  return normalized;
}
