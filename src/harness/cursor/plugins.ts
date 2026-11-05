import path from 'node:path';
import type { ScanContext, ScannedItem } from '../../model.js';
import { readSkillDir } from '../../discover/items.js';
import { listSubdirs, statSafe } from '../../util/fs.js';

export async function cursorPluginItems(ctx: ScanContext): Promise<{ items: ScannedItem[]; notes: string[] }> {
  const notes: string[] = [];
  const items: ScannedItem[] = [];
  const cache = path.join(ctx.home, '.cursor', 'plugins', 'cache');
  for (const market of await listSubdirs(cache)) {
    for (const pluginDir of await listSubdirs(market)) {
      const versions = await listSubdirs(pluginDir);
      if (versions.length === 0) continue;
      const ranked = await Promise.all(versions.map(async (dir) => ({
        dir,
        mtime: (await statSafe(dir))?.mtimeMs ?? 0,
        name: path.basename(dir),
      })));
      ranked.sort((a, b) => b.mtime - a.mtime || b.name.localeCompare(a.name));
      const newest = ranked[0];
      if (!newest) continue;
      if (ranked.length > 1) notes.push(`using newest of ${ranked.length} cached versions for ${path.basename(pluginDir)}`);
      const pluginName = path.basename(pluginDir);
      const skills = path.join(newest.dir, 'skills');
      for (const skillDir of await listSubdirs(skills)) {
        if (path.basename(skillDir).startsWith('.')) continue;
        const raw = await readSkillDir(skillDir);
        if (!raw) continue;
        items.push({
          ...raw,
          qualifiedName: `${pluginName}:${raw.name}`,
          scope: 'user',
          loadedBy: ['cursor'],
          evidence: 'observed',
          installedAt: new Date(newest.mtime).toISOString(),
          plugin: {
            harness: 'cursor',
            key: `${path.basename(market)}/${pluginName}`,
            name: pluginName,
            version: newest.name,
            enabled: null,
            scope: 'user',
          },
        });
      }
    }
  }
  return { items, notes };
}
