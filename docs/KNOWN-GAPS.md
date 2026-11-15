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
- Only the last 30 days of logs are read. If an item was last used before the window, StackWeight reports no use in the window and does not claim when it was last used.
- StackWeight's own audits can read `SKILL.md` files and count as use.
