import path from 'node:path';
import { HARNESS_IDS, type Evidence, type HarnessId, type ItemKind, type ScanContext, type ScannedItem, type Scope } from '../model.js';
import { exists, listMdFiles, listSubdirs } from '../util/fs.js';
import { displayPath, normalizeForCompare, samePath } from '../util/paths.js';
import { readMdItem, readSkillDir, type RawItem } from './items.js';

export interface RootSpec {
  id: string;
  harness: HarnessId;
  evidence: Evidence;
  scope: Scope;
  kind: ItemKind;
  layout: 'skill-dirs' | 'md-files';
  resolve(ctx: ScanContext): string | null;
}

function ocRoot(ctx: ScanContext): string {
  return path.join(ctx.env.XDG_CONFIG_HOME ?? path.join(ctx.home, '.config'), 'opencode');
}

function project(ctx: ScanContext, ...parts: string[]): string | null {
  if (samePath(ctx.cwd, ctx.home)) return null;
  return path.join(ctx.cwd, ...parts);
}

export const SKILL_ROOTS: RootSpec[] = [
  { id: 'claude-skills', harness: 'claude-code', evidence: 'documented', scope: 'user', kind: 'skill', layout: 'skill-dirs', resolve: (ctx) => path.join(ctx.home, '.claude', 'skills') },
  { id: 'claude-commands', harness: 'claude-code', evidence: 'documented', scope: 'user', kind: 'command', layout: 'md-files', resolve: (ctx) => path.join(ctx.home, '.claude', 'commands') },
  { id: 'claude-agents', harness: 'claude-code', evidence: 'documented', scope: 'user', kind: 'agent', layout: 'md-files', resolve: (ctx) => path.join(ctx.home, '.claude', 'agents') },
  { id: 'claude-skills-project', harness: 'claude-code', evidence: 'documented', scope: 'project', kind: 'skill', layout: 'skill-dirs', resolve: (ctx) => project(ctx, '.claude', 'skills') },
  { id: 'claude-commands-project', harness: 'claude-code', evidence: 'documented', scope: 'project', kind: 'command', layout: 'md-files', resolve: (ctx) => project(ctx, '.claude', 'commands') },
  { id: 'claude-agents-project', harness: 'claude-code', evidence: 'documented', scope: 'project', kind: 'agent', layout: 'md-files', resolve: (ctx) => project(ctx, '.claude', 'agents') },
  { id: 'cursor-skills', harness: 'cursor', evidence: 'documented', scope: 'user', kind: 'skill', layout: 'skill-dirs', resolve: (ctx) => path.join(ctx.home, '.cursor', 'skills') },
  { id: 'cursor-skills-builtin', harness: 'cursor', evidence: 'observed', scope: 'builtin', kind: 'skill', layout: 'skill-dirs', resolve: (ctx) => path.join(ctx.home, '.cursor', 'skills-cursor') },
  { id: 'cursor-skills-project', harness: 'cursor', evidence: 'documented', scope: 'project', kind: 'skill', layout: 'skill-dirs', resolve: (ctx) => project(ctx, '.cursor', 'skills') },
  { id: 'cursor-agents-skills', harness: 'cursor', evidence: 'observed', scope: 'user', kind: 'skill', layout: 'skill-dirs', resolve: (ctx) => path.join(ctx.home, '.agents', 'skills') },
  { id: 'codex-skills', harness: 'codex', evidence: 'documented', scope: 'user', kind: 'skill', layout: 'skill-dirs', resolve: (ctx) => path.join(ctx.home, '.codex', 'skills') },
  { id: 'codex-skills-builtin', harness: 'codex', evidence: 'observed', scope: 'builtin', kind: 'skill', layout: 'skill-dirs', resolve: (ctx) => path.join(ctx.home, '.codex', 'skills', '.system') },
  { id: 'codex-agents-skills', harness: 'codex', evidence: 'documented', scope: 'user', kind: 'skill', layout: 'skill-dirs', resolve: (ctx) => path.join(ctx.home, '.agents', 'skills') },
  { id: 'codex-agents-skills-project', harness: 'codex', evidence: 'documented', scope: 'project', kind: 'skill', layout: 'skill-dirs', resolve: (ctx) => project(ctx, '.agents', 'skills') },
  { id: 'opencode-skill', harness: 'opencode', evidence: 'observed', scope: 'user', kind: 'skill', layout: 'skill-dirs', resolve: (ctx) => path.join(ocRoot(ctx), 'skill') },
  { id: 'opencode-agent', harness: 'opencode', evidence: 'observed', scope: 'user', kind: 'agent', layout: 'md-files', resolve: (ctx) => path.join(ocRoot(ctx), 'agent') },
  { id: 'opencode-command', harness: 'opencode', evidence: 'observed', scope: 'user', kind: 'command', layout: 'md-files', resolve: (ctx) => path.join(ocRoot(ctx), 'command') },
  { id: 'opencode-skill-project', harness: 'opencode', evidence: 'observed', scope: 'project', kind: 'skill', layout: 'skill-dirs', resolve: (ctx) => project(ctx, '.opencode', 'skill') },
];

export interface RootDiscovery { items: ScannedItem[]; notes: string[]; }

const SCOPE_RANK: Record<Scope, number> = { user: 0, project: 1, builtin: 2 };

interface Acc {
  raw: RawItem;
  loadedBy: Set<HarnessId>;
  evidence: Evidence;
  scope: Scope;
}

export async function discoverRootItems(ctx: ScanContext): Promise<RootDiscovery> {
  const notes: string[] = [];
  const merged = new Map<string, Acc>();
  for (const root of SKILL_ROOTS) {
    const dir = root.resolve(ctx);
    if (!dir || !(await exists(dir))) continue;
    const raws = await readRoot(dir, root);
    notes.push(`found ${displayPath(dir, ctx.home)}: ${raws.length} items`);
    for (const raw of raws) {
      const key = normalizeForCompare(raw.parkPath);
      const prev = merged.get(key);
      if (!prev) {
        merged.set(key, { raw, loadedBy: new Set([root.harness]), evidence: root.evidence, scope: root.scope });
        continue;
      }
      prev.loadedBy.add(root.harness);
      if (root.evidence === 'observed') prev.evidence = 'observed';
      if (SCOPE_RANK[root.scope] > SCOPE_RANK[prev.scope]) prev.scope = root.scope;
    }
  }
  const items: ScannedItem[] = [...merged.values()].map((acc) => ({
    ...acc.raw,
    qualifiedName: acc.raw.name,
    scope: acc.scope,
    loadedBy: HARNESS_IDS.filter((id) => acc.loadedBy.has(id)),
    evidence: acc.evidence,
    plugin: null,
  }));
  return { items, notes };
}

async function readRoot(dir: string, root: RootSpec): Promise<RawItem[]> {
  if (root.layout === 'md-files') {
    const files = await listMdFiles(dir);
    const out: RawItem[] = [];
    for (const file of files) {
      const kind = root.kind === 'command' ? 'command' : 'agent';
      const item = await readMdItem(file, kind);
      if (item) out.push(item);
    }
    return out;
  }
  const out: RawItem[] = [];
  for (const sub of await listSubdirs(dir)) {
    if (path.basename(sub).startsWith('.')) continue;
    const item = await readSkillDir(sub);
    if (item) out.push(item);
  }
  return out;
}
