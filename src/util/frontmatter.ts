import YAML from 'yaml';

export interface Frontmatter {
  data: Record<string, unknown>;
  body: string;
  warnings: string[];
}

function isMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseFrontmatter(text: string): Frontmatter {
  let src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);
  if (!src.startsWith('---\n')) {
    return { data: {}, body: src, warnings: ['missing frontmatter'] };
  }
  const lines = src.slice(4).split('\n');
  const close = lines.findIndex((line) => line === '---');
  if (close < 0) return { data: {}, body: src, warnings: ['missing frontmatter'] };
  const yamlText = lines.slice(0, close).join('\n');
  const body = lines.slice(close + 1).join('\n');
  try {
    const parsed: unknown = YAML.parse(yamlText);
    if (!isMapping(parsed)) {
      return { data: {}, body, warnings: ['frontmatter is not a mapping'] };
    }
    return { data: parsed, body, warnings: [] };
  } catch {
    return { data: {}, body, warnings: ['invalid frontmatter YAML'] };
  }
}

export function fmString(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === 'string' ? value.trim() : null;
}
