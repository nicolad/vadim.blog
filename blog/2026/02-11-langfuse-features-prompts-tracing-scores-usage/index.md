---
title: "Langfuse Features: Prompts, Tracing, Scores, Usage"
description: Complete guide to using Langfuse features in Nomadically.work
tags: [langfuse, prompts, tracing, scores, usage, ai, llm, integration]
authors: [nicolad]
slug: /langfuse-features-prompts-tracing-scores-usage
---


A comprehensive guide to implementing Langfuse features for production-ready AI applications, covering prompt management, tracing, evaluation, and observability.

## Overview

This guide covers:

- Prompt management with caching and versioning
- Distributed tracing with OpenTelemetry
- User feedback and scoring
- Usage tracking and analytics
- A/B testing and experimentation

<!-- truncate -->

## Architecture Overview

```mermaid
graph TD
    A[Next.js Application] --> B[instrumentation.ts]
    B --> C[OpenTelemetry SDK]
    C --> D[LangfuseSpanProcessor]
    
    A --> E[GraphQL Resolvers]
    E --> F[Prompt Service]
    E --> G[DeepSeek Generator]
    E --> H[Scores Service]
    E --> I[Usage Tracker]
    
    F --> J[Langfuse Client]
    G --> K["@langfuse/openai"]
    H --> J
    I --> L[Observations API v2]
    
    K --> M[DeepSeek API]
    J --> N[Langfuse Cloud]
    L --> N
    
    style A fill:#1a3a52,stroke:#4a9eff,color:#fff
    style N fill:#4a3c1f,stroke:#ffd93d,color:#fff
    style M fill:#1f3d2a,stroke:#59c9a5,color:#fff
```

## Environment Setup

We use only three core Langfuse environment variables:

```bash
LANGFUSE_SECRET_KEY="sk-lf-..."
LANGFUSE_PUBLIC_KEY="pk-lf-..."
LANGFUSE_BASE_URL="https://cloud.langfuse.com"
```

## Core Features

### 1. Prompt Management

#### 1.1 Singleton Client Pattern

```typescript
// src/langfuse/index.ts
let singleton: LangfuseClient | null = null;

export function getLangfuseClient(): LangfuseClient {
  if (!singleton) {
    singleton = new LangfuseClient({
      secretKey: LANGFUSE_SECRET_KEY,
      publicKey: LANGFUSE_PUBLIC_KEY,
      baseUrl: LANGFUSE_BASE_URL,
    });
  }
  return singleton;
}
```

**Benefits:**

- Single connection reuse
- Optimal connection pooling
- Consistent configuration

#### 1.2 Prompt Fetching with Caching

```mermaid
graph TD
    A[Request Prompt] --> B{Cache Hit?}
    B -->|Yes| C[Return Cached]
    B -->|No| D[Fetch from Langfuse]
    D --> E{Success?}
    E -->|Yes| F[Cache for TTL]
    E -->|No| G{Fallback Available?}
    F --> H[Return Prompt]
    G -->|Yes| I[Use Fallback]
    G -->|No| J[Throw Error]
    I --> H
    C --> H
    
    style H fill:#1f3d2a,stroke:#59c9a5,color:#fff
    style J fill:#4a1f23,stroke:#ff6b6b,color:#fff
```

```typescript
export async function fetchLangfusePrompt(
  name: string,
  options: PromptFetchOptions = {},
) {
  const langfuse = getLangfuseClient();
  
  return await langfuse.prompt.get(name, {
    type: options.type,
    label: options.label,
    version: options.version,
    cacheTtlSeconds: options.cacheTtlSeconds ?? defaultCacheTtlSeconds(),
    fallback: options.fallback,
  });
}
```

**Cache Strategy:**

| Environment | TTL | Behavior |
|------------|-----|----------|
| Production | 300s | Cached for 5 minutes |
| Development | 0s | Always fetch latest |

**Reliability Features:**

- Fallback prompts for first-fetch failures
- Stale-while-revalidate pattern
- Optional prewarming on startup

```typescript
// Prewarm critical prompts
export async function prewarmPrompts(names: string[]) {
  await Promise.all(names.map((n) => fetchLangfusePrompt(n)));
}
```

### 2. Prompt Organization & Access Control

#### 2.1 Folder-Style Naming

