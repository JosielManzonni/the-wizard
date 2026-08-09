#!/usr/bin/env node
/**
 * The Wizard config sync.
 *
 * Reads wizard.config.jsonc (this repo's own config) AND, if present, a
 * user-level config outside this repo entirely — see loadUserConfig()
 * below — merges the two (user wins on name collision), and:
 *   - appends/updates a marked override block in agents/<name>.md for each
 *     entry under "overrides" (the shipped file is never otherwise touched)
 *   - generates agents/custom/<name>.md for each entry under "customAgents"
 *   - appends/updates a marked "default skills" block on every persona file,
 *     from the "defaultSkills" list
 *   - appends/updates a marked block on agents/<name>.md for each raw
 *     ~/.claude/the-wizard/agents/<name>__append.md file found — a
 *     structure-free alternative to "overrides" for free-form prose
 *     (see applyPersonalAppends())
 *
 * Safe to re-run any number of times: each block type has its own markers,
 * and re-running replaces only what's between them — it never duplicates a
 * block or disturbs anything a human wrote above/below it.
 *
 * No dependencies. Usage: node scripts/sync-config.js
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "wizard.config.jsonc");
// Deliberately outside this repo. wizard.config.jsonc is this repo's own
// config — fine for whoever maintains this repo/fork to edit, but
// anyone who just installs The Wizard as a plugin (not a fork) would have
// to edit a shipped file to customize it, which contradicts the whole
// "without forking or editing shipped files" point of the override
// mechanism (see docs/CUSTOMIZING.md). This file is where that person's
// own overrides/customAgents/defaultSkills live instead — untouched by
// plugin updates, never committed to this repo, one per machine or
// wherever ~/.claude is shared.
const USER_CONFIG_PATH = path.join(os.homedir(), ".claude", "the-wizard", "wizard.config.jsonc");
// Free-form alternative to a JSON "overrides" entry: drop
// ~/.claude/the-wizard/agents/<name>__append.md and its raw Markdown
// content gets appended to agents/<name>.md (or agents/custom/<name>.md)
// verbatim — no "pointsTo"/"notes" structure required. For a company that
// wants full prose freedom (headings, code blocks, multiple paragraphs)
// rather than the fixed shape an "overrides" entry forces. See
// docs/CUSTOMIZING.md, "5. A free-form append file per persona".
const USER_APPENDS_DIR = path.join(os.homedir(), ".claude", "the-wizard", "agents");
const AGENTS_DIR = path.join(ROOT, "agents");
const CUSTOM_DIR = path.join(AGENTS_DIR, "custom");
// Claude Code's own global subagent directory — NOT inside this plugin.
// Only written to when an override/customAgent declares "mcpServers": see
// materializeMcpAgent() below for why this has to live here instead of in
// agents/ or agents/custom/.
const MATERIALIZED_AGENTS_DIR = path.join(os.homedir(), ".claude", "agents");

const OVERRIDE_START = "<!-- WIZARD:OVERRIDE:START -->";
const OVERRIDE_END = "<!-- WIZARD:OVERRIDE:END -->";
const DEFAULT_SKILLS_START = "<!-- WIZARD:DEFAULT-SKILLS:START -->";
const DEFAULT_SKILLS_END = "<!-- WIZARD:DEFAULT-SKILLS:END -->";
const MATERIALIZED_MARKER = "<!-- WIZARD:MATERIALIZED-MCP-AGENT";
const APPEND_START = "<!-- WIZARD:PERSONAL-APPEND:START -->";
const APPEND_END = "<!-- WIZARD:PERSONAL-APPEND:END -->";

function stripJsonComments(text) {
  // Strips only whole-line `//` comments (lines whose trimmed content
  // starts with //). Deliberately simple — no trailing inline comments,
  // no /* */ blocks — so it can't misparse a value that happens to
  // contain "//" (e.g. a URL). Keep config comments on their own line.
  return text
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`No config found at ${CONFIG_PATH}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(CONFIG_PATH, "utf8");
  return JSON.parse(stripJsonComments(raw));
}

// Optional and silent when absent — this is the whole point: someone who
// only installed the plugin shouldn't need this file to exist at all, and
// shouldn't see a warning for not having one.
function loadUserConfig() {
  if (!fs.existsSync(USER_CONFIG_PATH)) return {};
  const raw = fs.readFileSync(USER_CONFIG_PATH, "utf8");
  try {
    return JSON.parse(stripJsonComments(raw));
  } catch (err) {
    console.error(`Could not parse user config at ${USER_CONFIG_PATH}: ${err.message}`);
    process.exit(1);
  }
}

// User config wins on any name collision, in all three sections — it's the
// more specific, more personal layer. Different names in each section from
// both sources all survive; only a name present in both gets replaced
// rather than duplicated.
function mergeConfigs(shipped, user) {
  const overrides = { ...(shipped.overrides || {}), ...(user.overrides || {}) };

  const customAgents = dedupeByName(
    [...(shipped.customAgents || []), ...(user.customAgents || [])]
  );

  const defaultSkills = dedupeByName(
    [...(shipped.defaultSkills || []), ...(user.defaultSkills || [])],
    // defaultSkills entries may be plain strings instead of {name, usage}
    (skill) => (typeof skill === "string" ? skill : skill.name)
  );

  return { overrides, customAgents, defaultSkills };
}

// Later entries win. Used for both customAgents and defaultSkills, whose
// items are objects (or strings) identified by a `name`, unlike overrides
// which is already a name-keyed object and needs no de-duping.
function dedupeByName(items, getName = (item) => item.name) {
  const byName = new Map();
  for (const item of items) {
    byName.set(getName(item), item);
  }
  return [...byName.values()];
}

function listPersonaFiles() {
  const dirs = [AGENTS_DIR, CUSTOM_DIR];
  const files = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(path.join(dir, entry.name));
      }
    }
  }
  return files;
}

// Replaces the content between startMarker/endMarker with `block`, or
// appends `block` (with its own markers already inside it) if the markers
// aren't present yet. Used by both overrides and the default-skills block —
// same non-destructive append/update contract either way.
function upsertMarkedBlock(filePath, startMarker, endMarker, block) {
  const current = fs.readFileSync(filePath, "utf8");
  const startIdx = current.indexOf(startMarker);
  const endIdx = current.indexOf(endMarker);

  let next;
  if (startIdx !== -1 && endIdx !== -1) {
    next = current.slice(0, startIdx) + block + current.slice(endIdx + endMarker.length);
  } else {
    next = current.replace(/\n*$/, "\n") + "\n" + block + "\n";
  }
  if (next !== current) {
    fs.writeFileSync(filePath, next);
    return true;
  }
  return false;
}

// --- MCP materialization -----------------------------------------------
//
// Plugin-loaded subagents (everything in agents/ and agents/custom/)
// silently ignore the mcpServers, hooks, and permissionMode frontmatter
// fields — this is Claude Code's own restriction, not something this
// script can work around from inside the plugin. See:
//   https://code.claude.com/docs/en/sub-agents#choose-the-subagent-scope
// So when an override or customAgent entry declares "mcpServers" (a
// company's own already-running MCP-exposed agent), the *only* way for
// that connection to actually work is to materialize a full copy of the
// persona — generic default + its override content, all of it — as a
// real, bare-named (no "wizard:" prefix) file under Claude Code's own
// global agent directory, ~/.claude/agents/. That directory is outside
// this plugin and outside this repo entirely; it's the same directory any
// hand-written personal subagent lives in. This is a deliberate exception
// to "never write outside the plugin" — Claude Code leaves no other way
// to honor mcpServers frontmatter at all.
//
// The plugin's own agents/<name>.md is untouched beyond its usual
// override block — "wizard:<name>" keeps working exactly as before, MCP
// or no MCP, for anyone without that company's server. The materialized
// copy is reached as a *different*, additional subagent_type:
// "wizard-<name>" (hyphen, not colon — Claude Code agent names can't
// contain ":", that's reserved for plugin namespacing).

// Minimal frontmatter parser — deliberately simple. Every field this
// script's own generated persona files use (name, description, tools,
// model, effort, cwd) is a single-line scalar, so a line-by-line
// "key: value" scan is enough. Not a general YAML parser.
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };
  const [, fmText, body] = match;
  const frontmatter = {};
  for (const line of fmText.split("\n")) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m) frontmatter[m[1]] = m[2].trim();
  }
  return { frontmatter, body };
}

// Always double-quotes string scalars via JSON.stringify. Less pretty than
// hand-written YAML, but always valid — including values like "${API_KEY}"
// or a URL with a colon in it — which matters more for a generated file
// nobody should be hand-editing anyway.
function mcpServersYaml(mcpServers) {
  const entries = Object.entries(mcpServers || {});
  if (entries.length === 0) return "";
  const lines = ["mcpServers:"];
  for (const [serverName, serverConfig] of entries) {
    lines.push(`  - ${serverName}:`);
    for (const [key, value] of Object.entries(serverConfig || {})) {
      if (Array.isArray(value)) {
        lines.push(`      ${key}: ${JSON.stringify(value.map(String))}`);
      } else if (value !== null && typeof value === "object") {
        lines.push(`      ${key}:`);
        for (const [k2, v2] of Object.entries(value)) {
          lines.push(`        ${k2}: ${JSON.stringify(String(v2))}`);
        }
      } else {
        lines.push(`      ${key}: ${JSON.stringify(String(value))}`);
      }
    }
  }
  return lines.join("\n");
}

// mcp__<server> grants every tool from that server even when "tools" is an
// explicit allowlist — confirmed syntax, see the docs link above.
function mcpToolPatterns(mcpServers) {
  return Object.keys(mcpServers || {}).map((name) => `mcp__${name}`);
}

function materializeMcpAgent(personaName, sourceContent, mcpServers, mcpNotes) {
  const { frontmatter, body } = parseFrontmatter(sourceContent);
  const materializedName = `wizard-${personaName}`;
  fs.mkdirSync(MATERIALIZED_AGENTS_DIR, { recursive: true });
  const targetPath = path.join(MATERIALIZED_AGENTS_DIR, `${materializedName}.md`);

  // Never clobber a file this script didn't generate — ~/.claude/agents/
  // is the user's real global agent directory, not ours, and a name
  // collision with something hand-written there would be a real loss.
  if (fs.existsSync(targetPath)) {
    const existing = fs.readFileSync(targetPath, "utf8");
    if (!existing.includes(MATERIALIZED_MARKER)) {
      console.warn(
        `Skipping MCP materialization for "${personaName}" — ` +
          `~/.claude/agents/${materializedName}.md already exists and wasn't ` +
          `generated by this script. Rename or remove it first if you want ` +
          `sync-config.js to manage it.`
      );
      return false;
    }
  }

  const tools = frontmatter.tools
    ? [frontmatter.tools, ...mcpToolPatterns(mcpServers)].join(", ")
    : undefined; // omitted entirely -> Claude Code inherits every tool, MCP tools included

  const frontmatterLines = ["---", `name: ${materializedName}`];
  frontmatterLines.push(
    `description: ${frontmatter.description || `"${personaName}, connected to a company's own MCP-exposed agent."`}`
  );
  if (tools) frontmatterLines.push(`tools: ${tools}`);
  if (frontmatter.model) frontmatterLines.push(`model: ${frontmatter.model}`);
  if (frontmatter.effort) frontmatterLines.push(`effort: ${frontmatter.effort}`);
  frontmatterLines.push(mcpServersYaml(mcpServers));
  frontmatterLines.push("---");

  const serverNames = Object.keys(mcpServers || {}).join(", ");
  const noteLines = [
    "",
    `${MATERIALIZED_MARKER} — generated by scripts/sync-config.js. -->`,
    "",
    "## MCP connection",
    "",
    `This file is a materialized copy of the \`${personaName}\` persona below, ` +
      `connected to ${serverNames || "a company's own MCP-exposed agent"} via the ` +
      "`mcpServers` frontmatter above. It lives outside The Wizard plugin " +
      "entirely, at `~/.claude/agents/" +
      materializedName +
      ".md` — Claude Code's own global subagent directory — because plugin-loaded " +
      "subagents silently ignore the `mcpServers`, `hooks`, and `permissionMode` " +
      "frontmatter fields (Claude Code's own restriction, not this framework's; see " +
      "https://code.claude.com/docs/en/sub-agents#choose-the-subagent-scope).",
    "",
    `Reach it with subagent_type \`${materializedName}\` — bare, no \`wizard:\` prefix; ` +
      `that prefix only applies inside the plugin. The plugin's own \`wizard:${personaName}\` ` +
      "keeps working exactly as before, with no MCP connection, for anyone without this " +
      "company's server.",
  ];
  if (mcpNotes) noteLines.push("", mcpNotes);
  noteLines.push(
    "",
    "_Generated by `scripts/sync-config.js` from `wizard.config.jsonc`'s (or a personal " +
      "config's) `mcpServers` field. Edit there, not here — a re-sync overwrites this file. " +
      "Safe to delete if you no longer want this connection; re-run the sync script to " +
      "regenerate it._"
  );

  const content =
    frontmatterLines.join("\n") + "\n" + body.replace(/\n+$/, "\n") + noteLines.join("\n") + "\n";
  fs.writeFileSync(targetPath, content);
  console.log(
    `Materialized ~/.claude/agents/${materializedName}.md ` +
      `(outside the plugin — Claude Code's own global agent directory)`
  );
  return true;
}

