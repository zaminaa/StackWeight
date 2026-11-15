import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // The 5 s default killed I/O-bound tests (fixture generation, tree hashing,
    // prune/restore round trips) when the whole suite runs in parallel on a
    // loaded machine. The real perf gates are the explicit assertions inside
    // the perf tests, not this timeout.
    testTimeout: 30000,
  },
});
