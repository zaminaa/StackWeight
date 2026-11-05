import { describe, expect, it } from 'vitest';
import { computeTotals, summarizeHarnesses } from '../../src/analyze/totals.js';
import type { Inventory } from '../../src/discover/inventory.js';
import type { AnalyzedItem, HarnessSummary } from '../../src/model.js';

function analyzed(overrides: Partial<AnalyzedItem> & Pick<AnalyzedItem, 'id' | 'verdict' | 'action'>): AnalyzedItem {
  return {
    kind: 'skill',
    name: overrides.id,
    qualifiedName: overrides.id,
    description: '',
    entryFile: `${overrides.id}/SKILL.md`,
    parkPath: overrides.id,
    scope: 'user',
    loadedBy: ['claude-code'],
    evidence: 'documented',
    plugin: null,
    installedAt: null,
    contentHash: overrides.id,
    warnings: [],
    weight: { 'claude-code': 10 },
    weightTotal: 10,
    usage: { status: 'known', count: 0, lastUsed: null, reason: null },
    flags: [],
    overlapGroupId: null,
    duplicateOf: [],
    reason: '',
    ...overrides,
  };
}

describe('computeTotals', () => {
  it('verifies every total from three items', () => {
    const items = [
      analyzed({ id: 'used', verdict: 'KEEP', action: 'none', weight: { 'claude-code': 100 }, weightTotal: 100, usage: { status: 'known', count: 2, lastUsed: '2026-11-01T00:00:00.000Z', reason: null } }),
      analyzed({ id: 'dead', verdict: 'ARCHIVE', action: 'move', weight: { 'claude-code': 40 }, weightTotal: 40, flags: [{ rule: 'SW004', title: 'Downloads and runs remote code', file: 'a', line: 1, snippet: 'x' }] }),
      analyzed({ id: 'mystery', verdict: 'KEEP', action: 'none', loadedBy: ['cursor'], weight: { cursor: 10 }, weightTotal: 10, usage: { status: 'unknown', count: null, lastUsed: null, reason: 'missing' } }),
    ];
    const harnesses: HarnessSummary[] = [
      { harness: 'claude-code', label: 'Claude Code', detected: true, itemCount: 2, weight: 140, deadWeight: 40, usage: { harness: 'claude-code', status: 'ok', reason: null, sources: [], coverageStart: null, modelRequests: 10, malformedLines: 0 }, listing: null, notes: [] },
      { harness: 'cursor', label: 'Cursor', detected: true, itemCount: 1, weight: 10, deadWeight: 0, usage: { harness: 'cursor', status: 'absent', reason: 'missing', sources: [], coverageStart: null, modelRequests: null, malformedLines: 0 }, listing: null, notes: [] },
      { harness: 'codex', label: 'Codex', detected: false, itemCount: 0, weight: 0, deadWeight: 0, usage: { harness: 'codex', status: 'absent', reason: 'missing', sources: [], coverageStart: null, modelRequests: null, malformedLines: 0 }, listing: null, notes: [] },
      { harness: 'opencode', label: 'OpenCode', detected: false, itemCount: 0, weight: 0, deadWeight: 0, usage: { harness: 'opencode', status: 'absent', reason: 'missing', sources: [], coverageStart: null, modelRequests: null, malformedLines: 0 }, listing: null, notes: [] },
    ];
    expect(computeTotals(items, harnesses, [])).toEqual({
      stackWeight: 150,
      deadWeight: 40,
      deadPct: 27,
      afterPruneWeight: 110,
      itemCount: 3,
      usedCount: 1,
      unknownCount: 1,
      verdictCounts: { KEEP: 2, DISABLE: 0, ARCHIVE: 1, MERGE: 0 },
      flaggedCount: 1,
      overlapGroupCount: 0,
      deadTokensResent: 400,
    });
    const inv = {
      items: [],
      detected: { 'claude-code': true, cursor: true, codex: false, opencode: false },
      notes: { 'claude-code': ['found'], cursor: [], codex: [], opencode: [] },
      listings: {},
      usage: {
        'claude-code': { ...harnesses[0]!.usage, events: [] },
        cursor: { ...harnesses[1]!.usage, events: [] },
        codex: { ...harnesses[2]!.usage, events: [] },
        opencode: { ...harnesses[3]!.usage, events: [] },
      },
    } satisfies Inventory;
    const summary = summarizeHarnesses(items, inv);
    expect(summary[0]?.weight).toBe(140);
    expect(summary[0]?.deadWeight).toBe(40);
    expect(summary[1]?.weight).toBe(10);
    expect(summary[0]?.notes).toEqual(['found']);
  });
});