```mermaid
graph TD
    A[Prompt Name] --> B{Contains /?}
    B -->|Yes| C[Absolute Path]
    B -->|No| D[Convert to User Path]
    D --> E[users/user-email/name]
    
    C --> F{Check Access}
    E --> F
    
    F --> G{User Owned?}
    F --> H{Shared Prefix?}
    
    G -->|Yes| I[Grant Access]
    H -->|Yes| I
    G -->|No| H
    H -->|No| J[Deny Access]
    
    style I fill:#1f3d2a,stroke:#59c9a5,color:#fff
    style J fill:#4a1f23,stroke:#ff6b6b,color:#fff
```

```typescript
// Convert: "my-prompt" to "users/alice-example-com/my-prompt"
export function toUserPromptName(
  userIdOrEmail: string,
  shortName: string,
): string {
  const safe = userIdOrEmail
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]+/g, "-")
    .replace(/@/g, "-at-");
  return `users/${safe}/${shortName}`;
}
```

**Access Control Rules:**

1. User owns: `users/{their-email}/*`
2. Shared access: `shared/*`, `public/*`
3. Everything else: denied

```typescript
export function assertPromptAccess(
  promptName: string,
  userIdOrEmail: string,
  allowedSharedPrefixes: string[] = ["shared/", "public/"],
) {
  const userPrefix = toUserPromptName(userIdOrEmail, "").replace(/\/$/, "");
  const isUserOwned = promptName.startsWith(userPrefix + "/");
  const isShared = allowedSharedPrefixes.some((p) => promptName.startsWith(p));

  if (!isUserOwned && !isShared) {
    throw new Error(`Access denied to prompt: ${promptName}`);
  }
}
```

### 3. Prompt Composability

Reuse prompt snippets across multiple prompts to maintain DRY principles.

```mermaid
graph TD
    A[Parent Prompt] --> B[Contains References?]
    B -->|Yes| C["Parse @@@langfusePrompt..."]
    B -->|No| D[Return As-Is]
    
    C --> E[Fetch Referenced Prompt]
    E --> F[Recursively Resolve]
    F --> G{Circular Reference?}
    
    G -->|Yes| H[Throw Error]
    G -->|No| I[Replace Reference]
    
    I --> J{More References?}
    J -->|Yes| C
    J -->|No| K[Return Resolved]
    
    style K fill:#1f3d2a,stroke:#59c9a5,color:#fff
    style H fill:#4a1f23,stroke:#ff6b6b,color:#fff
```

**Reference Format:**

```
@@@langfusePrompt:name=PromptName|version=1@@@
@@@langfusePrompt:name=PromptName|label=production@@@
```

**Helper Function:**

```typescript
export function composePromptRef(
  name: string,
  options: { version?: number; label?: string } = {},
): string {
  let ref = `@@@langfusePrompt:name=${name}`;
  if (options.version !== undefined) {
    ref += `|version=${options.version}`;
  }
  if (options.label) {
    ref += `|label=${options.label}`;
  }
  ref += "@@@";
  return ref;
}
```

**Example Usage:**

```typescript
// Base prompt: "shared/system-instructions"
const systemRef = composePromptRef("shared/system-instructions", { 
  label: "production" 
});

// Composed prompt
const prompt = `
${systemRef}

Your task: Review code for bugs and performance issues.
`;

// Automatically resolved when fetched
const resolved = await resolveComposedPrompt(prompt);
```

### 4. Variables & Placeholders

#### 4.1 Variables (Simple String Substitution)

```typescript
const prompt = "Hello {{name}}, welcome to {{app}}!";

compilePrompt(prompt, {
  variables: {
    name: "Alice",
    app: "Nomadically"
  }
});
// Result: "Hello Alice, welcome to Nomadically!"
```

#### 4.2 Message Placeholders (Chat Prompts)

```typescript
// Prompt with placeholder
const chatPrompt = [
  { role: "system", content: "You are a helpful assistant." },
  { type: "placeholder", name: "conversation_history" },
  { role: "user", content: "{{user_question}}" }
];

compilePrompt(chatPrompt, {
  variables: { user_question: "What is TypeScript?" },
  placeholders: {
    conversation_history: [
      { role: "user", content: "Hi!" },
      { role: "assistant", content: "Hello! How can I help?" }
    ]
  }
});
```

### 5. Prompt Config

Store model parameters, tools, and schemas directly with prompt versions.

