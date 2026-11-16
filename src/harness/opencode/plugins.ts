import path from 'node:path';
import type { ScanContext, ScannedItem, Scope } from '../../model.js';
import { readMdItem, readSkillDir } from '../../discover/items.js';
import { exists, listMdFiles, listSubdirs } from '../../util/fs.js';
import { displayPath, samePath } from '../../util/paths.js';

// Plugin skills registered only through a skill.transform hook cannot be resolved
// statically. The directory scan is the documented approximation. npm plugins
// listed in opencode.json but not yet downloaded are skipped: not installed
// means not loaded.

export async function opencodePluginItems(ctx: ScanContext): Promise<{ items: ScannedItem[]; notes: string[] }> {
  const configHome = ctx.env.XDG_CONFIG_HOME ?? path.join(ctx.home, '.config');
  const cacheHome = ctx.env.XDG_CACHE_HOME ?? path.join(ctx.home, '.cache');
  const roots: { dir: string; scope: Scope }[] = [
    { dir: path.join(configHome, 'opencode', 'plugins'), scope: 'user' },
    { dir: path.join(cacheHome, 'opencode', 'node_modules'), scope: 'user' },
  ];
  if (!samePath(ctx.cwd, ctx.home)) {
    roots.push({ dir: path.join(ctx.cwd, '.opencode', 'plugins'), scope: 'project' });
  }
  const items: ScannedItem[] = [];
  const notes: string[] = [];
  for (const root of roots) {
    if (!(await exists(root.dir))) continue;
    for (const pluginDir of await pluginPackages(root.dir)) {
      const found = await readPluginDir(pluginDir);
      if (found.length === 0) continue;
      const pluginName = packageName(root.dir, pluginDir);
      notes.push(`found ${displayPath(pluginDir, ctx.home)}: ${found.length} items`);
      for (const item of found) {
        items.push({
          ...item,
          qualifiedName: `${pluginName}:${item.name}`,
          scope: root.scope === 'project' ? 'project' : 'user',
          loadedBy: ['opencode'],
          evidence: 'observed',
          plugin: {
            harness: 'opencode',
            key: pluginName,
            name: pluginName,
            version: null,
            enabled: null,
            scope: root.scope === 'project' ? 'project' : 'user',
          },
        });
      }
    }
  }
  return { items, notes };
}

async function pluginPackages(root: string): Promise<string[]> {
  const out: string[] = [];
  for (const sub of await listSubdirs(root)) {
    const base = path.basename(sub);
    if (base.startsWith('.')) continue;
    if (base.startsWith('@')) {
      for (const scoped of await listSubdirs(sub)) {
        if (!path.basename(scoped).startsWith('.')) out.push(scoped);
      }
      continue;
    }
    out.push(sub);
  }
  return out;
}

function packageName(root: string, pluginDir: string): string {
  const rel = path.relative(root, pluginDir);
  const parts = rel.split(path.sep).filter(Boolean);
  if (parts[0]?.startsWith('@') && parts[1]) return `${parts[0]}/${parts[1]}`;
  return parts[0] ?? path.basename(pluginDir);
}

async function readPluginDir(dir: string): Promise<NonNullable<Awaited<ReturnType<typeof readSkillDir>>>[]> {
  const out: NonNullable<Awaited<ReturnType<typeof readSkillDir>>>[] = [];
  const skills = path.join(dir, 'skills');
  if (await exists(skills)) {
    for (const sub of await listSubdirs(skills)) {
      if (path.basename(sub).startsWith('.')) continue;
      const item = await readSkillDir(sub);
      if (item) out.push(item);
    }
  }
  for (const kind of ['commands', 'agents'] as const) {
    const folder = path.join(dir, kind);
    if (!(await exists(folder))) continue;
    for (const file of await listMdFiles(folder)) {
      const item = await readMdItem(file, kind === 'commands' ? 'command' : 'agent');
      if (item) out.push(item);
    }
  }
  return out;
}
