import type { Manifest } from '../apply/manifest.js';
import type { PrunePlan } from '../apply/prune.js';
import type { RestoreOutcome } from '../apply/restore.js';
import type { ScanResult, Verdict } from '../model.js';
import { bar, fmtDate, fmtTokens, paint } from '../util/format.js';
import { displayPath } from '../util/paths.js';

export interface RenderOpts { color: boolean; reportPath: string | null; home: string; }

export function renderSummary(result: ScanResult, opts: RenderOpts): string {
  const detected = result.harnesses.filter((harness) => harness.detected);
  const missing = result.harnesses.filter((harness) => !harness.detected);
  const max = Math.max(1, ...detected.map((harness) => harness.weight));
  const lines = [
    `StackWeight ${result.tool.version} · scanned ${detected.length} agents in ${(result.durationMs / 1000).toFixed(1)}s · local only, nothing uploaded`,
    '',
    `  Stack weight   ${paint('bold', fmtTokens(result.totals.stackWeight), opts.color)} tokens of always-on context, combined across ${detected.length} agents (≈ estimate)`,
    `  Dead weight    ${paint('bold', fmtTokens(result.totals.deadWeight), opts.color)} tokens · ${paint('red', `${result.totals.deadPct}%`, opts.color)} · unused for ${result.windowDays} days, safe to prune`,
    '',
  ];
  for (const harness of detected) {
    const dead = harness.usage.status === 'ok' ? `${Math.round(harness.weight === 0 ? 0 : (harness.deadWeight / harness.weight) * 100)}% dead` : '— dead';
    const usage = harness.usage.status === 'ok'
      ? `usage: ${harness.usage.modelRequests ?? 0} requests`
      : `usage: unknown (${short(harness.usage.reason)})`;
    lines.push(`  ${harness.label.padEnd(12)} ${bar(harness.weight / max, 20)} ${fmtTokens(harness.weight)}/msg  ${dead}   ${paint('gray', usage, opts.color)}`);
  }
  if (result.totals.deadTokensResent != null) {
    lines.push('', `  Re-sent in the last ${result.windowDays} days: ≈ ${fmtTokens(result.totals.deadTokensResent)} tokens of dead weight`);
  }
  const counts = result.totals.verdictCounts;
  lines.push(
    '',
    `  Verdicts   ${counts.KEEP} keep · ${counts.ARCHIVE} archive · ${counts.MERGE} merge · ${counts.DISABLE} disable`,
  );
  if (result.totals.overlapGroupCount > 0) {
    lines.push(`  Overlaps   ${result.totals.overlapGroupCount} groups of items compete for the same trigger`);
  }
  if (result.totals.flaggedCount > 0) {
    lines.push(`  Health     ${result.totals.flaggedCount} items have patterns worth a look`);
  }
  const deadItems = result.items.filter((item) => item.verdict !== 'KEEP').slice(0, 5);
  if (deadItems.length > 0) {
    lines.push('', '  Heaviest dead weight');
    deadItems.forEach((item, index) => {
      lines.push(`    ${index + 1}. ${item.qualifiedName.padEnd(32)} ${fmtTokens(item.weightTotal).padStart(6)}  ${paint(verdictColor(item.verdict), item.verdict.padEnd(8), opts.color)} ${item.reason}`);
    });
  }
  if (result.previous) {
    const weight = signed(fmtTokens(Math.abs(result.previous.stackWeightDelta)), result.previous.stackWeightDelta);
    const items = signed(String(Math.abs(result.previous.itemCountDelta)), result.previous.itemCountDelta);
    lines.push('', `  Since last scan (${fmtDate(result.previous.since)}): ${weight} tokens, ${items} items`);
  }
  if (result.lastPrune) {
    lines.push(`  Last prune ${fmtDate(result.lastPrune.at)}: ${fmtTokens(result.lastPrune.before)} → ${fmtTokens(result.lastPrune.after)}`);
  }
  if (opts.reportPath) lines.push('', `  Report   ${displayPath(opts.reportPath, opts.home)}`);
  const prunable = result.items.some((item) => item.action === 'move' || item.action === 'plugin-config');
  if (prunable) {
    lines.push(`  Prune    npx stackweight prune      ${fmtTokens(result.totals.stackWeight)} → ${fmtTokens(result.totals.afterPruneWeight)}   (undo anytime: npx stackweight restore)`);
  }
  if (missing.length > 0) lines.push(`  Not found: ${missing.map((harness) => harness.label).join(', ')}`);
  return `${lines.join('\n')}\n`;
}

