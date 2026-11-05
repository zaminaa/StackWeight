# How StackWeight measures

Every absolute token number is an estimate. The report marks those numbers with ≈. Percentages and rankings are the part to trust, because every item is measured the same way.

## What is counted

For each agent that loads an item, StackWeight counts the tokens of the exact listing line that agent injects:

| Agent | Listing line | Evidence |
|---|---|---|
| Claude Code | `- name: description` | Observed in session logs |
| Cursor | an `<agent_skill>` tag with the full file path | Observed in agent context |
| Codex | `- name: description (file: path)` | Observed in rollout logs |
| OpenCode | `- name: description` | Assumed. No observed listing yet, and the report says so |

Tokens use the OpenAI o200k tokenizer, locally, via `gpt-tokenizer`. Claude, Gemini and other models tokenize differently. Your model's own tokenizer will give a somewhat different absolute number, more so for non-Latin scripts. Percentages and rankings barely move.

Not counted, and stated in the report: each agent's fixed skills preamble, MCP tool schemas, instruction files such as `CLAUDE.md` and `AGENTS.md`, and any truncation an agent applies to a long listing. If an agent truncates, our number overstates the token cost, and the overflow skills become invisible to the agent.

Combined stack weight is the sum across agents, always labelled as combined. Each agent only pays for its own skills. The per-agent bars are the per-message cost.

## Re-sent dead weight

For agents whose logs were read successfully, dead weight times the number of assistant responses in the last 30 days. The label is "tokens of dead weight re-sent in the last 30 days (before prompt-cache discounts)". Model requests are a lower bound.

## What counts as installed

Roots come from one table in `src/discover/roots.ts`, plus the Claude and Cursor plugin registries. Marketplace catalogs, old cached plugin versions, and `~/.codex/.tmp` are not counted. A directory shared by several agents is one item loaded by each of them. It weighs once per agent.

## What counts as used

A skill counts as used only when it shows up in a tool call: the Skill tool, a file read, a shell command, a subagent call, or a slash command. System prompts, prompt snapshots, and `<skills_instructions>` blocks list every skill and are ignored. If an agent's logs cannot be read, usage is **unknown**, never zero. Unknown items are kept. So is anything with less than 7 days of log history, anything installed in the last 14 days, anything built in, and anything that lives in a project folder.

## Codex calibration

The newest Codex session in the window contains the real listing. The report compares that listing's token count with StackWeight's reconstruction of the same names.

## Overlap

Descriptions are compared per agent with TF-IDF cosine similarity. Pairs at or above **0.5** are grouped, and pairs inside the same plugin are not. The threshold stayed at 0.5. Generic modifiers (write, note, design, list, and similar words) were added to the stopword list so the five intended clusters separate without lowering the threshold. The survivor is the item you actually use, then a built-in, then the most recently used, then the lighter one.

StackWeight never merges file contents. MERGE means "this overlaps with X; keep X and park this one".

## Health checks

Four patterns, reported as "pattern to review", never as malicious:

- SW001 instruction-override phrasing
- SW002 hidden Unicode (zero-width space, bidi controls, tag characters, and a BOM that is not at the start of the file). U+200C and U+200D are never flagged, because Persian, Arabic and Indic text need them
- SW003 reads of sensitive files such as SSH keys or cloud credentials
- SW004 downloads piped into a shell

A flag does not change a verdict by itself. It is appended to the reason of an unused item.
