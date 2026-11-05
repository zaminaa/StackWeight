import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { restoreRun } from '../../src/apply/restore.js';
import { createContext } from '../../src/context.js';
import { FIXTURE_NOW, tempDir } from '../helpers/fixture.js';

describe('restoreRun', () => {
  it('throws when nothing was pruned', async () => {
    const home = await tempDir('sw-restore-empty-');
    const ctx = createContext({ home, cwd: home, now: FIXTURE_NOW, env: { STACKWEIGHT_HOME: path.join(home, '.stackweight') }, toolVersion: '0.0.0-test' });
    await expect(restoreRun(ctx, {})).rejects.toThrow('Nothing to restore.');
  });
});