```mermaid
graph TD
    A[Prompt] --> B[Prompt Content]
    A --> C[Prompt Config]
    
    C --> D[model]
    C --> E[temperature]
    C --> F[max_tokens]
    C --> G[top_p]
    C --> H[tools]
    C --> I[response_format]
    
    J[LLM Call] --> K[Extract Config]
    K --> L[Merge with Overrides]
    L --> M[Pass to API]
    
    style C fill:#4a3c1f,stroke:#ffd93d,color:#fff
```

**DeepSeek-Focused Config:**

```typescript
export type PromptConfig = {
  model?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  response_format?: unknown;
  tools?: unknown[];
  tool_choice?: unknown;
  stop?: string[];
} & Record<string, unknown>;
```

**Config Extraction:**

```typescript
export function extractPromptConfig(config: unknown): PromptConfig {
  // Validates and normalizes config
  // Enforces DeepSeek models only
  // Preserves custom keys
}
```

### 6. A/B Testing

Deterministic hash-based routing for consistent experiment assignment.

```mermaid
graph TD
    A[User Request] --> B[Hash user ID]
    B --> C{Hash < 0.5?}
    C -->|Yes| D[Label: prod-a]
    C -->|No| E[Label: prod-b]
    
    D --> F[Fetch Prompt v1]
    E --> G[Fetch Prompt v2]
    
    F --> H[Generate Response]
    G --> H
    
    H --> I[Link to Trace]
    I --> J[Langfuse Analytics]
    
    J --> K[Compare Metrics]
    K --> L[Label: prod-a vs prod-b]
    
    style K fill:#1f3d2a,stroke:#59c9a5,color:#fff
```

```typescript
export function pickAbLabel(params: {
  seed: string;            // stable userId/sessionId
  labelA: string;          // "prod-a"
  labelB: string;          // "prod-b"
  splitA?: number;         // default 0.5
}): string {
  const u = hashToUnit(params.seed);
  return u < (params.splitA ?? 0.5) ? params.labelA : params.labelB;
}
```

**Usage:**

```typescript
const label = pickAbLabel({
  seed: userId,     // Same user always gets same variant
  labelA: "prod-a",
  labelB: "prod-b",
  splitA: 0.5       // 50/50 split
});

const prompt = await fetchLangfusePrompt("shared/support-agent", { label });
```

### 7. DeepSeek Integration with Tracing

Complete OpenAI-compatible integration with full observability.

```mermaid
graph TD
    A[generateDeepSeekWithLangfuse] --> B[Initialize OTel]
    B --> C[Fetch Prompt with Cache]
    C --> D[Compile Variables]
    D --> E[Extract Config]
    E --> F[Wrap OpenAI Client]
    
    F --> G[observeOpenAI]
    G --> H{Pass Metadata}
    
    H --> I[langfusePrompt]
    H --> J[userId]
    H --> K[sessionId]
    H --> L[tags]
    
    G --> M[Call DeepSeek API]
    M --> N[Response]
    
    N --> O[Auto-captured Trace]
    O --> P[Linked to Prompt Version]
    O --> Q[Tagged with Metadata]
    
    P --> R[Langfuse Dashboard]
    Q --> R
    
    style R fill:#4a3c1f,stroke:#ffd93d,color:#fff
```

**Key Features:**

- Automatic prompt-to-trace linking
- User/session attribution
- Tag-based filtering
- Model parameter extraction from prompt config

```typescript
export async function generateDeepSeekWithLangfuse(
  input: GenerateInput,
): Promise<string> {
  await initOtel();

  const langfusePrompt = await fetchLangfusePrompt(input.promptName, {
    type: input.promptType,
    label: input.label,
    cacheTtlSeconds: defaultCacheTtlSeconds(),
    fallback: /* ... */,
  });

  const compiled = compilePrompt(langfusePrompt, {
    variables: input.variables,
    placeholders: input.placeholders,
  });

  const cfg = extractPromptConfig(langfusePrompt.config);

  const traced = observeOpenAI(getDeepSeekClient(), {
    langfusePrompt,        // Links to prompt version
    userId: input.userId,
    sessionId: input.sessionId,
    tags: input.tags,
  });

  const res = await traced.chat.completions.create({
    model: cfg.model ?? "deepseek-chat",
    messages: compiled,
    temperature: cfg.temperature,
    // ... other params from config
  });

  return res.choices?.[0]?.message?.content ?? "";
}
```

