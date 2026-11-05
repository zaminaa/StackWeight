import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

// Removing a settings file StackWeight itself created. User files are never removed here.
export async function removeCreatedFile(file: string): Promise<void> {
  await fs.rm(file);
}

export async function setClaudePluginEnabled(
  file: string,
  key: string,
  value: boolean | null,
  backupPath: string | null,
): Promise<{ before: boolean | null; fileExisted: boolean; afterHash: string }> {
  let raw: Buffer | null = null;
  try {
    raw = await fs.readFile(file);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  const fileExisted = raw !== null;
  if (backupPath && raw) {
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    await fs.writeFile(backupPath, raw);
  }
  let parsed: unknown = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw.toString('utf8'));
    } catch {
      throw new Error('settings.json is not valid JSON');
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('settings.json is not valid JSON');
  }
  const obj = parsed as { enabledPlugins?: Record<string, unknown> };
  const enabled = obj.enabledPlugins && typeof obj.enabledPlugins === 'object' ? obj.enabledPlugins : {};
  const current = enabled[key];
  const before = typeof current === 'boolean' ? current : null;
  if (value === null) delete enabled[key];
  else enabled[key] = value;
  obj.enabledPlugins = enabled;
  const text = `${JSON.stringify(obj, null, 2)}\n`;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
  return {
    before,
    fileExisted,
    afterHash: createHash('sha256').update(text).digest('hex'),
  };
}
