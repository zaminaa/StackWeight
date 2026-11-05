import { createHash } from 'node:crypto';
import path from 'node:path';
import type { ItemKind, ScannedItem } from '../model.js';
import { fmString, parseFrontmatter } from '../util/frontmatter.js';
import { readTextSafe, statSafe } from '../util/fs.js';
import { normalizeForCompare } from '../util/paths.js';

export type RawItem = Omit<ScannedItem, 'loadedBy' | 'evidence' | 'scope' | 'plugin' | 'qualifiedName'>;

export function makeItemId(parkPath: string): string {
  return createHash('sha1').update(normalizeForCompare(parkPath)).digest('hex').slice(0, 12);
}

export function hashText(text: string): string {
  return createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
}

export async function readSkillDir(dir: string): Promise<RawItem | null> {
  const entryFile = path.join(dir, 'SKILL.md');
  const text = await readTextSafe(entryFile);
  if (text === null) return null;
  const dirStat = await statSafe(dir);
  const fm = parseFrontmatter(text);
  const name = fmString(fm.data, 'name') ?? path.basename(dir);
  return {
    id: makeItemId(dir),
    kind: 'skill',
    name,
    description: fmString(fm.data, 'description') ?? '',
    entryFile,
    parkPath: dir,
    installedAt: dirStat ? dirStat.mtime.toISOString() : null,
    contentHash: hashText(text),
    warnings: fm.warnings,
  };
}

export async function readMdItem(file: string, kind: 'command' | 'agent'): Promise<RawItem | null> {
  const text = await readTextSafe(file);
  if (text === null) return null;
  const st = await statSafe(file);
  const fm = parseFrontmatter(text);
  const name = fmString(fm.data, 'name') ?? path.basename(file, '.md');
  return {
    id: makeItemId(file),
    kind,
    name,
    description: fmString(fm.data, 'description') ?? '',
    entryFile: file,
    parkPath: file,
    installedAt: st ? st.mtime.toISOString() : null,
    contentHash: hashText(text),
    warnings: fm.warnings,
  };
}
