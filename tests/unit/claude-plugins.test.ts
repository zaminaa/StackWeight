import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/context.js';
import { claudePluginItems } from '../../src/harness/claude/plugins.js';
import { FIXTURE_NOW, buildFixture, tempDir } from '../helpers/fixture.js';

describe('claudePluginItems', () => {
  it('reads enabled plugins and counts disabled ones on minimal', async () => {
    const home = await buildFixture('minimal', await tempDir('sw-claude-plugins-'));
    const ctx = createContext({ home, cwd: home, now: FIXTURE_NOW, env: {}, toolVersion: '0.0.0-test' });
    const { items, notes } = await claudePluginItems(ctx);
    const names = items.map((item) => item.qualifiedName).sort();
    expect(names).toEqual([
      'docs-kit:docx-tools',
      'docs-kit:pdf-tools',
      'lint-kit:eslint-fixer',
      'lint-kit:prettier-runner',
    ]);
    expect(names).not.toContain('legacy');
    expect(notes.some((note) => note.includes('1 Claude plugins already disabled'))).toBe(true);
    expect(items[0]?.loadedBy).toEqual(['claude-code']);
    expect(path.basename(items.find((item) => item.qualifiedName === 'docs-kit:pdf-tools')?.entryFile ?? '')).toBe('SKILL.md');
  });

  it('skips a broken registry without throwing', async () => {
    const home = await buildFixture('broken', await tempDir('sw-claude-broken-'));
    const ctx = createContext({ home, cwd: home, now: FIXTURE_NOW, env: {}, toolVersion: '0.0.0-test' });
    const { items, notes } = await claudePluginItems(ctx);
    expect(items).toEqual([]);
    expect(notes).toContain('Claude plugin registry unreadable or unknown version; plugin skills skipped');
  });
});