### 8. Scores & Feedback

Capture user feedback and evaluation metrics.

```mermaid
graph TD
    A[User Interaction] --> B[Generate Response]
    B --> C[Trace Created]
    
    D[User Gives Feedback] --> E[createScore]
    E --> F{Score Type}
    
    F -->|Thumbs| G[BOOLEAN: 0/1]
    F -->|Rating| H[NUMERIC: 1-5]
    F -->|Category| I[CATEGORICAL: good/bad]
    
    G --> J[Attach to Trace]
    H --> J
    I --> J
    
    J --> K[Include Metadata]
    K --> L[sessionId]
    K --> M[comment]
    K --> N[configId]
    
    J --> O[Langfuse Score API]
    O --> P[Analytics & Evals]
    
    style P fill:#1f3d2a,stroke:#59c9a5,color:#fff
```

```typescript
export async function createScore(input: {
  traceId: string;
  observationId?: string;
  sessionId?: string;
  name: string;              // e.g. "helpfulness"
  value: number | string;    // boolean => 0/1
  dataType?: ScoreDataType;
  comment?: string;
  id?: string;               // idempotency key
}) {
  const langfuse = getLangfuseClient();

  langfuse.score.create({ /* ... */ });
  
  await langfuse.flush(); // Important for serverless
}
```

**Use Cases:**

- Thumbs up/down feedback
- Star ratings (1-5)
- Correctness evaluation
- Guardrail checks
- Custom metrics

### 9. Usage Tracking via Observations API

Replace in-memory logs with real production data.

```mermaid
graph TD
    A[User Request] --> B[getRecentGenerationsForUser]
    B --> C[Query Observations API v2]
    
    C --> D[Filter Parameters]
    D --> E[type=GENERATION]
    D --> F[userId]
    D --> G[limit]
    D --> H[fields]
    
    C --> I[Langfuse Response]
    I --> J[Parse Observations]
    
    J --> K[traceId]
    J --> L[promptName]
    J --> M[promptVersion]
    J --> N[startTime]
    J --> O[sessionId]
    
    style I fill:#4a3c1f,stroke:#ffd93d,color:#fff
```

```typescript
export async function getRecentGenerationsForUser(params: {
  userId: string;
  limit?: number;
  environment?: string;
}): Promise<ObservationUsageItem[]> {
  const url = new URL(`${LANGFUSE_BASE_URL}/api/public/v2/observations`);
  
  url.searchParams.set("type", "GENERATION");
  url.searchParams.set("userId", params.userId);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("fields", "core,basic,prompt,time");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}`
      ).toString("base64")}`,
    },
  });

  return parseObservations(await res.json());
}
```

**Benefits:**

- Real production data (no fake logs)
- Filtered by user, environment, time
- Includes prompt name & version
- Ready for billing, quotas, analytics

### 10. OpenTelemetry Setup

Required for `@langfuse/openai` integration.

```mermaid
graph TD
    A[Next.js Startup] --> B[instrumentation.ts]
    B --> C[register function]
    C --> D[initOtel]
    
    D --> E[NodeSDK]
    E --> F[LangfuseSpanProcessor]
    
    F --> G[Capture Spans]
    G --> H[LLM Calls]
    G --> I[Prompt Fetches]
    G --> J[Metadata]
    
    H --> K[Send to Langfuse]
    I --> K
    J --> K
    
    style K fill:#4a3c1f,stroke:#ffd93d,color:#fff
```

**Setup:**

```typescript
// src/otel/initOtel.ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

let started = false;

export async function initOtel() {
  if (started) return;
  
  const sdk = new NodeSDK({
    spanProcessors: [new LangfuseSpanProcessor()],
  });
  
  await sdk.start();
  started = true;
}
```

```typescript
// instrumentation.ts (Next.js hook)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await initOtel();
  }
}
```

## GraphQL API

All Langfuse features are accessible via GraphQL.

### Query Prompts

```graphql
query GetPrompt($name: String!, $label: String) {
  prompt(name: $name, label: $label, resolveComposition: true) {
    name
    version
    type
    chatMessages
    config
    labels
    tags
  }
}
```

### Track Usage

```graphql
query MyUsage($limit: Int) {
  myPromptUsage(limit: $limit) {
    promptName
    version
    usedAt
    traceId
  }
}
```

### Create Prompts

