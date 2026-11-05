import path from 'node:path';
import type { HarnessAdapter } from '../types.js';
import { SKILL_ROOTS } from '../../discover/roots.js';
import { exists } from '../../util/fs.js';
import { mineOpencodeUsage } from './usage.js';

export const opencodeAdapter: HarnessAdapter = {
  id: 'opencode',
  listingEvidence: 'assumed',
  listingLine: (item) => `- ${item.name}: ${item.description}\n`,
  async detect(ctx) {
    const config = path.join(ctx.env.XDG_CONFIG_HOME ?? path.join(ctx.home, '.config'), 'opencode');
    const data = path.join(ctx.env.XDG_DATA_HOME ?? path.join(ctx.home, '.local', 'share'), 'opencode');
    if (await exists(config) || await exists(data)) return true;
    for (const root of SKILL_ROOTS) {
      if (root.harness !== 'opencode' || root.scope !== 'project') continue;
      const dir = root.resolve(ctx);
      if (dir && await exists(dir)) return true;
    }
    return false;
  },
  pluginItems: async () => ({ items: [], notes: [] }),
  mineUsage: mineOpencodeUsage,
};
