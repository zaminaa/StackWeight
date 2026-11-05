import path from 'node:path';
import type { AnalyzedItem, ScanContext, ScanResult } from '../model.js';
import { hashTree } from './hash.js';
import { setClaudePluginEnabled } from './claude-config.js';
import { acquireLock, newRunId, runDir, writeManifest, type Manifest, type ManifestAction } from './manifest.js';
import { movePath as defaultMove } from './move.js';

export interface PrunePlan {
  result: ScanResult;
  moves: AnalyzedItem[];
  pluginDisables: { key: string; name: string; items: AnalyzedItem[]; file: string }[];
  manual: { name: string; items: AnalyzedItem[]; instruction: string }[];
  skippedByUser: AnalyzedItem[];
}

export function planPrune(result: ScanResult, ctx: ScanContext, keep: string[]): PrunePlan {
  const kept = new Set(keep.map((name) => name.toLowerCase()));
  const moves: AnalyzedItem[] = [];
  const skippedByUser: AnalyzedItem[] = [];
  for (const item of result.items) {
    if (item.action !== 'move') continue;
    if (kept.has(item.name.toLowerCase()) || kept.has(item.qualifiedName.toLowerCase())) skippedByUser.push(item);
    else moves.push(item);
  }
  const disables = new Map<string, AnalyzedItem[]>();
  const manuals = new Map<string, AnalyzedItem[]>();
  for (const item of result.items) {
    if (!item.plugin) continue;
    if (item.action === 'plugin-config') {
      disables.set(item.plugin.key, [...(disables.get(item.plugin.key) ?? []), item]);
    } else if (item.action === 'manual') {
      manuals.set(item.plugin.key, [...(manuals.get(item.plugin.key) ?? []), item]);
    }
  }
  return {
    result,
    moves,
    skippedByUser,
    pluginDisables: [...disables.entries()].map(([key, items]) => ({
      key,
      name: items[0]?.plugin?.name ?? key,
      items,
      file: path.join(ctx.home, '.claude', 'settings.json'),
    })),
    manual: [...manuals.entries()].map(([key, items]) => ({
      name: items[0]?.plugin?.name ?? key,
      items,
      instruction: instructionFor(items[0]!, ctx),
    })),
  };
}

function instructionFor(item: AnalyzedItem, ctx: ScanContext): string {
  if (item.plugin?.harness === 'cursor') return `Disable the "${item.plugin.name}" plugin in Cursor's plugin settings.`;
  return `Run /plugin in Claude Code inside ${ctx.cwd} and disable ${item.plugin?.key}.`;
}

export async function executePrune(
  plan: PrunePlan,
  ctx: ScanContext,
  deps: { movePath?: typeof defaultMove } = {},
): Promise<Manifest> {
  const move = deps.movePath ?? defaultMove;
  const release = await acquireLock(ctx);
  const runId = newRunId(ctx.now);
  const dir = runDir(ctx, runId);
  const skipped = new Set(plan.skippedByUser.map((item) => item.id));
  const acted = plan.result.items.filter((item) => (item.action === 'move' || item.action === 'plugin-config') && !skipped.has(item.id));
  const after = plan.result.totals.stackWeight - acted.reduce((sum, item) => sum + item.weightTotal, 0);
  const actions: ManifestAction[] = [
    ...plan.moves.map((item): ManifestAction => ({
      type: 'move',
      itemIds: [item.id],
      name: item.name,
      verdict: item.verdict,
      from: item.parkPath,
      to: path.join(dir, 'items', item.id, path.basename(item.parkPath)),
      treeHash: '',
      state: 'pending',
    })),
    ...plan.pluginDisables.map((plugin): ManifestAction => ({
      type: 'config-set',
      itemIds: plugin.items.map((item) => item.id),
      name: plugin.name,
      file: plugin.file,
      backup: path.join(dir, 'files', 'claude-settings.json'),
      fileExisted: false,
      key: plugin.key,
      before: null,
      afterHash: null,
      state: 'pending',
    })),
    ...plan.manual.map((entry): ManifestAction => ({
      type: 'manual',
      itemIds: entry.items.map((item) => item.id),
      name: entry.name,
      instruction: entry.instruction,
      state: 'pending',
    })),
  ];
  const manifest: Manifest = {
    version: 1,
    runId,
    createdAt: ctx.now.toISOString(),
    toolVersion: ctx.toolVersion,
    home: ctx.home,
    status: 'in-progress',
    stackWeightBefore: plan.result.totals.stackWeight,
    stackWeightAfter: after,
    actions,
  };
  try {
    await writeManifest(ctx, manifest);
    let backedUp = false;
    let originalExisted: boolean | null = null;
    for (const action of manifest.actions) {
      if (action.type === 'move') {
        try {
          action.treeHash = await hashTree(action.from);
          await move(action.from, action.to);
          action.state = 'done';
        } catch (err) {
          action.state = 'failed';
          action.error = err instanceof Error ? err.message : String(err);
        }
        await writeManifest(ctx, manifest);
      } else if (action.type === 'config-set') {
        try {
          const backup = backedUp ? null : action.backup;
          backedUp = true;
          const updated = await setClaudePluginEnabled(action.file, action.key, false, backup);
          if (originalExisted === null) originalExisted = updated.fileExisted;
          action.before = updated.before;
          action.fileExisted = originalExisted;
          action.afterHash = updated.afterHash;
          action.state = 'done';
        } catch (err) {
          action.state = 'failed';
          action.error = err instanceof Error ? err.message : String(err);
        }
        await writeManifest(ctx, manifest);
      }
    }
    const actionable = manifest.actions.filter((action) => action.type !== 'manual');
    manifest.status = actionable.every((action) => action.state === 'done') ? 'complete' : 'partial';
    await writeManifest(ctx, manifest);
    return manifest;
  } finally {
    await release();
  }
}
