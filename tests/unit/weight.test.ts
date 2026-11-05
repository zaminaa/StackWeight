import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeWeights, countTokens } from '../../src/analyze/weight.js';
import { createContext } from '../../src/context.js';
import { buildInventory } from '../../src/discover/inventory.js';
import { FIXTURE_NOW, buildFixture, tempDir } from '../helpers/fixture.js';

describe('computeWeights', () => {
  it('counts hello world as two tokens', () => {
    expect(countTokens('hello world')).toBe(2);
  });

  it('weighs shared-notes per agent and keeps Persian weight above zero', async () => {
    const home = await buildFixture('minimal', await tempDir('sw-weight-'));
    const ctx = createContext({
      home,
      cwd: path.join(home, 'projects', 'webapp'),
      now: FIXTURE_NOW,
      env: {},
      toolVersion: '0.0.0-test',
    });
    const inv = await buildInventory(ctx, countTokens);
    const shared = inv.items.find((item) => item.name === 'shared-notes');
    const persian = inv.items.find((item) => item.name === 'translate-fa');
    expect(shared).toBeTruthy();
    expect(persian).toBeTruthy();
    const weights = computeWeights(shared!);
    expect(weights.weight.cursor ?? 0).toBeGreaterThan((weights.weight.codex ?? 0) - 5);
    expect(weights.weightTotal).toBe((weights.weight.cursor ?? 0) + (weights.weight.codex ?? 0));
    expect(computeWeights(persian!).weightTotal).toBeGreaterThan(0);
  });
});
