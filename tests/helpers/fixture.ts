import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toPosix } from '../../src/util/paths.js';

export const FIXTURE_NOW = new Date('2026-11-06T12:00:00.000Z');

const BASE_MTIME = new Date('2026-08-01T00:00:00Z');

function fixtureDir(name: string): string {
  return fileURLToPath(new URL(`../fixtures/${name}/`, import.meta.url));
}

async function walk(dir: string, visit: (full: string, rel: string, isDir: boolean) => Promise<void>): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, visit);
      await visit(full, '', true);
    } else if (entry.isFile()) {
      await visit(full, '', false);
    }
  }
}

async function replaceTokens(dest: string): Promise<void> {
  const homeToken = JSON.stringify(dest).slice(1, -1);
  const posix = toPosix(dest);
  await walk(dest, async (full, _rel, isDir) => {
    if (isDir) return;
    const text = await fs.readFile(full, 'utf8');
    if (!text.includes('{{')) return;
    const next = text
      .replaceAll('{{HOME}}', homeToken)
      .replaceAll('{{HOME_POSIX}}', posix)
      .replaceAll('{{ZWSP}}', '\u200B')
      .replaceAll('{{TAG_A}}', '\u{E0041}')
      .replaceAll('{{ZWNJ}}', '\u200C');
    await fs.writeFile(full, next);
  });
}

async function applyMtimes(dest: string, mtimeFile: string): Promise<void> {
  await walk(dest, async (full) => {
    await fs.utimes(full, BASE_MTIME, BASE_MTIME);
  });
  await fs.utimes(dest, BASE_MTIME, BASE_MTIME);
  let raw: string;
  try {
    raw = await fs.readFile(mtimeFile, 'utf8');
  } catch {
    return;
  }
  const table = JSON.parse(raw) as Record<string, string>;
  const files: [string, Date][] = [];
  const dirs: [string, Date, number][] = [];
  for (const [rel, iso] of Object.entries(table)) {
    const full = path.join(dest, ...rel.split('/'));
    const when = new Date(iso);
    const st = await fs.lstat(full);
    if (st.isDirectory()) dirs.push([full, when, rel.split('/').length]);
    else files.push([full, when]);
  }
  for (const [full, when] of files) await fs.utimes(full, when, when);
  dirs.sort((a, b) => b[2] - a[2]);
  for (const [full, when] of dirs) await fs.utimes(full, when, when);
}

export async function buildFixture(name: 'minimal' | 'broken' | 'bloated', dest: string): Promise<string> {
  const home = path.resolve(dest);
  if (name === 'bloated') {
    try {
      const mod = await import('../fixtures/bloated/generate.js') as { generateBloated: (home: string) => Promise<void> };
      await mod.generateBloated(home);
      return home;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'ERR_MODULE_NOT_FOUND') throw new Error('bloated fixture not built yet');
      throw err;
    }
  }
  await fs.cp(path.join(fixtureDir(name), 'home'), home, { recursive: true });
  await replaceTokens(home);
  await applyMtimes(home, path.join(fixtureDir(name), '_mtimes.json'));
  return home;
}

function ignored(rel: string, ignore: string[]): boolean {
  return ignore.some((entry) => rel === entry || rel.startsWith(`${entry.replace(/\/+$/, '')}/`));
}

export async function readTreeHashes(root: string, ignore: string[] = []): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  async function visit(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = toPosix(path.relative(root, full));
      if (ignored(rel, ignore)) continue;
      if (entry.isSymbolicLink()) {
        out[rel] = `link:${await fs.readlink(full)}`;
      } else if (entry.isDirectory()) {
        await visit(full);
      } else if (entry.isFile()) {
        const bytes = await fs.readFile(full);
        out[rel] = createHash('sha256').update(bytes).digest('hex');
      }
    }
  }
  await visit(root);
  return out;
}

export async function tempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}
