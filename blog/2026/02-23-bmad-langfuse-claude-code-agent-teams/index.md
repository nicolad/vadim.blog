---
title: "BMAD Method + Langfuse + Claude Code Agent Teams in Production"
description: "How BMAD v6 workflows, Langfuse observability, and Claude Code Agent Teams compose into a coherent AI-heavy development system — with real code from nomadically.work."
slug: bmad-langfuse-claude-code-agent-teams
authors: [nicolad]
tags: [bmad, langfuse, claude-code, ai-agents, observability, llm-evals, agent-teams]
---

# BMAD Method + Langfuse + Claude Code Agent Teams in Production

Running AI agents in a real codebase means solving three intertwined problems at once: **planning and quality gates** (so agents don't drift), **observability** (so you know what's working), and **orchestration** (so multiple agents divide work without clobbering each other). In [nomadically.work](https://nomadically.work) — a remote EU job board with an AI classification and skill-extraction pipeline — these problems are solved by three complementary systems: BMAD v6, Langfuse, and Claude Code Agent Teams. This article explains how each works and how they compose.

<!--truncate-->

## Table of Contents

- [The Three Pillars](#the-three-pillars)
- [Pillar 1 — BMAD v6: Workflows and Quality Gates](#pillar-1-bmad-v6)
- [Pillar 2 — Langfuse: Edge-Compatible Observability](#pillar-2-langfuse)
- [Pillar 3 — Claude Code Agent Teams](#pillar-3-agent-teams)
- [How They Compose](#how-they-compose)
- [Lessons Learned](#lessons-learned)

---

## The Three Pillars

Before diving into each system, it helps to name the gap each one fills:

| Gap | System | Mechanism |
|-----|--------|-----------|
| Agents lack structure and drift from requirements | **BMAD v6** | Step-file architecture, role definitions, checklist-gated quality gates |
| LLM outputs are invisible — no feedback loop | **Langfuse** | Traces, prompt versioning, scores, A/B routing |
| Multiple agents conflict on shared files | **Claude Code Agent Teams** | Role-based ownership, spawn prompts, permission layers |

None of them is optional. Skip BMAD and you get agents that produce code that doesn't match requirements. Skip Langfuse and you're flying blind on prompt accuracy. Skip proper Agent Teams setup and you get merge conflicts and overwritten work.

---

## Pillar 1 — BMAD v6: Workflows and Quality Gates {#pillar-1-bmad-v6}

[BMAD Method](https://docs.bmad-method.org/) v6 structures AI-assisted development into explicit workflow phases, each controlled by a **step-file** — a self-contained Markdown document that tells the agent exactly what to do, what state to carry forward, and what file to load next.

### Step-File Architecture

The key insight in BMAD v6 is that large context windows suffer from "lost in the middle" — agents forget early instructions as the conversation grows. Step-files solve this by loading fresh context at each phase:

```
_bmad/bmm/workflows/bmad-quick-flow/quick-dev/
├── workflow.md          ← entry point, loads step-01
├── steps/
│   ├── step-01-mode-detection.md
│   ├── step-02-context-gathering.md
│   ├── step-03-execute.md
│   └── step-04-self-check.md
```

Each step file declares explicit state variables that persist across steps:

```markdown
## STATE VARIABLES (capture now, persist throughout)

- `{baseline_commit}` - Git HEAD at workflow start
- `{execution_mode}` - "tech-spec" or "direct"
- `{tech_spec_path}` - Path to tech-spec file (if Mode A)
```

And a mandatory `NEXT STEP DIRECTIVE` that forces the agent to explicitly transition:

```markdown
## NEXT STEP DIRECTIVE

**CRITICAL:** When this step completes, explicitly state which step to load:

- Mode A (tech-spec): "**NEXT:** read fully and follow: step-03-execute.md"
- Mode B (direct, [E] selected): "**NEXT:** Read fully and follow: step-02-context-gathering.md"
```

This is the opposite of a single monolithic prompt. Instead of hoping the agent remembers everything, each step carries only what it needs.

### Escalation Thresholds

BMAD's mode-detection step includes an escalation threshold — an in-context evaluation that decides whether a request is simple enough to execute directly, should go through quick-spec planning, or warrants the full PRD workflow:

```
Triggers escalation (if 2+ signals present):
- Multiple components mentioned (dashboard + api + database)
- System-level language (platform, integration, architecture)
- Uncertainty about approach
- Multi-layer scope (UI + backend + data together)

Reduces signal:
- Simplicity markers ("just", "quickly", "fix", "bug")
- Single file/component focus
- Confident, specific request
```

This prevents over-engineering small tasks while catching scope that's too large for ad-hoc execution.

### Role Definitions and Quality Gates

BMAD defines four team roles, each with explicit ownership constraints. The project's spawn prompts (in `.claude/team-roles/`) encode these constraints as persona documents loaded when a teammate spawns:

- **PM** (`pm.md`) — owns requirements, challenges feasibility, validates user value
- **Architect** (`architect.md`) — owns system design, reviews technical tradeoffs
- **Dev** (`dev.md`) — owns `src/` and `workers/`, follows coding conventions exactly
- **QA** (`qa.md`) — validates against BMAD checklists before marking tasks complete

The dev role's spawn prompt reads:

```
Critical coding conventions:
- Use Drizzle ORM for all DB queries — never raw SQL strings
- Run `pnpm codegen` after any `schema/**/*.graphql` changes
- Never edit files in `src/__generated__/` — they are auto-generated
- Admin mutations need `isAdminEmail()` guard from `src/lib/admin.ts`
- D1 returns 0/1 for booleans — handle coercion in resolvers
```

These aren't suggestions — they're constraints baked into the agent's identity. Any teammate spawned from `dev.md` inherits them.

---

## Pillar 2 — Langfuse: Edge-Compatible Observability {#pillar-2-langfuse}

[Langfuse](https://langfuse.com) is an open-source LLM observability platform: prompt management, tracing, scoring, and evaluation in one place. The standard `@langfuse/client` SDK is Node.js-only, which is a problem for a Next.js app deployed on Vercel with Edge Runtime routes. The solution is a hand-rolled fetch-based client.

### Why the Node.js SDK Can't Be Used

The `LangfuseClient` SDK depends on Node.js APIs (`fs`, `stream`, HTTP keep-alive agents) that don't exist in the Edge Runtime. The comment at the top of `src/langfuse/index.ts` makes this explicit:

```typescript
// Note: LangfuseClient SDK is Node.js only and not compatible with Edge Runtime.
// We use direct fetch API calls instead for universal compatibility.
// import { LangfuseClient } from "@langfuse/client";
```

Every operation — fetching prompts, creating prompts, ingesting traces — uses `fetch` directly with Basic auth:

```typescript
const response = await fetch(url.toString(), {
  headers: {
    Authorization: `Basic ${btoa(
      `${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}`,
    )}`,
  },
});
```

This works identically in Node.js, Edge Runtime, and Cloudflare Workers.

### Prompt Management with Caching and Fallbacks

`fetchLangfusePrompt` fetches a named prompt from the Langfuse REST API, with optional version pinning, label selection, and a fallback for when the API is unavailable:

```typescript
export async function fetchLangfusePrompt(
  name: string,
  options: PromptFetchOptions = {},
) {
  const baseUrl = LANGFUSE_BASE_URL.replace(/\/+$/, "");
  const url = new URL(`${baseUrl}/api/public/prompts/${encodeURIComponent(name)}`);

  if (options.version !== undefined) {
    url.searchParams.set("version", String(options.version));
  }
  if (options.label) {
    url.searchParams.set("label", options.label);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Basic ${btoa(
        `${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}`,
      )}`,
    },
  });

  if (!response.ok) {
    if (options.fallback !== undefined) {
      return {
        name,
        version: options.version ?? 1,
        type: options.type ?? "text",
        prompt: options.fallback,
        labels: [],
        tags: [],
      };
    }
    throw new Error(`Langfuse API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
```

Cache TTL is environment-aware: 300 seconds in production (reduce API calls), 0 in development (instant iteration):

```typescript
export function defaultCacheTtlSeconds(): number {
  return process.env.NODE_ENV === "production" ? 300 : 0;
}
```

### Deterministic A/B Routing

A/B testing prompts requires stable routing — the same user should always get the same variant. The `pickAbLabel` function uses SHA-256 hashing via the Web Crypto API (Edge-compatible) to map a seed (userId or sessionId) to a variant label:

```typescript
async function hashToUnit(seed: string): Promise<number> {
  const encoder = new TextEncoder();
  const data = encoder.encode(seed);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  const num = (hashArray[0] << 24) | (hashArray[1] << 16) | (hashArray[2] << 8) | hashArray[3];
  return num / 0xffffffff;
}

export async function pickAbLabel(params: {
  seed: string;
  labelA: string;   // "prod-a"
  labelB: string;   // "prod-b"
  splitA?: number;  // default 0.5
}): Promise<string> {
  const u = await hashToUnit(params.seed);
  return u < (params.splitA ?? 0.5) ? params.labelA : params.labelB;
}
```

Usage: fetch the `prod-a` or `prod-b` labeled version of a prompt, then score results against each label to identify the winner.

### Composable Prompts

Large LLM systems reuse prompt fragments — a system identity block, a safety policy block, a formatting block. Langfuse supports this via prompt references. The `@@@langfusePrompt:name=PromptName|label=production@@@` syntax embeds one prompt inside another, resolved at fetch time:

```typescript
export function composePromptRef(
  name: string,
  options: { version?: number; label?: string } = {},
): string {
  let ref = `@@@langfusePrompt:name=${name}`;
  if (options.version !== undefined) ref += `|version=${options.version}`;
  if (options.label) ref += `|label=${options.label}`;
  ref += "@@@";
  return ref;
}
```

`resolveComposedPrompt` recursively expands references, tracking visited prompts to prevent cycles. A `system-instructions` prompt can reference a `safety-policy` prompt, which in turn references a `formatting-rules` prompt — all resolved in a single fetch chain.

### Score Ingestion

The scoring API allows attaching quality signals to traces. After running an LLM generation, you submit a score that links back to the `traceId`:

```typescript
export async function createScore(input: {
  traceId: string;
  observationId?: string;
  name: string;            // e.g. "helpfulness", "is-remote-eu"
  value: number | string;  // boolean => 0/1
  dataType?: ScoreDataType;
  comment?: string;
  id?: string;             // idempotency key
}) {
  const baseUrl = LANGFUSE_BASE_URL.replace(/\/+$/, "");
  const url = new URL(`${baseUrl}/api/public/scores`);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${btoa(
        `${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}`,
      )}`,
    },
    body: JSON.stringify({ ...input }),
  });

  if (!response.ok) {
    throw new Error(`Langfuse API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
```

Using `id` as an idempotency key means "update feedback" calls overwrite the same score rather than creating duplicates.

---

## Pillar 3 — Claude Code Agent Teams {#pillar-3-agent-teams}

[Claude Code Agent Teams](https://docs.anthropic.com/en/docs/claude-code/agent-teams) allows multiple Claude instances to collaborate on a project — each with a distinct role, tool set, and task ownership. The challenge is preventing conflicts: two agents editing the same file simultaneously produces chaos.

### defineSubagent() — Role-Based Tool Restrictions

The `defineSubagent()` helper in `src/anthropic/subagents.ts` creates a named agent definition that controls which tools a subagent can use:

```typescript
export function defineSubagent(
  name: string,
  config: SubagentConfig,
): Record<string, AgentDefinition> {
  const def: AgentDefinition = {
    description: config.description,
    prompt: config.prompt,
  };

  if (config.tools) def.tools = config.tools;
  if (config.disallowedTools) def.disallowedTools = config.disallowedTools;
  if (config.model) def.model = config.model;
  if (config.maxTurns) def.maxTurns = config.maxTurns;

  return { [name]: def };
}
```

The `SUBAGENT_PRESETS` object provides ready-made definitions for common roles:

```typescript
export const SUBAGENT_PRESETS = {
  codeReviewer: defineSubagent("code-reviewer", {
    description: "Expert code reviewer for quality and security reviews.",
    prompt: "Analyze code quality, security vulnerabilities, and suggest improvements.",
    tools: ["Read", "Glob", "Grep"],  // read-only — can't modify files
  }),

  testRunner: defineSubagent("test-runner", {
    description: "Runs tests and reports results.",
    prompt: "Execute tests and report failures with clear diagnostics.",
    tools: ["Bash", "Read"],
    model: "haiku",  // fast + cheap for test execution
  }),
};
```

The `tools` array is the critical constraint. A `code-reviewer` that can only `Read`, `Glob`, and `Grep` physically cannot write files. This is ownership enforcement at the SDK level.

### mergeSubagents() — Team Assembly

Multiple subagent definitions combine via `mergeSubagents()`:

```typescript
export function mergeSubagents(
  ...agentDefs: Record<string, AgentDefinition>[]
): Record<string, AgentDefinition> {
  return Object.assign({}, ...agentDefs);
}
```

Usage — the README shows the canonical pattern with `TOOL_PRESETS`:

```typescript
import { runAgent, defineSubagent, mergeSubagents, TOOL_PRESETS } from "@/anthropic";

const agents = mergeSubagents(
  defineSubagent("code-reviewer", {
    description: "Expert code reviewer for quality and security reviews.",
    prompt: "Analyze code quality and suggest improvements.",
    tools: TOOL_PRESETS.READONLY,  // Read, Glob, Grep
  }),
  defineSubagent("test-runner", {
    description: "Runs tests and reports results.",
    prompt: "Execute tests and report failures.",
    tools: ["Bash", "Read"],
    model: "haiku",
  }),
);

const result = await runAgent("Review and test the codebase", {
  tools: ["Read", "Edit", "Bash", "Glob", "Grep", "Task"],
  agents,
});
```

Or use `SUBAGENT_PRESETS` for the built-in roles:

```typescript
import { runAgent, mergeSubagents, SUBAGENT_PRESETS } from "@/anthropic";

const agents = mergeSubagents(
  SUBAGENT_PRESETS.codeReviewer,
  SUBAGENT_PRESETS.testRunner,
  SUBAGENT_PRESETS.linter,
);

const result = await runAgent("Full code review pipeline", {
  tools: ["Read", "Glob", "Grep", "Bash", "Task"],
  agents,
});
```

The main agent uses the `Task` tool to delegate to named subagents. Each subagent runs with its own tool restrictions and reports back via the `parent_tool_use_id` field.

### composePermissions() — Layered Access Control

For fine-grained control beyond tool allow/deny lists, `composePermissions()` chains multiple `canUseTool` callbacks — all must allow for a tool call to proceed:

```typescript
export function composePermissions(...callbacks: CanUseTool[]): CanUseTool {
  return async (toolName, input, options) => {
    for (const cb of callbacks) {
      const result = await cb(toolName, input, options);
      if (result.behavior === 'deny') {
        return result;  // first deny wins
      }
    }
    return { behavior: 'allow' };
  };
}
```

Practical example — compose allow-list, directory restriction, and command blocking in one pass:

```typescript
import {
  runAgent,
  composePermissions,
  allowOnly,
  restrictToDirectories,
  blockCommands,
} from "@/anthropic";

const result = await runAgent("Fix the codebase", {
  canUseTool: composePermissions(
    allowOnly(["Read", "Edit", "Bash", "Glob", "Grep"]),
    restrictToDirectories(["/app/src"]),
    blockCommands([/rm\s+-rf/]),
  ),
});
```

### BMAD Team-Roles as Spawn Prompts

The project's `.claude/team-roles/` directory contains spawn prompt files — Markdown documents that define each agent's persona, ownership, and constraints. When Claude Code Agent Teams spawns a teammate, it loads the appropriate role file as the agent's system context.

The dev role file (`dev.md`) enforces the project's coding conventions on every dev agent:

```markdown
You are the Developer teammate for the nomadically.work project.

Critical coding conventions:
- Use Drizzle ORM for all DB queries — never raw SQL strings
- Run `pnpm codegen` after any `schema/**/*.graphql` changes
- Never edit files in `src/__generated__/`
- Admin mutations need `isAdminEmail()` guard from `src/lib/admin.ts`
- Batch D1 queries when possible via `createD1HttpClient().batch()`
```

The pm role (`pm.md`) enforces business constraints:

```markdown
You are the Product Manager teammate.

- Challenge the Architect on feasibility and technical debt tradeoffs
- Challenge the Dev on scope creep
- Validate that features serve the core user: EU-based remote job seekers
- Use the BMAD checklist from `_bmad/` before marking any task complete.
```

These files are the bridge between BMAD's role system and Claude Code Agent Teams' spawn mechanism.

---

## How They Compose

The three systems interlock at implementation time. Here's a typical workflow:

**1. BMAD quick-spec → tech-spec file**

A feature request goes through the quick-spec workflow, which produces a `tech-spec-*.md` file in `_bmad-output/implementation-artifacts/`. The spec includes tasks, acceptance criteria, files to modify, and code patterns to follow.

**2. quick-dev → task execution**

The quick-dev workflow loads the tech-spec and executes it step by step — mode detection, context gathering, implementation, self-check. Each step loads fresh, carrying only the variables it needs.

**3. Agent Teams provides the execution substrate**

For larger specs, a team is spun up: PM validates scope, Architect reviews design, Dev implements, QA checks against BMAD checklists. Each role is seeded by a spawn prompt that bakes in project constraints.

**4. Langfuse observes the AI pipeline**

While agents execute, LLM calls within the product (job classification, skill extraction) are traced via `ingestLangfuseEvents`. Prompts are fetched from Langfuse with version pinning so agent actions use the same prompt versions as the evaluation suite. Scores are submitted after each classification, building the feedback loop that drives prompt improvement.

**5. The feedback loop**

Langfuse scores feed into Promptfoo evaluations (`pnpm eval:promptfoo`), which gate prompt changes behind an accuracy threshold (≥80%). BMAD's QA role validates implementation against acceptance criteria. Only code that passes both gates merges to main.

```
BMAD spec → Agent Teams execution → Langfuse traces
                   ↓
           Langfuse scores → Promptfoo evals → accuracy gate
                   ↓
            BMAD QA checklist → merge
```

---

## Lessons Learned

**Step-files beat system prompts for long tasks.** A monolithic system prompt degrades as context grows. Step-files force explicit state transitions and keep each phase focused.

**Edge Runtime forces discipline on observability.** The constraint of "no Node.js SDK" required building a lean, fetch-based Langfuse client — which turned out to be simpler and more portable than the official SDK for this use case.

**Tool restrictions are ownership, not just security.** Defining exactly which tools each subagent can use isn't about preventing malicious behavior — it's about preventing accidental conflicts. A reviewer that can't write files will never accidentally overwrite a dev's work.

**Spawn prompts encode institutional knowledge.** The `.claude/team-roles/` files aren't just instructions — they're the accumulated project conventions that every agent inherits. Keeping them updated as the codebase evolves is as important as keeping `CLAUDE.md` current.

**BMAD quality gates are checklists, not bureaucracy.** The QA role's job is to run through a checklist before declaring work done. In a multi-agent team, this catches the drift between what was planned and what was implemented — the gap that single-agent systems miss.

The combination of structured workflows, persistent observability, and role-enforced ownership is what makes AI-assisted development reliable at the level of a production codebase. Any one of the three is useful in isolation. Together, they close the feedback loops that make the system improvable over time.
