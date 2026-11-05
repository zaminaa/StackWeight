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
    expect(writes.join('')).toMatch(/^0\.1\.0\n$/);
  });
});
