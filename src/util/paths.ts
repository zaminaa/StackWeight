import path from 'node:path';

export function toPosix(p: string): string {
  return p.replace(/\\/g, '/');
}

export function normalizeForCompare(p: string): string {
  let n = toPosix(path.resolve(p));
  if (n.length > 1 && n.endsWith('/')) n = n.replace(/\/+$/, '');
  if (process.platform === 'win32') n = n.toLowerCase();
  return n;
}

export function samePath(a: string, b: string): boolean {
  return normalizeForCompare(a) === normalizeForCompare(b);
}

export function isInside(child: string, parent: string): boolean {
  const c = normalizeForCompare(child);
  const p = normalizeForCompare(parent);
  return c === p || c.startsWith(`${p}/`);
}

export function displayPath(p: string, home: string): string {
  const abs = toPosix(path.resolve(p));
  const homeAbs = toPosix(path.resolve(home)).replace(/\/+$/, '');
  const cmp = process.platform === 'win32'
    ? (s: string) => s.toLowerCase()
    : (s: string) => s;
  const a = cmp(abs);
  const h = cmp(homeAbs);
  if (a === h) return '~';
  if (a.startsWith(`${h}/`)) return `~/${abs.slice(homeAbs.length + 1)}`;
  return abs;
}
