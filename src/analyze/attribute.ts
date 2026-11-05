import path from 'node:path';
import { HARNESS_IDS, HARNESS_LABELS, type HarnessId, type HarnessUsage, type ItemUsage, type ScanContext, type ScannedItem, type UsageEvent } from '../model.js';
import { daysBetween } from '../util/format.js';
import { isInside, samePath } from '../util/paths.js';
import { inWindow } from '../harness/shared.js';

export function attributeUsage(
  items: ScannedItem[],
  usage: Record<HarnessId, HarnessUsage>,
  ctx: ScanContext,
): Map<string, ItemUsage> {
  const matched = new Map<string, UsageEvent[]>();
  for (const item of items) matched.set(item.id, []);
  for (const event of HARNESS_IDS.flatMap((id) => usage[id]?.events ?? [])) {
    const item = matchEvent(event, items, ctx);
    if (!item) continue;
    matched.get(item.id)?.push(event);
  }
  const out = new Map<string, ItemUsage>();
  for (const item of items) out.set(item.id, usageFor(item, matched.get(item.id) ?? [], usage, ctx));
  return out;
}

function matchEvent(event: UsageEvent, items: ScannedItem[], ctx: ScanContext): ScannedItem | null {
  const pool = items.filter((item) => item.loadedBy.includes(event.harness));
  if (event.ref.type === 'path') return matchPath(event.ref.path, pool, ctx);
  return matchName(event.ref, pool);
}

function matchPath(raw: string, items: ScannedItem[], ctx: ScanContext): ScannedItem | null {
  const ref = raw.startsWith('~/') ? path.join(ctx.home, raw.slice(2)) : raw;
  const direct = items.filter((item) => samePath(ref, item.entryFile) || isInside(ref, item.parkPath));
  if (direct.length === 1) return direct[0] ?? null;
  if (direct.length > 1) return null;
  const base = path.basename(path.dirname(ref.replace(/\\/g, '/')));
  const byName = items.filter((item) => path.basename(item.parkPath).toLowerCase() === base.toLowerCase());
  return byName.length === 1 ? byName[0] ?? null : null;
}

function matchName(
  ref: { name: string; plugin: string | null; kind: ScannedItem['kind'] },
  items: ScannedItem[],
): ScannedItem | null {
  let candidates = items.filter((item) => item.kind === ref.kind && item.name.toLowerCase() === ref.name.toLowerCase());
  if (ref.plugin) {
    candidates = candidates.filter((item) => item.plugin?.name === ref.plugin);
  } else {
    const plain = candidates.filter((item) => item.plugin === null);
    if (plain.length > 0) candidates = plain;
  }
  return candidates.length === 1 ? candidates[0] ?? null : null;
}

function usageFor(
  item: ScannedItem,
  events: UsageEvent[],
  usage: Record<string, HarnessUsage>,
  ctx: ScanContext,
): ItemUsage {
  const inWin = events.filter((event) => inWindow(event.at, ctx));
  const lastUsed = events.reduce<string | null>((latest, event) => {
    if (!event.at) return latest;
    if (!latest || event.at > latest) return event.at;
    return latest;
  }, null);
  if (inWin.length > 0) {
    return { status: 'known', count: inWin.length, lastUsed, reason: null };
  }
  const missing = item.loadedBy.find((id) => usage[id]?.status !== 'ok');
  if (missing) {
    return { status: 'unknown', count: null, lastUsed, reason: usage[missing]?.reason ?? null };
  }
  const starts = item.loadedBy
    .map((id) => usage[id]?.coverageStart)
    .filter((iso): iso is string => Boolean(iso))
    .sort();
  const newest = starts[starts.length - 1];
  if (!newest || daysBetween(newest, ctx.now) < ctx.minCoverageDays) {
    const agent = item.loadedBy.find((id) => usage[id]?.coverageStart === newest) ?? item.loadedBy[0];
    const days = newest ? daysBetween(newest, ctx.now) : 0;
    const label = agent ? HARNESS_LABELS[agent] : 'agent';
    return {
      status: 'insufficient-history',
      count: 0,
      lastUsed,
      reason: `Only ${days} days of ${label} history so far`,
    };
  }
  return { status: 'known', count: 0, lastUsed, reason: null };
}
