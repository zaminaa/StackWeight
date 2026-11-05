import path from 'node:path';
import type { HarnessAdapter } from '../types.js';
import { SKILL_ROOTS } from '../../discover/roots.js';
import { exists } from '../../util/fs.js';
import { cursorPluginItems } from './plugins.js';
import { mineCursorUsage } from './usage.js';

export const cursorAdapter: HarnessAdapter = {
  id: 'cursor',
  listingEvidence: 'observed',
  listingLine: (item) => `<agent_skill fullPath="${item.entryFile}">${item.description}</agent_skill>\n`,
  async detect(ctx) {
    if (await exists(path.join(ctx.home, '.cursor'))) return true;
    for (const root of SKILL_ROOTS) {
      if (root.harness !== 'cursor' || root.scope !== 'project') continue;
      const dir = root.resolve(ctx);
      if (dir && await exists(dir)) return true;
    }
    return false;
  },
  pluginItems: cursorPluginItems,
  mineUsage: mineCursorUsage,
};
