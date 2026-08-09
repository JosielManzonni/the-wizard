---
name: postmortem-writing
description: Use when writing an incident postmortem after a scoped, already-diagnosed problem has been fixed. Not for open-ended debugging or code review — this is for documenting an incident that's already resolved.
---

# Postmortem Writing

Use this skill to turn a resolved incident into a structured, durable writeup. This skill defines structure only — it does not assume a language, currency, tracker integration, or house template. A company with its own postmortem format layers that on top; see `docs/CUSTOMIZING.md`.

## Sections

Write these sections in order:

1. **Summary** — one or two sentences: what broke, for how long, who was affected.
2. **Timeline** — dated/timestamped sequence from first signal to resolution. Include detection, escalation, mitigation, and full resolution as distinct points.
3. **Impact** — concrete, measurable effect: what stopped working, for which users, for how long. State a number where one exists; do not estimate silently — mark an estimate as an estimate.
4. **Root cause** — the actual mechanism that caused the incident, not just the trigger. Distinguish "what triggered this" from "what allowed it to happen."
5. **Resolution** — what was done to stop the incident, in the order it was done.
6. **Preventive measures** — concrete, assignable follow-up items, each with a clear owner and a completion condition. Do not write a preventive measure with no way to verify it was done.

## Rules

* Ask for any of the above that isn't already in context — do not guess at a timeline, an impact number, or a root cause you don't have evidence for.
* State uncertainty explicitly. "Root cause: likely X, unconfirmed" is correct; a confident-sounding guess is not.
* Keep root cause and trigger separate. A trigger without a root cause is an incomplete postmortem.
* A preventive measure with no owner or no way to check it happened does not count as a preventive measure — flag it as unresolved instead of including it as if it were actionable.
* Do not assign blame to a person. Describe what the system allowed, not who made a mistake.

## Review

Before completing the writeup:

1. Verify every claimed fact (timestamp, impact figure, root cause) against available evidence rather than assumption.
2. Check that every preventive measure has an owner and a completion condition.
3. Check that root cause and trigger are not conflated.
4. Report any section left incomplete because the necessary information wasn't available, rather than filling it with a plausible-sounding guess.
