import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcRoot = fileURLToPath(new URL('../../src/', import.meta.url));
const deletePattern = /\b(rm|rmSync|unlink|unlinkSync|rmdir|rmdirSync|truncate|writeFileSync)\b/;
const writePattern = /\b(writeFile|appendFile|rename)\b/;

async function files(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await files(full));
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('no-delete guard', () => {
  it('keeps deletion and writes inside the allowed files', async () => {
    const found = await files(srcRoot);
    const deletions: string[] = [];
    const writes: string[] = [];
    for (const file of found) {
      const text = await fs.readFile(file, 'utf8');
      const rel = path.relative(srcRoot, file).replace(/\\/g, '/');
      if (deletePattern.test(text)) deletions.push(rel);
      if (writePattern.test(text)) writes.push(rel);
    }
    expect(deletions.sort()).toEqual(['apply/claude-config.ts', 'apply/move.ts']);
    const allowed = /^(apply\/.*|state\/history\.ts|cli\.ts)$/;
    expect(writes.filter((rel) => !allowed.test(rel))).toEqual([]);
  });
});
