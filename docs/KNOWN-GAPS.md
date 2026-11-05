# Known gaps

- MCP server weight is not measured. Measuring it would mean starting servers.
- Instruction files (`CLAUDE.md`, `AGENTS.md`, always-apply rules) are not weighed.
- Codex and OpenCode plugins are not inventoried.
- Claude plugin custom skill paths in `plugin.json` are ignored.
- Claude `local`-scope plugins are skipped.
- Cursor transcripts are dated by file modification time, which is an upper bound.
- Cursor and Claude listing caps are not modeled. If an agent truncates the listing, our weight overstates what was injected.
- The OpenCode listing template is assumed, not observed.
- Usage that happens only as a natural mention, without a tool call, is invisible.
- StackWeight's own audits can read `SKILL.md` files and count as use.
