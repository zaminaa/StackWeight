import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/context.js';
import { discoverRootItems } from '../../src/discover/roots.js';
import { samePath } from '../../src/util/paths.js';
import { FIXTURE_NOW, buildFixture, tempDir } from '../helpers/fixture.js';

async function discovered(cwdHome: boolean) {
  const home = await buildFixture('minimal', await tempDir('sw-roots-'));
  const cwd = cwdHome ? home : path.join(home, 'projects', 'webapp');
  const ctx = createContext({ home, cwd, now: FIXTURE_NOW, env: {}, toolVersion: '0.0.0-test' });
  const found = await discoverRootItems(ctx);
  return { home, found };
}

describe('discoverRootItems', () => {
  it('merges shared roots and skips catalogs on the webapp project', async () => {
    const { home, found } = await discovered(false);
    const byName = new Map(found.items.map((item) => [item.name, item]));
    expect(byName.get('shared-notes')?.loadedBy).toEqual(['cursor', 'codex']);
    expect(byName.get('imagegen')?.scope).toBe('builtin');
    expect(byName.get('create-rule')?.scope).toBe('builtin');
    expect(byName.get('team-style')?.scope).toBe('project');
    expect(found.items.some((item) => item.entryFile.includes('marketplaces') || item.entryFile.includes(`${path.sep}.tmp${path.sep}`) || item.entryFile.includes('/.tmp/'))).toBe(false);
    expect(found.items.some((item) => samePath(item.parkPath, path.join(home, '.codex', 'skills', '.system')))).toBe(false);
  });

  it('omits the project skill when cwd is home', async () => {
    const { found } = await discovered(true);
    expect(found.items.some((item) => item.name === 'team-style')).toBe(false);
  });
});
