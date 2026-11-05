import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/context.js';
import { renderCardSvg } from '../../src/report/card.js';
import { renderHtml } from '../../src/report/html.js';
import { shareText } from '../../src/report/share.js';
import { scan } from '../../src/scan.js';
import { FIXTURE_NOW, buildFixture, tempDir } from '../helpers/fixture.js';

describe('report', () => {
  it('builds a local report, a nameless card, and share text', async () => {
    const home = await buildFixture('minimal', await tempDir('sw-report-'));
    const ctx = createContext({
      home,
      cwd: path.join(home, 'projects', 'webapp'),
      now: FIXTURE_NOW,
      env: {},
      toolVersion: '0.0.0-test',
    });
    const result = await scan(ctx, { writeHistory: false });
    const html = renderHtml(result);
    expect(html).toContain('Content-Security-Policy');
    expect(html).not.toMatch(/(src|href)\s*=\s*["']https?:/i);
    expect(html).not.toMatch(/url\(\s*["']?https?:/i);
    const hostile = structuredClone(result);
    hostile.items[0]!.description = '</script><img src=x onerror=alert(1)>';
    expect(renderHtml(hostile)).not.toContain('</script><img');
    const card = renderCardSvg(result);
    for (const item of result.items) {
      expect(card).not.toContain(item.qualifiedName);
      expect(card).not.toContain(item.name);
    }
    expect(card).not.toContain(home);
    expect(card).not.toContain('<HOME>');
    expect(shareText(result)).toContain('npx stackweight');
  });
});
