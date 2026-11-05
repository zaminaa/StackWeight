import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function hashTree(target: string): Promise<string> {
  return hashNode(target, '');
}

async function hashNode(full: string, rel: string): Promise<string> {
  const st = await fs.lstat(full);
  if (st.isSymbolicLink()) {
    return sha256(`link:${await fs.readlink(full)}`);
  }
  if (st.isFile()) {
    const bytes = await fs.readFile(full);
    return sha256(Buffer.concat([Buffer.from(`file:${rel}`), bytes]));
  }
  const names = (await fs.readdir(full)).sort((a, b) => a.localeCompare(b));
  const lines: string[] = [];
  for (const name of names) {
    const childRel = rel ? `${rel}/${name}` : name;
    lines.push(`${childRel}:${await hashNode(path.join(full, name), childRel)}`);
  }
  return sha256(lines.join('\n'));
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
