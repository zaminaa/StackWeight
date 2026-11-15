import { describe, expect, it } from 'vitest';
import { generateBloated } from '../fixtures/bloated/generate.js';
import { readTreeHashes, tempDir } from '../helpers/fixture.js';

describe('bloated fixture', () => {
  it('generates the same tree twice, with at least 75 skills, in under 15 seconds', async () => {
    const left = await tempDir('sw-bloated-a-');
    const right = await tempDir('sw-bloated-b-');
    const started = Date.now();
    await generateBloated(left);
    await generateBloated(right);
    // 1.7 s on an idle machine, 4.1 s when 33 test files share the disk. The
    // budget catches a pathological generator, not a noisy neighbour.
    expect(Date.now() - started).toBeLessThan(15000);
    expect(await readTreeHashes(right)).toEqual(await readTreeHashes(left));
    const skills = Object.keys(await readTreeHashes(left)).filter((rel) => rel.endsWith('SKILL.md'));
    expect(skills.length).toBeGreaterThanOrEqual(75);
  });
});
