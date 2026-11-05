import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildFixture, tempDir } from '../helpers/fixture.js';

const root = fileURLToPath(new URL('../..', import.meta.url));
const preload = path.join(root, 'tests', 'helpers', 'block-network.mjs');

function run(args: string[], home: string) {
  return spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, path.join(root, 'bin', 'stackweight.js'), ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, STACKWEIGHT_NOW: '2026-11-06T12:00:00.000Z' },
  });
}

describe('no network', () => {
  it('scans and prunes the bloated fixture without opening a socket', async () => {
    const home = await buildFixture('bloated', await tempDir('sw-nonet-'));
    for (const args of [
      ['--home', home, '--no-history'],
      ['--home', home, '--json'],
      ['prune', '--yes', '--home', home],
      ['restore', '--home', home],
      ['sources', '--home', home],
    ]) {
      const result = run(args, home);
      expect(result.stderr ?? '').not.toContain('NETWORK_ATTEMPT');
      expect(result.status, `${args.join(' ')}\n${result.stderr}`).toBe(0);
    }
  }, 60_000);
});
