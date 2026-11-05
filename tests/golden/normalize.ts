import { createHash } from 'node:crypto';
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
  normalized.durationMs = 0;
  normalized.tool.version = '0.0.0-test';
  return normalized;
}
