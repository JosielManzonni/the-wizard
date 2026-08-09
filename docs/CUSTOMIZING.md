# Customizing The Wizard

Every persona in `agents/` ships with a default that works for anyone —
no connector, no plugin, no company-specific setup. The framework isn't
built around any one company's tools; a company's own tools are layered
*on top* of it instead. Five ways to customize, from
least to most decoupled from this repo, and they all compose (the fourth
and fifth are special cases — see their own sections below for why).

## 1. Drop a file (fastest, for a brand-new persona)

Claude Code auto-discovers every `.md` file under `agents/`. To add a new
persona, write one following the shape of any file in `agents/` and drop it
in `agents/custom/`. That's it — no config, no build step. This is the
right choice for a one-off, or while you're still iterating on a persona's
prompt.

## 2. Declare it in `wizard.config.jsonc` (for anything you want tracked)

`wizard.config.jsonc` is *this repo's own* declarative source of truth for
three kinds of customization — the right place for whoever maintains this
repo/fork to declare their own real additions. It ships empty — see the
commented-out shape for each field directly in the file:

- **`overrides`** — point one of the shipped seven at your own tool, **in
  addition to its generic default, not instead of it.** The default keeps
  working with zero configuration for anyone who doesn't have that tool;
  the override is what one specific company layers on top.
- **`customAgents`** — define a brand-new persona with no generic
  equivalent at all, generated for you.
- **`defaultSkills`** — a shared block applied to *every* persona file, not
  just one. Ships pointing at the bundled `ste-technical-writing` and
  `ste-requirements` skills — see "House convention" below.

After editing the config, run:

```bash
node scripts/sync-config.js
```

## 3. A personal config outside this repo (for anyone who just installed the plugin)

Editing `wizard.config.jsonc` means editing a file inside this repo —
fine if you maintain it, but if you only installed The Wizard as a
plugin, that's still "editing a shipped file," which defeats the point.
`scripts/sync-config.js` also reads, if it exists:

```
~/.claude/the-wizard/wizard.config.jsonc
```

Same exact shape as `wizard.config.jsonc` — `overrides`, `customAgents`,
`defaultSkills` — and it's optional; nothing warns or fails if it's
absent. It gets merged on top of this repo's own config: if you declare
an override or custom agent with the same name as one already in
`wizard.config.jsonc`, yours wins; anything you don't touch keeps working
exactly as shipped. This file is never committed to this repo and never
touched by a plugin update, so it's the right place for your own
company's — or even just your own personal — customizations, independent
of whatever this repo ships.

### Why this is additive, not destructive

An override doesn't touch the rest of a shipped persona's file — it appends
a block wrapped in `<!-- WIZARD:OVERRIDE:START -->` / `<!-- WIZARD:OVERRIDE:END -->`
markers. Re-running the sync script finds those markers and replaces only
what's between them, so:

- editing `wizard.config.jsonc` and re-syncing updates the override cleanly
- deleting the config entry and re-syncing... currently leaves the block in
  place (the script only adds/updates, it doesn't prune) — remove the
  marked block by hand if you want a persona back to pure-default, or
  delete the whole file and re-pull it from upstream
- everything else in that persona's file — the generic default that works
  for anyone — is untouched

`customAgents` entries are fully generated files under `agents/custom/`,
since there's no shipped default to preserve for a persona that didn't
exist before. Don't hand-edit a generated file — edit the config and
re-sync, or it'll be overwritten next time someone runs the script.

This is the same mechanism whether the entry lives in `wizard.config.jsonc`
or in a personal config at `~/.claude/the-wizard/wizard.config.jsonc` —
the sync script merges both before applying either kind of block.

### Example: pointing Fixer at your own tool

```jsonc
"overrides": {
  "fixer": {
    "pointsTo": "/my-org:lint-and-fix",
    "notes": "Our own lint-and-fix skill covers routine fixes faster than Fixer's generic default."
  }
}
```

Run `node scripts/sync-config.js`, and `agents/fixer.md` gets an appended
block documenting the addition — Fixer's own generic default (direct
scoped fixes, the bundled `postmortem-writing` skill) stays in the file
above it, still works on its own, and is what anyone without
`/my-org:lint-and-fix` falls back to.

