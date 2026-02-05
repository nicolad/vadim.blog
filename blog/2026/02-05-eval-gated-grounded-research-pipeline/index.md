---
title: Schema-First RAG with Eval-Gated Grounding and Claim-Card Provenance
description: Top-down architecture for multi-source research retrieval, schema-validated extraction, eval-gated grounding, and auditable claim artifacts
slug: /researchthera/research-architecture
sidebar_position: 1
authors: [nicolad]
tags: [mastra, agents, workflows, rag, evals, grounding, zod, libsql, turso, provenance, claim-cards]
---

This article documents a production-grade architecture for generating **research-grounded therapeutic content**. The system prioritizes **verifiable artifacts** (papers → structured extracts → scored outputs → claim cards) over unstructured text.

You can treat this as a “trust pipeline”:
**retrieve → normalize → extract → score → repair → persist → generate**.
<!--truncate-->
---

## System map

```mermaid
flowchart TD
  %% Client Layer
  U[User / Client App]
  
  U --> API[App Backend]
  API --> MC[Mastra Client]
  MC --> MS[Mastra Server]
  
  %% Content Sources
  NOTES[Notes Site]
  REPO[Reference Repo]
  
  NOTES --> MS
  REPO --> MS
  
  %% Mastra Runtime
  MS --> AG[Content Agent]
  MS --> WF[Research Workflow]
  
  %% Research Sources
  WF --> SRC_GROUP[Research Sources]
  SRC_GROUP --> CR[Crossref]
  SRC_GROUP --> PM[PubMed]
  SRC_GROUP --> SS[Semantic Scholar]
  SRC_GROUP --> OA[OpenAlex]
  SRC_GROUP --> AX[arXiv]
  SRC_GROUP --> EPC[Europe PMC]
  SRC_GROUP --> UP[Unpaywall]
  
  %% LLM & Evaluation
  WF --> LLM[LLM Provider]
  WF --> EVALS[Scorers / Evals]
  AG --> LLM
  
  %% Storage
  WF --> DB[LibSQL Store]
  WF --> VEC[Vector Store]
  AG --> DB
  AG --> VEC
  
  classDef external fill:#2d2d2d,stroke:#888,stroke-width:2px,stroke-dasharray: 5 5,color:#fff
  classDef storage fill:#1a3a52,stroke:#4da6ff,stroke-width:2px,color:#fff
  classDef core fill:#3d2817,stroke:#ff9800,stroke-width:2px,color:#fff
  
  class CR,PM,SS,OA,AX,EPC,UP,LLM,EVALS,NOTES,REPO external
  class DB,VEC storage
  class MS,AG,WF,SRC_GROUP core
```

**Core idea:** Mastra coordinates *agents* and *workflows*. The workflow produces **validated research artifacts**. The agent generates content from **those artifacts**, not from raw model guesses.

---

## Top-down runtime flows

### A) Research artifact production

**Flow:** App → Research Workflow → Sources → LLM → Eval Gates → Storage

**Steps:**

1. **Search & Retrieve** - Query multiple research sources in parallel
2. **Normalize** - Deduplicate and fetch full details
3. **Extract** - LLM generates structured data via schema
4. **Score** - Eval gates check faithfulness and grounding
5. **Repair** - If score fails, repair with feedback and re-score
6. **Persist** - Save validated artifacts with eval traces

```mermaid
sequenceDiagram
  autonumber
  participant App
  participant WF as Research Workflow
  participant SRC as Research Sources
  participant LLM as LLM
  participant EV as Evals/Scorers
  participant DB as LibSQL Store
  participant VEC as Vector Store

  App->>WF: execute(userId, goalId, inputs)
  WF->>SRC: search (parallel)
  SRC-->>WF: candidates
  WF->>WF: normalize + dedupe
  WF->>SRC: fetch details (abstract/meta)
  SRC-->>WF: paper details

  WF->>LLM: extract structured research (schema)
  LLM-->>WF: extracted object

  WF->>EV: score faithfulness/hallucination/grounding
  EV-->>WF: score + reason

  alt score < threshold
    WF->>LLM: repair extraction using scorer feedback
    LLM-->>WF: repaired object
    WF->>EV: re-score grounding
    EV-->>WF: updated score + reason
  end

  WF->>DB: persist artifacts + eval traces
  WF->>VEC: index artifacts (retrieval-ready)
  WF-->>App: result (count, artifact ids)
```

### B) Content generation from validated artifacts

```mermaid
sequenceDiagram
  autonumber
  participant User
  participant App
  participant Agent as Content Agent
  participant DB as LibSQL Store
  participant VEC as Vector Store
  participant LLM as LLM

  User->>App: ask for guidance
  App->>Agent: generate(prompt, sessionId, goalId)

  Agent->>DB: load session + goal context
  Agent->>VEC: retrieve validated research artifacts
  VEC-->>Agent: topK artifacts (scored + versioned)

  Agent->>LLM: generate response grounded in artifacts
  LLM-->>Agent: draft output

  Agent->>DB: persist output + provenance map
  Agent-->>App: response + provenance
```

**Guarantees:**

* The agent retrieves **only accepted artifacts** (passed gates).
* Every output can attach provenance: `artifact_ids_used[]`, `scorer_versions`, `model_id`, `timestamp`.

---

## Architecture layers

