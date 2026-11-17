import path from 'node:path';
import type { HarnessUsage, ScanContext, UsageEvent } from '../../model.js';
import { exists } from '../../util/fs.js';
import { displayPath } from '../../util/paths.js';
import { absentUsage, errorUsage, extractSkillMdPaths, windowStart } from '../shared.js';

type Sql = { all: (...args: (string | number | null)[]) => unknown[] };

type Db = {
  prepare: (sql: string) => Sql;
  close: () => void;
};

const KNOWN_TABLES = new Set(['session_part', 'session_message', 'session_v2', 'part', 'message']);

export async function mineOpencodeUsage(ctx: ScanContext): Promise<HarnessUsage> {
  const dbPath = path.join(ctx.env.XDG_DATA_HOME ?? path.join(ctx.home, '.local', 'share'), 'opencode', 'opencode.db');
  if (!(await exists(dbPath))) {
    return absentUsage('opencode', `No OpenCode database found at ${displayPath(dbPath, ctx.home)}`);
  }
  let open: (location: string) => Db;
  try {
    const sqlite = await import('node:sqlite');
    open = (location) => new sqlite.DatabaseSync(location, { readOnly: true });
  } catch {
    return absentUsage('opencode', 'This Node version has no node:sqlite; OpenCode usage unknown');
  }
  const db = open(dbPath);
  try {
    const tables = tableNames(db);
    const v2 = tables.has('session_part') || tables.has('session_message');
    const legacy = tables.has('part');
    // A migrated install can have empty v2 tables beside the legacy part rows.
    // Prefer v2 when it holds parts, or when there is no legacy table at all.
    const v2Parts = tables.has('session_part') ? countRows(db, 'session_part') : 0;
    if (v2 && (!legacy || v2Parts > 0)) return mineV2(db, ctx, dbPath, tables);
    if (legacy) return mineLegacy(db, ctx, dbPath);
    return errorUsage('opencode', 'opencode.db has neither v2 (session_part/session_message) nor v1 (part/message) tables');
  } catch (err) {
    return errorUsage('opencode', err);
  } finally {
    db.close();
  }
}

function mineLegacy(db: Db, ctx: ScanContext, dbPath: string): HarnessUsage {
  const ws = windowStart(ctx).getTime();
  const parts = db.prepare(
    "SELECT time_created, data FROM part WHERE time_created >= ? AND json_extract(data,'$.type') = 'tool' AND (json_extract(data,'$.tool') = 'skill' OR data LIKE '%SKILL.md%')",
  ).all(ws) as { time_created: number; data: string }[];
  const requests = db.prepare(
    "SELECT COUNT(*) AS n FROM message WHERE time_created >= ? AND json_extract(data,'$.role') = 'assistant'",
  ).all(ws) as { n: number }[];
  const coverage = db.prepare('SELECT MIN(time_created) AS t FROM message').all() as { t: number | null }[];
  const events: UsageEvent[] = [];
  for (const row of parts) events.push(...eventsFromPart(row.data, row.time_created));
  const earliest = coverage[0]?.t;
  return okUsage(dbPath, typeof earliest === 'number' ? new Date(earliest).toISOString() : null, requests[0]?.n ?? 0, events);
}

function mineV2(db: Db, ctx: ScanContext, dbPath: string, tables: Set<string>): HarnessUsage {
  const ws = windowStart(ctx).getTime();
  const timed = timeSource(db, tables);
  if (!timed) {
    return errorUsage('opencode', 'v2 schema without a usable time column; cannot apply the 30-day window');
  }
  const events: UsageEvent[] = [];
  const fromPart = timed.from === 'session_part' || timed.from.startsWith('session_part ');
  let partRows: { time_created: number; data: string }[] = [];
  if (fromPart) {
    const where = partFilter(columnNames(db, 'session_part'));
    partRows = db.prepare(
      `SELECT ${timed.timeExpr} AS time_created, ${timed.dataExpr} AS data FROM ${timed.from} WHERE ${timed.timeExpr} >= ? AND ${where}`,
    ).all(ws) as { time_created: number; data: string }[];
    for (const row of partRows) events.push(...eventsFromPart(row.data, row.time_created));
  }
  if (partRows.length === 0 && tables.has('session_message')) {
    const msgTimed = fromPart ? messageTimeSource(db, tables) : timed;
    if (msgTimed) {
      const rows = db.prepare(
        `SELECT ${msgTimed.timeExpr} AS time_created, ${msgTimed.dataExpr} AS data FROM ${msgTimed.from} WHERE ${msgTimed.timeExpr} >= ?`,
      ).all(ws) as { time_created: number; data: string }[];
      for (const row of rows) events.push(...eventsFromMessage(row.data, row.time_created));
    }
  }
  return okUsage(dbPath, coverageStart(db, tables), countAssistants(db, tables, ws), events);
}

