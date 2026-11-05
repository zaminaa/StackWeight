export type HarnessId = 'claude-code' | 'cursor' | 'codex' | 'opencode';
export const HARNESS_IDS: HarnessId[] = ['claude-code', 'cursor', 'codex', 'opencode'];
export const HARNESS_LABELS: Record<HarnessId, string> = {
  'claude-code': 'Claude Code', cursor: 'Cursor', codex: 'Codex', opencode: 'OpenCode',
};

export type ItemKind = 'skill' | 'command' | 'agent';
export type Scope = 'user' | 'project' | 'builtin';
export type Evidence = 'documented' | 'observed';
export type Verdict = 'KEEP' | 'DISABLE' | 'ARCHIVE' | 'MERGE';
export type Action = 'none' | 'move' | 'plugin-config' | 'manual';

export interface PluginRef {
  harness: HarnessId;
  key: string;            // Claude: 'docs-kit@acme'. Cursor: 'mkt/superpowers'
  name: string;           // 'docs-kit'
  version: string | null;
  enabled: boolean | null; // null = no explicit setting found; treated as enabled
  scope: 'user' | 'project';
}

export interface ScannedItem {
  id: string;             // makeItemId(parkPath)
  kind: ItemKind;
  name: string;           // frontmatter name, else dir/file basename
  qualifiedName: string;  // plugin items: `${plugin.name}:${name}`; else name
  description: string;    // frontmatter description, '' if missing
  entryFile: string;      // absolute path to SKILL.md / agent .md / command .md
  parkPath: string;       // skill dir for skills; the .md file for commands/agents
  scope: Scope;
  loadedBy: HarnessId[];  // sorted in HARNESS_IDS order, no duplicates
  evidence: Evidence;     // 'observed' if any root/plugin that contributed it is 'observed'
  plugin: PluginRef | null;
  installedAt: string | null; // ISO
  contentHash: string;    // sha256 hex of entryFile text with CRLF→LF
  warnings: string[];
}

export type UsageRef =
  | { type: 'path'; path: string }
  | { type: 'name'; name: string; plugin: string | null; kind: ItemKind };

export interface UsageEvent {
  harness: HarnessId;
  at: string | null;      // ISO
  via: 'skill-tool' | 'file-read' | 'slash-command' | 'subagent';
  ref: UsageRef;
}

export type UsageStatus = 'ok' | 'absent' | 'error';

export interface HarnessUsage {
  harness: HarnessId;
  status: UsageStatus;
  reason: string | null;        // required when status !== 'ok'
  sources: string[];            // absolute paths of files/dbs read
  coverageStart: string | null; // ISO; min(oldest log file mtime, earliest timestamp on any parsed line/row)
  modelRequests: number | null; // within window; null when status !== 'ok'
  events: UsageEvent[];
  malformedLines: number;
}

export interface ObservedListing {
  harness: HarnessId;
  file: string;
  at: string | null;
  entries: { name: string; path: string | null }[];
  text: string;
  tokens: number;
}

export interface ItemUsage {
  status: 'known' | 'unknown' | 'insufficient-history';
  count: number | null;      // events in window; null when unknown
  lastUsed: string | null;   // newest event ever seen (may be outside window)
  reason: string | null;     // set when status !== 'known'
}

export type RuleId = 'SW001' | 'SW002' | 'SW003' | 'SW004';
export interface SecurityFlag { rule: RuleId; title: string; file: string; line: number; snippet: string; }

export interface AnalyzedItem extends ScannedItem {
  weight: Partial<Record<HarnessId, number>>; // tokens per message, per agent that loads it
  weightTotal: number;
  usage: ItemUsage;
  flags: SecurityFlag[];
  overlapGroupId: string | null;
  duplicateOf: string[];   // ids of OTHER items with identical contentHash
  verdict: Verdict;
  reason: string;          // one plain sentence
  action: Action;
}

export interface OverlapGroup {
  id: string;              // 'og1', 'og2', … in discovery order
  harness: HarnessId;
  itemIds: string[];
  survivorId: string;
  score: number;           // max pairwise similarity in group, 0..1, 2 decimals
}

export interface HarnessSummary {
  harness: HarnessId;
  label: string;
  detected: boolean;
  itemCount: number;
  weight: number;
  deadWeight: number;
  usage: Omit<HarnessUsage, 'events'>;
  listing: ObservedListing | null;
  notes: string[];
}

export interface Totals {
  stackWeight: number;
  deadWeight: number;
  deadPct: number;             // integer 0..100
  afterPruneWeight: number;
  itemCount: number;
  usedCount: number;
  unknownCount: number;
  verdictCounts: Record<Verdict, number>;
  flaggedCount: number;
  overlapGroupCount: number;
  deadTokensResent: number | null;
}

export interface Snapshot {
  at: string;
  stackWeight: number;
  deadWeight: number;
  itemCount: number;
  perHarness: Partial<Record<HarnessId, number>>;
}
export interface SnapshotDelta { since: string; stackWeightDelta: number; itemCountDelta: number; }
export interface LastPrune { runId: string; at: string; before: number; after: number; }

export interface ScanResult {
  schemaVersion: 1;
  tool: { name: 'stackweight'; version: string };
  generatedAt: string;
  windowDays: number;
  durationMs: number;
  home: string;
  harnesses: HarnessSummary[];   // all 4, in HARNESS_IDS order
  items: AnalyzedItem[];         // sorted by weightTotal desc, then qualifiedName asc
  overlapGroups: OverlapGroup[];
  totals: Totals;
  previous: SnapshotDelta | null;
  lastPrune: LastPrune | null;
}

export interface ScanContext {
  home: string;
  cwd: string;
  now: Date;
  windowDays: number;       // 30
  graceDays: number;        // 14
  minCoverageDays: number;  // 7
  stateDir: string;
  toolVersion: string;
  env: Record<string, string | undefined>;
}
