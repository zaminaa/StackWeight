import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/context.js';
import { scan } from '../../src/scan.js';
import { FIXTURE_NOW, buildFixture, tempDir } from '../helpers/fixture.js';
import { normalizeResult } from './normalize.js';

describe('minimal golden', () => {
  it('matches the normalized scan snapshot', async () => {
    const home = await buildFixture('minimal', await tempDir('sw-golden-'));
    const ctx = createContext({
      home,
      cwd: path.join(home, 'projects', 'webapp'),
      now: FIXTURE_NOW,
      env: {},
      toolVersion: '0.0.0-test',
    });
    const result = await scan(ctx, { writeHistory: false });
    await expect(JSON.stringify(normalizeResult(result, home), null, 2)).toMatchFileSnapshot('./__snapshots__/minimal.scan.json');
  });

  it('scans the bloated fixture in under 3 seconds', async () => {
    const home = await buildFixture('bloated', await tempDir('sw-golden-bloated-'));
    const ctx = createContext({ home, cwd: home, now: FIXTURE_NOW, env: {}, toolVersion: '0.0.0-test' });
    const started = Date.now();
    await scan(ctx, { writeHistory: false });
    expect(Date.now() - started).toBeLessThan(3000);
  });
});