function overrideBlock(personaName, override) {
  const lines = [
    OVERRIDE_START,
    "",
    "## Company-specific addition",
    "",
    "This adds to the generic default above — it doesn't replace it. The",
    "default keeps working with zero configuration for anyone; this is what",
    "one specific company layered on top of it.",
    "",
    // Bold, not an inline code span — pointsTo often contains its own
    // backtick-wrapped snippets (e.g. `npm run build`), and nesting
    // backticks inside a backtick span breaks Markdown rendering.
    `Points to: **${override.pointsTo}**`,
  ];
  if (override.notes) {
    lines.push("", override.notes);
  }
  if (override.mcpServers) {
    lines.push(
      "",
      `This persona also connects to ${Object.keys(override.mcpServers).join(", ")} via MCP — ` +
        `see \`~/.claude/agents/wizard-${personaName}.md\` (subagent_type \`wizard-${personaName}\`), ` +
        "generated alongside this file because plugin subagents can't hold `mcpServers` " +
        "frontmatter themselves. See `docs/CUSTOMIZING.md`."
    );
  }
  lines.push(
    "",
    "_Generated by `scripts/sync-config.js`, from either `wizard.config.jsonc` " +
      "or a personal config outside this repo — see `docs/CUSTOMIZING.md`. " +
      "Edit the config, not this block — a re-sync will overwrite it._",
    "",
    OVERRIDE_END
  );
  return lines.join("\n");
}

