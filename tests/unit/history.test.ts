import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/context.js';
import { appendSnapshot, computeDelta, readHistory, snapshotOf } from '../../src/state/history.js';
import { tempDir } from '../helpers/fixture.js';

describe('history', () => {
  it('round-trips snapshots and skips a corrupt line', async () => {
    const stateDir = await tempDir('sw-history-');
    const ctx = createContext({ home: stateDir, cwd: stateDir, env: { STACKWEIGHT_HOME: stateDir }, toolVersion: '0.0.0-test' });
    const file = path.join(stateDir, 'history.jsonl');
    await fs.mkdir(stateDir, { recursive: true });
    await fs.writeFile(file, '{"at":"2026-10-01T00:00:00.000Z","stackWeight":10,"deadWeight":4,"itemCount":2,"perHarness":{}}\nnot json\n');
    await appendSnapshot(ctx, { at: '2026-11-01T00:00:00.000Z', stackWeight: 12, deadWeight: 3, itemCount: 3, perHarness: { cursor: 12 } });
    const rows = await readHistory(ctx);
    expect(rows.map((row) => row.at)).toEqual(['2026-10-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z']);
    expect(computeDelta(rows[0], rows[1]!)).toEqual({ since: '2026-10-01T00:00:00.000Z', stackWeightDelta: 2, itemCountDelta: 1 });
    expect(computeDelta(undefined, rows[1]!)).toBeNull();
    const snap = snapshotOf({
      generatedAt: '2026-11-06T00:00:00.000Z',
      totals: { stackWeight: 5, deadWeight: 1, deadPct: 20, afterPruneWeight: 4, itemCount: 1, usedCount: 0, unknownCount: 0, verdictCounts: { KEEP: 1, DISABLE: 0, ARCHIVE: 0, MERGE: 0 }, flaggedCount: 0, overlapGroupCount: 0, deadTokensResent: null },
      harnesses: [{ harness: 'cursor', label: 'Cursor', detected: true, itemCount: 1, weight: 5, deadWeight: 1, usage: { harness: 'cursor', status: 'ok', reason: null, sources: [], coverageStart: null, modelRequests: 1, malformedLines: 0 }, listing: null, notes: [] }],
    });
    expect(snap.perHarness.cursor).toBe(5);
    expect(snap.stackWeight).toBe(5);
  });
});
