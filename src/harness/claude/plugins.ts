import path from 'node:path';
import type { ScanContext, ScannedItem } from '../../model.js';
import { readMdItem, readSkillDir } from '../../discover/items.js';
import { exists, listMdFiles, listSubdirs, readJsonSafe } from '../../util/fs.js';
import { samePath } from '../../util/paths.js';

interface InstallEntry {
  scope?: string;
  installPath?: string;
  version?: string;
  installedAt?: string;
  lastUpdated?: string;
  projectPath?: string;
}

interface Registry {
  version?: number;
  plugins?: Record<string, InstallEntry[]>;
}

export async function claudePluginItems(ctx: ScanContext): Promise<{ items: ScannedItem[]; notes: string[] }> {
  const registryPath = path.join(ctx.home, '.claude', 'plugins', 'installed_plugins.json');
  const registry = await readJsonSafe<Registry>(registryPath);
  if (registry === null && !(await exists(registryPath))) return { items: [], notes: [] };
  if (!registry || registry.version !== 2 || !registry.plugins) {
    return { items: [], notes: ['Claude plugin registry unreadable or unknown version; plugin skills skipped'] };
  }

  const enabled = await mergedEnabled(ctx);
  const notes: string[] = [];
  let disabled = 0;
  const items: ScannedItem[] = [];

  for (const [key, entries] of Object.entries(registry.plugins)) {
    const eligible: InstallEntry[] = [];
    for (const entry of entries) {
      if (entry.scope === 'user') {
        eligible.push(entry);
        continue;
      }
      if (entry.scope === 'project' && entry.projectPath && samePath(entry.projectPath, ctx.cwd)) {
        eligible.push(entry);
        continue;
      }
      if (entry.scope && entry.scope !== 'user' && entry.scope !== 'project') {
        notes.push(`skipped scope ${entry.scope} for ${key}`);
      }
      if (entry.scope === 'project' && (!entry.projectPath || !samePath(entry.projectPath, ctx.cwd))) {
        notes.push(`skipped scope project for ${key}`);
      }
    }
    if (eligible.length === 0) continue;
    eligible.sort((a, b) => {
      if (a.scope === 'project' && b.scope !== 'project') return -1;
      if (b.scope === 'project' && a.scope !== 'project') return 1;
      return String(b.lastUpdated ?? '').localeCompare(String(a.lastUpdated ?? ''));
    });
    const chosen = eligible[0];
    if (!chosen?.installPath) continue;
    if (enabled[key] === false) {
      disabled += 1;
      continue;
    }
    const pluginName = key.split('@')[0] ?? key;
    const scope = chosen.scope === 'project' ? 'project' : 'user';
    const enabledFlag = Object.prototype.hasOwnProperty.call(enabled, key) ? enabled[key] ?? null : null;
    const found = await readPluginDir(path.resolve(ctx.home, chosen.installPath));
    for (const item of found) {
      items.push({
        ...item,
        qualifiedName: `${pluginName}:${item.name}`,
        scope,
        loadedBy: ['claude-code'],
        evidence: 'observed',
        plugin: {
          harness: 'claude-code',
          key,
          name: pluginName,
          version: chosen.version ?? null,
          enabled: enabledFlag,
          scope,
        },
        installedAt: chosen.installedAt ?? item.installedAt,
      });
    }
  }
  if (disabled > 0) notes.push(`${disabled} Claude plugins already disabled`);
  return { items, notes };
}

async function mergedEnabled(ctx: ScanContext): Promise<Record<string, boolean>> {
  const files = [
    path.join(ctx.home, '.claude', 'settings.json'),
    path.join(ctx.cwd, '.claude', 'settings.json'),
    path.join(ctx.cwd, '.claude', 'settings.local.json'),
  ];
  const enabled: Record<string, boolean> = {};
  for (const file of files) {
    const json = await readJsonSafe<{ enabledPlugins?: Record<string, boolean> }>(file);
    if (!json?.enabledPlugins) continue;
    Object.assign(enabled, json.enabledPlugins);
  }
  return enabled;
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
