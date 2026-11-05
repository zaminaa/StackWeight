import path from 'node:path';
import type { HarnessUsage, ScanContext, UsageEvent } from '../../model.js';
import { exists } from '../../util/fs.js';
import { displayPath } from '../../util/paths.js';
import { absentUsage, errorUsage, extractSkillMdPaths, windowStart } from '../shared.js';

export async function mineOpencodeUsage(ctx: ScanContext): Promise<HarnessUsage> {
  const dbPath = path.join(ctx.env.XDG_DATA_HOME ?? path.join(ctx.home, '.local', 'share'), 'opencode', 'opencode.db');
  if (!(await exists(dbPath))) {
    return absentUsage('opencode', `No OpenCode database found at ${displayPath(dbPath, ctx.home)}`);
  }
  let open: (location: string) => {
    prepare: (sql: string) => { all: (...args: (string | number | null)[]) => unknown[] };
    close: () => void;
  };
  try {
    const sqlite = await import('node:sqlite');
    open = (location) => new sqlite.DatabaseSync(location, { readOnly: true });
  } catch {
    return absentUsage('opencode', 'This Node version has no node:sqlite; OpenCode usage unknown');
  }
  const db = open(dbPath);
  try {
    const ws = windowStart(ctx).getTime();
    const parts = db.prepare(
      "SELECT time_created, data FROM part WHERE time_created >= ? AND json_extract(data,'$.type') = 'tool' AND (json_extract(data,'$.tool') = 'skill' OR data LIKE '%SKILL.md%')",
    ).all(ws) as { time_created: number; data: string }[];
    const requests = db.prepare(
      "SELECT COUNT(*) AS n FROM message WHERE time_created >= ? AND json_extract(data,'$.role') = 'assistant'",
    ).all(ws) as { n: number }[];
    const coverage = db.prepare('SELECT MIN(time_created) AS t FROM message').all() as { t: number | null }[];
    const events: UsageEvent[] = [];
    for (const row of parts) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(row.data);
      } catch {
        continue;
      }
      const data = parsed as { tool?: string; state?: { input?: { name?: unknown } } };
      const at = new Date(row.time_created).toISOString();
      const skillName = data.state?.input?.name;
      if (data.tool === 'skill' && typeof skillName === 'string') {
        events.push({
          harness: 'opencode',
          at,
          via: 'skill-tool',
          ref: { type: 'name', name: skillName, plugin: null, kind: 'skill' },
        });
      }
      for (const skillPath of extractSkillMdPaths(row.data)) {
        events.push({ harness: 'opencode', at, via: 'file-read', ref: { type: 'path', path: skillPath } });
      }
    }
    const earliest = coverage[0]?.t;
    return {
      harness: 'opencode',
      status: 'ok',
      reason: null,
      sources: [dbPath],
      coverageStart: typeof earliest === 'number' ? new Date(earliest).toISOString() : null,
      modelRequests: requests[0]?.n ?? 0,
      events,
      malformedLines: 0,
    };
  } catch (err) {
    return errorUsage('opencode', err);
  } finally {
    db.close();
  }
}
