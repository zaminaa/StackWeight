import type { HarnessId, HarnessUsage, ScanContext } from '../model.js';
import { displayPath } from '../util/paths.js';

export function extractSkillMdPaths(text: string): string[] {
  if (!text.includes('SKILL.md')) return [];
  const unescaped = text.replace(/\\\\/g, '/').replace(/\\/g, '/');
  // `/` is excluded from the quantified class so a long run cannot backtrack
  // quadratically. The segment repeats so a real path stays intact, not just the tail.
  const matches = unescaped.match(/(?:[A-Za-z]:)?(?:[^\s"'`<>|(){}\[\],;\/]*\/)+[^\s"'`<>|(){}\[\],;\/]+\/SKILL\.md/gi) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of matches) {
    if (seen.has(match)) continue;
    seen.add(match);
    out.push(match);
  }
  return out;
}

export function absentUsage(harness: HarnessId, reason: string): HarnessUsage {
  return {
    harness,
    status: 'absent',
    reason,
    sources: [],
    coverageStart: null,
    modelRequests: null,
    events: [],
    malformedLines: 0,
  };
}

export function errorUsage(harness: HarnessId, err: unknown): HarnessUsage {
  const message = err instanceof Error ? err.message : String(err);
  return {
    harness,
    status: 'error',
    reason: message.split('\n')[0] ?? message,
    sources: [],
    coverageStart: null,
    modelRequests: null,
    events: [],
    malformedLines: 0,
  };
}

export function windowStart(ctx: ScanContext): Date {
  return new Date(ctx.now.getTime() - ctx.windowDays * 86_400_000);
}

export function inWindow(iso: string | null, ctx: ScanContext): boolean {
  if (!iso) return false;
  const at = new Date(iso);
  return !Number.isNaN(at.getTime()) && at.getTime() >= windowStart(ctx).getTime();
}

export function displayLogDir(dir: string, home: string, label: string): string {
  return `No ${label} session logs found at ${displayPath(dir, home)}`;
}
