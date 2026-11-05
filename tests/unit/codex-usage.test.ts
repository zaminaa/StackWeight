import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/context.js';
import { mineCodexUsage, readCodexListing } from '../../src/harness/codex/usage.js';
import { FIXTURE_NOW, buildFixture, tempDir } from '../helpers/fixture.js';

describe('mineCodexUsage', () => {
  it('counts a shell read and ignores the skills listing', async () => {
    const home = await buildFixture('minimal', await tempDir('sw-codex-usage-'));
    const ctx = createContext({ home, cwd: home, now: FIXTURE_NOW, env: {}, toolVersion: '0.0.0-test' });
    const usage = await mineCodexUsage(ctx);
    expect(usage.status).toBe('ok');
    const paths = usage.events.flatMap((event) => event.ref.type === 'path' ? [event.ref.path] : []);
    expect(paths.some((item) => item.includes('sql-helper/SKILL.md'))).toBe(true);
    expect(paths.some((item) => item.includes('csv-cleaner') || item.includes('imagegen') || item.includes('shared-notes'))).toBe(false);
    expect(usage.modelRequests).toBe(2);
    const listing = await readCodexListing(ctx, (text) => text.length);
    expect(listing?.entries.map((entry) => entry.name)).toEqual(['imagegen', 'sql-helper', 'csv-cleaner', 'shared-notes']);
  });
});
