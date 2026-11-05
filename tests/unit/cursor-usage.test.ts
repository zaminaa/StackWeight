import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/context.js';
import { mineCursorUsage } from '../../src/harness/cursor/usage.js';
import { FIXTURE_NOW, buildFixture, tempDir } from '../helpers/fixture.js';

describe('mineCursorUsage', () => {
  it('counts path reads and ignores the available-skills trap', async () => {
    const home = await buildFixture('minimal', await tempDir('sw-cursor-usage-'));
    const ctx = createContext({ home, cwd: home, now: FIXTURE_NOW, env: {}, toolVersion: '0.0.0-test' });
    const usage = await mineCursorUsage(ctx);
    expect(usage.status).toBe('ok');
    const paths = usage.events.flatMap((event) => event.ref.type === 'path' ? [event.ref.path] : []);
    expect(paths.some((item) => item.includes('react-patterns/SKILL.md'))).toBe(true);
    expect(paths.some((item) => item.includes('abc222') && item.includes('brainstorming/SKILL.md'))).toBe(true);
    expect(paths.some((item) => item.includes('vue-patterns'))).toBe(false);
    expect(usage.modelRequests).toBe(3);
  });
});
