import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/context.js';
import { buildInventory } from '../../src/discover/inventory.js';
import { FIXTURE_NOW, buildFixture, tempDir } from '../helpers/fixture.js';

async function inventory(name: 'minimal' | 'broken', cwdHome: boolean) {
  const home = await buildFixture(name, await tempDir(`sw-inv-${name}-`));
  const cwd = cwdHome ? home : path.join(home, 'projects', 'webapp');
  const ctx = createContext({ home, cwd, now: FIXTURE_NOW, env: {}, toolVersion: '0.0.0-test' });
  return buildInventory(ctx, (text) => text.length);
}

describe('buildInventory', () => {
  it('finds 24 items when the project cwd is set', async () => {
    const inv = await inventory('minimal', false);
    expect(inv.items).toHaveLength(24);
    expect(inv.detected).toEqual({ 'claude-code': true, cursor: true, codex: true, opencode: true });
  });

  it('finds 23 items when cwd is home', async () => {
    const inv = await inventory('minimal', true);
    expect(inv.items).toHaveLength(23);
    expect(inv.items.some((item) => item.name === 'team-style')).toBe(false);
  });

  it('finishes the broken fixture and records the Claude registry note', async () => {
    const inv = await inventory('broken', true);
    expect(inv.notes['claude-code'].some((note) => note.includes('plugin registry unreadable'))).toBe(true);
  });
});
