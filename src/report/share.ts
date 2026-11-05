import type { ScanResult } from '../model.js';
import { fmtTokens } from '../util/format.js';

export function shareText(result: ScanResult): string {
  if (result.lastPrune) {
    return `My AI agent stack went from ≈${fmtTokens(result.lastPrune.before)} to ≈${fmtTokens(result.lastPrune.after)} tokens per message after one prune. Undo is one command. npx stackweight`;
  }
  return `My AI agents carry ≈${fmtTokens(result.totals.stackWeight)} tokens of skills on every message. ${result.totals.deadPct}% of it I haven't used in ${result.windowDays} days. Weighed with npx stackweight (local-only, nothing uploaded).`;
}
