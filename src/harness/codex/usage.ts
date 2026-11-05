import fs from 'node:fs/promises';
import path from 'node:path';
import type { HarnessUsage, ObservedListing, ScanContext, UsageEvent } from '../../model.js';
import { forEachLine, statSafe } from '../../util/fs.js';
import { absentUsage, displayLogDir, errorUsage, extractSkillMdPaths, inWindow, windowStart } from '../shared.js';

const CALL_TYPES = new Set(['function_call', 'custom_tool_call', 'local_shell_call']);

export async function mineCodexUsage(ctx: ScanContext): Promise<HarnessUsage> {
  try {
    const sessions = path.join(ctx.home, '.codex', 'sessions');
    const files: { file: string; mtime: Date }[] = [];
    await collectRollouts(sessions, 0, files);
    if (files.length === 0) return absentUsage('codex', displayLogDir(sessions, ctx.home, 'Codex'));

    let oldest = Infinity;
    let earliest = Infinity;
    let requests = 0;
    let malformedLines = 0;
    const events: UsageEvent[] = [];
    const sources: string[] = [];
    const start = windowStart(ctx).getTime();
    for (const { file, mtime } of files) {
      oldest = Math.min(oldest, mtime.getTime());
      if (mtime.getTime() < start) continue;
      sources.push(file);
      await forEachLine(file, (line) => {
        const assistant = line.includes('"type":"message"') && line.includes('"role":"assistant"');
        const call = line.includes('"function_call"') || line.includes('"custom_tool_call"') || line.includes('"local_shell_call"');
        if (!assistant && !call) return;
        let row: unknown;
        try {
          row = JSON.parse(line);
        } catch {
          malformedLines += 1;
          return;
        }
        if (!row || typeof row !== 'object') return;
        const record = row as { timestamp?: string; type?: string; payload?: { type?: string; role?: string } };
        if (typeof record.timestamp === 'string') {
          const ms = new Date(record.timestamp).getTime();
          if (!Number.isNaN(ms)) earliest = Math.min(earliest, ms);
        }
        if (assistant && record.payload?.type === 'message' && record.payload.role === 'assistant' && inWindow(record.timestamp ?? null, ctx)) {
          requests += 1;
        }
        if (record.type === 'response_item' && record.payload?.type && CALL_TYPES.has(record.payload.type)) {
          for (const skillPath of extractSkillMdPaths(JSON.stringify(record.payload))) {
            events.push({
              harness: 'codex',
              at: record.timestamp ?? null,
              via: 'file-read',
              ref: { type: 'path', path: skillPath },
            });
          }
        }
      });
    }
    const coverageMs = Math.min(oldest, earliest);
    return {
      harness: 'codex',
      status: 'ok',
      reason: null,
      sources,
      coverageStart: Number.isFinite(coverageMs) ? new Date(coverageMs).toISOString() : null,
      modelRequests: requests,
      events,
      malformedLines,
    };
  } catch (err) {
    return errorUsage('codex', err);
  }
}

export async function readCodexListing(
  ctx: ScanContext,
  countTokens: (text: string) => number,
): Promise<ObservedListing | null> {
  const sessions = path.join(ctx.home, '.codex', 'sessions');
  const files: { file: string; mtime: Date }[] = [];
  await collectRollouts(sessions, 0, files);
  const start = windowStart(ctx).getTime();
  const newest = files
    .filter((file) => file.mtime.getTime() >= start)
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0];
  if (!newest) return null;
  const found: { text: string; at: string | null }[] = [];
  await forEachLine(newest.file, (line) => {
    if (found.length > 0 || !line.includes('### Available skills')) return;
    try {
      const row = JSON.parse(line) as { timestamp?: string };
      const text = findString(row, '### Available skills');
      if (!text) return;
      found.push({ text, at: typeof row.timestamp === 'string' ? row.timestamp : null });
    } catch {
      // listing line was not JSON
    }
  });
  const hit = found[0];
  if (!hit) return null;
  const headerAt = hit.text.indexOf('### Available skills');
  const slice = hit.text.slice(headerAt);
  const next = slice.indexOf('\n### ', 1);
  const body = next === -1 ? slice : slice.slice(0, next);
  const entries: { name: string; path: string | null }[] = [];
  for (const line of body.split('\n')) {
    const match = line.match(/^- ([^:]+): .* \(file: (.+)\)$/);
    if (!match?.[1]) continue;
    entries.push({ name: match[1], path: match[2] ?? null });
  }
  return {
    harness: 'codex',
    file: newest.file,
    at: hit.at,
    entries,
    text: body,
    tokens: countTokens(body),
  };
}

function findString(value: unknown, needle: string): string | null {
  if (typeof value === 'string') return value.includes(needle) ? value : null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findString(item, needle);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      const found = findString(item, needle);
      if (found) return found;
    }
  }
  return null;
}

async function collectRollouts(dir: string, depth: number, out: { file: string; mtime: Date }[]): Promise<void> {
  if (depth > 4) return;
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectRollouts(full, depth + 1, out);
      continue;
    }
    if (!entry.isFile() || !entry.name.startsWith('rollout-') || !entry.name.endsWith('.jsonl')) continue;
    const st = await statSafe(full);
    if (st) out.push({ file: full, mtime: st.mtime });
  }
}
