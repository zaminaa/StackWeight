import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import type { ScanContext } from '../model.js';
import { statSafe } from '../util/fs.js';
import { removeCreatedFile, setClaudePluginEnabled } from './claude-config.js';
import { hashTree } from './hash.js';
import { acquireLock, listManifests, writeManifest, type Manifest, type ManifestAction } from './manifest.js';
import { movePath } from './move.js';

export interface RestoreOutcome {
  runId: string;
  restored: string[];
  conflicts: string[];
  failed: string[];
  skipped: string[];
}

export async function restoreRun(ctx: ScanContext, opts: { runId?: string; item?: string }): Promise<RestoreOutcome> {
  const manifests = await listManifests(ctx);
  const manifest = opts.runId
    ? manifests.find((entry) => entry.runId === opts.runId) ?? null
    : manifests.find((entry) => entry.status !== 'restored') ?? null;
  if (!manifest) throw new Error('Nothing to restore.');
  const release = await acquireLock(ctx);
  const outcome: RestoreOutcome = { runId: manifest.runId, restored: [], conflicts: [], failed: [], skipped: [] };
  let settingsRestored = false;
  try {
    for (const action of [...manifest.actions].reverse()) {
      if (opts.item && action.name.toLowerCase() !== opts.item.toLowerCase()) continue;
      if (action.type === 'config-set' && settingsRestored) {
        action.state = 'restored';
        outcome.restored.push(action.name);
      } else {
        await restoreAction(action, outcome);
        if (action.type === 'config-set' && action.state === 'restored' && !action.error) settingsRestored = true;
      }
      await writeManifest(ctx, manifest);
    }
    if (!manifest.actions.some((action) => action.state === 'done')) manifest.status = 'restored';
    await writeManifest(ctx, manifest);
    return outcome;
  } finally {
    await release();
  }
}

async function restoreAction(action: ManifestAction, outcome: RestoreOutcome): Promise<void> {
  if (action.type === 'manual') {
    outcome.skipped.push(action.name);
    return;
  }
  if (action.type === 'move') {
    const parked = await statSafe(action.to);
    if (action.state !== 'done' && !(action.state === 'pending' && parked)) return;
    if (await statSafe(action.from)) {
      action.state = 'conflict';
      outcome.conflicts.push(action.name);
      return;
    }
    try {
      await movePath(action.to, action.from);
      if (await hashTree(action.from) !== action.treeHash) {
        action.state = 'failed';
        action.error = 'restored tree hash does not match';
        outcome.failed.push(action.name);
        return;
      }
      action.state = 'restored';
      outcome.restored.push(action.name);
    } catch (err) {
      action.state = 'failed';
      action.error = err instanceof Error ? err.message : String(err);
      outcome.failed.push(action.name);
    }
    return;
  }
  if (action.state !== 'done' || !action.afterHash) return;
  const current = await hashFile(action.file);
  if (current === action.afterHash) {
    if (action.fileExisted) await fs.copyFile(action.backup, action.file);
    else await removeCreatedFile(action.file);
  } else {
    await setClaudePluginEnabled(action.file, action.key, action.before, null);
    action.error = 'settings changed since the prune; the plugin flag was reverted in place';
  }
  action.state = 'restored';
  outcome.restored.push(action.name);
}

async function hashFile(file: string): Promise<string | null> {
  try {
    const bytes = await fs.readFile(file);
    return createHash('sha256').update(bytes).digest('hex');
  } catch {
    return null;
  }
}
