import type { ScanResult } from '../model.js';
import { fmtDate, fmtTokens } from '../util/format.js';

export function renderCardSvg(result: ScanResult): string {
  const detected = result.harnesses.filter((harness) => harness.detected);
  const max = Math.max(1, ...detected.map((harness) => harness.weight));
  const alive = Math.max(0, result.totals.stackWeight - result.totals.deadWeight);
  const deadWidth = result.totals.stackWeight === 0 ? 0 : Math.round((result.totals.deadWeight / result.totals.stackWeight) * 1040);
  const sub = result.lastPrune
    ? `${fmtTokens(result.lastPrune.before)} → ${fmtTokens(result.lastPrune.after)} after one prune (−${pctDrop(result.lastPrune.before, result.lastPrune.after)}%)`
    : `${result.totals.deadPct}% is dead weight — unused for ${result.windowDays} days`;
  const rows = detected.slice(0, 4).map((harness, index) => {
    const y = 360 + index * 36;
    const width = Math.round((harness.weight / max) * 280);
    return `<text x="80" y="${y}" fill="#E8EAED" font-size="18" font-family="ui-sans-serif, system-ui, sans-serif">${escapeXml(harness.label)}</text>
      <rect x="280" y="${y - 16}" width="280" height="14" rx="7" fill="#1C2128"/>
      <rect x="280" y="${y - 16}" width="${width}" height="14" rx="7" fill="#3DDC97"/>
      <text x="580" y="${y}" fill="#E8EAED" font-size="18" font-family="ui-monospace, Consolas, monospace">${escapeXml(fmtTokens(harness.weight))}/msg</text>`;
  }).join('\n');
  const resent = result.totals.deadTokensResent == null ? '' : `<text x="80" y="540" fill="#FF5C5C" font-size="22" font-family="ui-sans-serif, system-ui, sans-serif">≈${escapeXml(fmtTokens(result.totals.deadTokensResent))} tokens of dead weight re-sent in the last ${result.windowDays} days</text>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0B0D10"/>
  <text x="80" y="80" fill="#E8EAED" font-size="20" letter-spacing="2" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif">MY AGENT STACK WEIGHS</text>
  <text x="80" y="190" fill="#E8EAED" font-size="88" font-family="ui-monospace, SF Mono, Consolas, monospace">≈${escapeXml(fmtTokens(result.totals.stackWeight))}</text>
  <text x="80" y="240" fill="#E8EAED" font-size="28" font-family="ui-sans-serif, system-ui, sans-serif">tokens</text>
  <text x="80" y="290" fill="#E8EAED" font-size="24" font-family="ui-sans-serif, system-ui, sans-serif">${escapeXml(sub)}</text>
  <rect x="80" y="320" width="1040" height="18" rx="9" fill="#3DDC97"/>
  <rect x="${80 + (1040 - deadWidth)}" y="320" width="${deadWidth}" height="18" rx="9" fill="#FF5C5C"/>
  ${rows}
  ${resent}
  <text x="80" y="590" fill="#E8EAED" font-size="20" font-family="ui-monospace, Consolas, monospace">npx stackweight</text>
  <text x="1120" y="590" text-anchor="end" fill="#E8EAED" font-size="18" font-family="ui-sans-serif, system-ui, sans-serif">local-only · ${escapeXml(fmtDate(result.generatedAt))}</text>
  <title>alive ${alive}</title>
</svg>`;
}

function pctDrop(before: number, after: number): number {
  if (before === 0) return 0;
  return Math.round(((before - after) / before) * 100);
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