```mermaid
flowchart TD
  %% Client Layer
  UI[UI / App]
  MC[MastraClient]
  
  UI --> MC
  
  %% Orchestration Layer
  MS[Mastra Server]
  AG[Agents]
  WF[Workflows]
  
  MC --> MS
  MS --> AG
  MS --> WF
  
  %% Research + Validation Layer
  SRC[Source Tools<br/>search/fetch/normalize]
  SCHEMA[Schema Contracts<br/>Zod]
  EXT[Extractor Tools<br/>schema-first]
  EVALS[Scorers<br/>faithfulness/hallucination/grounding]
  CC[Claim Cards<br/>audit trail]
  
  WF --> SRC
  WF --> EXT
  WF --> EVALS
  WF --> CC
  SCHEMA --> EXT
  SCHEMA --> CC
  
  %% Data Layer
  DB[(LibSQL Store<br/>artifacts + traces)]
  VEC[(Vector Store<br/>retrieval indexes)]
  
  AG --> DB
  AG --> VEC
  WF --> DB
  WF --> VEC
  
  %% External Systems
  APIS[Research APIs]
  LLM[LLM Provider]
  
  SRC --> APIS
  EXT --> LLM
  EVALS --> LLM
  CC --> LLM
  
  %% Styling
  classDef client fill:#1a1a2e,stroke:#4da6ff,stroke-width:2px,color:#fff
  classDef orchestration fill:#16213e,stroke:#ff9800,stroke-width:2px,color:#fff
  classDef research fill:#0f3460,stroke:#00d9ff,stroke-width:2px,color:#fff
  classDef data fill:#533483,stroke:#9d4edd,stroke-width:2px,color:#fff
  classDef external fill:#2d2d2d,stroke:#888,stroke-width:2px,stroke-dasharray: 5 5,color:#fff
  
  class UI,MC client
  class MS,AG,WF orchestration
  class SRC,SCHEMA,EXT,EVALS,CC research
  class DB,VEC data
  class APIS,LLM external
```

---

## Why this pipeline works

### 1) Schema-first extraction creates controllable artifacts

You treat every extraction as a typed object with invariants:

* bounded arrays (`keyFindings` length constraints)
* numeric ranges (`relevanceScore`, `extractionConfidence`)
* explicit nullability for missing fields

This prevents “string soup” from leaking into persistence and makes evals deterministic.

```mermaid
flowchart LR
  Paper[Paper details + abstract] --> LLM[Extract to JSON]
  LLM --> Z[Schema validation]
  Z -->|valid| Artifact[Research Artifact vN]
  Z -->|invalid| Retry[Fix prompt / repair]
```

### 2) Multi-source + dedupe optimizes coverage and spend

Retrieval stays cheap; judgment stays expensive. So you:

1. search multiple sources
2. normalize identity (DOI/title fingerprint)
3. dedupe
4. only then pay tokens for extraction + scoring

```mermaid
flowchart TD
  Q[Query] --> S1[Search A]
  Q --> S2[Search B]
  Q --> S3[Search C]
  S1 --> C[Candidates]
  S2 --> C
  S3 --> C
  C --> N[Normalize IDs]
  N --> D[Dedupe]
  D --> TopK[Select TopK]
  TopK --> X[Extract + Score]
```

### 3) Eval gates + single repair pass keep trust high

You treat extraction as an untrusted build artifact:

* run tests (scorers)
* if failing: run a single repair step with feedback
* re-test
* persist only on pass

```mermaid
flowchart LR
  Extract[Extract] --> Score[Score]
  Score -->|pass| Persist[Persist]
  Score -->|fail| Repair[Repair]
  Repair --> ReScore[Re-score]
  ReScore -->|pass| Persist
  ReScore -->|fail| Drop[Drop candidate]
```

---

## Claim cards: auditable statement-level evidence

Claim cards attach evidence to atomic claims and preserve provenance.

```mermaid
sequenceDiagram
  autonumber
  participant Output as Generated Output
  participant CC as Claim Cards
  participant SRC as Sources
  participant LLM as LLM
  participant DB as Storage

  Output->>CC: extract atomic claims
  CC->>LLM: propose claim list (schema)
  LLM-->>CC: claims[]

  loop each claim
    CC->>SRC: retrieve evidence candidates
    SRC-->>CC: candidates (deduped)
    CC->>SRC: fetch details (abstract/meta)
    SRC-->>CC: evidence set
    CC->>LLM: judge polarity + strength
    LLM-->>CC: polarity + score + rationale
  end

  CC->>CC: aggregate verdict + confidence
  CC->>DB: persist claim cards + provenance
```

**Operational outcome:** you can enforce product rules like:

* “insufficient evidence” → soften language + add uncertainty label
* “contradicted/mixed” → present tradeoffs or avoid recommendation

---

## Notes ingestion as first-class input

The system can treat a curated note (example: “state-of-remote-work”) as:

* an input context object (goal framing, assumptions, topic scope)
* a retrieval seed (keywords for paper search)
* an artifact to index for later retrieval

```mermaid
flowchart TD
  Note[Note: state-of-remote-work] --> Parse[Parse + normalize]
  Parse --> Tag[Tag concepts + entities]
  Tag --> Seed[Seed queries]
  Seed --> WF[Research Workflow]
  Parse --> VEC[Index note embedding]
  WF --> DB[Persist research artifacts]
  DB --> VEC[Index artifacts]
```

---

## Reference implementation

Use the “research-thera” repository as the canonical layout for:

* app runtime (client + server boundaries)
* persistence (LibSQL/Turso + migrations)
* research pipeline wiring (workflow steps + tools)
* artifact schema + eval traces + indexing strategy

The repo structure usually exposes these responsibilities clearly:

* `app/` and `src/` for runtime surfaces
* `schema/` and migrations tooling for storage contracts
* `scripts/` for ingestion/backfills
* cached HTTP responses for repeatable research runs (when enabled)

---

## URLs

* [https://researchthera.com/notes/state-of-remote-work](https://researchthera.com/notes/state-of-remote-work)
* [https://github.com/nicolad/research-thera](https://github.com/nicolad/research-thera)
