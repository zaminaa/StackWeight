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
        if (calls > 2) throw new Error('crash');
        await movePath(src, dest);
      },
    });
    await restoreRun(ctx, {});
    expect(await readTreeHashes(home, ['.stackweight'])).toEqual(before);
  });

  it('reports a conflict and keeps both copies', async () => {
    const { home, ctx } = await homeContext('minimal');
    const plan = planPrune(await scan(ctx, { writeHistory: false }), ctx, []);
    const brand = plan.moves.find((item) => item.name === 'brand-voice');
    if (!brand) throw new Error('missing brand-voice');
    const manifest = await executePrune(plan, ctx);
    await fs.mkdir(brand.parkPath, { recursive: true });
    await fs.writeFile(path.join(brand.parkPath, 'SKILL.md'), 'kept');
    const outcome = await restoreRun(ctx, {});
    expect(outcome.conflicts).toContain('brand-voice');
    expect(await fs.readFile(path.join(brand.parkPath, 'SKILL.md'), 'utf8')).toBe('kept');
    const parked = manifest.actions.find((action) => action.type === 'move' && action.name === 'brand-voice');
    if (!parked || parked.type !== 'move') throw new Error('missing parked brand-voice');
    expect(await fs.stat(parked.to)).toBeTruthy();
  });

  it('restores a single named item', async () => {
    const { home, ctx } = await homeContext('minimal');
    const plan = planPrune(await scan(ctx, { writeHistory: false }), ctx, []);
    const brand = plan.moves.find((item) => item.name === 'brand-voice');
    if (!brand) throw new Error('missing brand-voice');
    await executePrune(plan, ctx);
    const outcome = await restoreRun(ctx, { item: 'brand-voice' });
    expect(outcome.restored).toEqual(['brand-voice']);
    expect(await fs.stat(brand.parkPath)).toBeTruthy();
    const stillGone = plan.moves.filter((item) => item.name !== 'brand-voice');
    for (const item of stillGone) await expect(fs.stat(item.parkPath)).rejects.toThrow();
  });
});
