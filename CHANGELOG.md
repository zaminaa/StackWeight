# Changelog

## 0.1.0

First release. Weighs Claude Code, Cursor, Codex and OpenCode, prints a receipt, writes a local HTML report, and parks unused items so `restore` can put them back.

### Demo fixture

On the bloated demo home, with the clock set to 2026-11-06, the receipt was: stack weight ≈ 5.7k tokens combined across 3 agents, dead weight ≈ 4.8k (85%), and ≈ 4.97M tokens of dead weight re-sent in 30 days. One prune took the stack from 5.7k to 1.5k.

### Real machine

Dogfooded on the maintainer's own Windows machine, with Claude Code, Cursor, Codex and OpenCode all installed: stack weight ≈ 9.6k tokens combined across 4 agents, dead weight ≈ 5.4k (57%), and ≈ 17.19M tokens of dead weight re-sent in 30 days. A full scan takes under 3 seconds. `prune` moved 10 items and disabled 8 Claude plugins; `restore` put every byte back and the tree hashed identical to before.

`docs/card.png` is rendered from that real scan (`npm run card`), not from the demo fixture.

### Fixed

- An unused item said "never seen in your logs" even though only the last 30 days of logs are ever read. It now says "no use recorded in that window", which is the only claim the data supports.
