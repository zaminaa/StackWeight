import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/context.js';
import { renderSummary } from '../../src/render/terminal.js';
import { scan } from '../../src/scan.js';
import { FIXTURE_NOW, buildFixture, tempDir } from '../helpers/fixture.js';

describe('terminal summary', () => {
  it('matches the plain summary and can paint color', async () => {
    const home = await buildFixture('minimal', await tempDir('sw-term-'));
    const ctx = createContext({
      home,
      cwd: path.join(home, 'projects', 'webapp'),
      now: FIXTURE_NOW,
      env: {},
      toolVersion: '0.1.0',
    });
    const result = await scan(ctx, { writeHistory: false });
    result.durationMs = 0;
    const plain = renderSummary(result, { color: false, reportPath: null, home });
    expect(plain).toContain('Stack weight');
    expect(plain).toContain('Dead weight');
    expect(plain).toContain('Heaviest dead weight');
    expect(plain).toContain('npx stackweight prune');
    expect(plain).toMatchFileSnapshot('./__snapshots__/minimal.terminal.txt');
    expect(renderSummary(result, { color: true, reportPath: null, home })).toContain('\x1b[');
  });
});