function applyOverride(personaName, override) {
  const filePath = path.join(AGENTS_DIR, `${personaName}.md`);
  if (!fs.existsSync(filePath)) {
    console.warn(
      `Skipping override for "${personaName}" — no agents/${personaName}.md exists. ` +
        `Overrides target the shipped seven; use "customAgents" to add a new persona.`
    );
    return;
  }
  upsertMarkedBlock(filePath, OVERRIDE_START, OVERRIDE_END, overrideBlock(personaName, override));
  console.log(`Updated ${path.relative(ROOT, filePath)}`);

  if (override.mcpServers) {
    const content = fs.readFileSync(filePath, "utf8");
    materializeMcpAgent(personaName, content, override.mcpServers, override.mcpNotes || override.notes);
  }
}

function applyCustomAgent(agent) {
  if (!agent.name) {
    console.warn("Skipping a customAgents entry with no name.");
    return;
  }
  fs.mkdirSync(CUSTOM_DIR, { recursive: true });
  const filePath = path.join(CUSTOM_DIR, `${agent.name}.md`);
  const frontmatterLines = [
    "---",
    `name: ${agent.name}`,
    `description: "${(agent.description || "").replace(/"/g, '\\"')}"`,
  ];
  if (agent.tools) {
    frontmatterLines.push(`tools: ${agent.tools}`);
  }
  frontmatterLines.push("---");
  const frontmatter = frontmatterLines.join("\n");
  const mcpNote = agent.mcpServers
    ? `\nThis persona also connects to ${Object.keys(agent.mcpServers).join(", ")} via MCP — ` +
      `see \`~/.claude/agents/wizard-${agent.name}.md\` (subagent_type \`wizard-${agent.name}\`), ` +
      "generated alongside this file because plugin subagents can't hold `mcpServers` " +
      "frontmatter themselves. See `docs/CUSTOMIZING.md`."
    : "";
  const body = [
    `# ${agent.name}`,
    "",
    "**Status: custom persona, generated from `wizard.config.jsonc`.**",
    "",
    // Bold, not an inline code span — see the note in overrideBlock().
    `Points to: **${agent.pointsTo || "(not set)"}**`,
    agent.notes ? `\n${agent.notes}` : "",
    mcpNote,
    "",
    "_Generated by `scripts/sync-config.js`. Edit `wizard.config.jsonc`, not this file — a re-sync will overwrite it._",
  ].join("\n");
  fs.writeFileSync(filePath, `${frontmatter}\n\n${body}\n`);
  console.log(`Wrote ${path.relative(ROOT, filePath)}`);

  if (agent.mcpServers) {
    const content = fs.readFileSync(filePath, "utf8");
    materializeMcpAgent(agent.name, content, agent.mcpServers, agent.mcpNotes || agent.notes);
  }
}

