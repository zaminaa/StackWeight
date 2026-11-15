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

`demo/stackweight.gif` is a real 1200×720 recording of the bloated fixture with the clock at 2026-11-06, embedded from the README. The receipt in the GIF matches the changelog: stack weight ≈ 5.7k across 3 agents, dead weight ≈ 4.8k (85%), ≈ 4.97M tokens re-sent in 30 days, and one prune from 5.7k to 1.5k.

vhs 0.12.1 still hangs on this Windows machine during browser setup (go-rod): Chrome starts, and ttyd never does. The same fixture under WSL does not match those numbers, because Cursor and Codex listings include absolute paths. This GIF was captured from ttyd 1.7.7 serving Git Bash, screenshotted at 1200×720.

## npm publish

The registry auto-staged the first publish from a brand-new account: `npm view` returned a `0.0.0-stage` placeholder and `npm stage list` reported empty even while the placeholder existed. Once the staged version was approved on npmjs.com (Staged Packages tab, behind 2FA), the same tarball went live as `0.1.0` unchanged — no republish needed. A granular access token with the "bypass 2FA for API and CI" scope can publish, but it does not replace the interactive 2FA prompt for approving a staged package.
