import fs from 'node:fs/promises';
import path from 'node:path';
import type { ScanContext, ScanResult, Snapshot, SnapshotDelta } from '../model.js';

export async function readHistory(ctx: ScanContext): Promise<Snapshot[]> {
  let text = '';
  try {
    text = await fs.readFile(path.join(ctx.stateDir, 'history.jsonl'), 'utf8');
  } catch {
    return [];
  }
  const out: Snapshot[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as Snapshot);
    } catch {
      // A corrupt history line is ignored so one bad write cannot hide the rest.
    }
  }
  return out;
}

export async function appendSnapshot(ctx: ScanContext, snapshot: Snapshot): Promise<void> {
  await fs.mkdir(ctx.stateDir, { recursive: true });
  await fs.appendFile(path.join(ctx.stateDir, 'history.jsonl'), `${JSON.stringify(snapshot)}\n`);
}

export function computeDelta(prev: Snapshot | undefined, cur: Snapshot): SnapshotDelta | null {
  if (!prev) return null;
  return {
    since: prev.at,
    stackWeightDelta: cur.stackWeight - prev.stackWeight,
    itemCountDelta: cur.itemCount - prev.itemCount,
  };
}

export function snapshotOf(result: Pick<ScanResult, 'generatedAt' | 'totals' | 'harnesses'>): Snapshot {
  const perHarness: Snapshot['perHarness'] = {};
  for (const harness of result.harnesses) perHarness[harness.harness] = harness.weight;
  return {
    at: result.generatedAt,
    stackWeight: result.totals.stackWeight,
    deadWeight: result.totals.deadWeight,
    itemCount: result.totals.itemCount,
    perHarness,
  };
}
