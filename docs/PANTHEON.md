# The Pantheon — persona ↔ tool mapping

This is the source of truth. When a persona's backing implementation changes,
update this table and the corresponding file in `agents/`.

All seven agents run standalone, with **zero connection to any company's
tools** — no connector, no plugin, no external skill, nothing to
authenticate. The table below describes exactly that generic default,
which is the only thing this repo ships. Expanding a persona's
capabilities beyond that default is always additive, layered on top
afterward, never baked into the shipped file, via one of: `overrides`/
`customAgents` in `wizard.config.jsonc` (this repo's own config, or a
personal config at `~/.claude/the-wizard/wizard.config.jsonc` that never
touches this repo at all), a free-form append file at
`~/.claude/the-wizard/agents/<name>__append.md`, or a connection to a
company's already-existing agent — either one it already runs behind its
own MCP server (`mcpServers`, see `docs/CUSTOMIZING.md` section 4), or one
that's already a plain Claude Code subagent under `~/.claude/agents/`
(referenced directly by `subagent_type`, no extra mechanism needed). See
`docs/CUSTOMIZING.md` for exactly how, including worked examples.

| Persona | Role (from oh-my-opencode-slim) | Generic default | Status |
|---|---|---|---|
| **Orchestrator** | Plans work graphs, delegates specialized tasks as background jobs | Claude Code's own `Task` tool with `subagent_type` dispatch to this plugin's own `agents/*.md` personas — decompose a task, call `Task` per persona using the namespaced form (`wizard:explorer`, `wizard:custom:<name>`, ...), parallel where independent, sequential where one needs another's output, then assemble the results | ✅ Built and tested end to end — routed a real ambiguous task to two personas correctly. See "Test record" in `agents/orchestrator.md`. |
| **Explorer** | Scouts codebases, maps file structure | The built-in `Explore` subagent type — read-only, broad fan-out search | ✅ Exists as-is. No new code needed; `agents/explorer.md` is a pure alias. |
| **Oracle** | Architecture decisions, hard debugging | Local docs (`Read`/`Grep`/`Glob`) + `WebSearch`/`WebFetch` for public documentation, plus a `general-purpose` agent at `high`/`xhigh` reasoning effort for genuinely hard questions | ✅ Built — works with zero configuration. |
| **Council** | Synthesizes multiple model perspectives on complex questions | Claude Code's own `Task` tool: 3–5 question-relevant lenses launched as independent subagents in one turn, then synthesized (never averaged) into a recommendation that still surfaces real dissent | ✅ Built and tested end to end (see `agents/council.md`). |
| **Librarian** | Retrieves external documentation and web knowledge | `Read`/`Grep`/`Glob` for local docs, `WebSearch`/`WebFetch` for public documentation | ✅ Built — works with zero configuration. |
| **Designer** | UI/UX implementation | Direct critique/handoff/accessibility/UX-copy/research-synthesis via Claude's native reasoning and multimodal capability | ✅ Built — works with zero configuration. |
| **Fixer** | Executes scoped, well-defined coding tasks | Direct scoped fixes (`Read`/`Grep`/`Glob`/`Bash`/`Edit`) and the bundled, language/currency-agnostic `postmortem-writing` skill | ✅ Built — works with zero configuration, no company connection of any kind. Executes already-diagnosed work only; review is Council's or Oracle's job, not Fixer's. |

Anything beyond these seven — a company-specific persona with no generic
equivalent — is a `customAgents` entry, generated at `agents/custom/<name>.md`.
None ship in this repo by default; see `docs/CUSTOMIZING.md` for the shape
and a worked example.

## Notes

- **Model routing → reasoning effort.** oh-my-opencode-slim routes tasks
  across different model providers by cost/quality. Claude doesn't have that
  axis in the same way — the equivalent lever here is reasoning effort
  (`low`/`medium`/`high`/`xhigh`/`max`) and choice of subagent type, not
  swapping vendors. Oracle and Council both lean on this instead of model
  routing.
- **No Observer yet.** oh-my-opencode-slim has an optional Observer for
  visual analysis when the main model isn't multimodal. Claude is
  multimodal natively, so there's no gap to fill here — omitted on purpose,
  not an oversight.
- **Council and Orchestrator are both built.** Neither needed a bespoke
  Workflow script — `Task`-tool fan-out (Council) and `Task`-tool
  `subagent_type` dispatch (Orchestrator) both do the job and both work
  over MCP, since `Task` is a standard tool reachable from a headless
  `claude -p` process the way a Workflow-tool script never would be.
- **Plugin `subagent_type` values are namespaced — confirmed by test.**
  Installed `wizard` from a local marketplace (with a temporary example
  `customAgents` entry added for the test) and ran a subagent_type probe
  with no project-local `.claude/agents/` present. A bare `"explorer"`
  failed with "Agent type not found"; the actual available values were
  `wizard:explorer`, `wizard:oracle`, `wizard:council`, `wizard:librarian`,
  `wizard:designer`, `wizard:fixer`, `wizard:orchestrator`, and
  `wizard:custom:<name>` — `<plugin-name>:` for the pantheon,
  `<plugin-name>:custom:` for anything under `agents/custom/`.
  `agents/orchestrator.md` was written assuming bare names before this
  test; it's corrected now.
