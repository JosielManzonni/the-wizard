---
name: ste-technical-writing
description: Use when creating, reviewing, or rewriting technical documentation, API guides, READMEs, runbooks, release notes, pull-request descriptions, error messages, or important code comments.
---

# STE-Inspired Technical Writing

Use this skill for technical prose. Do not use it for ordinary source-code implementation unless the task also requires a written artifact.

This skill applies selected principles from ASD-STE100. It does not establish formal ASD-STE100 compliance.

## Priorities

Apply these priorities in order:

1. Technical correctness
2. Preservation of meaning
3. Preservation of exact technical identifiers
4. Clarity
5. Controlled terminology
6. Concision

Do not improve style by changing technical meaning.

## Rules

* Use one term for one concept.
* Preserve identifiers, commands, paths, configuration keys, API fields, and literal error messages.
* Do not replace established technical terms with stylistic synonyms.
* Put one principal statement in each sentence when practical.
* Use active voice when the actor is known.
* Name the component that performs an action.
* Put a condition before the action that depends on it.
* Put instructions in execution order.
* Use one bounded action in each procedural step.
* Define domain-specific terms before using them extensively.
* Replace subjective descriptions with observable behavior.
* Remove filler, unnecessary introductions, and repeated conclusions.
* Do not omit necessary warnings, limitations, prerequisites, or failure behavior.

## Modal verbs

Use modal verbs consistently:

* `must`: required behavior;
* `must not`: prohibited behavior;
* `should`: recommended behavior with permitted exceptions;
* `may`: permitted behavior;
* `can`: capability.

Do not use `should` when the behavior is mandatory.

## Vague language

Avoid vague terms unless the text defines their observable meaning.

Examples include:

* properly;
* appropriately;
* robust;
* seamless;
* efficient;
* simple;
* intuitive;
* user-friendly;
* handle;
* support;
* optimize.

Replace vague language with a named condition, action, constraint, or measurable result.

## Example

Avoid:

> Make the authentication flow more robust.

Prefer:

> If the identity provider returns a timeout, retry the request one time.

> Do not retry a response with a 4xx status.

> Record the final failure in the authentication error log.

## Review

Before completing the writing task:

1. Verify the technical claims against available repository evidence.
2. Check that each concept has a consistent term.
3. Check that conditions precede dependent actions.
4. Check that procedures follow execution order.
5. Check that identifiers and literal values remain unchanged.
6. Check that requirements and recommendations use the correct modal verbs.
7. Report any factual claim that could not be verified.
