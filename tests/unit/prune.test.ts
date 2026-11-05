import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { acquireLock } from '../../src/apply/manifest.js';
import { executePrune, planPrune } from '../../src/apply/prune.js';
import { movePath } from '../../src/apply/move.js';
import { createContext } from '../../src/context.js';
import { scan } from '../../src/scan.js';
import { FIXTURE_NOW, buildFixture, tempDir } from '../helpers/fixture.js';

describe('executePrune', () => {
  it('parks seven items and disables the unused Claude plugin', async () => {
    const home = await buildFixture('minimal', await tempDir('sw-prune-'));
    const ctx = createContext({ home, cwd: home, now: FIXTURE_NOW, env: { STACKWEIGHT_HOME: path.join(home, '.stackweight') }, toolVersion: '0.0.0-test' });
    const result = await scan(ctx, { writeHistory: false });
    const plan = planPrune(result, ctx, []);
    const manifest = await executePrune(plan, ctx);
    const moves = manifest.actions.filter((action) => action.type === 'move');
    expect(moves).toHaveLength(7);
    const names = moves.map((action) => action.name).sort();
    expect(names).toEqual(['brand-voice', 'csv-cleaner', 'git-commit-writer', 'shared-notes', 'sketchy-installer', 'vue-patterns', 'zw-trap']);
    for (const action of moves) {
      if (action.type !== 'move') continue;
      await expect(fs.access(action.from)).rejects.toThrow();
      await expect(fs.access(action.to)).resolves.toBeUndefined();
    }
    const settings = JSON.parse(await fs.readFile(path.join(home, '.claude', 'settings.json'), 'utf8')) as { enabledPlugins: Record<string, boolean> };
    expect(settings.enabledPlugins['lint-kit@acme']).toBe(false);
    expect(settings.enabledPlugins['docs-kit@acme']).toBe(true);
    expect(settings.enabledPlugins['old-kit@acme']).toBe(false);
    expect(manifest.status).toBe('complete');
  });

  it('rejects a second lock', async () => {
    const home = await tempDir('sw-lock-');
    const ctx = createContext({ home, cwd: home, env: { STACKWEIGHT_HOME: home }, toolVersion: '0.0.0-test' });
    const release = await acquireLock(ctx);
    await expect(acquireLock(ctx)).rejects.toThrow('Another StackWeight prune/restore is running');
    await release();
  });

  it('marks the run partial when one move is denied', async () => {
    const home = await buildFixture('minimal', await tempDir('sw-prune-eperm-'));
    const ctx = createContext({ home, cwd: home, now: FIXTURE_NOW, env: { STACKWEIGHT_HOME: path.join(home, '.stackweight') }, toolVersion: '0.0.0-test' });
    const plan = planPrune(await scan(ctx, { writeHistory: false }), ctx, []);
    const manifest = await executePrune(plan, ctx, {
      movePath: async (src, dest) => {
        if (src.includes('brand-voice')) throw Object.assign(new Error('EPERM'), { code: 'EPERM' });
        await movePath(src, dest);
      },
    });
    expect(manifest.status).toBe('partial');
    const moves = manifest.actions.filter((action) => action.type === 'move');
    expect(moves.filter((action) => action.state === 'done')).toHaveLength(6);
    expect(moves.filter((action) => action.state === 'failed')).toHaveLength(1);
  });
});
