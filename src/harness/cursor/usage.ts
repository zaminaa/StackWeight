import fs from 'node:fs/promises';
import path from 'node:path';
import type { HarnessUsage, ScanContext, UsageEvent } from '../../model.js';
import { forEachLine, listSubdirs, statSafe } from '../../util/fs.js';
import { absentUsage, displayLogDir, errorUsage, extractSkillMdPaths, inWindow } from '../shared.js';

export async function mineCursorUsage(ctx: ScanContext): Promise<HarnessUsage> {
  try {
    const projects = path.join(ctx.home, '.cursor', 'projects');
    const files: { file: string; mtime: Date }[] = [];
    for (const project of await listSubdirs(projects)) {
      await collectJsonl(path.join(project, 'agent-transcripts'), 0, files);
    }
    if (files.length === 0) return absentUsage('cursor', displayLogDir(projects, ctx.home, 'Cursor'));

    let oldest = Infinity;
    let requests = 0;
    let malformedLines = 0;
    const events: UsageEvent[] = [];
    const sources: string[] = [];
    for (const { file, mtime } of files) {
      oldest = Math.min(oldest, mtime.getTime());
      if (!inWindow(mtime.toISOString(), ctx)) continue;
      sources.push(file);
      const at = mtime.toISOString();
      await forEachLine(file, (line) => {
        if (!line.includes('"role":"assistant"')) return;
        requests += 1;
        if (!line.includes('"tool_use"')) return;
        let row: unknown;
        try {
          row = JSON.parse(line);
        } catch {
          malformedLines += 1;
          return;
        }
        const content = (row as { message?: { content?: unknown } }).message?.content;
        if (!Array.isArray(content)) return;
        for (const item of content) {
          if (!item || typeof item !== 'object') continue;
          const tool = item as { type?: string; input?: unknown };
          if (tool.type !== 'tool_use' || !tool.input || typeof tool.input !== 'object') continue;
          for (const skillPath of extractSkillMdPaths(JSON.stringify(tool.input))) {
            events.push({ harness: 'cursor', at, via: 'file-read', ref: { type: 'path', path: skillPath } });
          }
        }
      });
    }
    return {
      harness: 'cursor',
      status: 'ok',
      reason: null,
      sources,
      coverageStart: Number.isFinite(oldest) ? new Date(oldest).toISOString() : null,
      modelRequests: requests,
      events,
      malformedLines,
    };
  } catch (err) {
    return errorUsage('cursor', err);
  }
}

async function collectJsonl(dir: string, depth: number, out: { file: string; mtime: Date }[]): Promise<void> {
  if (depth > 3) return;
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectJsonl(full, depth + 1, out);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
    const st = await statSafe(full);
    if (st) out.push({ file: full, mtime: st.mtime });
  }
}
