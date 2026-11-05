import type { HarnessId } from '../model.js';
import { claudeAdapter } from './claude/index.js';
import { codexAdapter } from './codex/index.js';
import { cursorAdapter } from './cursor/index.js';
import { opencodeAdapter } from './opencode/index.js';
import type { HarnessAdapter } from './types.js';

export const ADAPTERS: HarnessAdapter[] = [claudeAdapter, cursorAdapter, codexAdapter, opencodeAdapter];

export function getAdapter(id: HarnessId): HarnessAdapter {
  const adapter = ADAPTERS.find((item) => item.id === id);
  if (!adapter) throw new Error(`unknown harness ${id}`);
  return adapter;
}
