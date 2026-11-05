# Contributing

Unknown beats wrong. If a log format, path or config key is not in the plan, degrade to `"unknown"` and record a note. Do not invent a zero.

## Add a skill root

1. Add one row to `SKILL_ROOTS` in `src/discover/roots.ts`.
2. Add a fixture file under `tests/fixtures/minimal/home` and a contract row if the verdict changes.
3. Set the evidence level to `documented` with a docs URL, or `observed` with a redacted log line.

## Add an agent

1. Implement `HarnessAdapter`.
2. Add fixtures for inventory and for the usage traps (a system prompt that lists every skill must not count).
3. Add contract rows for the new items.

Do not add a runtime dependency. The allowed ones are `gpt-tokenizer` and `yaml`.