function defaultSkillsBlock(skills) {
  const lines = [
    DEFAULT_SKILLS_START,
    "",
    "## House convention: ASD-STE100 for machine-facing text",
    "",
    "Scope: agent-to-agent messages, tool and function descriptions, error",
    "messages, and instructions this persona sends to another persona or",
    "subagent. Apply the rules in these bundled skills to that text:",
    "",
  ];
  for (const skill of skills) {
    const name = typeof skill === "string" ? skill : skill.name;
    const usage = typeof skill === "string" ? "" : skill.usage || "";
    lines.push(`* \`${name}\`${usage ? ` — ${usage}` : ""}`);
  }
  lines.push(
    "",
    "Out of scope: a deliverable meant for a human reader, where voice and",
    "nuance are the point. Examples: Designer's UX copy, Council's final",
    "recommendation, Oracle's explanation of a design tradeoff. Write those",
    "in plain, natural prose, not flattened technical English.",
    "",
    "_Generated by `scripts/sync-config.js` from `wizard.config.jsonc`'s " +
      '`defaultSkills`. Edit there, not here — a re-sync will overwrite it._',
    "",
    DEFAULT_SKILLS_END
  );
  return lines.join("\n");
}

function applyDefaultSkills(skills) {
  if (!skills || skills.length === 0) return 0;
  const block = defaultSkillsBlock(skills);
  let count = 0;
  for (const filePath of listPersonaFiles()) {
    if (upsertMarkedBlock(filePath, DEFAULT_SKILLS_START, DEFAULT_SKILLS_END, block)) {
      count += 1;
    }
  }
  return count;
}

