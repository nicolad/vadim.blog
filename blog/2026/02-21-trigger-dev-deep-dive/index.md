---
title: "Trigger.dev Deep Dive: Background Jobs, Queue Fan-Out, MCP, and Agent Skills"
description: "A comprehensive guide to Trigger.dev — serverless background task infrastructure with durable execution, queue concurrency control, MCP integration, AI agent skills, and a real-world TTS fan-out pipeline case study."
slug: trigger-dev-deep-dive
authors: [nicolad]
tags: [trigger.dev, background-jobs, queues, mcp, ai-agents, tts, next.js]
---

# Trigger.dev Deep Dive: Background Jobs, Queue Fan-Out, MCP, and Agent Skills

Trigger.dev is a serverless background job platform that lets you run long-running tasks with **no timeouts**, automatic retries, queue-based concurrency control, and full observability. Unlike traditional job queues (BullMQ, Celery, Sidekiq), Trigger.dev manages the infrastructure — you write TypeScript tasks and deploy them like functions.

This article covers the platform end-to-end: architecture, task authoring, the queue fan-out pattern, MCP server integration for AI assistants, agent skills/rules, and a production case study of a TTS audio pipeline.

<!--truncate-->

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Getting Started](#getting-started)
- [Writing Tasks](#writing-tasks)
- [Triggering Tasks](#triggering-tasks)
- [Queues and Concurrency](#queues-and-concurrency)
- [The Fan-Out Pattern with batchTriggerAndWait](#the-fan-out-pattern-with-batchtriggerandwait)
- [Error Handling and Retries](#error-handling-and-retries)
- [Waits and Checkpointing](#waits-and-checkpointing)
- [Configuration — trigger.config.ts](#configuration--triggerconfigts)
- [MCP Server — AI Assistant Integration](#mcp-server--ai-assistant-integration)
- [Agent Skills and Rules](#agent-skills-and-rules)
- [Claude Agent SDK Integration](#claude-agent-sdk-integration)
- [Case Study: TTS Audio Pipeline](#case-study-tts-audio-pipeline)
- [Deployment](#deployment)
- [Common Mistakes](#common-mistakes)

---

## Architecture Overview

Trigger.dev implements a serverless architecture without timeouts:

```
Your App ──trigger──▶ Trigger.dev Platform ──▶ Task Worker (isolated)
         ◀─handle───                        ◀── Task completed
```

When you run `npx trigger.dev@latest deploy`, your task code is built and deployed to Trigger.dev's infrastructure. When you trigger a task from your application, it runs in a secure, isolated environment with the resources needed to complete it.

Key architectural properties:

- **No timeouts** — tasks can run for hours (configurable via `maxDuration`)
- **Durable execution** — tasks survive restarts and infrastructure failures
- **Automatic checkpointing** — when a task waits, execution is suspended and doesn't consume compute
- **Queue-based scheduling** — every task gets a queue; concurrency is configurable
- **Full observability** — logs, traces, and run history in the dashboard

## Getting Started

### Installation

```bash
npm install @trigger.dev/sdk
# or
pnpm add @trigger.dev/sdk
```

### Project Configuration

Create a `trigger.config.ts` at your project root:

```ts
import { defineConfig } from "@trigger.dev/sdk/build";

export default defineConfig({
  project: "<your-project-ref>",   // e.g., "proj_abc123"
  dirs: ["./src/trigger"],          // where your task files live
  maxDuration: 300,                 // default max duration in seconds
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 30_000,
      factor: 2,
      randomize: true,
    },
  },
});
```

### Development

```bash
npx trigger.dev@latest dev   # starts the dev server, watches for task changes
```

## Writing Tasks

Tasks are the core primitive. Every task must be a **named export** using the `task()` function:

```ts
import { task } from "@trigger.dev/sdk";

export const myTask = task({
  id: "my-task",               // unique identifier
  maxDuration: 120,            // override global maxDuration (seconds)
  retry: {
    maxAttempts: 3,
    factor: 1.8,
    minTimeoutInMs: 500,
    maxTimeoutInMs: 30_000,
  },
  run: async (payload: { url: string }) => {
    // Your long-running logic here
    return { success: true };
  },
});
```

### Schema Validation with Zod

For type-safe payloads with runtime validation, use `schemaTask`:

```ts
import { schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";

export const processVideo = schemaTask({
  id: "process-video",
  schema: z.object({
    videoUrl: z.string().url(),
    format: z.enum(["mp4", "webm"]).default("mp4"),
  }),
  run: async (payload) => {
    // payload is typed AND validated at runtime
  },
});
```

### Lifecycle Hooks

Tasks support `onFailure` for cleanup when all retries are exhausted:

```ts
export const riskyTask = task({
  id: "risky-task",
  onFailure: async ({ payload, error }) => {
    // Update database, send alerts, clean up resources
    await db.markJobFailed(payload.jobId, error.message);
  },
  run: async (payload) => {
    // ...
  },
});
```

## Triggering Tasks

### From Your Backend (fire-and-forget)

```ts
import { tasks } from "@trigger.dev/sdk";
import type { myTask } from "./trigger/my-task";

// Fire and forget — returns a run handle immediately
const handle = await tasks.trigger<typeof myTask>("my-task", {
  url: "https://example.com",
});
```

### From Inside Other Tasks

```ts
export const parentTask = task({
  id: "parent-task",
  run: async (payload) => {
    // Fire and forget
    await childTask.trigger({ data: "value" });

    // Wait for result — returns a Result object
    const result = await childTask.triggerAndWait({ data: "value" });
    if (result.ok) {
      console.log(result.output); // the actual return value
    }

    // Or use .unwrap() to get output directly (throws on failure)
    const output = await childTask.triggerAndWait({ data: "value" }).unwrap();
  },
});
```

### Batch Triggering

```ts
// From backend
const batchHandle = await tasks.batchTrigger<typeof myTask>("my-task", [
  { payload: { url: "https://example.com/1" } },
  { payload: { url: "https://example.com/2" } },
]);
```

## Queues and Concurrency

When you trigger a task, it enters a queue. By default each task gets its own queue, limited only by your environment concurrency. For fine-grained control, define custom queues:

```ts
import { task, queue } from "@trigger.dev/sdk";

const apiQueue = queue({
  name: "openai-calls",
  concurrencyLimit: 5,  // max 5 parallel runs in this queue
});

export const callOpenAI = task({
  id: "call-openai",
  queue: apiQueue,
  run: async (payload) => {
    // At most 5 instances run concurrently
  },
});
```

Only **actively executing** runs count toward concurrency. Delayed or waiting runs don't consume slots.

You can also override the queue at trigger time for priority routing:

```ts
const handle = await myTask.trigger(data, {
  queue: {
    name: "high-priority",
    concurrencyLimit: 20,
  },
});
```

## The Fan-Out Pattern with batchTriggerAndWait

The fan-out pattern is Trigger.dev's answer to parallel processing: an orchestrator task spawns N child tasks, waits for all to complete, then aggregates results.

```
Orchestrator Task
  ├── batchTriggerAndWait([...payloads])
  │     ├── Child Task 1  ─▶  Result 1
  │     ├── Child Task 2  ─▶  Result 2
  │     └── Child Task N  ─▶  Result N
  └── Aggregate results
```

```ts
export const orchestrator = task({
  id: "orchestrator",
  run: async (payload: { items: string[] }) => {
    const results = await childTask.batchTriggerAndWait(
      payload.items.map((item) => ({ payload: { item } })),
    );

    // Inspect individual results
    const succeeded = results.runs.filter((r) => r.ok);
    const failed = results.runs.filter((r) => !r.ok);

    if (failed.length > 0) {
      throw new Error(`${failed.length} items failed`);
    }

    return succeeded.map((r) => r.output);
  },
});
```

Key behaviors:

- The parent task is **checkpointed** while waiting — no compute charge during the wait
- Child concurrency is controlled by the child task's queue
- Each child run's result is individually inspectable (`ok`, `output`, `error`)

> **Important**: Never wrap `triggerAndWait` or `batchTriggerAndWait` in `Promise.all` — parallel waits are not supported. Use the built-in batch functions instead.

## Error Handling and Retries

### Task-Level Retries

Configured per-task or globally in `trigger.config.ts`:

```ts
export const resilientTask = task({
  id: "resilient-task",
  retry: { maxAttempts: 5 },
  run: async (payload) => {
    // Throwing triggers a retry (up to maxAttempts)
  },
});
```

### Aborting Retries

For permanent errors that shouldn't be retried:

```ts
import { AbortTaskRunError } from "@trigger.dev/sdk";

throw new AbortTaskRunError("Invalid payload, will not retry");
```

### Scoped Retries

Retry a specific block within a task without restarting the whole run:

```ts
import { retry } from "@trigger.dev/sdk";

const data = await retry.onThrow(
  async () => await fetchExternalApi(payload),
  { maxAttempts: 3 },
);
```

## Waits and Checkpointing

Trigger.dev automatically suspends (checkpoints) tasks during waits, so you don't pay for idle time:

```ts
import { wait } from "@trigger.dev/sdk";

// Wait for a duration
await wait.for({ seconds: 30 });
await wait.for({ hours: 1 });

// Wait until a specific date
await wait.until({ date: new Date("2025-06-01") });

// Wait for an external callback (human-in-the-loop)
await wait.forToken({ id: "approval-token", timeout: "24h" });
```

When a wait exceeds ~5 seconds, the task worker is suspended and resumed when the wait completes. This is fundamental to how Trigger.dev achieves long-running tasks without burning compute.

## Configuration — trigger.config.ts

The configuration file at your project root controls build, runtime, and retry behavior:

```ts
import { defineConfig } from "@trigger.dev/sdk/build";

export default defineConfig({
  project: "proj_gmqcwyqsqcnkjnlqcmxf",
  dirs: ["./src/trigger"],
  maxDuration: 300,

  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 30_000,
      factor: 2,
      randomize: true,
    },
  },

  // Build extensions (optional)
  build: {
    extensions: [],
    external: ["some-native-module"], // exclude from bundling
  },

  // Machine size for deployed tasks
  machine: "small-2x",
});
```

Key options:

- **`dirs`** — directories containing task files (auto-discovered)
- **`maxDuration`** — global max compute time per task (seconds). Minimum is 5s
- **`retries`** — global retry defaults; individual tasks can override
- **`build.external`** — packages to exclude from the bundle (useful for native deps)
- **`machine`** — compute size (`micro`, `small-1x`, `small-2x`, `medium-1x`, `medium-2x`, `large-1x`, `large-2x`)

## MCP Server — AI Assistant Integration

Trigger.dev provides an **MCP (Model Context Protocol) Server** that lets AI assistants interact directly with your projects. This is one of the most powerful integrations — it turns your AI coding assistant into a Trigger.dev operator.

### What the MCP Server Can Do

| Tool | Description |
|------|-------------|
| `search_docs` | Search Trigger.dev documentation |
| `list_orgs` / `list_projects` | Browse your organizations and projects |
| `get_current_worker` | Get task definitions, payload schemas, latest versions |
| `trigger_task` | Trigger a task run with a payload |
| `list_runs` / `get_run_details` | Search and inspect run history |
| `wait_for_run_to_complete` | Poll a run until it finishes |
| `cancel_run` | Cancel a running task |
| `deploy` | Deploy your project to staging/prod |
| `list_deploys` | View deployment history |
| `initialize_project` | Set up Trigger.dev in a new project |

### Installation for Claude Code

```bash
npx trigger.dev@latest install-mcp --client claude-code
```

Or add manually to `~/.claude.json` or `.mcp.json`:

```json
{
  "mcpServers": {
    "trigger": {
      "command": "npx",
      "args": ["trigger.dev@latest", "mcp"]
    }
  }
}
```

### Installation for Other Clients

| Client | Command |
|--------|---------|
| Cursor | `npx trigger.dev@latest install-mcp --client cursor` |
| Windsurf | `npx trigger.dev@latest install-mcp --client windsurf` |
| VS Code Copilot | `npx trigger.dev@latest install-mcp --client vscode` |

### Real-World MCP Usage

With the MCP server active, you can ask your AI assistant things like:

- *"Deploy my project to staging"* — the assistant calls the `deploy` tool
- *"What tasks are defined in my project?"* — calls `get_current_worker`
- *"Trigger the tts-generate-audio task with this payload"* — calls `trigger_task`
- *"Show me the last 10 failed runs"* — calls `list_runs` with status filter
- *"What happened in run_abc123?"* — calls `get_run_details` with full trace

The MCP server bridges the gap between coding and operations — your AI assistant can write tasks, deploy them, trigger them, and debug failures without leaving the editor.

## Agent Skills and Rules

Trigger.dev provides **three layers** of AI assistance. The MCP server is the live operational layer. Skills and Rules are the knowledge layer.

### Skills

Skills are portable instruction sets (markdown files) that teach AI assistants Trigger.dev patterns:

```bash
npx skills add trigger.dev
```

This installs a `.claude/skills/` (or `.cursor/skills/`) directory with `SKILL.md` files containing patterns, examples, and best practices. Skills work across all major AI assistants (Claude Code, Cursor, Windsurf, Copilot, Cline, Codex CLI, etc.).

### Agent Rules

Comprehensive rule sets installed into your AI client's config:

```bash
npx trigger.dev@latest install-rules
```

This creates rule files (in `CLAUDE.md`, `.cursor/rules/`, etc.) with:

- Correct import patterns (`@trigger.dev/sdk`, never `@trigger.dev/sdk/v3` in v4)
- Task definition templates
- Triggering patterns (backend vs. inside tasks)
- Error handling with `AbortTaskRunError` and `retry.onThrow`
- Common mistakes to avoid

### Comparison

| Feature | Skills | Agent Rules | MCP Server |
|---------|--------|-------------|------------|
| What it does | Drops skill files into your project | Installs rule sets into client config | Runs a live server your AI connects to |
| Installs to | `.claude/skills/`, `.cursor/skills/` | `CLAUDE.md`, `.cursor/rules/` | `mcp.json`, `~/.claude.json` |
| Updates | Re-run `npx skills add` | Re-run install or auto-prompted | Always latest (`@latest`) |
| Best for | Teaching patterns | Comprehensive code generation | Live project interaction |
| Works offline | Yes | Yes | No (calls Trigger.dev API) |

**Recommendation**: Install all three. Skills and rules teach your AI how to write code. The MCP server lets it operate your project.

## Claude Agent SDK Integration

Trigger.dev pairs exceptionally well with the **Claude Agent SDK** for building AI agents that need durable execution. The Claude Agent SDK provides the same tools (file read, code edit, bash execution) that power Claude Code, and Trigger.dev provides the infrastructure.

### Example: Changelog Generator

```ts
import { task } from "@trigger.dev/sdk";
import { Claude } from "@anthropic-ai/claude-agent-sdk";

export const generateChangelog = task({
  id: "generate-changelog",
  maxDuration: 300,
  machine: "small-2x",
  run: async (payload: { repo: string; since: string }) => {
    const claude = new Claude();
    // Agent explores git commits, fetches diffs, generates changelog
    const result = await claude.run({
      prompt: `Generate a changelog for ${payload.repo} since ${payload.since}`,
      tools: ["bash", "read", "grep"],
    });
    return result;
  },
});
```

Build configuration requires marking the SDK as external:

```ts
// trigger.config.ts
export default defineConfig({
  build: {
    external: ["@anthropic-ai/claude-agent-sdk"],
  },
  machine: "medium-2x",
});
```

### Example Projects

- **Claude Changelog Generator** — generates changelogs from git commit history with custom MCP tools
- **Claude GitHub Wiki Agent** — analyzes repositories and answers questions with real-time streaming
- **Smart Spreadsheet** — enriches company data using Exa search and Claude with parallel `batch.triggerByTaskAndWait`

## Case Study: TTS Audio Pipeline

Here's a production implementation from a therapeutic content platform that uses Trigger.dev to convert long-form text to audio via OpenAI's TTS API.

### The Problem

- OpenAI TTS has a 4,096 character limit per API call
- Long therapeutic narratives can be 10,000+ characters
- Each API call takes 5-15 seconds
- Sequential processing is too slow for good UX
- Need rate limiting to avoid OpenAI 429 errors
- Audio chunks must be merged seamlessly (MP3 ID3 headers)

### The Solution: Queue Fan-Out

```
GraphQL Mutation (generateOpenAIAudio)
  │
  ├─▶ Create D1 job record (RUNNING)
  ├─▶ tasks.trigger("tts-generate-audio", payload)
  └─▶ Return jobId immediately (client polls)

ttsTask (orchestrator, maxDuration: 300s)
  ├─▶ chunkText(text, 4000 chars)
  ├─▶ batchTriggerAndWait([chunk1, chunk2, ...chunkN])
  │     ├── ttsChunkTask (queue: concurrency=5, maxDuration: 120s)
  │     │     ├─▶ OpenAI TTS API call
  │     │     └─▶ Upload chunk to R2
  │     ├── ttsChunkTask ...
  │     └── ttsChunkTask ...
  ├─▶ Download all chunks from R2
  ├─▶ Merge audio (strip ID3v2 headers from chunks 2-N)
  ├─▶ Upload final audio to R2
  ├─▶ Clean up temp chunk files
  ├─▶ Update D1: story.audio_url + job status
  └─▶ Return { audioUrl, key, sizeBytes }
```

### Queue Definition

```ts
export const ttsChunkQueue = queue({
  name: "tts-chunks",
  concurrencyLimit: 5,  // max 5 parallel OpenAI calls
});
```

This single line prevents rate limiting. Even if a user submits a 20,000-character text (5+ chunks), at most 5 OpenAI calls happen simultaneously.

### Chunk Task

Each chunk task makes one OpenAI API call and stores the result in R2:

```ts
export const ttsChunkTask = task({
  id: "tts-chunk",
  queue: ttsChunkQueue,
  maxDuration: 120,
  retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 1_000, maxTimeoutInMs: 15_000 },
  run: async (payload: ChunkPayload) => {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const resp = await openai.audio.speech.create({ /* ... */ });
    const buf = Buffer.from(await resp.arrayBuffer());
    await uploadToR2({ key: payload.tempKey, body: buf });
    return { tempKey: payload.tempKey, sizeBytes: buf.length };
  },
});
```

### Orchestrator Task

The orchestrator chunks the text, fans out, merges, and cleans up:

```ts
export const ttsTask = task({
  id: "tts-generate-audio",
  maxDuration: 300,
  onFailure: async ({ payload, error }) => {
    if (payload.jobId) {
      await updateJob(payload.jobId, "FAILED", { error: error.message });
    }
  },
  run: async (payload: TTSPayload) => {
    const chunks = chunkText(payload.text);

    // Fan-out: all chunks run in parallel, capped by queue
    const results = await ttsChunkTask.batchTriggerAndWait(
      chunks.map((chunk, i) => ({
        payload: { chunk, index: i, tempKey: `tts-chunks/${batchId}-${i}.mp3`, /* ... */ },
      })),
    );

    // Check for failures
    const failed = results.runs.filter((r) => !r.ok);
    if (failed.length > 0) throw new Error(`${failed.length} chunk(s) failed`);

    // Download, merge, upload final, clean up
    const buffers = await Promise.all(chunkPayloads.map((p) => downloadFromR2(p.tempKey)));
    const combined = mergeAudioChunks(buffers, "mp3");
    const { publicUrl } = await uploadToR2({ key, body: combined });
    await Promise.all(chunkPayloads.map((p) => deleteFromR2(p.tempKey)));

    // Update database
    await updateJob(payload.jobId, "SUCCEEDED", { result: { audioUrl: publicUrl } });
    return { audioUrl: publicUrl, sizeBytes: combined.length };
  },
});
```

### GraphQL Integration

The resolver creates a job record, dispatches the task, and returns immediately:

```ts
// schema/resolvers/Mutation/generateOpenAIAudio.ts
const handle = await tasks.trigger("tts-generate-audio", ttsPayload);
return { success: true, jobId, message: "Audio generation started" };
```

The client polls `generationJob(id)` until `status === "SUCCEEDED"`, then reads `result.audioUrl`.

### Stale Job Detection

A practical concern: `MAX_DURATION_EXCEEDED` doesn't always fire `onFailure`. The resolver checks for RUNNING jobs older than 10 minutes and marks them FAILED before creating a new one:

```ts
if (ageMs < 10 * 60 * 1000) {
  return { success: true, message: "Already in progress", jobId: existingJobId };
}
// Stale — mark FAILED and proceed
await d1.execute({ sql: `UPDATE generation_jobs SET status = 'FAILED' WHERE id = ?` });
```

## Deployment

### Deploy to Production

```bash
npx trigger.dev@latest deploy
```

Or via the MCP server from your AI assistant:

```
"Deploy my project to production"
→ MCP: deploy({ environment: "prod" })
```

### Environments

Trigger.dev supports multiple environments:

- **dev** — local development with `trigger.dev dev`
- **staging** — pre-production testing
- **prod** — production
- **preview** — branch-based preview environments

## Common Mistakes

1. **Forgetting to export tasks** — every task must be a named export
2. **Importing from `@trigger.dev/sdk/v3`** — this is the old v3 path; use `@trigger.dev/sdk` in v4
3. **Using `client.defineJob()`** — deprecated v2 API
4. **Using `triggerAndWait` result as output** — it returns a `Result` object; check `result.ok` then access `result.output`, or use `.unwrap()`
5. **Wrapping waits in `Promise.all`** — parallel waits are not supported; use built-in batch functions
6. **Not handling `onFailure`** — when `maxDuration` is exceeded, your database may be left in an inconsistent state
7. **Forgetting `await` on trigger calls** — without `await`, the task may not be triggered before the process exits

---

## Summary

Trigger.dev solves the "background job infrastructure" problem for TypeScript applications:

| Problem | Trigger.dev Solution |
|---------|---------------------|
| Long-running tasks timeout | No timeouts, configurable `maxDuration` |
| Rate limiting external APIs | Queue concurrency limits |
| Parallel processing | `batchTriggerAndWait` fan-out |
| Failure recovery | Automatic retries with exponential backoff |
| Monitoring | Dashboard with full run traces |
| AI-assisted development | MCP server + Skills + Agent Rules |
| Deployment complexity | `npx trigger.dev deploy` — no infra to manage |

The combination of durable execution, queue-based concurrency, and first-class AI tooling makes Trigger.dev a compelling choice for any TypeScript application that needs reliable background processing.
