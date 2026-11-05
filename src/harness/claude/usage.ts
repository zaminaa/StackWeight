import fs from 'node:fs/promises';
import path from 'node:path';
import type { HarnessUsage, ScanContext, UsageEvent } from '../../model.js';
import { forEachLine, listSubdirs, statSafe } from '../../util/fs.js';
import { absentUsage, displayLogDir, errorUsage, extractSkillMdPaths, inWindow, windowStart } from '../shared.js';

export async function mineClaudeUsage(ctx: ScanContext): Promise<HarnessUsage> {
  try {
    const projects = path.join(ctx.home, '.claude', 'projects');
    const projectDirs = await listSubdirs(projects);
    const files: { file: string; mtime: number }[] = [];
    for (const dir of projectDirs) {
      let entries: import('node:fs').Dirent[];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
        const file = path.join(dir, entry.name);
        const st = await statSafe(file);
        if (st) files.push({ file, mtime: st.mtimeMs });
      }
    }
    if (files.length === 0) return absentUsage('claude-code', displayLogDir(projects, ctx.home, 'Claude Code'));

    let oldestMtime = Infinity;
    let earliest = Infinity;
    const ids = new Set<string>();
    let anonRequests = 0;
    let malformedLines = 0;
    const events: UsageEvent[] = [];
    const sources: string[] = [];
    const start = windowStart(ctx).getTime();

    for (const { file, mtime } of files) {
      oldestMtime = Math.min(oldestMtime, mtime);
      if (mtime < start) continue;
      sources.push(file);
      await forEachLine(file, (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        if (!trimmed.startsWith('{')) {
          malformedLines += 1;
          return;
        }
        if (line.includes('"type":"assistant"')) {
          const stamp = line.match(/"timestamp":"([^"]+)"/)?.[1] ?? null;
          if (inWindow(stamp, ctx)) {
            const id = line.match(/"message":\{"id":"([^"]+)"/)?.[1];
            if (id) ids.add(id);
            else anonRequests += 1;
          }
        }
        if (!line.includes('"tool_use"') && !line.includes('<command-name>')) return;
        let row: unknown;
        try {
          row = JSON.parse(line);
        } catch {
          malformedLines += 1;
          return;
        }
        if (!row || typeof row !== 'object') return;
        const record = row as { type?: string; timestamp?: string; message?: { content?: unknown } };
        if (typeof record.timestamp === 'string') {
          const ms = new Date(record.timestamp).getTime();
          if (!Number.isNaN(ms)) earliest = Math.min(earliest, ms);
        }
        collectClaudeEvents(record, events);
      });
    }

    const coverageMs = Math.min(oldestMtime, earliest);
    return {
      harness: 'claude-code',
      status: 'ok',
      reason: null,
      sources,
      coverageStart: Number.isFinite(coverageMs) ? new Date(coverageMs).toISOString() : null,
      modelRequests: ids.size + anonRequests,
      events,
      malformedLines,
    };
  } catch (err) {
    return errorUsage('claude-code', err);
  }
}

function collectClaudeEvents(
  record: { type?: string; timestamp?: string; message?: { content?: unknown } },
  events: UsageEvent[],
): void {
  const at = typeof record.timestamp === 'string' ? record.timestamp : null;
  const content = record.message?.content;
  if (record.type === 'assistant' && Array.isArray(content)) {
    for (const item of content) {
      if (!item || typeof item !== 'object') continue;
      const tool = item as { type?: string; name?: string; input?: unknown };
      if (tool.type !== 'tool_use') continue;
      if (!tool.input || typeof tool.input !== 'object' || Array.isArray(tool.input)) continue;
      const input = tool.input as Record<string, unknown>;
      if (tool.name === 'Skill' && typeof input.skill !== 'string') continue;
      if (tool.name === 'Skill' && typeof input.skill === 'string') {
        const raw = input.skill;
        const colon = raw.indexOf(':');
        events.push({
          harness: 'claude-code',
          at,
          via: 'skill-tool',
          ref: {
            type: 'name',
            name: colon === -1 ? raw : raw.slice(colon + 1),
            plugin: colon === -1 ? null : raw.slice(0, colon),
            kind: 'skill',
          },
        });
      }
      if (tool.name === 'Task' && typeof input.subagent_type === 'string') {
        events.push({
          harness: 'claude-code',
          at,
          via: 'subagent',
          ref: { type: 'name', name: input.subagent_type, plugin: null, kind: 'agent' },
        });
      }
      for (const skillPath of extractSkillMdPaths(JSON.stringify(input))) {
        events.push({
          harness: 'claude-code',
          at,
          via: 'file-read',
          ref: { type: 'path', path: skillPath },
        });
      }
    }
  }
  if (record.type === 'user' && typeof content === 'string') {
    const match = content.match(/<command-name>\/([^<]+)<\/command-name>/);
    const name = match?.[1];
    if (name) {
      events.push({
        harness: 'claude-code',
        at,
        via: 'slash-command',
        ref: { type: 'name', name, plugin: null, kind: 'command' },
      });
    }
  }
}
