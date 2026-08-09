---
name: ste-requirements
description: Use when converting informal requests into requirements, acceptance criteria, behavioral contracts, implementation specifications, test cases, or tasks for another coding agent.
---

# STE-Inspired Requirements

Use this skill to convert informal intent into precise and verifiable software requirements.

This skill applies selected controlled-language principles inspired by ASD-STE100. It does not establish formal ASD-STE100 compliance.

## Preserve intent

Do not invent product behavior.

When information is missing:

* state the assumption explicitly;
* identify the missing decision;
* separate confirmed requirements from proposed behavior.

## Requirement structure

For each behavior, identify the applicable elements:

1. Actor or component
2. Trigger or precondition
3. Required behavior
4. Prohibited behavior
5. Observable result
6. Failure behavior
7. Verification method

Not every requirement needs all seven elements. Include each element that affects implementation or verification.

## Writing rules

* Write one principal requirement in each statement.
* Name the responsible component.
* Put the condition before the required behavior.
* Use one term for one concept.
* Preserve established domain terminology.
* Use explicit quantities, durations, limits, states, and error conditions.
* Separate independent behaviors into separate requirements.
* Separate normal behavior from failure behavior.
* Do not hide multiple requirements inside one conjunction.
* Do not use examples as substitutes for requirements.
* Do not specify implementation details unless they are required constraints.

## Modal verbs

Use:

* `must` for required behavior;
* `must not` for prohibited behavior;
* `should` for recommended behavior with permitted exceptions;
* `may` for permission;
* `can` for capability.

Avoid ambiguous uses of:

* should;
* will;
* would;
* normally;
* usually;
* when possible;
* as needed.

## Vague terms

Do not use subjective terms without defining an observable meaning.

Avoid:

* properly;
* correctly;
* appropriately;
* robust;
* seamless;
* fast;
* efficient;
* secure;
* user-friendly;
* handle;
* support.

For example, replace:

> The service must respond quickly.

With:

> The service must return a response within 500 milliseconds for 95% of requests under the defined test load.

Do not invent numerical targets. Use a visible placeholder or identify the missing decision when no target was provided.

## Example

Informal request:

> The service should handle failed payments properly.

Controlled requirements:

1. If the payment gateway returns a timeout, the payment service must retry the request one time.
2. The payment service must wait two seconds before the retry.
3. The payment service must not retry a response with a 4xx status.
4. If the retry fails, the payment service must mark the payment as `FAILED`.
5. An automated test must verify the timeout behavior.
6. An automated test must verify that a 4xx response does not cause a retry.

## Acceptance criteria

Acceptance criteria must describe externally observable results.

Use this form when useful:

```text
Given <initial state>
When <event or action>
Then <observable result>
```

Do not force this form when a direct requirement is clearer.

## Output

When preparing work for another coding agent, provide:

* confirmed requirements;
* explicit assumptions;
* affected components;
* prohibited behavior;
* acceptance criteria;
* required verification;
* unresolved decisions.

Keep implementation proposals separate from confirmed requirements.
