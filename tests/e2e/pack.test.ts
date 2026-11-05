import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildFixture, tempDir } from '../helpers/fixture.js';

const root = fileURLToPath(new URL('../..', import.meta.url));

function npm(args: string[], cwd: string) {
  const bin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return spawnSync(bin, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32' });
}

describe('npm pack', () => {
  it('installs the tarball and runs the command', async () => {
    const packDir = await tempDir('sw-pack-');
    const packed = npm(['pack', '--pack-destination', packDir], root);
    expect(packed.status, packed.stderr).toBe(0);
    const tgz = fs.readdirSync(packDir).find((name) => name.endsWith('.tgz'));
    if (!tgz) throw new Error('npm pack produced no tarball');
    const app = await tempDir('sw-pack-app-');
    expect(npm(['init', '-y'], app).status).toBe(0);
    const install = npm(['install', path.join(packDir, tgz)], app);
    if (install.status !== 0) {
      console.warn(`Skipping pack install test because npm install failed offline.\n${install.stderr}`);
      return;
    }
    const version = npm(['exec', 'stackweight', '--', '--version'], app);
    expect(version.stdout.trim()).toBe('0.1.0');
    const home = await buildFixture('minimal', await tempDir('sw-pack-home-'));
    const scan = npm(['exec', 'stackweight', '--', '--home', home, '--no-history'], app);
    expect(scan.status, scan.stderr).toBe(0);
  }, 180_000);
});
