export const STYLES = `
:root { color-scheme: dark; --bg:#0B0D10; --text:#E8EAED; --muted:#9aa0a6; --line:#2a3038; --dead:#FF5C5C; --alive:#3DDC97; --chip:#1c2128; }
@media (prefers-color-scheme: light) {
  :root { color-scheme: light; --bg:#f7f8f9; --text:#1a1c1e; --muted:#5f6368; --line:#dadce0; --chip:#fff; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.45 ui-sans-serif, system-ui, sans-serif; }
main { max-width: 1100px; margin: 0 auto; padding: 24px; }
button, input { font: inherit; color: inherit; background: var(--chip); border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; }
button:focus-visible, input:focus-visible, th:focus-visible { outline: 2px solid #8ab4f8; outline-offset: 2px; }
.card svg { width: 100%; height: auto; }
.row { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { cursor: pointer; }
.blur .item { filter: blur(6px); }
.pill { display: inline-block; border-radius: 999px; padding: 2px 8px; margin-right: 4px; background: var(--chip); }
.keep { color: var(--alive); } .archive, .merge { color: #e6b450; } .disable { color: var(--dead); }
.unknown { color: var(--muted); }
.bar { height: 8px; background: var(--line); border-radius: 99px; }
.bar > span { display: block; height: 8px; background: var(--alive); border-radius: 99px; }
footer { color: var(--muted); margin-top: 32px; }
`;
