import path from 'node:path';
import type { HarnessAdapter } from '../types.js';
import { SKILL_ROOTS } from '../../discover/roots.js';
import { exists } from '../../util/fs.js';
import { toPosix } from '../../util/paths.js';
import { mineCodexUsage, readCodexListing } from './usage.js';

export const codexAdapter: HarnessAdapter = {
  id: 'codex',
  listingEvidence: 'observed',
  listingLine: (item) => `- ${item.name}: ${item.description} (file: ${toPosix(item.entryFile)})\n`,
  async detect(ctx) {
    if (await exists(path.join(ctx.home, '.codex'))) return true;
    for (const root of SKILL_ROOTS) {
      if (root.harness !== 'codex' || root.scope !== 'project') continue;
      const dir = root.resolve(ctx);
      if (dir && await exists(dir)) return true;
    }
    return false;
  },
  pluginItems: async () => ({ items: [], notes: [] }),
  mineUsage: mineCodexUsage,
  observedListing: readCodexListing,
};
