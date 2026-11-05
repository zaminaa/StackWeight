import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

export async function exists(p: string): Promise<boolean> {
  return (await statSafe(p)) !== null;
}

export async function statSafe(p: string): Promise<fs.Stats | null> {
  try {
    return await fs.promises.lstat(p);
  } catch {
    return null;
  }
}

export async function readTextSafe(p: string, maxBytes = 1_048_576): Promise<string | null> {
  try {
    const st = await fs.promises.lstat(p);
    if (!st.isFile() || st.size > maxBytes) return null;
    let text = await fs.promises.readFile(p, 'utf8');
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    return text;
  } catch {
    return null;
  }
}

export async function readJsonSafe<T = unknown>(p: string): Promise<T | null> {
  const text = await readTextSafe(p);
  if (text === null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function listSubdirs(dir: string): Promise<string[]> {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const out: string[] = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        out.push(full);
        continue;
      }
      if (!entry.isSymbolicLink()) continue;
      try {
        const st = await fs.promises.stat(full);
        if (st.isDirectory()) out.push(full);
      } catch {
        // dangling link
      }
    }
    out.sort((a, b) => a.localeCompare(b));
    return out;
  } catch {
    return [];
  }
}

export async function listMdFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
      .map((entry) => path.join(dir, entry.name))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export async function walkFiles(
  dir: string,
  opts: { exts: string[]; maxFiles: number; maxBytes: number; skipDirs: string[] },
): Promise<string[]> {
  const out: string[] = [];
  const skip = new Set(opts.skipDirs);
  const exts = new Set(opts.exts.map((ext) => ext.toLowerCase()));
  async function walk(current: string): Promise<void> {
    if (out.length >= opts.maxFiles) return;
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= opts.maxFiles) return;
      if (skip.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!exts.has(ext)) continue;
      const st = await statSafe(full);
      if (!st || st.size > opts.maxBytes) continue;
      out.push(full);
    }
  }
  await walk(dir);
  return out;
}

export async function forEachLine(file: string, fn: (line: string) => void): Promise<void> {
  await new Promise<void>((resolve) => {
    const stream = fs.createReadStream(file, { encoding: 'utf8' });
    stream.on('error', () => resolve());
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    rl.on('line', (line) => {
      if (line.length <= 20_000_000) fn(line);
    });
    rl.on('close', () => resolve());
    rl.on('error', () => resolve());
  });
}
