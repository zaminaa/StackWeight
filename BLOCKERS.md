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

A recording attempt on 2026-11-15 got as far as validating the tape and then hung. Notes for the next attempt:

- Prebuilt binaries were downloaded to `%TEMP%\vhs-tools` and SHA256-verified: `vhs_0.12.1_Windows_x86_64\vhs.exe` and `ttyd.exe` (ttyd 1.7.7). ffmpeg is already on PATH via WinGet.
- Run with Git Bash first on PATH, because `bash` resolves to WSL's `C:\WINDOWS\system32\bash.exe` otherwise: `PATH="C:\Program Files\Git\bin;%TEMP%\vhs-tools\vhs_0.12.1_Windows_x86_64;%TEMP%\vhs-tools;%PATH%"`.
- vhs 0.12.1 hung after echoing the tape directives: no ttyd child process and no headless browser were ever spawned, so it died during browser setup (go-rod). It ran for ten minutes without another line of output. Alternative: record inside WSL Ubuntu (installed here) or drive ttyd + a screencast recorder directly.

## npm publish

The registry auto-staged the first publish from a brand-new account: `npm view` returned a `0.0.0-stage` placeholder and `npm stage list` reported empty even while the placeholder existed. Once the staged version was approved on npmjs.com (Staged Packages tab, behind 2FA), the same tarball went live as `0.1.0` unchanged — no republish needed. A granular access token with the "bypass 2FA for API and CI" scope can publish, but it does not replace the interactive 2FA prompt for approving a staged package.
