import { HARNESS_LABELS, type Action, type ScanContext, type SecurityFlag, type Verdict } from '../model.js';
import { daysBetween, fmtDate } from '../util/format.js';
import type { AnalyzedItemDraft } from './overlap.js';
import type { OverlapGroup } from '../model.js';

export type AnalyzedItemDraft2 = AnalyzedItemDraft & { flags: SecurityFlag[] };

export function assignVerdicts(
  items: AnalyzedItemDraft2[],
  groups: OverlapGroup[],
  ctx: ScanContext,
): Map<string, { verdict: Verdict; reason: string; action: Action }> {
  const early = new Map<string, { verdict: Verdict; reason: string; action: Action } | null>();
  for (const item of items) early.set(item.id, rulesOneToSix(item, ctx));
  const out = new Map<string, { verdict: Verdict; reason: string; action: Action }>();
  const byPlugin = new Map<string, AnalyzedItemDraft2[]>();
  for (const item of items) {
    const decided = early.get(item.id) ?? null;
    if (decided) {
      out.set(item.id, decided);
      continue;
    }
    if (!item.plugin) continue;
    const key = `${item.plugin.harness}:${item.plugin.key}`;
    byPlugin.set(key, [...(byPlugin.get(key) ?? []), item]);
  }
  const pluginKeep = new Set<string>();
  for (const [key, members] of byPlugin) {
    const all = items.filter((item) => item.plugin && `${item.plugin.harness}:${item.plugin.key}` === key);
    const everyReaches = all.every((item) => early.get(item.id) == null);
    if (everyReaches) {
      for (const item of members) {
        const action = item.plugin?.harness === 'claude-code' && item.plugin.scope === 'user' ? 'plugin-config' : 'manual';
        out.set(item.id, {
          verdict: 'DISABLE',
          reason: `Plugin ${item.plugin?.name}: none of its ${all.length} items used in ${ctx.windowDays} days.`,
          action,
        });
      }
    } else {
      for (const item of members) pluginKeep.add(item.id);
    }
  }
  for (const item of items) {
    if (out.has(item.id)) continue;
    if (pluginKeep.has(item.id)) {
      out.set(item.id, {
        verdict: 'KEEP',
        reason: `Unused, but part of plugin ${item.plugin?.name}, which you use.`,
        action: 'none',
      });
    }
  }
  for (const item of items) {
    if (out.has(item.id)) continue;
    const group = groups.find((entry) => entry.itemIds.includes(item.id));
    const survivor = group ? items.find((entry) => entry.id === group.survivorId) : undefined;
    const survivorKeeps = survivor ? early.get(survivor.id)?.verdict === 'KEEP' || pluginKeep.has(survivor.id) : false;
    if (group && survivor && item.id !== survivor.id && survivorKeeps) {
      out.set(item.id, withFlags(item, {
        verdict: 'MERGE',
        reason: `Overlaps with ${survivor.qualifiedName} (${Math.round(group.score * 100)}% similar); keep that one.`,
        action: 'move',
      }));
      continue;
    }
    // Only the window is mined, so "never seen in your logs" would be a claim we never checked.
    const last = item.usage.lastUsed ? `; last used ${fmtDate(item.usage.lastUsed)}` : '; no use recorded in that window';
    out.set(item.id, withFlags(item, {
      verdict: 'ARCHIVE',
      reason: `Unused for ${ctx.windowDays} days${last}.`,
      action: 'move',
    }));
  }
  return out;
}

function rulesOneToSix(item: AnalyzedItemDraft2, ctx: ScanContext): { verdict: Verdict; reason: string; action: Action } | null {
  const agents = item.loadedBy.map((id) => HARNESS_LABELS[id]).join(' and ');
  if (item.scope === 'builtin') return { verdict: 'KEEP', reason: `Built into ${agents}; managed by the vendor.`, action: 'none' };
  if (item.scope === 'project') return { verdict: 'KEEP', reason: 'Project item shared with your team; StackWeight only reports it.', action: 'none' };
  if (item.usage.status === 'unknown') {
    return { verdict: 'KEEP', reason: `Usage unknown (${item.usage.reason ?? 'no usage data'}); StackWeight never prunes what it can't see.`, action: 'none' };
  }
  if (item.usage.status === 'insufficient-history') {
    return { verdict: 'KEEP', reason: `${item.usage.reason}; run again in a few days.`, action: 'none' };
  }
  if ((item.usage.count ?? 0) > 0) {
    const when = item.usage.lastUsed ? ` (last ${fmtDate(item.usage.lastUsed)})` : '';
    return { verdict: 'KEEP', reason: `Used ${item.usage.count}× in the last ${ctx.windowDays} days${when}.`, action: 'none' };
  }
  if (item.installedAt) {
    const days = daysBetween(item.installedAt, ctx.now);
    if (days <= ctx.graceDays) return { verdict: 'KEEP', reason: `Installed ${Math.max(0, days)} days ago; too new to judge.`, action: 'none' };
  }
  return null;
}

function withFlags(
  item: AnalyzedItemDraft2,
  result: { verdict: Verdict; reason: string; action: Action },
): { verdict: Verdict; reason: string; action: Action } {
  const title = item.flags[0]?.title;
  if (!title || (result.verdict !== 'ARCHIVE' && result.verdict !== 'MERGE')) return result;
  return { ...result, reason: `${result.reason} Also flagged: ${title.toLowerCase()}.` };
}
