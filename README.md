# The Wizard

A pantheon of seven specialist personas for Claude, inspired by
[oh-my-opencode-slim](https://github.com/alvinunreal/oh-my-opencode-slim) — but
**not a port**. oh-my-opencode-slim is wired directly into OpenCode's plugin
interfaces (its own agent-to-agent protocol, background job dispatcher, model
router). None of that has a Claude equivalent to plug into, so the Wizard
reimplements nothing it doesn't have to. It borrows the *concept* — seven
named specialists you can reach for by name — and builds each one on top of
whatever Claude already does well.

Every persona works out of the box with **zero configuration** — no
connector, no plugin, no company-specific setup. This repo ships with an
empty config: nothing here assumes any particular company's tools. A
company adopting this framework layers its own real tools on top of the
generic defaults via config, never baking them into the shipped files —
see "Generic by default, company-specific by config" below.

## Design principle: separation of concerns

Every persona in `agents/` is a **thin pointer**, not a reimplementation.

- If Claude already has a tool, skill, plugin, or agent type that does
  the job, the persona's file says so explicitly and routes to it.
- Only the personas with no existing equivalent get real logic of their own
  — currently just `Orchestrator`, not yet built. `Council` looked like it
  would need this too, but turned out to be fully expressible as
  instructions over Claude Code's own `Task` tool (see `docs/PANTHEON.md`).
- `docs/PANTHEON.md` is the single source of truth for which persona maps to
  which underlying capability, and its current build status. Keep it in sync
  whenever a persona's backing implementation changes.

This matters because the underlying tools (Explore, WebSearch, general-purpose
reasoning, and whatever a company layers on top via `overrides`) get updated
independently of the Wizard. A persona that reimplements its own version of
"explore the codebase" or "critique this design" will drift from the real
thing. A persona that just points at it never can.

## Generic by default, company-specific by config

Every persona in `agents/` ships with a default that works for anyone —
no connector, no plugin, nothing to install. Oracle reasons and searches
the public web; Librarian searches local files and the web; Designer
critiques directly from Claude's own multimodal reasoning; Fixer executes
fixes and writes postmortems with Claude's own tools. None of that is
hypothetical — it's what those files actually say today.

A company's own existing tools layer on *top* of that default, they never
replace it, through five mechanisms (in order of how decoupled from this
repo they are):

1. **Drop a file** in `agents/custom/` for a brand-new persona — no config.
2. **Edit `wizard.config.jsonc`** — this repo's own config, for whoever
   maintains this repo/fork. Ships empty; see the commented-out shape for
   each field directly in the file.
3. **A personal config outside this repo** — `~/.claude/the-wizard/wizard.config.jsonc`
   — for anyone who just installed the plugin and wants to customize it
   without forking or editing a single shipped file. Same shape as #2,
   merged on top of it.
4. **Connect a persona to a company's own MCP-exposed agent** — for when
   the "existing tool" is someone else's agent running behind its own MCP
   server rather than a Claude tool/skill/plugin. This one behaves
   differently from the other three: Claude Code's plugin subagents can't
   hold `mcpServers` frontmatter at all, so the sync script materializes a
   separate copy of that persona into Claude Code's own `~/.claude/agents/`
   instead of the plugin itself.
5. **A free-form append file per persona** — `~/.claude/the-wizard/agents/<name>__append.md`
   gets appended to that persona's file verbatim, no JSON structure
   required. For when `overrides`'s fixed `pointsTo`/`notes` shape is too
   rigid for what you want to add.

See `docs/CUSTOMIZING.md` for the full mechanics of all five.

## House convention: Simplified Technical English

Every persona ships with a `defaultSkills` block (see `docs/CUSTOMIZING.md`)
pointing at two bundled skills — `skills/ste-technical-writing/` and
`skills/ste-requirements/` — based on ASD-STE100. Scope: agent-to-agent
messages, tool/function descriptions, error messages, and instructions one
persona sends to another. Out of scope: a deliverable meant for a human
reader — Designer's UX copy, Council's final recommendation, Oracle's
explanation — where voice and nuance still matter.

## The pantheon

| Persona | Generic default |
|---|---|
| Orchestrator | ✅ built — `Task` + namespaced `subagent_type` dispatch, routed a real task to two personas |
| Explorer | ✅ built — `Explore` agent |
| Oracle | ✅ built — local docs + WebSearch + high-effort reasoning |
| Council | ✅ built — `Task`-tool fan-out across question-relevant lenses, then synthesis |
| Librarian | ✅ built — Read/Grep/Glob + WebSearch |
| Designer | ✅ built — native critique/handoff/accessibility/copy |
| Fixer | ✅ built — direct fix execution + generic postmortem writeup |

Every persona works with this default alone — no connector, no plugin, no
company account needed. A company adopting this framework layers its own
real tools on top via `overrides`/`customAgents` in `wizard.config.jsonc`
(or a personal config that never touches this repo), generated onto the
shipped files by `scripts/sync-config.js`, never hand-edited into the base
persona files. See `docs/PANTHEON.md` for the full mapping and rationale,
and `docs/CUSTOMIZING.md` for exactly how to add your own.

## The Wizard is a plugin, not an MCP server

Personas are just subagent files — Claude Code's native discovery picks up
everything under `agents/` once this plugin is installed, with no extra
setup and nothing else running. The Wizard doesn't expose itself as an MCP
server, and doesn't try to be one: adding a server here would mean
shipping and running infrastructure to solve a problem nobody has, since
every caller is already Claude Code or Cowork.

What The Wizard *does* do with MCP is the opposite direction: connect a
persona *to* an MCP server a company already runs, exposing an agent that
matches one of the seven profiles (or a custom one). See "4. Connecting to
a company's own MCP-exposed agent" in `docs/CUSTOMIZING.md`.

## Layout

```
the-wizard/
├── .claude-plugin/
│   └── plugin.json      # plugin manifest
├── agents/               # one persona per file, each a thin pointer
│   ├── orchestrator.md
│   ├── explorer.md
│   ├── oracle.md
│   ├── council.md
│   ├── librarian.md
│   ├── designer.md
│   ├── fixer.md
│   └── custom/           # empty by default — customAgents entries generate here
├── skills/               # bundled skills every persona is pointed at
│   ├── ste-technical-writing/SKILL.md
│   ├── ste-requirements/SKILL.md
│   └── postmortem-writing/SKILL.md
├── wizard.config.jsonc   # this repo's own overrides/customAgents/defaultSkills
├── scripts/
│   └── sync-config.js    # also reads ~/.claude/the-wizard/, if present
└── docs/
    ├── PANTHEON.md       # source of truth: persona ↔ tool mapping + status
    └── CUSTOMIZING.md    # the five extension mechanisms
```

## Status

All seven pantheon personas are built and working, with zero
configuration required for anyone. A company adopting this framework can
layer its own `overrides`/`customAgents` on top — see
`docs/CUSTOMIZING.md`. Every persona is reachable through Claude Code's
own native subagent discovery once this plugin is installed — no server,
no separate process. Orchestrator's mechanism — `Task` with a namespaced
`subagent_type` — needs this plugin actually installed on whichever
machine is running it, since it dispatches to its own sibling personas; a
persona Orchestrator routes to may need
`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` raised in that session's own
`settings.json` to keep its own `Task` access — see
`agents/orchestrator.md`.
