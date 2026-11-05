import { describe, expect, it } from 'vitest';
import { fmString, parseFrontmatter } from '../../src/util/frontmatter.js';

describe('parseFrontmatter', () => {
  it('reads a simple name and description', () => {
    const fm = parseFrontmatter('---\nname: commit-helper\ndescription: Write commits.\n---\n# Body\n');
    expect(fm.data).toEqual({ name: 'commit-helper', description: 'Write commits.' });
    expect(fm.body).toBe('# Body\n');
    expect(fm.warnings).toEqual([]);
    expect(fmString(fm.data, 'name')).toBe('commit-helper');
  });

  it('unfolds a folded description', () => {
    const fm = parseFrontmatter('---\ndescription: >\n  one line\n  and the next\n---\n');
    expect(fmString(fm.data, 'description')).toBe('one line and the next');
  });

  it('keeps a literal block', () => {
    const fm = parseFrontmatter('---\ndescription: |\n  line one\n  line two\n---\n');
    expect(fmString(fm.data, 'description')).toBe('line one\nline two');
  });

  it('normalizes CRLF input', () => {
    const fm = parseFrontmatter('---\r\nname: crlf\r\n---\r\nbody\r\n');
    expect(fmString(fm.data, 'name')).toBe('crlf');
    expect(fm.body).toBe('body\n');
  });

  it('strips a leading BOM', () => {
    const fm = parseFrontmatter('\uFEFF---\nname: bom\n---\n');
    expect(fmString(fm.data, 'name')).toBe('bom');
    expect(fm.warnings).toEqual([]);
  });

  it('warns when frontmatter is missing', () => {
    const fm = parseFrontmatter('# Just a heading\n');
    expect(fm.data).toEqual({});
    expect(fm.warnings).toEqual(['missing frontmatter']);
  });

  it('warns on invalid YAML', () => {
    const fm = parseFrontmatter('---\nname: bad-yaml\ndescription: [unclosed\n---\nBody');
    expect(fm.data).toEqual({});
    expect(fm.warnings).toEqual(['invalid frontmatter YAML']);
    expect(fm.body).toBe('Body');
  });

  it('keeps Persian text and U+200C intact', () => {
    const description = 'ترجمهٔ متن\u200Cهای فنی';
    const fm = parseFrontmatter(`---\ndescription: ${description}\n---\n`);
    expect(fmString(fm.data, 'description')).toBe(description);
    expect(fmString(fm.data, 'description')).toContain('\u200C');
  });
});