export function renderPrunePlan(plan: PrunePlan, opts: RenderOpts): string {
  const lines = ['Prune plan', ''];
  for (const item of plan.moves) lines.push(`  move    ${item.qualifiedName}  ${item.verdict}  ${item.reason}`);
  for (const plugin of plan.pluginDisables) lines.push(`  disable ${plugin.name}  (${plugin.items.length} items)`);
  for (const entry of plan.manual) lines.push(`  manual  ${entry.name}: ${entry.instruction}`);
  if (plan.skippedByUser.length > 0) lines.push(`  keep    ${plan.skippedByUser.map((item) => item.name).join(', ')}`);
  lines.push('', `  ${fmtTokens(plan.result.totals.stackWeight)} → ${fmtTokens(plan.result.totals.afterPruneWeight)}`);
  if (!opts.color) return `${lines.join('\n')}\n`;
  return `${lines.join('\n')}\n`;
}

export function renderPruneOutcome(manifest: Manifest, _opts: RenderOpts): string {
  const done = manifest.actions.filter((action) => action.state === 'done').length;
  return [
    `Prune ${manifest.status}: ${done} actions done`,
    `${fmtTokens(manifest.stackWeightBefore)} → ${fmtTokens(manifest.stackWeightAfter)}`,
    'Restart your agent sessions to feel the difference. Undo: npx stackweight restore',
    '',
  ].join('\n');
}

export function renderRestoreOutcome(outcome: RestoreOutcome, _opts: RenderOpts): string {
  return `Restored ${outcome.restored.length}. Conflicts ${outcome.conflicts.length}. Failed ${outcome.failed.length}. Skipped ${outcome.skipped.length}.\n`;
}

export function renderSources(result: ScanResult, opts: RenderOpts): string {
  const lines: string[] = [];
  for (const harness of result.harnesses) {
    lines.push(`${harness.label}: ${harness.detected ? 'detected' : 'not found'}`);
    for (const note of harness.notes) lines.push(`  ${note}`);
    lines.push(`  usage: ${harness.usage.status}${harness.usage.reason ? ` (${harness.usage.reason})` : ''}`);
    for (const source of harness.usage.sources) lines.push(`  read ${displayPath(source, opts.home)}`);
    lines.push(`  malformed lines: ${harness.usage.malformedLines}`);
    if (harness.listing) {
      const names = new Set(harness.listing.entries.map((entry) => entry.name));
      const estimate = result.items
        .filter((item) => item.loadedBy.includes(harness.harness) && names.has(item.name))
        .reduce((sum, item) => sum + (item.weight[harness.harness] ?? 0), 0);
      const delta = harness.listing.tokens === 0 ? 0 : Math.round(((estimate - harness.listing.tokens) / harness.listing.tokens) * 100);
      lines.push(`  listing: ${harness.listing.entries.length} skills = ${harness.listing.tokens} tokens; estimate ${estimate} (Δ ${delta}%)`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function short(reason: string | null): string {
  if (!reason) return 'no logs';
  return reason.length > 80 ? `${reason.slice(0, 77)}...` : reason;
}

function signed(text: string, value: number): string {
  if (value > 0) return `+${text}`;
  if (value < 0) return `-${text}`;
  return text;
}

function verdictColor(verdict: Verdict): 'green' | 'yellow' | 'red' {
  if (verdict === 'KEEP') return 'green';
  if (verdict === 'DISABLE') return 'red';
  return 'yellow';
}
