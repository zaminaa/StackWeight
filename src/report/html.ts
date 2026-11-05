import type { ScanResult } from '../model.js';
import { renderCardSvg } from './card.js';
import { CLIENT } from './client.js';
import { shareText } from './share.js';
import { STYLES } from './styles.js';

export function renderHtml(result: ScanResult): string {
  const data = JSON.stringify(result).replace(/</g, '\\u003c');
  const share = shareText(result).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob:">
<title>StackWeight</title>
<style>${STYLES}</style>
</head>
<body>
<main>
  <section class="card" id="card">${renderCardSvg(result)}
    <div class="row"><button type="button" id="png">Download PNG</button><button type="button" id="copy">Copy share text</button></div>
    <textarea id="share-box" hidden></textarea>
  </section>
  <section id="strip"><h2>Agents</h2></section>
  <section>
    <div class="row"><input id="q" type="search" placeholder="Search" aria-label="Search items"><label><input id="hide" type="checkbox"> Hide names</label></div>
    <div class="row" id="verdicts"></div>
    <div class="row" id="agents"></div>
    <table id="items">
      <thead><tr>
        <th data-key="qualifiedName">Item</th><th data-key="weightTotal">Weight</th><th>Usage</th><th>Overlap</th><th>Health</th><th>Verdict</th>
      </tr></thead>
      <tbody></tbody>
    </table>
  </section>
  <section><h2>Overlap groups</h2><div id="groups"></div></section>
  <section>
    <h2>How this was measured</h2>
    <p>Tokens are counted locally with the o200k tokenizer over the exact listing text each agent injects. Absolute numbers are estimates; percentages and rankings are stable. Usage comes only from tool calls, never from system prompts. ≈ means estimate. Dead weight re-sent is before prompt-cache discounts, and model requests are a lower bound.</p>
  </section>
  <section>
    <h2>Next steps</h2>
    <p>npx stackweight prune</p>
    <p>npx stackweight restore</p>
  </section>
  <footer>Generated locally by StackWeight ${result.tool.version} on ${result.generatedAt.slice(0, 10)}. No data left this machine.</footer>
</main>
<script type="application/json" id="sw-data">${data}</script>
<script type="application/json" id="sw-share">${share}</script>
<script>${CLIENT}</script>
</body>
</html>`;
}
