import { HARNESS_IDS, HARNESS_LABELS, type AnalyzedItem, type HarnessSummary, type OverlapGroup, type Totals } from '../model.js';
import type { Inventory } from '../discover/inventory.js';

export function summarizeHarnesses(items: AnalyzedItem[], inv: Inventory): HarnessSummary[] {
  return HARNESS_IDS.map((harness) => {
    const loaded = items.filter((item) => item.loadedBy.includes(harness));
    const dead = loaded.filter((item) => item.verdict !== 'KEEP');
    const usage = inv.usage[harness];
    const { events: _events, ...rest } = usage;
    return {
      harness,
      label: HARNESS_LABELS[harness],
      detected: inv.detected[harness],
      itemCount: loaded.length,
      weight: sum(loaded.map((item) => item.weight[harness] ?? 0)),
      deadWeight: sum(dead.map((item) => item.weight[harness] ?? 0)),
      usage: rest,
      listing: inv.listings[harness] ?? null,
      notes: inv.notes[harness] ?? [],
    };
  });
}

export function computeTotals(items: AnalyzedItem[], harnesses: HarnessSummary[], groups: OverlapGroup[]): Totals {
  const stackWeight = sum(harnesses.map((harness) => harness.weight));
  const dead = items.filter((item) => item.verdict !== 'KEEP');
  const deadWeight = sum(dead.map((item) => item.weightTotal));
  const pruned = items.filter((item) => item.action === 'move' || item.action === 'plugin-config');
  let resent = 0;
  let sawUsage = false;
  for (const harness of harnesses) {
    if (harness.usage.status !== 'ok' || harness.usage.modelRequests == null) continue;
    sawUsage = true;
    resent += harness.deadWeight * harness.usage.modelRequests;
  }
  return {
    stackWeight,
    deadWeight,
    deadPct: stackWeight === 0 ? 0 : Math.round((deadWeight / stackWeight) * 100),
    afterPruneWeight: stackWeight - sum(pruned.map((item) => item.weightTotal)),
    itemCount: items.length,
    usedCount: items.filter((item) => item.usage.status === 'known' && (item.usage.count ?? 0) > 0).length,
    unknownCount: items.filter((item) => item.usage.status !== 'known').length,
    verdictCounts: {
      KEEP: items.filter((item) => item.verdict === 'KEEP').length,
      DISABLE: items.filter((item) => item.verdict === 'DISABLE').length,
      ARCHIVE: items.filter((item) => item.verdict === 'ARCHIVE').length,
      MERGE: items.filter((item) => item.verdict === 'MERGE').length,
    },
    flaggedCount: items.filter((item) => item.flags.length > 0).length,
    overlapGroupCount: groups.length,
    deadTokensResent: sawUsage ? Math.round(resent) : null,
  };
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
