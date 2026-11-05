export const CLIENT = `
const data = JSON.parse(document.getElementById('sw-data').textContent);
const share = document.getElementById('sw-share').textContent;
const groups = new Map(data.overlapGroups.flatMap((group) => group.itemIds.map((id) => [id, group])));
let rows = data.items.slice();
let sortKey = 'weightTotal';
let sortDir = -1;
let query = '';
let verdict = '';
let agent = '';
const body = document.querySelector('#items tbody');
function text(el, value) { el.textContent = value == null ? '' : String(value); return el; }
function pill(label, cls) { const s = document.createElement('span'); s.className = 'pill ' + (cls || ''); text(s, label); return s; }
function draw() {
  body.replaceChildren();
  const filtered = rows.filter((item) => {
    if (verdict && item.verdict !== verdict) return false;
    if (agent && !item.loadedBy.includes(agent)) return false;
    if (query && !item.qualifiedName.toLowerCase().includes(query) && !item.description.toLowerCase().includes(query)) return false;
    return true;
  });
  for (const item of filtered) {
    const tr = document.createElement('tr');
    const name = document.createElement('td');
    name.className = 'item';
    text(name, item.qualifiedName);
    name.append(' ', pill(item.kind), ...item.loadedBy.map((id) => pill(id)), pill(item.scope));
    const weight = document.createElement('td');
    text(weight, String(item.weightTotal));
    const bar = document.createElement('div'); bar.className = 'bar';
    const span = document.createElement('span');
    span.style.width = Math.min(100, item.weightTotal) + 'px';
    bar.append(span); weight.append(bar);
    const usage = document.createElement('td');
    if (item.usage.status !== 'known') {
      const u = pill('unknown', 'unknown');
      u.title = item.usage.reason || '';
      usage.append(u);
    } else text(usage, item.usage.count + '×' + (item.usage.lastUsed ? ' · last ' + item.usage.lastUsed.slice(0, 10) : ''));
    const overlap = document.createElement('td');
    const group = groups.get(item.id);
    if (group) {
      const survivor = data.items.find((entry) => entry.id === group.survivorId);
      text(overlap, (item.id === group.survivorId ? '★ ' : 'competes with ') + (survivor ? survivor.qualifiedName : ''));
    }
    const health = document.createElement('td');
    for (const flag of item.flags) {
      const button = document.createElement('button');
      button.type = 'button';
      text(button, flag.rule);
      button.addEventListener('click', () => {
        const next = tr.nextElementSibling;
        if (next && next.classList.contains('snippet')) { next.remove(); return; }
        const extra = document.createElement('tr'); extra.className = 'snippet';
        const cell = document.createElement('td'); cell.colSpan = 6;
        text(cell, flag.file + ':' + flag.line + ' ' + flag.snippet);
        extra.append(cell); tr.after(extra);
      });
      health.append(button);
    }
    const verdictCell = document.createElement('td');
    verdictCell.append(pill(item.verdict, item.verdict.toLowerCase()));
    const reason = document.createElement('div'); text(reason, item.reason); verdictCell.append(reason);
    tr.append(name, weight, usage, overlap, health, verdictCell);
    body.append(tr);
  }
}
document.querySelectorAll('#items th').forEach((th) => th.addEventListener('click', () => {
  const key = th.dataset.key;
  sortDir = sortKey === key ? -sortDir : -1;
  sortKey = key;
  rows.sort((a, b) => {
    const av = key === 'qualifiedName' ? a.qualifiedName : a.weightTotal;
    const bv = key === 'qualifiedName' ? b.qualifiedName : b.weightTotal;
    return av < bv ? -sortDir : av > bv ? sortDir : 0;
  });
  draw();
}));
document.getElementById('q').addEventListener('input', (event) => { query = event.target.value.toLowerCase(); draw(); });
document.getElementById('hide').addEventListener('change', (event) => document.body.classList.toggle('blur', event.target.checked));
for (const id of ['KEEP','ARCHIVE','MERGE','DISABLE']) {
  const button = document.createElement('button'); button.type = 'button'; text(button, id);
  button.addEventListener('click', () => { verdict = verdict === id ? '' : id; draw(); });
  document.getElementById('verdicts').append(button);
}
for (const harness of data.harnesses) {
  const button = document.createElement('button'); button.type = 'button'; text(button, harness.label);
  button.addEventListener('click', () => { agent = agent === harness.harness ? '' : harness.harness; draw(); });
  document.getElementById('agents').append(button);
}
document.getElementById('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(share); }
  catch { const box = document.getElementById('share-box'); box.hidden = false; box.select(); }
});
document.getElementById('png').addEventListener('click', () => {
  const svg = document.querySelector('#card svg');
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 630;
    canvas.getContext('2d').drawImage(image, 0, 0, 1200, 630);
    canvas.toBlob((png) => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(png); a.download = 'stackweight-card.png'; a.click();
    });
  };
  image.src = url;
});
const strip = document.getElementById('strip');
for (const harness of data.harnesses) {
  const p = document.createElement('p');
  text(p, harness.label + ' · ' + harness.weight + ' tokens · dead ' + harness.deadWeight + ' · usage ' + harness.usage.status + (harness.usage.reason ? ' (' + harness.usage.reason + ')' : ''));
  strip.append(p);
}
const groupsEl = document.getElementById('groups');
for (const group of data.overlapGroups) {
  const p = document.createElement('p');
  const names = group.itemIds.map((id) => data.items.find((item) => item.id === id)?.qualifiedName || id);
  text(p, group.id + ' ' + group.harness + ': ' + names.join(', '));
  groupsEl.append(p);
}
draw();
`;
