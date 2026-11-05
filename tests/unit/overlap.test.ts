import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { attributeUsage } from '../../src/analyze/attribute.js';
import { findOverlaps, type AnalyzedItemDraft } from '../../src/analyze/overlap.js';
import { computeWeights, countTokens } from '../../src/analyze/weight.js';
import { createContext } from '../../src/context.js';
import { buildInventory } from '../../src/discover/inventory.js';
import { FIXTURE_NOW, buildFixture, tempDir } from '../helpers/fixture.js';

async function drafts(name: 'minimal' | 'bloated', cwd: (home: string) => string): Promise<AnalyzedItemDraft[]> {
  const home = await buildFixture(name, await tempDir(`sw-overlap-${name}-`));
  const ctx = createContext({ home, cwd: cwd(home), now: FIXTURE_NOW, env: {}, toolVersion: '0.0.0-test' });
  const inv = await buildInventory(ctx, countTokens);
  const usage = attributeUsage(inv.items, inv.usage, ctx);
  return inv.items.map((item) => ({
    ...item,
    usage: usage.get(item.id) ?? { status: 'known', count: 0, lastUsed: null, reason: null },
    weightTotal: computeWeights(item).weightTotal,
  }));
}

function names(items: AnalyzedItemDraft[], ids: string[]): string[] {
  return ids.map((id) => items.find((item) => item.id === id)?.qualifiedName ?? id).sort();
}

describe('findOverlaps', () => {
  it('groups the two commit skills on minimal', async () => {
    const items = await drafts('minimal', (home) => path.join(home, 'projects', 'webapp'));
    const groups = findOverlaps(items);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.harness).toBe('claude-code');
    expect(names(items, groups[0]?.itemIds ?? [])).toEqual(['commit-helper', 'git-commit-writer']);
    expect(items.find((item) => item.id === groups[0]?.survivorId)?.qualifiedName).toBe('commit-helper');
  });

  it('finds the five bloated clusters', async () => {
    const items = await drafts('bloated', (home) => home);
    const groups = findOverlaps(items);
    const sets = groups.map((group) => names(items, group.itemIds).join('|')).sort();
    expect(sets).toEqual([
      'commit-helper|git-commit-writer|smart-commit',
      'frontend-design|ui-designer|web-ui-polish',
      'meeting-notes|minutes-writer|notes-taker',
      'pdf-extract|pdf-reader|pdf-toolkit',
      'red-green-refactor|tdd-workflow|test-first',
    ]);
  });
});
