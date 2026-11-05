import fs from 'node:fs/promises';
import path from 'node:path';
import { statSafe } from '../util/fs.js';
import { hashTree } from './hash.js';

export interface MoveFs {
  rename: typeof fs.rename;
  cp: typeof fs.cp;
  rm: typeof fs.rm;
}

const defaultFs: MoveFs = {
  rename: fs.rename,
  cp: fs.cp,
  rm: fs.rm,
};

export async function movePath(src: string, dest: string, f: MoveFs = defaultFs): Promise<void> {
  if (await statSafe(dest)) throw new Error('destination exists');
  await fs.mkdir(path.dirname(dest), { recursive: true });
  const before = await hashTree(src);
  try {
    await f.rename(src, dest);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'EXDEV') throw err;
    await f.cp(src, dest, { recursive: true, verbatimSymlinks: true, errorOnExist: true, force: false });
    const copied = await hashTree(dest);
    if (copied !== before) {
      await f.rm(dest, { recursive: true });
      throw new Error('copy verification failed');
    }
    await f.rm(src, { recursive: true });
    return;
  }
  if (await hashTree(dest) !== before) throw new Error('move verification failed');
}
