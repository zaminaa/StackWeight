# Blockers

## T23

T23 was not dropped. Its three files (`src/apply/manifest.ts`, `src/apply/claude-config.ts`, `src/apply/prune.ts`) landed inside commit `f8a9557` ("T24: restore and round trip") instead of their own commit. The prune acceptance test was added later in `1202a40`. The one-task-one-commit rule was broken. History was not rewritten, because those commits are already on `origin/main`.

## T31

The test script quoted `tests/e2e/**` so a POSIX shell cannot expand the glob and skip the real tests. CI now builds before `npm test`. The workflow is on GitHub; confirm the six jobs at https://github.com/zaminaa/StackWeight/actions.

## T32

Dogfood ran on the real machine: Claude Code, Cursor, Codex and OpenCode are all installed here. A scan takes 2.6 s and reports stack weight ≈ 9.6k tokens across 4 agents, dead weight ≈ 5.4k (57%), and ≈ 17.19M tokens of dead weight re-sent in 30 days. `docs/card.png` is now rendered from that scan (`npm run card`), not from the demo fixture.

The prune/restore round trip was verified on the real machine. `prune --yes` moved 10 items and disabled 8 Claude plugins; `restore` put every one of them back and the tree hashed byte-identical to before, including `~/.claude/settings.json`. The 5 Cursor plugins are only ever printed as instructions; StackWeight never touches Cursor's own config.

Two findings came out of reading every reason on that machine:

- The ARCHIVE reason said "never seen in your logs". Only the last 30 days of logs are ever read, so that claim was never checked, and on this machine it was false: `webfarsi` was used 40 days before the scan. The reason now says "no use recorded in that window", which is the only claim the data supports. A unit test locks the wording.
- Codex calibration could not run here. The newest Codex rollout on this machine is from 2026-06-01, outside the window, so there is no observed listing to compare against and `sources` reports "listing: none" instead of inventing a Δ.

## Demo GIF

`demo/stackweight.gif` is still a 1×1 placeholder. VHS is not installed on this machine, so `demo/demo.tape` has not been recorded.
