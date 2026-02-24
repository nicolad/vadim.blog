---
title: AI-Powered Skill Extraction with Cloudflare Embeddings and a Vector Taxonomy
description: Bulk skill extraction for job descriptions using Cloudflare Workers AI embeddings (384-dim) + Turso/libSQL vector taxonomy retrieval + Mastra workflow structured extraction, with persistence and robust logging.
sidebar_position: 1
slug: /ai-powered-bulk-skill-extraction-cloudflare-embeddings-vector-taxonomy
authors: [nicolad]
image: ./image.png

---

This bulk processor extracts **structured skill tags** for job postings using an AI pipeline that combines:

<!-- truncate -->

- **Embedding generation** via **Cloudflare Workers AI** (`@cf/baai/bge-small-en-v1.5`, **384-dim**)
- **Vector retrieval** over a **skills taxonomy** (Turso/libSQL index `skills_taxonomy`) for candidate narrowing
- **Mastra workflow orchestration** for **LLM-based structured extraction** + validation + persistence
- **Production-grade run controls**: robust logging, progress metrics, graceful shutdown, and per-item failure isolation

It’s designed for real-world runs where you expect rate limits, transient failures, and safe restarts.

---

## Core constraint: embedding dimension ↔ vector index schema

The taxonomy retrieval layer is backed by a Turso/libSQL vector index:

- **Index name:** `skills_taxonomy`
- **Embedding dimension (required):** **384**
- **Embedding model:** `@cf/baai/bge-small-en-v1.5` (**384-dim**)

If the index dimension isn’t **384**, vector search can fail or degrade into meaningless similarity scores.  
The script prevents this by validating `stats.dimension === 384` before processing.

---

## Architecture overview (pipeline flow)

```mermaid
flowchart TD
  A([Start]) --> B[Install signal handlers<br/>SIGINT/SIGTERM]
  B --> C[Initialize logging<br/>console + file tee]
  C --> D[Install fatal handlers<br/>uncaughtException / unhandledRejection]

  D --> E[Verify vector index<br/>skills_taxonomy]
  E --> F{Index healthy?}
  F -->|No: missing / dim != 384 / empty| F1[Fail fast<br/>actionable error] --> Z([Exit])

  F -->|Yes| G[Query jobs for inference<br/>description present<br/>AND no existing tags]
  G --> H{Any jobs?}
  H -->|No| Y([Exit: nothing to process])
  H -->|Yes| I[Iterate jobs sequentially<br/>throughput-friendly]

  I --> J{Stop requested?}
  J -->|Yes| X([Stop after current job])
  J -->|No| K[Idempotency guard:<br/>jobAlreadyHasSkills jobId]
  K --> L{Already tagged?}
  L -->|Yes| L1[Skip + stats.skipped++] --> I
  L -->|No| M[Run Mastra workflow:<br/>extractJobSkillsWorkflow]

  M --> N{Workflow ok?}
  N -->|No| N1[Log step trace + error<br/>stats.failed++] --> I
  N -->|Yes| O[Persist tags via workflow<br/>job_skill_tags<br/>stats.succeeded++<br/>stats.totalSkills += count] --> P[Backoff 1s] --> I

  X --> S[Emit summary + metrics] --> Z
  Y --> S
````

---

## Retrieval + extraction: what happens per job

### 1) Retrieval: taxonomy candidate narrowing (vector search)

- Convert relevant job text to embeddings using Cloudflare Workers AI.
- Use **vector similarity search** in `skills_taxonomy` to retrieve top-N candidate skills.
- Candidates constrain the downstream LLM step (better precision, lower cost).

### 2) Extraction: structured inference via Mastra workflow

A cached Mastra workflow (`extractJobSkillsWorkflow`) performs:

- prompt + schema-driven extraction
- normalization (matching to taxonomy terms/ids)
- validation (reject malformed outputs)
- persistence into `job_skill_tags`

On failure, the script logs workflow status and step details for debugging.

---

## Cloudflare Workers AI embeddings

### Model contract and hardening

- **Model:** `@cf/baai/bge-small-en-v1.5`
- **Vectors:** 384 dimensions
- **Input contract:** strict **array of strings**
- **Timeout:** 45s (`AbortController`)
- **Output contract:** explicit response shape checks (fail early on unexpected payloads)

This is important because embedding pipelines can silently drift if the response shape changes or inputs are malformed.

### Dimension enforcement (non-negotiable)

If `skills_taxonomy` was created/seeded with a different dimension:

- similarity search becomes invalid (best case: errors; worst case: plausible-but-wrong matches)

The script enforces `stats.dimension === 384` to keep retrieval semantically meaningful.

---

## Turso/libSQL vector taxonomy index

- **Storage:** Turso (libSQL)
- **Index:** `skills_taxonomy`
- **Schema dimension:** 384
- **Role:** retrieval layer for skills ontology/taxonomy

The script also ensures the index is **populated** (`count > 0`), otherwise it fails fast and directs you to seed.

---

## Reliability and operational controls

### Observability: console + file tee logs

- tees `console.log/warn/error` to a timestamped file and the terminal
- log naming: `extract-job-skills-<ISO timestamp>-<pid>.log`
- degrades to console-only logging if file IO fails

### Graceful termination

- `SIGINT` / `SIGTERM` sets a `shouldStop` flag
- the loop exits **after** the current job completes
- avoids interrupting in-flight workflow steps (embedding/LLM/DB writes)

### Idempotency / restart safety

Even after selecting jobs without tags, the script re-checks:

- `jobAlreadyHasSkills(jobId)`

This avoids duplicate inference when:

- you restart mid-run
- multiple workers run concurrently
- the initial query snapshot becomes stale

### Throughput shaping

- sequential processing
- a fixed **1s backoff** between jobs (simple, reliable rate-limit mitigation)

---

## Failure modes

### Retrieval layer failures (index health)

**Triggers:**

- index missing
- dimension mismatch (not 384)
- empty index (`count === 0`)

**Behavior:** fail fast with actionable logs (recreate index / re-seed / verify DB target).

### Embedding timeouts

**Symptom:** embedding call exceeds 45s and aborts.
**Behavior:** job fails; run continues.

**Mitigations:**

- chunk long descriptions upstream
- add retry/backoff on transient 429/5xx
- monitor Workers AI service health

### Workflow failures

**Behavior:** job is marked failed; run continues.
Logs include step trace and error payload to accelerate debugging.

---

## Quick reference

- Embeddings: Cloudflare Workers AI `@cf/baai/bge-small-en-v1.5` (**384-dim**)
- Retrieval: Turso/libSQL vector index `skills_taxonomy` (**384-dim**)
- Orchestration: Mastra workflow `extractJobSkillsWorkflow`
- Persistence: `job_skill_tags`
- Embedding timeout: 45s
- Stop behavior: graceful after current job (`SIGINT` / `SIGTERM`)