### Example: adding a persona that isn't in the pantheon

```jsonc
"customAgents": [
  {
    "name": "sentinel",
    "description": "Security review — runs before anything touches production.",
    "pointsTo": "/my-org:security-scan",
    "notes": "Invoke before Fixer executes anything security-sensitive."
  }
]
```

Run the sync script and `agents/custom/sentinel.md` appears, ready to use
like any other persona.

## 4. Connecting to a company's own MCP-exposed agent

The first three mechanisms all point a persona at something reachable as a
Claude tool, skill, or plugin. Sometimes what a company already has isn't
any of those — it's an agent someone else built, running behind its own
MCP server. This mechanism lets a Wizard persona connect to that server
directly.

Add `mcpServers` (and, optionally, `mcpNotes`) to an `overrides` or
`customAgents` entry, in either `wizard.config.jsonc` or a personal config:

```jsonc
"overrides": {
  "oracle": {
    "pointsTo": "...",
    "notes": "...",
    "mcpServers": {
      "acme-support-bot": {
        "type": "stdio",
        "command": "acme-mcp-server",
        "args": ["--org", "your-org"],
        "env": { "ACME_API_KEY": "${ACME_API_KEY}" }
      }
    },
    "mcpNotes": "Acme's own support-ticket agent, exposed over MCP. Ask it about open tickets before searching generically."
  }
}
```

