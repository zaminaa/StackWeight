import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/context.js';
import { scan } from '../../src/scan.js';
import { FIXTURE_NOW, buildFixture, tempDir } from '../helpers/fixture.js';

const expected: [string, string, string, string][] = [
  ['commit-helper', 'KEEP', 'none', 'Used 3×'],
  ['git-commit-writer', 'MERGE', 'move', 'Overlaps with commit-helper'],
  ['brand-voice', 'ARCHIVE', 'move', 'last used Sep 1'],
  ['fresh-skill', 'KEEP', 'none', 'too new'],
  ['sketchy-installer', 'ARCHIVE', 'move', 'Also flagged: downloads and runs remote code'],
  ['zw-trap', 'ARCHIVE', 'move', 'Also flagged:'],
  ['reviewer', 'KEEP', 'none', 'Used 1×'],
  ['deploy', 'KEEP', 'none', 'Used 1×'],
  ['docs-kit:pdf-tools', 'KEEP', 'none', 'Used 1×'],
  ['docs-kit:docx-tools', 'KEEP', 'none', 'part of plugin docs-kit'],
  ['lint-kit:eslint-fixer', 'DISABLE', 'plugin-config', 'Plugin lint-kit'],
  ['lint-kit:prettier-runner', 'DISABLE', 'plugin-config', 'Plugin lint-kit'],
  ['react-patterns', 'KEEP', 'none', 'Used 1×'],
  ['vue-patterns', 'ARCHIVE', 'move', 'no use recorded in that window'],
  ['create-rule', 'KEEP', 'none', 'Built into Cursor'],
  ['superpowers:brainstorming', 'KEEP', 'none', 'Used 1×'],
  ['superpowers:writing-plans', 'KEEP', 'none', 'part of plugin superpowers'],
  ['imagegen', 'KEEP', 'none', 'Built into Codex'],
  ['sql-helper', 'KEEP', 'none', 'Used 1×'],
  ['csv-cleaner', 'ARCHIVE', 'move', 'no use recorded'],
  ['shared-notes', 'ARCHIVE', 'move', 'no use recorded'],
  ['translate-fa', 'KEEP', 'none', 'Usage unknown'],
  ['planner', 'KEEP', 'none', 'Usage unknown'],
  ['team-style', 'KEEP', 'none', 'Project item'],
];

describe('verdict contract', () => {
  it('matches every minimal verdict', async () => {
    const home = await buildFixture('minimal', await tempDir('sw-contract-'));
    const ctx = createContext({
      home,
      cwd: path.join(home, 'projects', 'webapp'),
      now: FIXTURE_NOW,
      env: {},
      toolVersion: '0.0.0-test',
    });
    const result = await scan(ctx, { writeHistory: false });
    expect(result.items).toHaveLength(24);
    const byName = new Map(result.items.map((item) => [item.qualifiedName, item]));
    for (const [name, verdict, action, reason] of expected) {
      const item = byName.get(name);
      expect(item, name).toBeTruthy();
      expect(item?.verdict, name).toBe(verdict);
      expect(item?.action, name).toBe(action);
      expect(item?.reason, name).toContain(reason);
    }
    for (const banned of ['legacy', 'never', 'never2', 'x']) {
      expect(result.items.some((item) => item.name === banned || item.qualifiedName === banned)).toBe(false);
    }
    expect(result.totals.verdictCounts).toEqual({ KEEP: 15, ARCHIVE: 6, MERGE: 1, DISABLE: 2 });
    expect(result.overlapGroups).toHaveLength(1);
    expect(result.harnesses.map((harness) => harness.detected)).toEqual([true, true, true, true]);
    expect(result.totals.deadTokensResent).toBeGreaterThan(0);
  });
});
