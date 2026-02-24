---
title: "BMAD Method + Langfuse + Claude Code Agent Teams in Production"
description: "How BMAD v6 workflows, Langfuse observability, and Claude Code Agent Teams compose into a coherent AI-heavy development system — with real code from nomadically.work."
slug: bmad-langfuse-claude-code-agent-teams
authors: [nicolad]
image: ./image.jpg
tags: [bmad, langfuse, claude-code, ai-agents, observability, llm-evals, agent-teams]
---

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

### Project Layout

BMAD v6 is installed as a directory at the project root. The [installer](https://docs.bmad-method.org/docs/install) creates `_bmad/` with the core framework, the BMM (BMAD Method Module) with role agents and workflows, and a config file that sets user name, communication language, and artifact output paths:

```
_bmad/
├── core/          ← core tasks, workflows (adversarial review, etc.)
└── bmm/           ← BMM module: agents, checklists, workflows
    ├── config.yaml
    └── workflows/
        └── bmad-quick-flow/
            ├── quick-spec/
            └── quick-dev/
```

```yaml
# _bmad/bmm/config.yaml
project_name: nomadically.work
user_name: Vadim
communication_language: English
planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"
implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"
```

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

[Claude Code Agent Teams](https://docs.anthropic.com/en/docs/claude-code/agent-teams) allows multiple Claude instances to collaborate on a project — each with a distinct role, tool set, and task ownership. The underlying SDK ([`@anthropic-ai/claude-agent-sdk`](https://docs.anthropic.com/en/docs/agent-sdk)) provides the `defineSubagent`, `mergeSubagents`, and permission primitives used throughout this section. The challenge is preventing conflicts: two agents editing the same file simultaneously produces chaos.

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

Every subagent prompt in `SUBAGENT_PRESETS` is prefixed with `GOAL_CONTEXT_LINE` — a single constant defined in `src/constants/goal.ts` that anchors every agent to the platform mission:

```typescript
// src/constants/goal.ts
export const GOAL_CONTEXT_LINE = `This codebase powers nomadically.work — a job board helping its owner land a fully remote AI Engineer or React Engineer role in Europe/worldwide.`;
```

This constant is the single source of truth imported by every agent, workflow, and evaluation in the codebase. The `SUBAGENT_PRESETS` object uses it in every prompt:

```typescript
// src/anthropic/subagents.ts
import { GOAL_CONTEXT_LINE } from "@/constants/goal";

export const SUBAGENT_PRESETS = {
  codeReviewer: defineSubagent("code-reviewer", {
    description: "Expert code reviewer for quality and security reviews.",
    prompt: `${GOAL_CONTEXT_LINE} Analyze code quality, security vulnerabilities, and suggest improvements. Be specific and actionable.`,
    tools: ["Read", "Glob", "Grep"],  // read-only — can't modify files
  }),

  testRunner: defineSubagent("test-runner", {
    description: "Runs tests and reports results.",
    prompt: `${GOAL_CONTEXT_LINE} Execute tests and report failures with clear diagnostics.`,
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

The three systems interlock at implementation time. The clearest example is the job classification pipeline, which touches all three layers in a single request.

### The Production Loop: Langfuse + DeepSeek

`src/llm/deepseek.ts` is where Langfuse and the LLM pipeline meet. It fetches the versioned prompt, compiles it, calls DeepSeek, and ingests a trace — all in one function:

```typescript
// src/llm/deepseek.ts
export async function generateDeepSeekWithLangfuse(input: GenerateInput): Promise<string> {
  // 1. Fetch prompt from Langfuse — versioned, labeled, cached
  const langfusePrompt = await fetchLangfusePrompt(input.promptName, {
    type: input.promptType,
    label: input.label,              // "production" or "prod-a"/"prod-b"
    cacheTtlSeconds: defaultCacheTtlSeconds(),
    fallback: "You are a helpful assistant.\n\nUser: {{input}}\nAssistant:",
  });

  // 2. Compile with runtime variables
  const compiled = compilePrompt(langfusePrompt, { variables: input.variables });

  // 3. Emit trace-create + observation-create before the call
  const traceId = crypto.randomUUID();
  const generationId = crypto.randomUUID();

  void ingestLangfuseEvents([
    { id: crypto.randomUUID(), type: "trace-create",
      body: { id: traceId, name: "deepseek-generation",
              userId: input.userId, sessionId: input.sessionId } },
    { id: crypto.randomUUID(), type: "observation-create",
      body: { id: generationId, traceId, type: "GENERATION",
              model, input: messages,
              promptName: langfusePrompt.name,
              promptVersion: langfusePrompt.version } },
  ]);

  // 4. Call DeepSeek
  const res = await client.chat.completions.create({ model, messages });
  const output = res.choices?.[0]?.message?.content ?? "";

  // 5. Update observation with output + token usage
  void ingestLangfuseEvents([
    { id: crypto.randomUUID(), type: "observation-update",
      body: { id: generationId, traceId, type: "GENERATION", output,
              endTime: new Date().toISOString(),
              usage: { input: res.usage?.prompt_tokens,
                       output: res.usage?.completion_tokens, unit: "TOKENS" } } },
  ]);

  return output;
}
```

The `promptName` and `promptVersion` fields on the observation link every LLM call back to the exact Langfuse prompt that drove it — enabling per-version accuracy tracking in the dashboard.

### The Classifier: Langfuse Prompt → DeepSeek → D1

One layer up, `src/agents/index.ts` uses `getPrompt` (which wraps `fetchLangfusePrompt` with a Map-based cache and a fallback) to drive the Remote EU classifier:

```typescript
// src/agents/index.ts
export async function classifyJobForRemoteEU(input: {
  title: string;
  location: string;
  description: string;
}) {
  // Fetch "job-classifier" prompt, labeled "production", with hardcoded fallback
  const { text: promptText } = await getPrompt(PROMPTS.JOB_CLASSIFIER);

  const result = await generateObject({
    model: deepseek("deepseek-chat"),
    system: promptText,
    prompt: `Job Title: ${input.title}\nLocation: ${input.location}\nDescription: ${input.description}`,
    schema: z.object({
      isRemoteEU: z.boolean(),
      confidence: z.enum(["high", "medium", "low"]),
      reason: z.string(),
    }),
  });

  return result.object;
}
```

Changing the `job-classifier` prompt in the Langfuse UI takes effect on the next request — no deploy required. Rolling back is equally instant.

### Where BMAD and Agent Teams Enter

The prompt itself — `PROMPTS.JOB_CLASSIFIER` and the fallback text — was written and iterated by a BMAD dev agent constrained by `dev.md`. The workflow:

1. **BMAD quick-spec** describes the change: update the classifier to handle a new edge case
2. **quick-dev** executes: the dev agent reads `src/agents/index.ts` and `src/observability/prompts.ts`, modifies the fallback text and creates a new Langfuse prompt version
3. **Promptfoo eval** (`pnpm eval:promptfoo`) gates the change: the new prompt must hit ≥80% accuracy on the eval dataset before merging
4. **BMAD QA** marks the story done only after the eval passes and the Langfuse label `production` is updated to the new version

```
BMAD quick-spec
      ↓
dev agent (constrained by dev.md) edits src/observability/prompts.ts
      ↓
new prompt version pushed to Langfuse
      ↓
pnpm eval:promptfoo → accuracy gate (≥80%)
      ↓
label "production" promoted → live in classifyJobForRemoteEU
      ↓
BMAD QA checklist → story closed
```

---

## Lessons Learned

**Step-files prevent state loss — and the failure modes prove they're necessary.** `step-01-mode-detection.md` lists as an explicit failure mode: *"Proceeding without capturing baseline commit"* and *"Not setting execution_mode variable."* These aren't hypothetical — they're real ways agents drift when state lives only in a monolithic prompt. The fix is making state explicit and checked at each transition, not hoping the model remembers it.

**The Node.js SDK constraint was the best thing that happened to observability.** The comment at the top of `src/langfuse/index.ts` reads: *"LangfuseClient SDK is Node.js only and not compatible with Edge Runtime. We use direct fetch API calls instead."* Being forced to drop the SDK meant writing 200 lines of direct `fetch` calls — which turned out to be easier to audit, port to Cloudflare Workers, and test than the SDK would have been. The constraint produced a better design.

**Tool restrictions enforce ownership more reliably than documentation.** `SUBAGENT_PRESETS.codeReviewer` has `tools: ["Read", "Glob", "Grep"]`. That's not a convention — it's a hard constraint. The agent is structurally incapable of calling `Edit` or `Write`. Compare this to a code comment saying "this agent should not modify files": one is enforced by the runtime, one is ignored under pressure.

**Spawn prompts are where project conventions become agent constraints.** The dev spawn prompt (`dev.md`) includes: *"D1 returns 0/1 for booleans — handle coercion in resolvers."* That line exists because an agent without it would write `parent.is_remote_eu === true` and get silent bugs when D1 returns `1` instead. The team-roles files are the diff between an agent that knows the project and one that doesn't.

**Self-check steps catch implementation drift before it reaches review.** `step-04-self-check.md` requires marking every task `[x]` complete and verifying each acceptance criterion before proceeding. In practice this step caught a case where Task 2 was complete but the tech-spec still showed `status: ready-for-dev` — a stale status that would have confused any follow-on tooling. Small drift, caught early.

The combination of structured workflows, persistent observability, and role-enforced ownership is what makes AI-assisted development reliable at the level of a production codebase. Any one of the three is useful in isolation. Together, they close the feedback loops that make the system improvable over time.