// Free-form per-persona appends — see USER_APPENDS_DIR above. Returns how
// many files were applied, for the summary line in main().
function applyPersonalAppends() {
  if (!fs.existsSync(USER_APPENDS_DIR)) return 0;

  let count = 0;
  for (const entry of fs.readdirSync(USER_APPENDS_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith("__append.md")) continue;

    const personaName = entry.name.slice(0, -"__append.md".length);
    if (!personaName) {
      console.warn(`Skipping "${entry.name}" — no persona name before "__append.md".`);
      continue;
    }

    // Same lookup order as applyOverride: the shipped seven live directly
    // under agents/, anything generated by customAgents lives one level
    // down.
    let targetPath = path.join(AGENTS_DIR, `${personaName}.md`);
    if (!fs.existsSync(targetPath)) {
      targetPath = path.join(CUSTOM_DIR, `${personaName}.md`);
    }
    if (!fs.existsSync(targetPath)) {
      console.warn(
        `Skipping ${entry.name} — no agents/${personaName}.md or agents/custom/${personaName}.md exists to append to.`
      );
      continue;
    }

    const raw = fs.readFileSync(path.join(USER_APPENDS_DIR, entry.name), "utf8").replace(/\n+$/, "\n");
    const block = [
      APPEND_START,
      "",
      raw.trim(),
      "",
      `_Appended verbatim from ~/.claude/the-wizard/agents/${entry.name} by ` +
        "scripts/sync-config.js — see docs/CUSTOMIZING.md, \"5. A free-form append " +
        'file per persona." Edit that file, not this block — a re-sync overwrites it._',
      "",
      APPEND_END,
    ].join("\n");

    upsertMarkedBlock(targetPath, APPEND_START, APPEND_END, block);
    console.log(`Applied ${path.relative(os.homedir(), path.join(USER_APPENDS_DIR, entry.name))} -> ${path.relative(ROOT, targetPath)}`);
    count += 1;
  }
  return count;
}

function main() {
  const shipped = loadConfig();
  const user = loadUserConfig();
  const hasUserConfig = Object.keys(user).length > 0;
  const config = mergeConfigs(shipped, user);

  const { overrides, customAgents, defaultSkills } = config;

  Object.entries(overrides).forEach(([personaName, override]) =>
    applyOverride(personaName, override)
  );
  customAgents.forEach(applyCustomAgent);
  // Runs last, over every persona file — including ones customAgents just
  // wrote above — so newly-added personas get the house convention too.
  const skillsApplied = applyDefaultSkills(defaultSkills);
  // Independent of wizard.config.jsonc entirely — reads raw files, not
  // JSON — so it runs regardless of whether a personal config exists.
  const appendsApplied = applyPersonalAppends();

  const mcpCount =
    Object.values(overrides).filter((o) => o.mcpServers).length +
    customAgents.filter((a) => a.mcpServers).length;

  console.log(
    `\nSynced ${Object.keys(overrides).length} override(s), ${customAgents.length} custom agent(s), ` +
      `default-skills block on ${skillsApplied} file(s), ${appendsApplied} personal append(s).` +
      (hasUserConfig ? `\n(included your personal config at ${USER_CONFIG_PATH})` : "") +
      (mcpCount > 0
        ? `\n${mcpCount} persona(s) also materialized to ~/.claude/agents/ for their mcpServers ` +
          `connection — see the "Materialized ..." lines above and docs/CUSTOMIZING.md.`
        : "")
  );
}

main();
