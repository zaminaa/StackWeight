import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/context.js';
import { mineOpencodeUsage } from '../../src/harness/opencode/usage.js';
import { FIXTURE_NOW, buildFixture, tempDir } from '../helpers/fixture.js';

describe('mineOpencodeUsage', () => {
  it('reports a non-database file as an error', async () => {
    const home = await buildFixture('broken', await tempDir('sw-oc-broken-'));
    const ctx = createContext({ home, cwd: home, now: FIXTURE_NOW, env: {}, toolVersion: '0.0.0-test' });
    const usage = await mineOpencodeUsage(ctx);
    expect(usage.status).toBe('error');
    expect(usage.reason).toMatch(/not a database/i);
  });

  it('is absent on the minimal fixture', async () => {
    const home = await buildFixture('minimal', await tempDir('sw-oc-minimal-'));
    const ctx = createContext({ home, cwd: home, now: FIXTURE_NOW, env: {}, toolVersion: '0.0.0-test' });
    const usage = await mineOpencodeUsage(ctx);
    expect(usage.status).toBe('absent');
  });

  it('reads skill tool parts and assistant messages', async () => {
    const home = await tempDir('sw-oc-db-');
    const dbPath = path.join(home, '.local', 'share', 'opencode', 'opencode.db');
    await fs.mkdir(path.dirname(dbPath), { recursive: true });
    const db = new DatabaseSync(dbPath);
    db.exec(`
      CREATE TABLE part (id TEXT, message_id TEXT, session_id TEXT, time_created INTEGER, time_updated INTEGER, data TEXT);
      CREATE TABLE message (id TEXT, session_id TEXT, time_created INTEGER, time_updated INTEGER, data TEXT);
    `);
    const when = FIXTURE_NOW.getTime() - 86_400_000;
    const data = JSON.stringify({ type: 'tool', tool: 'skill', state: { input: { name: 'translate-fa' } } });
    db.prepare('INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?, ?)').run('p1', 'm1', 's1', when, when, data);
    const insert = db.prepare('INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?)');
    insert.run('m1', 's1', when, when, JSON.stringify({ role: 'assistant' }));
    insert.run('m2', 's1', when, when, JSON.stringify({ role: 'assistant' }));
    db.close();
    const ctx = createContext({ home, cwd: home, now: FIXTURE_NOW, env: {}, toolVersion: '0.0.0-test' });
    const usage = await mineOpencodeUsage(ctx);
    expect(usage.status).toBe('ok');
    expect(usage.events.filter((event) => event.ref.type === 'name' && event.ref.name === 'translate-fa')).toHaveLength(1);
    expect(usage.modelRequests).toBe(2);
  });
});
