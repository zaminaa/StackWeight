import { describe, expect, it } from 'vitest';
import { extractSkillMdPaths } from '../../src/harness/shared.js';

describe('extractSkillMdPaths', () => {
  it('finds a real SKILL.md path', () => {
    const text = 'open /home/user/.config/opencode/skills/x/SKILL.md now';
    expect(extractSkillMdPaths(text)).toEqual(['/home/user/.config/opencode/skills/x/SKILL.md']);
  });

  it('returns [] in under 100ms for a 200k unmatched slashless run and slashy base64', () => {
    const slashless = 'a'.repeat(200_000);
    const slashy = Buffer.alloc(150_000, 0xff).toString('base64').slice(0, 200_000);
    expect(slashless).toHaveLength(200_000);
    expect(slashy).toHaveLength(200_000);
    expect(slashless.includes('SKILL.md')).toBe(false);
    expect(slashy.includes('SKILL.md')).toBe(false);
    expect(slashy.includes('/')).toBe(true);

    const slashlessStarted = performance.now();
    expect(extractSkillMdPaths(slashless)).toEqual([]);
    expect(performance.now() - slashlessStarted).toBeLessThan(100);

    const slashyStarted = performance.now();
    expect(extractSkillMdPaths(slashy)).toEqual([]);
    expect(performance.now() - slashyStarted).toBeLessThan(100);
  });

  it('stays fast on a 200k string of long path segments', () => {
    const segment = 'p'.repeat(50_000);
    const text = `/${segment}/${segment}/${segment}/${segment}/SKILL.md`;
    expect(text.length).toBeGreaterThanOrEqual(200_000);
    const started = performance.now();
    const paths = extractSkillMdPaths(text);
    expect(performance.now() - started).toBeLessThan(100);
    expect(paths).toEqual([text]);
  });
});
