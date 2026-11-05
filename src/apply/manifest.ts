import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ScanContext, Verdict } from '../model.js';
import { listSubdirs, readJsonSafe } from '../util/fs.js';
import { removeFile } from './move.js';

export type ActionState = 'pending' | 'done' | 'failed' | 'restored' | 'conflict';

export type ManifestAction =
  | { type: 'move'; itemIds: string[]; name: string; verdict: Verdict; from: string; to: string; treeHash: string; state: ActionState; error?: string }
  | { type: 'config-set'; itemIds: string[]; name: string; file: string; backup: string; fileExisted: boolean; key: string; before: boolean | null; afterHash: string | null; state: ActionState; error?: string }
  | { type: 'manual'; itemIds: string[]; name: string; instruction: string; state: 'pending' };

export interface Manifest {
  version: 1;
  runId: string;
  createdAt: string;
  toolVersion: string;
  home: string;
  status: 'in-progress' | 'complete' | 'partial' | 'restored';
  stackWeightBefore: number;
  stackWeightAfter: number;
  actions: ManifestAction[];
}

export function newRunId(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = [
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`,
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`,
  ].join('-');
  return `${stamp}-${randomBytes(2).toString('hex')}`;
}

export function runDir(ctx: ScanContext, runId: string): string {
  return path.join(ctx.stateDir, 'parked', runId);
}

export async function writeManifest(ctx: ScanContext, manifest: Manifest): Promise<void> {
  const dir = runDir(ctx, manifest.runId);
  await fs.mkdir(dir, { recursive: true });
  const finalPath = path.join(dir, 'manifest.json');
  const tmp = path.join(dir, 'manifest.json.tmp');
  await fs.writeFile(tmp, `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.rename(tmp, finalPath);
}

export async function readManifest(ctx: ScanContext, runId: string): Promise<Manifest | null> {
  return readJsonSafe<Manifest>(path.join(runDir(ctx, runId), 'manifest.json'));
}

export async function listManifests(ctx: ScanContext): Promise<Manifest[]> {
  const dirs = await listSubdirs(path.join(ctx.stateDir, 'parked'));
  const manifests: Manifest[] = [];
  for (const dir of dirs) {
    const manifest = await readManifest(ctx, path.basename(dir));
    if (manifest) manifests.push(manifest);
  }
  return manifests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function acquireLock(ctx: ScanContext): Promise<() => Promise<void>> {
  await fs.mkdir(ctx.stateDir, { recursive: true });
  const lockPath = path.join(ctx.stateDir, 'lock');
  let handle: fs.FileHandle;
  try {
    handle = await fs.open(lockPath, 'wx');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(`Another StackWeight prune/restore is running. If not, delete ${lockPath}.`);
    }
    throw err;
  }
  return async () => {
    await handle.close();
    await removeFile(lockPath);
  };
}
