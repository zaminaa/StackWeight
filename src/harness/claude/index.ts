import path from 'node:path';
import type { HarnessAdapter } from '../types.js';
import { SKILL_ROOTS } from '../../discover/roots.js';
import { exists } from '../../util/fs.js';
import { claudePluginItems } from './plugins.js';
import { mineClaudeUsage } from './usage.js';

async function homeOrProject(ctx: Parameters<HarnessAdapter['detect']>[0], homeDir: string, harness: HarnessAdapter['id']): Promise<boolean> {
  if (await exists(homeDir)) return true;
  for (const root of SKILL_ROOTS) {
    if (root.harness !== harness || root.scope !== 'project') continue;
    const dir = root.resolve(ctx);
    if (dir && await exists(dir)) return true;
  }
  return false;
}

export const claudeAdapter: HarnessAdapter = {
  id: 'claude-code',
  listingEvidence: 'observed',
  listingLine: (item) => `- ${item.qualifiedName}: ${item.description}\n`,
  detect: (ctx) => homeOrProject(ctx, path.join(ctx.home, '.claude'), 'claude-code'),
  pluginItems: claudePluginItems,
  mineUsage: mineClaudeUsage,
};
