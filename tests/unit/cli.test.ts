import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from '../../src/cli.js';

describe('cli', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints the package version', async () => {
    const writes: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });
    const code = await main(['--version']);
    expect(code).toBe(0);
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };
    expect(writes.join('')).toBe(`${pkg.version}\n`);
  });
});
