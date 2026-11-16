import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { attributeUsage } from '../../src/analyze/attribute.js';
import { createContext } from '../../src/context.js';
import { buildInventory } from '../../src/discover/inventory.js';
import { FIXTURE_NOW, buildFixture, tempDir } from '../helpers/fixture.js';

describe('attributeUsage', () => {
  it('attributes minimal fixture events and leaves OpenCode unknown', async () => {
    const home = await buildFixture('minimal', await tempDir('sw-attr-'));
    const ctx = createContext({
      home,
      cwd: path.join(home, 'projects', 'webapp'),
      now: FIXTURE_NOW,
      env: {},
      toolVersion: '0.0.0-test',
    });
    const inv = await buildInventory(ctx, (text) => text.length);
    const usage = attributeUsage(inv.items, inv.usage, ctx);
    const item = (name: string) => {
      const found = inv.items.find((entry) => entry.qualifiedName === name || entry.name === name);
      if (!found) throw new Error(`missing ${name}`);
      const row = usage.get(found.id);
      if (!row) throw new Error(`no usage ${name}`);
      return row;
    };
    expect(item('commit-helper')).toMatchObject({ count: 3, lastUsed: '2026-11-01T09:00:00.000Z' });
    expect(item('brand-voice').status).toBe('unknown');
    expect(item('git-commit-writer').status).toBe('unknown');
    expect(item('react-patterns').count).toBe(1);
    expect(item('superpowers:brainstorming').count).toBe(1);
    expect(item('sql-helper').count).toBe(1);
    expect(item('shared-notes').status).toBe('unknown');
    expect(item('translate-fa').status).toBe('unknown');
    expect(item('translate-fa').reason).toMatch(/OpenCode/);
    expect(item('reviewer').count).toBe(1);
    expect(item('deploy').count).toBe(1);
    expect(item('docs-kit:pdf-tools').count).toBe(1);
  });
});
