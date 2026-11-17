import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/context.js';
import type { UsageEvent } from '../../src/model.js';
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

  it('mines a v2 database and skips skill rows outside the window', async () => {
    const home = await tempDir('sw-oc-v2-');
    const dbPath = path.join(home, '.local', 'share', 'opencode', 'opencode.db');
    await fs.mkdir(path.dirname(dbPath), { recursive: true });
    const db = new DatabaseSync(dbPath);
    db.exec(`
      CREATE TABLE session_v2 (id TEXT, time_created INTEGER);
      CREATE TABLE session_message (id TEXT, session_id TEXT, type TEXT, time_created INTEGER, data TEXT);
      CREATE TABLE session_part (message_id TEXT, session_id TEXT, type TEXT, time_created INTEGER, data TEXT);
    `);
    const inside = FIXTURE_NOW.getTime() - 86_400_000;
    const outside = FIXTURE_NOW.getTime() - 40 * 86_400_000;
    const skill = (name: string) => JSON.stringify({ type: 'tool', tool: 'skill', state: { input: { name } } });
    const insertPart = db.prepare('INSERT INTO session_part (message_id, session_id, type, time_created, data) VALUES (?, ?, ?, ?, ?)');
    insertPart.run('m1', 's1', 'tool', inside, skill('inside-skill'));
    insertPart.run('m2', 's1', 'tool', outside, skill('outside-skill'));
    db.prepare('INSERT INTO session_message (id, session_id, type, time_created, data) VALUES (?, ?, ?, ?, ?)').run(
      'm1', 's1', 'assistant', inside, JSON.stringify({ role: 'assistant' }),
    );
    db.close();
    const ctx = createContext({ home, cwd: home, now: FIXTURE_NOW, env: {}, toolVersion: '0.0.0-test' });
    const usage = await mineOpencodeUsage(ctx);
    expect(usage.status).toBe('ok');
    expect(usage.events.filter((event): event is UsageEvent & { ref: { type: 'name'; name: string } } => event.ref.type === 'name').map((event) => event.ref.name)).toEqual(['inside-skill']);
    expect(usage.modelRequests).toBe(1);
  });

  it('mines skill rows from session_message when session_part is empty', async () => {
    const home = await tempDir('sw-oc-v2-msg-');
    const dbPath = path.join(home, '.local', 'share', 'opencode', 'opencode.db');
    await fs.mkdir(path.dirname(dbPath), { recursive: true });
    const db = new DatabaseSync(dbPath);
    db.exec(`
      CREATE TABLE session_message (id TEXT, session_id TEXT, type TEXT, time_created INTEGER, data TEXT);
      CREATE TABLE session_part (message_id TEXT, session_id TEXT, type TEXT, time_created INTEGER, data TEXT);
    `);
    const inside = FIXTURE_NOW.getTime() - 86_400_000;
    const data = JSON.stringify({
      content: [{ type: 'tool', tool: 'skill', state: { input: { name: 'from-message' } } }],
    });
    db.prepare('INSERT INTO session_message (id, session_id, type, time_created, data) VALUES (?, ?, ?, ?, ?)').run(
      'm1', 's1', 'user', inside, data,
    );
    db.close();
    const ctx = createContext({ home, cwd: home, now: FIXTURE_NOW, env: {}, toolVersion: '0.0.0-test' });
    const usage = await mineOpencodeUsage(ctx);
    expect(usage.status).toBe('ok');
    expect(usage.events.filter((event): event is UsageEvent & { ref: { type: 'name'; name: string } } => event.ref.type === 'name').map((event) => event.ref.name)).toEqual(['from-message']);
  });

  it('errors when the database has neither schema', async () => {
    const home = await tempDir('sw-oc-empty-');
    const dbPath = path.join(home, '.local', 'share', 'opencode', 'opencode.db');
    await fs.mkdir(path.dirname(dbPath), { recursive: true });
    const db = new DatabaseSync(dbPath);
    db.exec('CREATE TABLE nope (id INTEGER)');
    db.close();
    const ctx = createContext({ home, cwd: home, now: FIXTURE_NOW, env: {}, toolVersion: '0.0.0-test' });
    const usage = await mineOpencodeUsage(ctx);
    expect(usage.status).toBe('error');
    expect(usage.reason).toMatch(/neither v2/);
  });
});
