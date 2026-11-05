import { describe, expect, it } from 'vitest';
import { bar, fmtDate, fmtTokens, paint } from '../../src/util/format.js';

describe('format', () => {
  it('formats token counts', () => {
    expect(fmtTokens(940)).toBe('940');
    expect(fmtTokens(31400)).toBe('31.4k');
    expect(fmtTokens(123456)).toBe('123k');
    expect(fmtTokens(1250000)).toBe('1.25M');
  });

  it('formats a UTC month and day', () => {
    expect(fmtDate('2026-10-06T00:00:00.000Z')).toBe('Oct 6');
  });

  it('draws a clamped bar', () => {
    expect(bar(0.5, 4)).toBe('██░░');
    expect(bar(2, 2)).toBe('██');
  });

  it('paints only when color is enabled', () => {
    expect(paint('red', 'x', false)).toBe('x');
    expect(paint('red', 'x', true)).toBe('\x1b[31mx\x1b[0m');
  });
});
