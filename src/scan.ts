import type { AnalyzedItem, ScanContext, ScanResult } from './model.js';
import { attributeUsage } from './analyze/attribute.js';
import { findOverlaps } from './analyze/overlap.js';
import { scanItemSecurity } from './analyze/security.js';
import { computeTotals, summarizeHarnesses } from './analyze/totals.js';
import { assignVerdicts } from './analyze/verdict.js';
import { computeWeights, countTokens } from './analyze/weight.js';
import { buildInventory } from './discover/inventory.js';
import { appendSnapshot, computeDelta, readHistory, snapshotOf } from './state/history.js';

export async function scan(ctx: ScanContext, opts?: { writeHistory?: boolean }): Promise<ScanResult> {
  const started = performance.now();
  const inv = await buildInventory(ctx, countTokens);
  const usage = attributeUsage(inv.items, inv.usage, ctx);
  const drafted = await Promise.all(inv.items.map(async (item) => {
    const weights = computeWeights(item);
    const row = usage.get(item.id) ?? { status: 'unknown' as const, count: null, lastUsed: null, reason: 'missing usage' };
    return { ...item, ...weights, usage: row, flags: await scanItemSecurity(item) };
  }));
  const overlapGroups = findOverlaps(drafted);
  const verdicts = assignVerdicts(drafted, overlapGroups, ctx);
  const hashes = new Map<string, string[]>();
  for (const item of drafted) hashes.set(item.contentHash, [...(hashes.get(item.contentHash) ?? []), item.id]);
  const groupOf = new Map<string, string>();
  for (const group of overlapGroups) {
    for (const id of group.itemIds) groupOf.set(id, group.id);
  }
  const items: AnalyzedItem[] = drafted.map((item) => {
    const verdict = verdicts.get(item.id);
    if (!verdict) throw new Error(`no verdict for ${item.qualifiedName}`);
    return {
      ...item,
      overlapGroupId: groupOf.get(item.id) ?? null,
      duplicateOf: (hashes.get(item.contentHash) ?? []).filter((id) => id !== item.id),
      verdict: verdict.verdict,
      reason: verdict.reason,
      action: verdict.action,
    };
  });
  items.sort((a, b) => b.weightTotal - a.weightTotal || a.qualifiedName.localeCompare(b.qualifiedName));
  const harnesses = summarizeHarnesses(items, inv);
  const totals = computeTotals(items, harnesses, overlapGroups);
  const generatedAt = ctx.now.toISOString();
  const history = await readHistory(ctx);
  const snapshot = snapshotOf({ generatedAt, totals, harnesses });
  const result: ScanResult = {
    schemaVersion: 1,
    tool: { name: 'stackweight', version: ctx.toolVersion },
    generatedAt,
    windowDays: ctx.windowDays,
    durationMs: Math.round(performance.now() - started),
    home: ctx.home,
    harnesses,
    items,
    overlapGroups,
    totals,
    previous: computeDelta(history.at(-1), snapshot),
    lastPrune: null,
  };
  if (opts?.writeHistory !== false) await appendSnapshot(ctx, snapshot);
  return result;
}
