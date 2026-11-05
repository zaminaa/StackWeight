# Blockers

## T23

T23 was not dropped. Its three files (`src/apply/manifest.ts`, `src/apply/claude-config.ts`, `src/apply/prune.ts`) landed inside commit `f8a9557` ("T24: restore and round trip") instead of their own commit. The prune acceptance test was added later in `1202a40`. The one-task-one-commit rule was broken. History was not rewritten, because those commits are already on `origin/main`.

## T31

The test script quoted `tests/e2e/**` so a POSIX shell cannot expand the glob and skip the real tests. CI now builds before `npm test`. The workflow is on GitHub; confirm the six jobs at https://github.com/zaminaa/StackWeight/actions.

## T32

Dogfood on the real machine is still for the owner, about 20 minutes. Every number published in this repo, including `docs/card.png`, comes from the demo fixture. There is no real receipt yet.

## Demo GIF

`demo/stackweight.gif` is still a 1×1 placeholder. VHS is not installed on this machine, so `demo/demo.tape` has not been recorded.
