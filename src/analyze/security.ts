import path from 'node:path';
import type { RuleId, ScannedItem, SecurityFlag } from '../model.js';
import { readTextSafe, walkFiles } from '../util/fs.js';

export const RULES: { id: RuleId; title: string; patterns: RegExp[] }[] = [
  {
    id: 'SW001',
    title: 'Instruction override phrasing',
    patterns: [
      /\b(ignore|disregard|forget)\s+(all\s+)?(of\s+)?(the\s+)?(previous|prior|above|earlier|preceding)\s+(instructions|prompts|rules|messages)\b/i,
      /\bdo\s+not\s+(tell|inform|mention\s+(this\s+)?to)\s+the\s+user\b/i,
    ],
  },
  {
    id: 'SW003',
    title: 'Reads sensitive files',
    patterns: [
      /(~|\$HOME|%USERPROFILE%|\/home\/[^/\s]+|\/Users\/[^/\s]+)?[\/\\]\.ssh[\/\\]|\bid_(rsa|ed25519|ecdsa)\b|\.aws[\/\\]credentials|\.git-credentials|[\/\\]\.netrc\b|Login Data|\.config[\/\\]gh[\/\\]hosts\.yml/i,
    ],
  },
  {
    id: 'SW004',
    title: 'Downloads and runs remote code',
    patterns: [
      /\b(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?(ba|z)?sh\b/i,
      /\b(iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^\n|]*\|\s*(iex|Invoke-Expression)\b/i,
      /\bbash\s+<\(\s*(curl|wget)/i,
      /DownloadString\([^)]*\)\s*\|?\s*(iex|Invoke-Expression)|(iex|Invoke-Expression)\s*\(\s*\(?\s*New-Object\s+Net\.WebClient/i,
    ],
  },
];

const TITLES: Record<RuleId, string> = {
  SW001: 'Instruction override phrasing',
  SW002: 'Hidden Unicode characters',
  SW003: 'Reads sensitive files',
  SW004: 'Downloads and runs remote code',
};

function hidden(cp: number, index: number): boolean {
  if (cp === 0x200c || cp === 0x200d) return false;
  if (cp === 0xfeff) return index !== 0;
  return cp === 0x200b
    || (cp >= 0x2060 && cp <= 0x2064)
    || (cp >= 0x202a && cp <= 0x202e)
    || (cp >= 0x2066 && cp <= 0x2069)
    || (cp >= 0xe0000 && cp <= 0xe007f);
}

export function findHiddenChars(text: string): { index: number; codePoint: number }[] {
  const out: { index: number; codePoint: number }[] = [];
  for (let i = 0; i < text.length;) {
    const codePoint = text.codePointAt(i) ?? 0;
    if (hidden(codePoint, i)) out.push({ index: i, codePoint });
    i += codePoint > 0xffff ? 2 : 1;
  }
  return out;
}

function renderSnippet(line: string): string {
  let out = '';
  const trimmed = line.trim();
  for (let i = 0; i < trimmed.length;) {
    const cp = trimmed.codePointAt(i) ?? 0;
    const size = cp > 0xffff ? 2 : 1;
    const show = cp === 0x200b || cp === 0x200c || cp === 0x200d || hidden(cp, 1) || cp === 0xfeff;
    if (show) out += `<U+${cp.toString(16).toUpperCase().padStart(4, '0')}>`;
    else out += trimmed.slice(i, i + size);
    i += size;
  }
  return out.slice(0, 120);
}

export function scanText(text: string, file: string): SecurityFlag[] {
  const flags: SecurityFlag[] = [];
  const lines = text.split('\n');
  const hiddenLines = new Set<number>();
  let cursor = 0;
  const starts: number[] = [];
  for (const line of lines) {
    starts.push(cursor);
    cursor += line.length + 1;
  }
  for (const hit of findHiddenChars(text)) {
    let lineNo = 0;
    for (let i = 0; i < starts.length; i++) {
      if ((starts[i] ?? 0) <= hit.index) lineNo = i;
    }
    hiddenLines.add(lineNo);
  }
  for (let n = 0; n < lines.length; n++) {
    if (flags.length >= 5) break;
    const line = lines[n] ?? '';
    for (const rule of RULES) {
      if (flags.length >= 5) break;
      if (rule.patterns.some((pattern) => pattern.test(line))) {
        flags.push({ rule: rule.id, title: rule.title, file, line: n + 1, snippet: renderSnippet(line) });
      }
    }
    if (flags.length < 5 && hiddenLines.has(n)) {
      flags.push({ rule: 'SW002', title: TITLES.SW002, file, line: n + 1, snippet: renderSnippet(line) });
    }
  }
  return flags;
}

export async function scanItemSecurity(item: ScannedItem): Promise<SecurityFlag[]> {
  const files: string[] = [];
  if (item.kind === 'skill') {
    const walked = await walkFiles(item.parkPath, {
      exts: ['.md', '.sh', '.bash', '.ps1', '.py', '.js', '.mjs', '.ts'],
      maxFiles: 50,
      maxBytes: 256 * 1024,
      skipDirs: ['node_modules', '.git'],
    });
    files.push(...walked);
  }
  if (!files.some((file) => path.resolve(file) === path.resolve(item.entryFile))) files.push(item.entryFile);
  const flags: SecurityFlag[] = [];
  for (const file of files) {
    const text = await readTextSafe(file, 256 * 1024);
    if (text === null) continue;
    flags.push(...scanText(text, file));
  }
  return flags;
}
