import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildFixture, readTreeHashes, tempDir } from '../helpers/fixture.js';

describe('fixtures', () => {
  it('builds minimal with tokens, plugin paths and mtimes', async () => {
    const dest = await tempDir('sw-minimal-');
    const home = await buildFixture('minimal', dest);
    const trap = await fs.readFile(path.join(home, '.claude/skills/zw-trap/SKILL.md'), 'utf8');
    expect(trap).toContain('\u200B');
    expect(trap).toContain('\u{E0041}');
    expect(trap).not.toContain('{{ZWSP}}');

    const registry = JSON.parse(await fs.readFile(path.join(home, '.claude/plugins/installed_plugins.json'), 'utf8')) as {
      plugins: Record<string, { installPath: string }[]>;
    };
    const installPath = registry.plugins['docs-kit@acme']?.[0]?.installPath ?? '';
    expect(installPath.startsWith(home)).toBe(true);

    const fresh = await fs.stat(path.join(home, '.claude/skills/fresh-skill'));
    expect(fresh.mtime.toISOString()).toBe('2026-11-03T00:00:00.000Z');

    const first = await readTreeHashes(home);
    const second = await readTreeHashes(home);
    expect(second).toEqual(first);
  });
});
