import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/context.js';

const home = path.resolve('C:/stackweight-home');

describe('createContext', () => {
  it('uses STACKWEIGHT_SCAN_HOME', () => {
    const ctx = createContext({
      env: { STACKWEIGHT_SCAN_HOME: 'C:/from-env' },
      toolVersion: '0.0.0-test',
    });
    expect(ctx.home).toBe(path.resolve('C:/from-env'));
  });

  it('lets opts.home beat the environment', () => {
    const ctx = createContext({
      home,
      env: { STACKWEIGHT_SCAN_HOME: 'C:/from-env' },
      toolVersion: '0.0.0-test',
    });
    expect(ctx.home).toBe(home);
  });

  it('parses STACKWEIGHT_NOW', () => {
    const ctx = createContext({
      home,
      env: { STACKWEIGHT_NOW: '2026-11-06T12:00:00.000Z' },
      toolVersion: '0.0.0-test',
    });
    expect(ctx.now.toISOString()).toBe('2026-11-06T12:00:00.000Z');
  });

  it('throws when STACKWEIGHT_NOW is not a valid ISO date', () => {
    expect(() => createContext({
      home,
      env: { STACKWEIGHT_NOW: 'not-a-date' },
      toolVersion: '0.0.0-test',
    })).toThrow('STACKWEIGHT_NOW is not a valid ISO date');
  });

  it('defaults stateDir to <home>/.stackweight', () => {
    const ctx = createContext({ home, env: {}, toolVersion: '0.0.0-test' });
    expect(ctx.stateDir).toBe(path.join(home, '.stackweight'));
    expect(ctx.windowDays).toBe(30);
    expect(ctx.graceDays).toBe(14);
    expect(ctx.minCoverageDays).toBe(7);
  });

  it('lets STACKWEIGHT_HOME override stateDir', () => {
    const ctx = createContext({
      home,
      env: { STACKWEIGHT_HOME: 'D:/custom-state' },
      toolVersion: '0.0.0-test',
    });
    expect(ctx.stateDir).toBe('D:/custom-state');
  });
});
