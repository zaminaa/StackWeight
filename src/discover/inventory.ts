import { HARNESS_IDS, HARNESS_LABELS, type HarnessId, type HarnessUsage, type ObservedListing, type ScanContext, type ScannedItem } from '../model.js';
import { absentUsage } from '../harness/shared.js';
import { ADAPTERS } from '../harness/index.js';
import { exists } from '../util/fs.js';
import { SKILL_ROOTS, discoverRootItems } from './roots.js';

export interface Inventory {
  items: ScannedItem[];
  usage: Record<HarnessId, HarnessUsage>;
  listings: Partial<Record<HarnessId, ObservedListing>>;
  detected: Record<HarnessId, boolean>;
  notes: Record<HarnessId, string[]>;
}

function failure(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.split('\n')[0] ?? message;
}

export async function buildInventory(ctx: ScanContext, countTokens: (text: string) => number): Promise<Inventory> {
  const notes = Object.fromEntries(HARNESS_IDS.map((id) => [id, [] as string[]])) as Record<HarnessId, string[]>;
  const detected = Object.fromEntries(HARNESS_IDS.map((id) => [id, false])) as Record<HarnessId, boolean>;
  const usage = {} as Record<HarnessId, HarnessUsage>;
  const listings: Partial<Record<HarnessId, ObservedListing>> = {};
  const items = new Map<string, ScannedItem>();

  try {
    const roots = await discoverRootItems(ctx);
    for (const item of roots.items) items.set(item.id, item);
    let noteAt = 0;
    for (const root of SKILL_ROOTS) {
      const dir = root.resolve(ctx);
      if (!dir || !(await exists(dir))) continue;
      const note = roots.notes[noteAt];
      noteAt += 1;
      if (note) notes[root.harness].push(note);
    }
  } catch (err) {
    for (const id of HARNESS_IDS) notes[id].push(`discover roots failed: ${failure(err)}`);
  }

  for (const adapter of ADAPTERS) {
    try {
      detected[adapter.id] = await adapter.detect(ctx);
    } catch (err) {
      notes[adapter.id].push(`detect failed: ${failure(err)}`);
    }
    try {
      const plugins = await adapter.pluginItems(ctx);
      notes[adapter.id].push(...plugins.notes);
      for (const item of plugins.items) {
        if (!items.has(item.id)) items.set(item.id, item);
      }
    } catch (err) {
      notes[adapter.id].push(`pluginItems failed: ${failure(err)}`);
    }
    if (!detected[adapter.id]) {
      usage[adapter.id] = absentUsage(adapter.id, `${HARNESS_LABELS[adapter.id]} not found on this machine`);
    } else {
      try {
        usage[adapter.id] = await adapter.mineUsage(ctx);
      } catch (err) {
        notes[adapter.id].push(`mineUsage failed: ${failure(err)}`);
        usage[adapter.id] = absentUsage(adapter.id, failure(err));
      }
    }
    if (adapter.observedListing && detected[adapter.id]) {
      try {
        const listing = await adapter.observedListing(ctx, countTokens);
        if (listing) listings[adapter.id] = listing;
      } catch (err) {
        notes[adapter.id].push(`observedListing failed: ${failure(err)}`);
      }
    }
  }

  if (usage.cursor?.status === 'ok') {
    notes.cursor.push('Cursor transcripts have no per-message timestamps; events are dated by file modification time.');
  }

  return { items: [...items.values()], usage, listings, detected, notes };
}
