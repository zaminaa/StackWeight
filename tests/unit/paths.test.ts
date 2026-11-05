import { describe, expect, it } from 'vitest';
import { displayPath, isInside, samePath, toPosix } from '../../src/util/paths.js';

describe('paths', () => {
  it('converts backslashes to slashes', () => {
    expect(toPosix('a\\b\\c')).toBe('a/b/c');
  });

  it('treats windows paths as equal when the platform is windows', () => {
    if (process.platform !== 'win32') return;
    expect(samePath('C:\\A\\b', 'c:/a/B/')).toBe(true);
  });

  it('counts a path as inside itself and its parent', () => {
    expect(isInside('/tmp/a/b', '/tmp/a')).toBe(true);
    expect(isInside('/tmp/a', '/tmp/a')).toBe(true);
    expect(isInside('/tmp/ab', '/tmp/a')).toBe(false);
  });

  it('replaces the home prefix with a tilde', () => {
    if (process.platform === 'win32') {
      expect(displayPath('C:\\Users\\me\\.claude\\skills', 'C:\\Users\\me')).toBe('~/.claude/skills');
    } else {
      expect(displayPath('/home/me/.claude/skills', '/home/me')).toBe('~/.claude/skills');
    }
  });
});
