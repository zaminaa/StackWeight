import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/context.js';
import { mineClaudeUsage } from '../../src/harness/claude/usage.js';
import { FIXTURE_NOW, buildFixture, tempDir } from '../helpers/fixture.js';

function named(events: { ref: { type: string; name?: string } }[], name: string): number {
  return events.filter((event) => event.ref.type === 'name' && event.ref.name === name).length;
}

describe('mineClaudeUsage', () => {
  it('counts tool calls and ignores the prompt snapshot on minimal', async () => {
    const home = await buildFixture('minimal', await tempDir('sw-claude-usage-'));
    const ctx = createContext({ home, cwd: home, now: FIXTURE_NOW, env: {}, toolVersion: '0.0.0-test' });
    const usage = await mineClaudeUsage(ctx);
    expect(usage.status).toBe('ok');
    expect(named(usage.events, 'commit-helper')).toBe(3);
    expect(named(usage.events, 'brand-voice')).toBe(1);
    expect(usage.events.find((event) => event.ref.type === 'name' && event.ref.name === 'brand-voice')?.at).toBe('2026-09-01T10:00:00.000Z');
    expect(named(usage.events, 'pdf-tools')).toBe(1);
    expect(named(usage.events, 'reviewer')).toBe(1);
    expect(named(usage.events, 'deploy')).toBe(1);
    expect(named(usage.events, 'git-commit-writer')).toBe(0);
    expect(usage.modelRequests).toBe(7);
    expect(usage.coverageStart).toBe('2026-09-01T10:00:00.000Z');
    expect(usage.malformedLines).toBeGreaterThanOrEqual(1);
  });

  it('survives broken logs', async () => {
    const home = await buildFixture('broken', await tempDir('sw-claude-broken-usage-'));
    const ctx = createContext({ home, cwd: home, now: FIXTURE_NOW, env: {}, toolVersion: '0.0.0-test' });
    const usage = await mineClaudeUsage(ctx);
    expect(usage.status).toBe('ok');
    expect(usage.malformedLines).toBeGreaterThanOrEqual(1);
  });

  it('is absent when Claude is not installed', async () => {
    const home = await tempDir('sw-claude-absent-');
    const ctx = createContext({ home, cwd: home, now: FIXTURE_NOW, env: {}, toolVersion: '0.0.0-test' });
    const usage = await mineClaudeUsage(ctx);
    expect(usage.status).toBe('absent');
    expect(usage.reason).toContain('Claude Code');
  });
});