- **Root-caused and fixed: nested `Task` calls lost `Task` access below
  the subagent depth limit — checked whether this is Council-specific or
  general, it's general.** Claude Code withholds `Agent`/`Task` from any
  subagent at `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` layers below the main
  session, regardless of that subagent's own `tools:` declaration. Audited
  every persona's frontmatter directly: only **Council** and
  **Orchestrator** declare `Task` at all, so the only chain at risk today
  is Orchestrator → Council → Council's own lenses (two layers). Dispatch
  to the rest of the pantheon is unaffected at any depth — they never call
  `Task`, so there's nothing to withhold that they'd have used. Testing
  had the depth variable at `1`, so Council hit the limit; re-running at
  `3` restored full five-lens fan-out, confirming the mechanism precisely.
  **There is no fix this repo can apply on its own** — every persona here
  runs inside whatever live Claude Code/Cowork session discovers this
  plugin, and that session's own environment is the only place
  `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` can be raised; see the
  `settings.json` snippet in `agents/orchestrator.md`. See
  `agents/council.md` and `agents/orchestrator.md`'s "Test record" for the
  full writeup.
- **Orchestrator ports oh-my-opencode-slim's routing threshold, not its
  background dispatch.** Checked the actual source (`src/agents/orchestrator.ts`):
  it calls a `task(..., background: true)` primitive with a resumable
  `task_id` — dispatch now, reconcile later. Claude's `Task` tool has no
  equivalent; it only does true parallel fan-out within one message, the
  pattern Council already validated. The "handle directly only for one
  isolated, low-risk action, otherwise delegate" rule ported cleanly
  though, and is now in `agents/orchestrator.md`. Also: no OpenSpec-style
  command pipeline was adopted (see `docs/CUSTOMIZING.md`'s "Future work"
  note on `grilling` instead).
- **Historical note, now fully resolved: every shipped persona's default
  used to assume a particular company's tools, not layered via config.**
  (Past tense throughout this bullet — none of this describes current
  behavior.) Oracle and Librarian's defaults used to be blocked on
  connectors that don't exist for a day-one adopter, and Fixer's only
  postmortem path used to assume one specific company's language and
  currency — none of that was a usable generic default. Rewrote all five
  affected bodies to a real, working, zero-config default with **zero
  company connection of any kind**, and moved every company-specific piece
  out of the shipped files entirely — a company's own additions now live
  only in `overrides`/`customAgents`/an append file (or a personal config),
  never baked into a
  shipped persona body. See `docs/CUSTOMIZING.md`.
- **User-level config layer added.** `wizard.config.jsonc` is *this
  repo's own* config — fine for whoever maintains this repo/fork to edit,
  but anyone who only installs the plugin would have to edit a shipped
  file to customize it, which is exactly what the override mechanism was
  supposed to avoid. `scripts/sync-config.js` now also reads
  `~/.claude/the-wizard/wizard.config.jsonc` if present and merges it on
  top (name collisions go to the personal config). See
  `docs/CUSTOMIZING.md`.
- **The Wizard is not an MCP server — it connects to ones that already
  exist.** An earlier iteration built `mcp/server.js`, an outbound server
  exposing Wizard's own personas as MCP tools for a non-Claude client to
  call. Removed entirely — nothing needs that, since every caller is
  Claude Code/Cowork itself, and shipping a server contradicted the
  framework's own identity as a plugin, not infrastructure. The direction
  with real leverage, and the only MCP mechanism that ships now, is
  inbound: a persona connecting *to* a company's own already-running
  MCP-exposed agent (matching one of the seven profiles, or a custom one).
  `overrides`/`customAgents` entries can declare `mcpServers`, and
  `scripts/sync-config.js` materializes a bare-named copy of that persona
  (`wizard-<name>`, not `wizard:<name>`) into Claude Code's own
  `~/.claude/agents/`, because Claude Code's plugin subagents silently
  ignore `mcpServers`/`hooks`/`permissionMode` frontmatter — confirmed via
  its own docs, not assumed. Tested end to end: a dry-run override with a
  fake `mcpServers` entry produced valid, Claude-Code-shaped YAML
  frontmatter (checked with a real YAML parser), was idempotent across
  re-runs, and the sync script correctly refused to clobber a
  hand-written file occupying the same materialized path. See
  `docs/CUSTOMIZING.md`'s "4. Connecting to a company's own MCP-exposed
  agent".
- **Fixer's postmortem instructions moved out of its own body into a
  bundled skill.** They were generic (no assumed language/currency) but
  still inline prose baked directly into `agents/fixer.md` — a
  contradiction of this framework's own "thin pointer, not a
  reimplementation" principle (see README). Extracted to
  `skills/postmortem-writing/SKILL.md`; Fixer's body now just points to
  it, the same way every other persona points at its underlying
  capability instead of reimplementing it inline.
- **A fifth customization mechanism: a free-form append file per
  persona.** `overrides` forces a fixed shape (`pointsTo`/`notes`) — fine
  for a short pointer, awkward for a company that wants to write several
  paragraphs, a code block, or a multi-section addition. Dropping
  `~/.claude/the-wizard/agents/<name>__append.md` appends that file's raw
  Markdown to `agents/<name>.md` (or `agents/custom/<name>.md`) verbatim,
  no structure required. Tested end to end: content applied, marker
  block idempotent across re-runs. See `docs/CUSTOMIZING.md`, "5. A
  free-form append file per persona".
