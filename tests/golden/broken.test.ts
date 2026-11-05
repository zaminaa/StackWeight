import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/context.js';
import { scan } from '../../src/scan.js';
import { FIXTURE_NOW, buildFixture, tempDir } from '../helpers/fixture.js';

describe('broken fixture', () => {
  it('finishes and records unreadable inputs', async () => {
    const home = await buildFixture('broken', await tempDir('sw-broken-scan-'));
    const ctx = createContext({ home, cwd: home, now: FIXTURE_NOW, env: {}, toolVersion: '0.0.0-test' });
    const result = await scan(ctx, { writeHistory: false });
    expect(result.harnesses.find((harness) => harness.harness === 'opencode')?.usage.status).toBe('error');
    const plain = result.items.find((item) => item.name === 'no-frontmatter');
    const yaml = result.items.find((item) => item.name === 'bad-yaml');
    expect(plain?.warnings).toContain('missing frontmatter');
    expect(yaml?.warnings).toContain('invalid frontmatter YAML');
  });
});