function timeSource(db: Db, tables: Set<string>): { from: string; timeExpr: string; dataExpr: string } | null {
  const partEmpty = !tables.has('session_part') || countRows(db, 'session_part') === 0;
  if (!partEmpty && tables.has('session_part') && columnNames(db, 'session_part').has('time_created')) {
    return { from: 'session_part', timeExpr: 'time_created', dataExpr: 'data' };
  }
  if (!partEmpty && tables.has('session_part') && tables.has('session_v2') && columnNames(db, 'session_v2').has('time_created') && columnNames(db, 'session_part').has('session_id')) {
    return {
      from: 'session_part p JOIN session_v2 s ON s.id = p.session_id',
      timeExpr: 's.time_created',
      dataExpr: 'p.data',
    };
  }
  return messageTimeSource(db, tables);
}

function messageTimeSource(db: Db, tables: Set<string>): { from: string; timeExpr: string; dataExpr: string } | null {
  if (!tables.has('session_message')) return null;
  if (columnNames(db, 'session_message').has('time_created')) {
    return { from: 'session_message', timeExpr: 'time_created', dataExpr: 'data' };
  }
  if (tables.has('session_v2') && columnNames(db, 'session_v2').has('time_created') && columnNames(db, 'session_message').has('session_id')) {
    return {
      from: 'session_message m JOIN session_v2 s ON s.id = m.session_id',
      timeExpr: 's.time_created',
      dataExpr: 'm.data',
    };
  }
  return null;
}

function partFilter(cols: Set<string>): string {
  const typeClause = cols.has('type')
    ? "(type = 'tool' OR json_extract(data,'$.type') = 'tool')"
    : "json_extract(data,'$.type') = 'tool'";
  return `${typeClause} AND (json_extract(data,'$.tool') = 'skill' OR data LIKE '%SKILL.md%')`;
}

function countAssistants(db: Db, tables: Set<string>, ws: number): number {
  if (!tables.has('session_message')) return 0;
  const cols = columnNames(db, 'session_message');
  if (!cols.has('time_created')) return 0;
  const clauses: string[] = [];
  if (cols.has('type')) clauses.push("type = 'assistant'");
  if (cols.has('data')) clauses.push("json_extract(data,'$.role') = 'assistant'");
  if (clauses.length === 0) return 0;
  const rows = db.prepare(
    `SELECT COUNT(*) AS n FROM session_message WHERE time_created >= ? AND (${clauses.join(' OR ')})`,
  ).all(ws) as { n: number }[];
  return rows[0]?.n ?? 0;
}

function coverageStart(db: Db, tables: Set<string>): string | null {
  for (const table of ['session_message', 'session_part', 'session_v2']) {
    if (!tables.has(table) || !columnNames(db, table).has('time_created')) continue;
    const rows = db.prepare(`SELECT MIN(time_created) AS t FROM ${table}`).all() as { t: number | null }[];
    const earliest = rows[0]?.t;
    if (typeof earliest === 'number') return new Date(earliest).toISOString();
  }
  return null;
}

function eventsFromPart(data: string, time: number): UsageEvent[] {
  const at = new Date(time).toISOString();
  const events: UsageEvent[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return events;
  }
  const record = parsed as { tool?: string; state?: { input?: { name?: unknown } } };
  const skillName = record.state?.input?.name;
  if (record.tool === 'skill' && typeof skillName === 'string') {
    events.push(skillEvent(at, skillName));
  }
  for (const skillPath of extractSkillMdPaths(data)) {
    events.push({ harness: 'opencode', at, via: 'file-read', ref: { type: 'path', path: skillPath } });
  }
  return events;
}

function eventsFromMessage(data: string, time: number): UsageEvent[] {
  const at = new Date(time).toISOString();
  const events = eventsFromPart(data, time);
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return events;
  }
  const content = (parsed as { content?: unknown }).content;
  if (!Array.isArray(content)) return events;
  for (const part of content) {
    if (!part || typeof part !== 'object') continue;
    const record = part as { type?: string; tool?: string; state?: { input?: { name?: unknown } } };
    const skillName = record.state?.input?.name;
    if (record.type === 'tool' && record.tool === 'skill' && typeof skillName === 'string') {
      events.push(skillEvent(at, skillName));
    }
  }
  return events;
}

function skillEvent(at: string, name: string): UsageEvent {
  return {
    harness: 'opencode',
    at,
    via: 'skill-tool',
    ref: { type: 'name', name, plugin: null, kind: 'skill' },
  };
}

function okUsage(dbPath: string, coverageStart: string | null, modelRequests: number, events: UsageEvent[]): HarnessUsage {
  return {
    harness: 'opencode',
    status: 'ok',
    reason: null,
    sources: [dbPath],
    coverageStart,
    modelRequests,
    events,
    malformedLines: 0,
  };
}

function tableNames(db: Db): Set<string> {
  const rows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[];
  return new Set(rows.map((row) => row.name));
}

function columnNames(db: Db, table: string): Set<string> {
  if (!KNOWN_TABLES.has(table)) return new Set();
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return new Set(rows.map((row) => row.name));
}

function countRows(db: Db, table: string): number {
  if (!KNOWN_TABLES.has(table)) return 0;
  const rows = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).all() as { n: number }[];
  return rows[0]?.n ?? 0;
}
