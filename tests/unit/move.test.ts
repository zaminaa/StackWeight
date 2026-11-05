import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { hashTree } from '../../src/apply/hash.js';
import { movePath, type MoveFs } from '../../src/apply/move.js';

async function temp(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'sw-move-'));
}

describe('movePath', () => {
  it('keeps the tree hash when moving inside one directory', async () => {
    const root = await temp();
    const src = path.join(root, 'src');
    await fs.mkdir(src);
    await fs.writeFile(path.join(src, 'a.txt'), 'hello');
    const before = await hashTree(src);
    const dest = path.join(root, 'nested', 'dest');
    await movePath(src, dest);
    expect(await hashTree(dest)).toBe(before);
    expect(await fs.access(src).then(() => true, () => false)).toBe(false);
  });

  it('copies across devices when rename throws EXDEV', async () => {
    const root = await temp();
    const src = path.join(root, 'src');
    await fs.mkdir(src);
    await fs.writeFile(path.join(src, 'a.txt'), 'hello');
    const before = await hashTree(src);
    const dest = path.join(root, 'dest');
    const exdev = Object.assign(new Error('cross device'), { code: 'EXDEV' });
    const fsOverride: MoveFs = {
      rename: async () => { throw exdev; },
      cp: fs.cp,
      rm: fs.rm,
    };
    await movePath(src, dest, fsOverride);
    expect(await hashTree(dest)).toBe(before);
    await expect(fs.access(src)).rejects.toThrow();
  });

  it('leaves the source intact when copy verification fails', async () => {
    const root = await temp();
    const src = path.join(root, 'src');
    await fs.mkdir(src);
    await fs.writeFile(path.join(src, 'a.txt'), 'hello');
    const dest = path.join(root, 'dest');
    const exdev = Object.assign(new Error('cross device'), { code: 'EXDEV' });
    const fsOverride: MoveFs = {
      rename: async () => { throw exdev; },
      cp: async (_source, target) => {
        const dest = String(target);
        await fs.mkdir(dest);
        await fs.writeFile(path.join(dest, 'a.txt'), 'different');
      },
      rm: fs.rm,
    };
    await expect(movePath(src, dest, fsOverride)).rejects.toThrow('copy verification failed');
    expect(await fs.readFile(path.join(src, 'a.txt'), 'utf8')).toBe('hello');
    await expect(fs.access(dest)).rejects.toThrow();
  });

  it('refuses to overwrite an existing destination', async () => {
    const root = await temp();
    const src = path.join(root, 'src.txt');
    const dest = path.join(root, 'dest.txt');
    await fs.writeFile(src, 'a');
    await fs.writeFile(dest, 'b');
    await expect(movePath(src, dest)).rejects.toThrow('destination exists');
    expect(await fs.readFile(src, 'utf8')).toBe('a');
    expect(await fs.readFile(dest, 'utf8')).toBe('b');
  });

  it('moves a symlinked directory as a link', async () => {
    const root = await temp();
    const real = path.join(root, 'real');
    const link = path.join(root, 'link');
    await fs.mkdir(real);
    await fs.writeFile(path.join(real, 'a.txt'), 'hello');
    try {
      await fs.symlink(real, link, 'dir');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EPERM' && process.platform === 'win32') return;
      throw err;
    }
    const dest = path.join(root, 'parked');
    await movePath(link, dest);
    const st = await fs.lstat(dest);
    expect(st.isSymbolicLink()).toBe(true);
    expect(await fs.readlink(dest)).toBe(real);
  });
});
