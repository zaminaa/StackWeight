import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/context.js';
import { cursorPluginItems } from '../../src/harness/cursor/plugins.js';
import { FIXTURE_NOW, buildFixture, tempDir } from '../helpers/fixture.js';

describe('cursorPluginItems', () => {
  it('keeps only the newest cached plugin version', async () => {
    const home = await buildFixture('minimal', await tempDir('sw-cursor-plugins-'));
    const ctx = createContext({ home, cwd: home, now: FIXTURE_NOW, env: {}, toolVersion: '0.0.0-test' });
    const { items } = await cursorPluginItems(ctx);
    const names = items.map((item) => item.qualifiedName).sort();
    expect(names).toEqual(['superpowers:brainstorming', 'superpowers:writing-plans']);
    expect(items.find((item) => item.qualifiedName === 'superpowers:brainstorming')?.description.startsWith('Explore intent')).toBe(true);
    expect(items.some((item) => item.entryFile.includes('old111') || item.entryFile.includes('marketplaces'))).toBe(false);
  });
});
