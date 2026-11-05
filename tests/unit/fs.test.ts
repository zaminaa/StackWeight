import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { forEachLine, readTextSafe } from '../../src/util/fs.js';

describe('fs helpers', () => {
  it('returns null for a missing file', async () => {
    const missing = path.join(os.tmpdir(), 'stackweight-missing-file.txt');
    expect(await readTextSafe(missing)).toBeNull();
  });

  it('resolves forEachLine on a missing file', async () => {
    const missing = path.join(os.tmpdir(), 'stackweight-missing-lines.txt');
    await expect(forEachLine(missing, () => {})).resolves.toBeUndefined();
  });

  it('reads text and strips a leading BOM', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sw-fs-'));
    const file = path.join(dir, 'note.txt');
    await fs.writeFile(file, '\uFEFFhello');
    expect(await readTextSafe(file)).toBe('hello');
  });
});
