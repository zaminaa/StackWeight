import { describe, expect, it } from 'vitest';
import { assignVerdicts, type AnalyzedItemDraft2 } from '../../src/analyze/verdict.js';
import type { OverlapGroup, ScanContext } from '../../src/model.js';

const ctx = {
  home: 'C:/home',
  cwd: 'C:/home',
  now: new Date('2026-11-06T12:00:00.000Z'),
  windowDays: 30,
  graceDays: 14,
  minCoverageDays: 7,
  stateDir: 'C:/home/.stackweight',
  toolVersion: '0.0.0-test',
  env: {},
} satisfies ScanContext;

function item(overrides: Partial<AnalyzedItemDraft2> & Pick<AnalyzedItemDraft2, 'id' | 'name'>): AnalyzedItemDraft2 {
  return {
    qualifiedName: overrides.name,
    kind: 'skill',
    description: '',
    entryFile: `C:/home/${overrides.name}/SKILL.md`,
    parkPath: `C:/home/${overrides.name}`,
    scope: 'user',
    loadedBy: ['claude-code'],
    evidence: 'documented',
    plugin: null,
    installedAt: '2026-08-01T00:00:00.000Z',
    contentHash: overrides.id,
    warnings: [],
    usage: { status: 'known', count: 0, lastUsed: null, reason: null },
    weightTotal: 10,
    flags: [],
    ...overrides,
  };
}

describe('assignVerdicts', () => {
  it('covers each rule with a handcrafted draft', () => {
    const items = [
      item({ id: 'b', name: 'builtin', scope: 'builtin', loadedBy: ['cursor'] }),
      item({ id: 'p', name: 'project', scope: 'project' }),
      item({ id: 'u', name: 'unknown', usage: { status: 'unknown', count: null, lastUsed: null, reason: 'No OpenCode database' } }),
      item({ id: 'h', name: 'history', usage: { status: 'insufficient-history', count: 0, lastUsed: null, reason: 'Only 2 days of Claude Code history so far' } }),
      item({ id: 'used', name: 'used', usage: { status: 'known', count: 3, lastUsed: '2026-11-01T00:00:00.000Z', reason: null } }),
      item({ id: 'fresh', name: 'fresh', installedAt: '2026-11-03T00:00:00.000Z' }),
      item({ id: 'pdf', name: 'pdf', plugin: { harness: 'claude-code', key: 'docs@acme', name: 'docs', version: '1', enabled: true, scope: 'user' }, usage: { status: 'known', count: 1, lastUsed: '2026-10-20T00:00:00.000Z', reason: null } }),
      item({ id: 'docx', name: 'docx', plugin: { harness: 'claude-code', key: 'docs@acme', name: 'docs', version: '1', enabled: true, scope: 'user' } }),
      item({ id: 'lint', name: 'lint', plugin: { harness: 'claude-code', key: 'lint@acme', name: 'lint', version: '1', enabled: null, scope: 'user' } }),
      item({ id: 'cur', name: 'curplug', plugin: { harness: 'cursor', key: 'mkt/x', name: 'x', version: '1', enabled: null, scope: 'user' }, loadedBy: ['cursor'] }),
      item({ id: 'keep', name: 'commit-helper', usage: { status: 'known', count: 2, lastUsed: '2026-11-01T00:00:00.000Z', reason: null } }),
      item({ id: 'dup', name: 'git-commit-writer' }),
      item({ id: 'dead', name: 'vue', flags: [{ rule: 'SW004', title: 'Downloads and runs remote code', file: 'a', line: 1, snippet: 'curl' }] }),
      item({ id: 'flagged-used', name: 'flagged', usage: { status: 'known', count: 1, lastUsed: '2026-10-20T00:00:00.000Z', reason: null }, flags: [{ rule: 'SW001', title: 'Instruction override phrasing', file: 'a', line: 1, snippet: 'ignore' }] }),
    ];
    const groups: OverlapGroup[] = [{ id: 'og1', harness: 'claude-code', itemIds: ['keep', 'dup'], survivorId: 'keep', score: 0.62 }];
    const verdicts = assignVerdicts(items, groups, ctx);
    expect(verdicts.get('b')).toMatchObject({ verdict: 'KEEP', action: 'none' });
    expect(verdicts.get('b')?.reason).toContain('Built into Cursor');
    expect(verdicts.get('p')?.reason).toContain('Project item');
    expect(verdicts.get('u')?.reason).toContain('Usage unknown');
    expect(verdicts.get('h')?.reason).toContain('run again in a few days');
    expect(verdicts.get('used')?.reason).toContain('Used 3×');
    expect(verdicts.get('fresh')?.reason).toContain('too new');
    expect(verdicts.get('docx')).toMatchObject({ verdict: 'KEEP', action: 'none' });
    expect(verdicts.get('docx')?.reason).toContain('part of plugin docs');
    expect(verdicts.get('lint')).toMatchObject({ verdict: 'DISABLE', action: 'plugin-config' });
    expect(verdicts.get('cur')).toMatchObject({ verdict: 'DISABLE', action: 'manual' });
    expect(verdicts.get('dup')).toMatchObject({ verdict: 'MERGE', action: 'move' });
    expect(verdicts.get('dup')?.reason).toContain('Overlaps with commit-helper');
    expect(verdicts.get('dead')).toMatchObject({ verdict: 'ARCHIVE', action: 'move' });
    expect(verdicts.get('dead')?.reason).toContain('Also flagged: downloads and runs remote code');
    expect(verdicts.get('flagged-used')?.verdict).toBe('KEEP');
  });
});
