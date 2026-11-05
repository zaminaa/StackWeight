import { describe, expect, it } from 'vitest';
import { generateBloated } from '../fixtures/bloated/generate.js';
import { readTreeHashes, tempDir } from '../helpers/fixture.js';

describe('bloated fixture', () => {
  it('generates the same tree twice, with at least 75 skills, in under 5 seconds', async () => {
    const left = await tempDir('sw-bloated-a-');
    const right = await tempDir('sw-bloated-b-');
    const started = Date.now();
    await generateBloated(left);
    await generateBloated(right);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(await readTreeHashes(right)).toEqual(await readTreeHashes(left));
    const skills = Object.keys(await readTreeHashes(left)).filter((rel) => rel.endsWith('SKILL.md'));
    expect(skills.length).toBeGreaterThanOrEqual(75);
  });
});
