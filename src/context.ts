import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ScanContext } from './model.js';

export interface ContextOptions {
  home?: string;
  cwd?: string;
  now?: Date;
  windowDays?: number;
  env?: Record<string, string | undefined>;
  toolVersion?: string;
}

function packageVersion(): string {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
  return pkg.version;
}

export function createContext(opts?: ContextOptions): ScanContext {
  const env = opts?.env ?? process.env;
  const home = path.resolve(opts?.home ?? env.STACKWEIGHT_SCAN_HOME ?? os.homedir());
  const cwd = opts?.cwd ?? process.cwd();
  let now: Date;
  if (opts?.now) {
    now = opts.now;
  } else if (env.STACKWEIGHT_NOW) {
    now = new Date(env.STACKWEIGHT_NOW);
    if (Number.isNaN(now.getTime())) throw new Error('STACKWEIGHT_NOW is not a valid ISO date');
  } else {
    now = new Date();
  }
  return {
    home,
    cwd,
    now,
    windowDays: opts?.windowDays ?? 30,
    graceDays: 14,
    minCoverageDays: 7,
    stateDir: env.STACKWEIGHT_HOME ?? path.join(home, '.stackweight'),
    toolVersion: opts?.toolVersion ?? packageVersion(),
    env,
  };
}
