import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildFixture, readTreeHashes, tempDir } from '../helpers/fixture.js';

const root = fileURLToPath(new URL('../..', import.meta.url));
const pkgVersion = (JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string }).version;

function run(args: string[], home: string) {
  return spawnSync(process.execPath, [path.join(root, 'bin', 'stackweight.js'), ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, STACKWEIGHT_NOW: '2026-11-06T12:00:00.000Z' },
  });
}

describe('cli e2e', () => {
  it('scans, prunes, restores, and rejects unknown flags', async () => {
    const home = await buildFixture('minimal', await tempDir('sw-cli-'));
    const version = run(['--version'], home);
    expect(version.status).toBe(0);
    expect(version.stdout).toBe(`${pkgVersion}\n`);

    const scan = run(['--home', home, '--no-history'], home);
    expect(scan.status).toBe(0);
    expect(scan.stdout).toContain('Stack weight');

    const json = run(['--home', home, '--json'], home);
    expect(json.status).toBe(0);
    expect(JSON.parse(json.stdout).schemaVersion).toBe(1);

    const budget = run(['--home', home, '--budget', '1', '--no-history'], home);
    expect(budget.status).toBe(2);

    const before = await readTreeHashes(home, ['.stackweight']);
    const dry = run(['prune', '--home', home], home);
    expect(dry.stdout).toContain('Dry run');
    expect(await readTreeHashes(home, ['.stackweight'])).toEqual(before);

    const pruned = run(['prune', '--yes', '--home', home], home);
    expect(pruned.status).toBe(0);
    const restored = run(['restore', '--home', home], home);
    expect(restored.status).toBe(0);
    expect(await readTreeHashes(home, ['.stackweight'])).toEqual(before);

    const list = run(['restore', '--list', '--home', home], home);
    expect(list.stdout).toMatch(/\d{8}-\d{6}-[0-9a-f]{4}/);

    const sources = run(['sources', '--home', home], home);
    expect(sources.stdout).toContain('Claude Code');

    const bogus = run(['--bogus'], home);
    expect(bogus.status).toBe(1);
  }, 30_000);
});