```graphql
mutation CreatePrompt($input: CreatePromptInput!) {
  createPrompt(input: $input) {
    name
    version
    config
  }
}
```

## Best Practices

### Recommended Practices

- **Caching**: Always use caching in production (300s TTL)
- **Fallbacks**: Provide fallback prompts for critical operations
- **Prewarming**: Prewarm prompts on server startup
- **Tagging**: Tag all generations with userId and sessionId
- **A/B Testing**: Use labels for experiments (prod-a/prod-b)
- **Organization**: Use folder-style naming convention
- **DRY Principle**: Compose prompts to avoid duplication
- **Configuration**: Extract config from prompts (avoid hardcoding)
- **Serverless**: Flush scores in serverless environments
- **Production Data**: Use Observations API for real usage tracking

### Common Pitfalls to Avoid

- Bypassing caching in production
- Hardcoding model parameters
- Creating circular prompt references
- Skipping ACL checks
- Using in-memory logs for usage tracking
- Forgetting to call `initOtel()` before tracing
- Mixing manual prompt names with namespace convention

## Performance Characteristics

| Feature | Latency | Cache Hit Rate | Notes |
|---------|---------|----------------|-------|
| Prompt Fetch (cached) | ~1ms | 95%+ | In-process cache |
| Prompt Fetch (miss) | ~50-100ms | - | Network + DB |
| Prompt Compilation | &lt;1ms | - | Pure computation |
| Score Creation | ~20-50ms | - | Async, buffered |
| Observations API | ~100-200ms | - | Paginated queries |
| Composed Prompt (3 refs) | ~150ms | 80%+ | Parallel fetches |

## Security Considerations

- **Credentials**: Never expose `LANGFUSE_SECRET_KEY` to client-side code
- **Access Control**: Always validate access with `assertPromptAccess()`
- **User Isolation**: Folder-style naming prevents cross-user data leaks
- **Rate Limits**: Observations API has a limit of 1000 records per query
- **Idempotency**: Use score IDs to prevent duplicate feedback submission

## Monitoring & Debugging

### In Langfuse Dashboard

1. **Traces** - Filter by userId, sessionId, tags
2. **Prompts** - View usage per version/label
3. **Scores** - Aggregate feedback by name
4. **Sessions** - Track multi-turn conversations
5. **Datasets** - Export for evals (future)

### Local Development

```bash
# Disable caching for instant updates
NODE_ENV=development

# Check OTel initialization
# Look for "LangfuseSpanProcessor initialized" in logs

# Verify prompt fetches
# Check Network tab for Langfuse API calls

# Test composability
# Use resolveComposedPrompt() directly
```

## Migration Guide

Upgrading from a previous implementation:

**Step 1: Install Dependencies**

```bash
pnpm add @langfuse/openai @langfuse/otel
```

**Step 2: Setup OpenTelemetry**

- Add `instrumentation.ts` for OTel initialization
- Configure `LangfuseSpanProcessor`

**Step 3: Update Client**

- Replace `Langfuse` with `LangfuseClient`
- Update prompt fetching to use the caching API

**Step 4: Refactor Code**

- Switch to folder-style naming convention
- Replace in-memory usage tracking with Observations API
- Add `langfusePrompt` parameter to all `observeOpenAI` calls

## Resources

- [Langfuse Prompt Management](https://langfuse.com/docs/prompt-management)
- [Langfuse OpenAI Integration](https://langfuse.com/integrations/model-providers/openai-js)
- [Observations API](https://langfuse.com/docs/api-and-data-platform/features/observations-api)
- [DeepSeek API Docs](https://api-docs.deepseek.com/)
- [A/B Testing Guide](https://langfuse.com/docs/prompt-management/features/a-b-testing)
- [Prompt Composability](https://langfuse.com/docs/prompt-management/features/prompt-composability)

## Troubleshooting

Common issues and solutions:

**Build Errors**

- Check build logs for TypeScript errors
- Verify all required dependencies are installed

**Configuration Issues**

- Verify environment variables are set correctly
- Confirm `LANGFUSE_SECRET_KEY` and `LANGFUSE_PUBLIC_KEY` are valid

**Runtime Issues**

- Confirm OTel is initialized before first LLM call
- Check that `initOtel()` is called in `instrumentation.ts`

**Monitoring**

- Review Langfuse dashboard for traces and errors
- Check browser Network tab for API errors
- Verify API responses and status codes