For a remote server instead of a local command, use `"type": "http"` (or
`"sse"`) with a `url` and optional `headers` instead of `command`/`args`.
This is the same shape Claude Code itself uses for inline `mcpServers`
frontmatter — see
[the Claude Code docs](https://code.claude.com/docs/en/sub-agents#scope-mcp-servers-to-a-subagent).

Run `node scripts/sync-config.js` and something different happens compared
to a plain override: **Claude Code's plugin subagents silently ignore the
`mcpServers`, `hooks`, and `permissionMode` frontmatter fields** — a
restriction Claude Code documents directly, not something this project
chose. Since every Wizard persona is plugin-loaded, an `mcpServers` entry
can never take effect on `agents/oracle.md` or `agents/custom/<name>.md`
themselves, no matter what the config says.

So the sync script does the only thing that actually works: it
**materializes** a full copy of that persona — its generic default, plus
whatever else the override adds — as a real file outside the plugin
entirely, at `~/.claude/agents/wizard-<name>.md`. That's Claude Code's own
global subagent directory, the same place any hand-written personal
subagent lives. The copy is bare-named (`wizard-oracle`, hyphen not colon
— Claude Code agent names can't contain `:`), reachable as subagent_type
`wizard-oracle`, separate from and in addition to the plugin's own
`wizard:oracle`, which keeps working exactly as before — no MCP, same as
always — for anyone without that company's server.

A few things worth knowing about this one mechanism, since it behaves
differently from the other three:

- **It writes outside this repo *and* outside `~/.claude/the-wizard/`.**
  Every other customization stays inside the plugin or a config file this
  script owns. This is the one exception, and it exists only because
  Claude Code leaves no other way to honor `mcpServers` frontmatter at
  all.
- **It won't overwrite a file it didn't create.** If
  `~/.claude/agents/wizard-<name>.md` already exists and doesn't carry
  this script's own marker comment, the sync script skips materializing
  that persona and warns instead of clobbering something hand-written.
- **`tools`, if the persona declares one, gets `mcp__<server>` appended
  automatically** for every server in `mcpServers` — otherwise an explicit
  tool allowlist would silently exclude the very MCP tools you just
  connected. Leave a persona's `tools` field unset in its own file and
  Claude Code inherits everything, MCP tools included, with no extra step.
- **It's a materialized snapshot, not a live pointer.** Re-run
  `node scripts/sync-config.js` after changing the config to regenerate
  it. Delete the file if you no longer want the connection.

## 5. A free-form append file per persona

An `overrides` entry forces a fixed shape: `pointsTo` plus an optional
`notes` string. That's fine for a short pointer, but awkward if what
you actually want to add is several paragraphs, a code block, a list, or
anything with real Markdown structure — cramming that into a single
`notes` string produces an ugly wall of text.

Drop a file at:

```
~/.claude/the-wizard/agents/<name>__append.md
```

— where `<name>` matches a persona under `agents/` or `agents/custom/`
(e.g. `fixer__append.md`, `oracle__append.md`) — and its raw content gets
appended to that persona's file verbatim, no JSON, no required shape.
Write it exactly like you'd write any other section of that persona's
file: headings, code blocks, multiple paragraphs, whatever the addition
actually needs.

Run `node scripts/sync-config.js` and the file's content appears in
`agents/<name>.md`, wrapped in its own marker block so a re-run updates
it cleanly rather than duplicating it — the same non-destructive
append/update contract as every other mechanism here. This reads
independently of `wizard.config.jsonc` entirely: it works whether or not
you have a personal config at all, and composes with one if you do
(an `overrides` entry and an append file for the same persona both apply,
one after the other).

### Example: Fixer's generic postmortem skill plus a company's own template

Fixer's shipped default points at a bundled, generic `postmortem-writing`
skill (structure only — no assumed language, currency, or house format).
A company with its own real postmortem template doesn't touch that
pointer or `agents/fixer.md` at all — it adds a `fixer__append.md`:

```markdown
## Our own postmortem template

For an incident that follows [Team]'s on-call rotation, use our own
postmortem template instead of the generic structure above: [link/skill
name]. It covers the same sections (summary, timeline, impact, root
cause, resolution, preventive measures) in our house format.
```

This is additive the same way an `overrides` entry is — Fixer's generic
`postmortem-writing` skill reference above it is untouched and still
works for anyone without this addition.

## House convention: `defaultSkills`

Unlike `overrides` (one persona) and `customAgents` (one new persona),
`defaultSkills` writes the same block to **every** persona file — the
pantheon and anything you add later. It exists so a house-wide
convention lives in one place instead of eight copy-pasted paragraphs.

The shipped default points every persona at two bundled skills based on
ASD-STE100 (Simplified Technical English):

```jsonc
"defaultSkills": [
  {
    "name": "ste-technical-writing",
    "usage": "tool/function descriptions, error messages, docs, and any other written artifact aimed at a machine or non-native reader"
  },
  {
    "name": "ste-requirements",
    "usage": "translating a task into requirements or instructions for another persona/subagent to execute"
  }
]
```

The scope is narrow on purpose: agent-to-agent messages, tool/function
descriptions, error messages, and instructions one persona sends to
another. It does not apply to a deliverable meant for a human reader —
Designer's UX copy, Council's final recommendation, Oracle's explanation
of a tradeoff — where voice and nuance still matter and flattened
technical English would make the output worse, not clearer. Each
persona's generated block states this boundary explicitly so it doesn't
get applied too broadly by mistake.

The two bundled skills live at `skills/ste-technical-writing/SKILL.md` and
`skills/ste-requirements/SKILL.md`. Replace `defaultSkills` with your own
list to make a different convention the house default — anything you put
there gets the same non-destructive append treatment as an override.

## Future work: a grilling-based skill, not a spec-driven pipeline

oh-my-opencode-slim was built on top of [OpenSpec](https://github.com/Fission-AI/openspec),
which drives development through a fixed command pipeline
(`/opsx:propose` → `/opsx:apply` → `/opsx:archive`) — a proposal has to
exist before anything gets built. The Wizard deliberately does not adopt
that pipeline. It doesn't fit the framework's own "thin pointer, stay
composable" principle — persona work shouldn't be gated behind a
mandatory proposal step.

What's planned instead is [`grilling`](https://github.com/mattpocock/skills/tree/main/skills/productivity) —
a reusable, model-invoked interview primitive ("a relentless interview to
sharpen a plan or design," aimed at the same misalignment problem OpenSpec
solves, without owning the whole process). Its own docs make the same
choice this project is making: small composable skills over a rigid
pipeline. When it's added, it should slot in the same way everything else
here does — as a bundled skill under `defaultSkills` or attached to a
specific persona (Council and Orchestrator are the likely candidates,
since both make judgment calls worth stress-testing before committing) —
not as a new mechanism.
