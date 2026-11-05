const ANSI: Record<'bold' | 'dim' | 'red' | 'green' | 'yellow' | 'cyan' | 'gray', string> = {
  bold: '1',
  dim: '2',
  red: '31',
  green: '32',
  yellow: '33',
  cyan: '36',
  gray: '90',
};

export function fmtTokens(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs < 1000) return sign + String(Math.round(abs));
  if (abs < 100_000) {
    const one = Math.round(abs / 100) / 10;
    return `${sign}${one.toFixed(1)}k`;
  }
  if (abs < 1_000_000) return `${sign}${Math.round(abs / 1000)}k`;
  const millions = Math.round(abs / 10_000) / 100;
  return `${sign}${millions.toFixed(2)}M`;
}

export function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

export function daysBetween(fromIso: string, to: Date): number {
  return Math.floor((to.getTime() - new Date(fromIso).getTime()) / 86_400_000);
}

export function bar(fraction: number, width: number): string {
  const clamped = Math.min(1, Math.max(0, fraction));
  const filled = Math.round(clamped * width);
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
}

export function paint(
  style: 'bold' | 'dim' | 'red' | 'green' | 'yellow' | 'cyan' | 'gray',
  text: string,
  enabled: boolean,
): string {
  if (!enabled) return text;
  return `\x1b[${ANSI[style]}m${text}\x1b[0m`;
}
