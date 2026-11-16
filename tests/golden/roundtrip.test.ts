import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { movePath } from '../../src/apply/move.js';
import { executePrune, planPrune } from '../../src/apply/prune.js';
import { restoreRun } from '../../src/apply/restore.js';
import { createContext } from '../../src/context.js';
import { scan } from '../../src/scan.js';
import { FIXTURE_NOW, buildFixture, readTreeHashes, tempDir } from '../helpers/fixture.js';

async function homeContext(name: 'minimal' | 'bloated') {
  const home = await buildFixture(name, await tempDir(`sw-round-${name}-`));
  const ctx = createContext({
    home,
    cwd: home,
    now: FIXTURE_NOW,
    env: { STACKWEIGHT_HOME: path.join(home, '.stackweight') },
    toolVersion: '0.0.0-test',
  });
  return { home, ctx };
}

describe('prune restore round trip', () => {
  it('restores the minimal tree byte for byte', async () => {
    const { home, ctx } = await homeContext('minimal');
    const before = await readTreeHashes(home, ['.stackweight']);
    const plan = planPrune(await scan(ctx, { writeHistory: false }), ctx, []);
    await executePrune(plan, ctx);
    expect(await readTreeHashes(home, ['.stackweight'])).not.toEqual(before);
    await restoreRun(ctx, {});
    expect(await readTreeHashes(home, ['.stackweight'])).toEqual(before);
  });

  it('restores the bloated tree byte for byte', async () => {
    const { home, ctx } = await homeContext('bloated');
    const before = await readTreeHashes(home, ['.stackweight']);
    await executePrune(planPrune(await scan(ctx, { writeHistory: false }), ctx, []), ctx);
    await restoreRun(ctx, {});
    expect(await readTreeHashes(home, ['.stackweight'])).toEqual(before);
  }, 20_000);

  it('undoes a prune that crashed after two moves', async () => {
    const { home, ctx } = await homeContext('minimal');
    const before = await readTreeHashes(home, ['.stackweight']);
    const plan = planPrune(await scan(ctx, { writeHistory: false }), ctx, []);
    let calls = 0;
    await executePrune(plan, ctx, {
      movePath: async (src, dest) => {
        calls += 1;
        if (calls > 1) throw new Error('crash');
        await movePath(src, dest);
      },
    });
    await restoreRun(ctx, {});
    expect(await readTreeHashes(home, ['.stackweight'])).toEqual(before);
  });

  it('reports a conflict and keeps both copies', async () => {
    const { home, ctx } = await homeContext('minimal');
    const plan = planPrune(await scan(ctx, { writeHistory: false }), ctx, []);
    const parkedItem = plan.moves.find((item) => item.name === 'csv-cleaner');
    if (!parkedItem) throw new Error('missing csv-cleaner');
    const manifest = await executePrune(plan, ctx);
    await fs.mkdir(parkedItem.parkPath, { recursive: true });
    await fs.writeFile(path.join(parkedItem.parkPath, 'SKILL.md'), 'kept');
    const outcome = await restoreRun(ctx, {});
    expect(outcome.conflicts).toContain('csv-cleaner');
    expect(await fs.readFile(path.join(parkedItem.parkPath, 'SKILL.md'), 'utf8')).toBe('kept');
    const parked = manifest.actions.find((action) => action.type === 'move' && action.name === 'csv-cleaner');
    if (!parked || parked.type !== 'move') throw new Error('missing parked csv-cleaner');
    expect(await fs.stat(parked.to)).toBeTruthy();
  });

  it('restores a single named item', async () => {
    const { home, ctx } = await homeContext('minimal');
    const plan = planPrune(await scan(ctx, { writeHistory: false }), ctx, []);
    const parkedItem = plan.moves.find((item) => item.name === 'csv-cleaner');
    if (!parkedItem) throw new Error('missing csv-cleaner');
    await executePrune(plan, ctx);
    const outcome = await restoreRun(ctx, { item: 'csv-cleaner' });
    expect(outcome.restored).toEqual(['csv-cleaner']);
    expect(await fs.stat(parkedItem.parkPath)).toBeTruthy();
    const stillGone = plan.moves.filter((item) => item.name !== 'csv-cleaner');
    for (const item of stillGone) await expect(fs.stat(item.parkPath)).rejects.toThrow();
  });
});
