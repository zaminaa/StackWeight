import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/context.js';
import { opencodePluginItems } from '../../src/harness/opencode/plugins.js';
import { FIXTURE_NOW, tempDir } from '../helpers/fixture.js';

describe('opencodePluginItems', () => {
  it('reads skills from a global plugin directory', async () => {
    const home = await tempDir('sw-oc-plugins-');
    const skill = path.join(home, '.config', 'opencode', 'plugins', 'superpowers', 'skills', 'brainstorming');
    await fs.mkdir(skill, { recursive: true });
    await fs.writeFile(path.join(skill, 'SKILL.md'), '---\nname: brainstorming\ndescription: think first\n---\n');
    const ctx = createContext({
      home,
      cwd: path.join(home, 'proj'),
      now: FIXTURE_NOW,
      env: {},
      toolVersion: '0.0.0-test',
    });
    const { items } = await opencodePluginItems(ctx);
    expect(items.map((item) => item.qualifiedName)).toEqual(['superpowers:brainstorming']);
    expect(items[0]?.loadedBy).toEqual(['opencode']);
    expect(items[0]?.plugin?.harness).toBe('opencode');
  });
});