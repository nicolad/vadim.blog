---
title: AI Observability for LLM Evals with Langfuse
description: A deep dive into end-to-end AI observability for batch evaluation—traces, spans, prompt versions, structured outputs, scoring, and debugging workflows.
sidebar_position: 1
slug: /ai-observability-llm-evals-langfuse
authors: [nicolad]
image: ./image.png
tags:

- ai-observability
- evals
- langfuse
- tracing
- llm
- deepseek
- mastra
- zod
- typescript

---

# AI Observability for LLM Evals with Langfuse

## Prompt Governance Flow

```mermaid
sequenceDiagram
  participant Runner as Evaluation Runner
  participant LF as Langfuse Prompts
  participant Local as Local fallback

  Runner->>LF: getPrompt("job-classifier", label="production")
  alt Prompt found
    LF-->>Runner: promptText + metadata (version/hash if available)
  else Not found or skip enabled
    Runner->>Local: get local prompt text
    Local-->>Runner: promptText
  end
```

## Structured Output Schema

```mermaid
classDiagram
  class RemoteEUClassification {
    +boolean isRemoteEU
    +Confidence confidence
    +string reason
  }

  class Confidence {
    <<enumeration>>
    high
    medium
    low
  }

  RemoteEUClassification --> Confidence
```

## Trace Model

```mermaid
flowchart TD
  T[Trace: remote-eu-classification] --> G[Generation: classify-job]
  G --> IN[Input<br/>prompt + job posting]
  G --> OUT[Output<br/>RemoteEUClassification]
  G --> U[Usage<br/>prompt/completion/total tokens]
  T --> S1[Score: remote-eu-accuracy]
  T --> S2[Score: confidence-match]
  T --> META[Metadata<br/>testCaseId, sessionId, prompt version, model]
```

## Scoring Flow

```mermaid
sequenceDiagram
  participant Case as Test Case
  participant LF as Langfuse
  participant LLM as Model Output
  participant Sc as Scorer

  Case->>LLM: produce {isRemoteEU, confidence, reason}
  Case->>Sc: score(expected, actual, jobPosting)
  Sc-->>Case: score + metadata (isCorrect, confidenceMatch)
  Case->>LF: trace.score("remote-eu-accuracy", value, comment)
  Case->>LF: trace.score("confidence-match", value, comment)
```

## Batch Evaluation Flow

```mermaid
flowchart LR
  A[Start] --> B[Get prompt]
  B --> C[Loop test cases]
  C --> D[Trace + Generation]
  D --> E[LLM call]
  E --> F[Validate schema]
  F --> G[Score]
  G --> H[Log scores]
  H --> I[Collect results]
  I --> C
  C --> J[Flush]
  J --> K[Summarize]
  K --> L[CI gate]
```

## Per-Case Execution Sequence

```mermaid
sequenceDiagram
  participant Runner as evaluateTestCase()
  participant LF as Langfuse
  participant Gen as Generation Span
  participant Agent as Mastra Agent
  participant Model as DeepSeek
  participant Scorer as scoreRemoteEUClassification

  Runner->>LF: trace(name, sessionId, metadata)
  Runner->>LF: generation(name="classify-job", model, input, metadata)
  LF-->>Gen: generation handle
  Runner->>Agent: generate(messages, structuredOutput schema)
  Agent->>Model: prompt + job posting
  Model-->>Agent: {isRemoteEU, confidence, reason}
  Agent-->>Runner: result.object + usage
  Runner->>Gen: update(output, usage)
  Runner->>Scorer: score(expected, actual)
  Scorer-->>Runner: score + flags
  Runner->>LF: trace.score(remote-eu-accuracy)
  Runner->>LF: trace.score(confidence-match)
  Runner->>Gen: end()
```

## Data Model

```mermaid
classDiagram
  class TestCase {
    +string id
    +string description
    +JobPosting jobPosting
    +RemoteEUClassification expected
  }

  class JobPosting {
    +string title
    +string location
    +string description
  }

  class RemoteEUClassification {
    +boolean isRemoteEU
    +Confidence confidence
    +string reason
  }

  class Confidence {
    <<enumeration>>
    high
    medium
    low
  }

  class EvalResult {
    +string testCaseId
    +number score
    +boolean isCorrect
    +boolean confidenceMatch
    +RemoteEUClassification expected
    +RemoteEUClassification actual
    +string traceUrl
  }

  TestCase --> JobPosting
  TestCase --> RemoteEUClassification : expected
  EvalResult --> RemoteEUClassification : expected
  EvalResult --> RemoteEUClassification : actual
```

## Debugging Workflow

```mermaid
flowchart TD
  A[CI fails threshold] --> B[Open Langfuse session]
  B --> C[Filter: failing traces]
  C --> D[Inspect prompt + input]
  D --> E[Inspect output + confidence]
  E --> F[Inspect scoring comment/metadata]
  F --> G[Fix: prompt OR test data OR scorer]
  G --> H[Re-run eval]
```
