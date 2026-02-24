---
title: OpenRouter Integration with DeepSeek
description: Complete guide to using OpenRouter with DeepSeek models in Nomadically.work
tags: [openrouter, deepseek, ai, llm, integration]
authors: [nicolad]
image: ./image.jpeg
slug: /openrouter-deepseek-integration
---

This article documents the complete OpenRouter integration implemented in Nomadically.work, using DeepSeek models exclusively through a unified API.

<!-- truncate -->

## Architecture Overview

```mermaid
graph TD
    A[Application] --> B[OpenRouter Module]
    B --> C[Provider Layer]
    C --> F[createOpenRouter]
    F --> N["@ai-sdk/openai"]
    N --> O[OpenRouter API]
    O --> P[DeepSeek Chat]
    O --> Q[DeepSeek R1]
    O --> R[DeepSeek Coder]
    O --> S[DeepSeek R1 Distill]
    
    B --> D[Agent Helpers]
    D --> H[createChatAgent]
    D --> I[createReasoningAgent]
    D --> J[createCodingAgent]
    D --> K[agentTemplates]
    
    B --> E[Configuration]
    E --> L[DEEPSEEK_MODELS]
    E --> M[OPENROUTER_CONFIG]
    E --> G[deepseekModels]

    style B fill:#4a9eff
    style C fill:#59c9a5
    style D fill:#ff8c42
    style E fill:#ffd93d
    style O fill:#a06cd5
```

## Module Structure

```mermaid
graph TD
    A[src/openrouter/] --> B[index.ts]
    B --> F[Exports all public APIs]
    
    A --> C[config.ts]
    C --> G[OPENROUTER_CONFIG]
    C --> H[DEEPSEEK_MODELS]
    C --> I[DEFAULT_OPENROUTER_OPTIONS]
    C --> J[TypeScript Types]
    
    A --> D[provider.ts]
    D --> K[createOpenRouter]
    D --> L[openrouter instance]
    D --> M[createDeepSeekModel]
    D --> N[deepseekModels]
    
    A --> E[agents.ts]
    E --> O[createChatAgent]
    E --> P[createReasoningAgent]
    E --> Q[createCodingAgent]
    E --> R[agentTemplates]

    style A fill:#4a9eff
    style B fill:#59c9a5
    style C fill:#ff8c42
    style D fill:#ffd93d
    style E fill:#a06cd5
```

## Core Features

### 1. Provider Configuration

The provider layer handles OpenRouter API communication using the OpenAI SDK compatibility layer.

```mermaid
graph TD
    A[createOpenRouter] --> B{API Key Exists?}
    B -->|Yes| C[Create OpenAI Provider]
    B -->|No & throwOnMissingKey=false| D[Create with Dummy Key]
    B -->|No & throwOnMissingKey=true| E[Throw Error]

    C --> F[Configure Base URL]
    F --> I[https://openrouter.ai/api/v1]
    
    C --> G[Set Custom Headers]
    G --> J[X-Title Header]
    G --> K[HTTP-Referer Header]
    
    C --> H[Apply Options]
    H --> L[Reasoning Config]

    style A fill:#4a9eff
    style C fill:#59c9a5
    style I fill:#a06cd5
```

**Implementation Details:**

- Uses `@ai-sdk/openai` package for API compatibility
- Lazy-loaded provider instance to support testing without API key
- Configurable reasoning tokens (default: 10,000 max_tokens)
- Custom headers for analytics and tracking

### 2. DeepSeek Model Access

Five DeepSeek models are available through the integration:

```mermaid
graph TD
    A[deepseekModels] --> B[chat]
    B --> G[deepseek/deepseek-chat]
    G --> L[General Conversations]
    
    A --> C[r1]
    C --> H[deepseek/deepseek-r1]
    H --> M[Complex Reasoning]
    
    A --> D[coder]
    D --> I[deepseek/deepseek-coder]
    I --> N[Code Generation]
    
    A --> E[r1DistillQwen32B]
    E --> J[deepseek/deepseek-r1-distill-qwen-32b]
    J --> O[Fast Reasoning]
    
    A --> F[r1DistillLlama70B]
    F --> K[deepseek/deepseek-r1-distill-llama-70b]
    K --> P[Advanced Reasoning]

    style A fill:#4a9eff
    style G fill:#59c9a5
    style H fill:#ff8c42
    style I fill:#ffd93d
    style J fill:#a06cd5
    style K fill:#d96c75
```

**Model Selection Guide:**

- **DeepSeek Chat**: General-purpose conversations, Q&A, text generation
- **DeepSeek R1**: Complex reasoning, multi-step analysis, decision-making
- **DeepSeek Coder**: Code generation, debugging, technical documentation
- **R1 Distill Qwen 32B**: Faster inference for reasoning tasks
- **R1 Distill Llama 70B**: High-quality reasoning with better performance

### 3. Agent Creation Patterns

Three patterns for creating agents with different levels of abstraction:

```mermaid
graph TD
    A[Agent Creation] --> B[Pattern 1: Templates]
    B --> E[agentTemplates.assistant]
    B --> F[agentTemplates.reasoning]
    B --> G[agentTemplates.coder]
    E --> L[Fastest Setup]
    F --> L
    G --> L

    A --> C[Pattern 2: Helpers]
    C --> H[createChatAgent]
    C --> I[createReasoningAgent]
    C --> J[createCodingAgent]
    H --> M[Custom Configuration]
    I --> M
    J --> M

    A --> D[Pattern 3: Direct]
    D --> K[new Agent with deepseekModels]
    K --> N[Full Control]

    style A fill:#4a9eff
    style B fill:#59c9a5
    style C fill:#ff8c42
    style D fill:#ffd93d
```

**Pattern Comparison:**

| Pattern   | Use Case                           | Flexibility | Setup Time |
| --------- | ---------------------------------- | ----------- | ---------- |
| Templates | Quick prototyping, demos           | Low         | Seconds    |
| Helpers   | Standard agents with custom config | Medium      | Minutes    |
| Direct    | Advanced use cases, full control   | High        | Minutes    |

### 4. Agent Template Flow

```mermaid
graph TD
    A[agentTemplates] --> B{Select Template}

    B --> C[assistant]
    C --> F[deepseekModels.chat]
    F --> I[Default Instructions]
    I --> L[new Agent]
    L --> M[Ready to Use]

    B --> D[reasoning]
    D --> G[deepseekModels.r1]
    G --> J[Reasoning Instructions]
    J --> L

    B --> E[coder]
    E --> H[deepseekModels.coder]
    H --> K[Coding Instructions]
    K --> L

    style A fill:#4a9eff
    style C fill:#59c9a5
    style D fill:#ff8c42
    style E fill:#ffd93d
    style M fill:#a06cd5
```

### 5. Configuration System

```mermaid
graph TD
    A[Configuration] --> B[Environment Variables]
    B --> E[OPENROUTER_API_KEY]
    E --> N[Required]
    B --> F[OPENROUTER_SITE_NAME]
    F --> O[Optional]
    B --> G[OPENROUTER_SITE_URL]
    G --> O
    
    A --> C[Constants]
    C --> H[DEEPSEEK_MODELS]
    H --> P[Model IDs]
    C --> I[OPENROUTER_CONFIG]
    I --> Q[API Config]
    C --> J[DEFAULT_OPENROUTER_OPTIONS]
    J --> R[Default Settings]
    
    A --> D[Types]
    D --> K[DeepSeekModel]
    D --> L[OpenRouterOptions]
    D --> M[AgentConfig]

    style A fill:#4a9eff
    style B fill:#59c9a5
    style C fill:#ff8c42
    style D fill:#ffd93d
```

## Usage Examples

### Basic Agent Creation

```typescript
import { agentTemplates } from "@/openrouter";

// Quick start with template
const assistant = agentTemplates.assistant();

const response = await assistant.generate([
  { role: "user", content: "What are remote work benefits?" },
]);
```

### Custom Agent with Specific Model

```typescript
import { createChatAgent, deepseekModels } from "@/openrouter";

// Using helper function
const jobClassifier = createChatAgent({
  id: "job-classifier",
  name: "Job Classifier",
  instructions: "You are an expert at classifying job postings.",
  model: "chat",
});

// Or using model directly
import { Agent } from "@mastra/core/agent";

const reasoningAgent = new Agent({
  model: deepseekModels.r1(),
  name: "Reasoning Agent",
  instructions: "Think step by step about complex problems.",
});
```

### Advanced Configuration

```typescript
import { createOpenRouter, DEEPSEEK_MODELS } from "@/openrouter";

const customProvider = createOpenRouter({
  reasoning: {
    max_tokens: 15000,
  },
  headers: {
    "HTTP-Referer": "https://nomadically.work",
    "X-Title": "Job Platform AI",
  },
});

const model = customProvider(DEEPSEEK_MODELS.R1);
```

## Data Flow

### Request Flow

```mermaid
graph TD
    A[Application Code] --> B[Agent.generate]
    B --> C[deepseekModels.chat]

    C --> D[createDeepSeekModel]
    D --> E[createOpenRouter]

    E --> F[OpenAI SDK Provider]
    F --> G[HTTP Request]

    G --> H[OpenRouter API]
    H --> I[Route to DeepSeek]

    I --> J[DeepSeek API]
    J --> K[Generate Response]

    K --> L[Return to OpenRouter]
    L --> M[Return to SDK]
    M --> N[Return to Agent]
    N --> O[Return to Application]

    style A fill:#4a9eff
    style H fill:#59c9a5
    style J fill:#ff8c42
    style O fill:#a06cd5
```

### Error Handling Flow

```mermaid
graph TD
    A[API Request] --> B{API Key Valid?}

    B -->|No| C[Throw Error]
    B -->|Yes| D{Model Available?}

    D -->|No| E[OpenRouter Fallback]
    D -->|Yes| F[Process Request]

    F --> G{Rate Limited?}
    G -->|Yes| H[Retry with Backoff]
    G -->|No| I[Execute Request]

    I --> J{Success?}
    J -->|Yes| K[Return Response]
    J -->|No| L[Error Response]

    E --> F
    H --> I

    style A fill:#4a9eff
    style C fill:#d96c75
    style E fill:#ff8c42
    style K fill:#59c9a5
    style L fill:#d96c75
```

## Integration Points

### Mastra Agent Integration

```mermaid
graph TD
    A[Mastra Framework] --> B[Agent Class]
    B --> C[Model Interface]
    C --> D[OpenRouter Provider]
    D --> E[DeepSeek Models]
    E --> Q[Generate Response]
    Q --> R[Score with Evaluators]
    R --> S[Store in Memory]
    S --> T[Return to Application]
    
    B --> F[Scorers]
    F --> I[Answer Relevancy]
    F --> J[Toxicity]
    F --> K[Bias]
    F --> L[Hallucination]
    
    B --> G[Memory]
    G --> M[Working Memory]
    G --> N[Thread Management]
    
    B --> H[Tools]
    H --> O[Custom Tools]
    H --> P[Database Tools]

    style A fill:#4a9eff
    style D fill:#59c9a5
    style E fill:#ff8c42
    style T fill:#a06cd5
```

## Environment Configuration

### Required Variables

```bash
# Core configuration
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here

# Optional configuration
OPENROUTER_SITE_NAME="Nomadically.work"
OPENROUTER_SITE_URL="https://nomadically.work"
```

### Deployment Flow

```mermaid
graph TD
    A[Local Development] --> B[.env.development]
    B --> C[OPENROUTER_API_KEY]

    D[Production] --> E[Vercel Environment]
    E --> F[Production Env Vars]
    F --> I[OPENROUTER_API_KEY]
    
    E --> G[Preview Env Vars]
    G --> I
    
    E --> H[Development Env Vars]
    H --> I

    I --> J[Encrypted at Rest]
    J --> K[Available at Runtime]

    style A fill:#4a9eff
    style D fill:#59c9a5
    style I fill:#ff8c42
    style K fill:#a06cd5
```

## Performance Characteristics

### Model Comparison

```mermaid
graph TD
    A[Model Selection] --> B{Task Type?}

    B -->|General Chat| C[DeepSeek Chat]
    C --> H[Fast Response]
    C --> I[Low Cost]

    B -->|Complex Reasoning| D[DeepSeek R1]
    D --> J[High Quality]
    D --> K[Longer Latency]

    B -->|Code Tasks| E[DeepSeek Coder]
    E --> L[Code Optimized]
    E --> M[Medium Latency]

    B -->|Fast Reasoning| F[R1 Distill Qwen]
    F --> N[Balanced]
    F --> O[Good Speed]

    B -->|Advanced Reasoning| G[R1 Distill Llama]
    G --> P[Best Quality]
    G --> Q[Medium Latency]

    style A fill:#4a9eff
    style C fill:#59c9a5
    style D fill:#ff8c42
    style E fill:#ffd93d
    style F fill:#a06cd5
    style G fill:#d96c75
```

## Benefits

### OpenRouter Advantages

```mermaid
graph TD
    A[OpenRouter Benefits] --> B[Unified Billing]
    B --> G[Single API Key]
    B --> H[Consolidated Invoice]
    
    A --> C[Automatic Failover]
    C --> I[High Availability]
    C --> J[Redundancy]
    
    A --> D[Rate Limit Management]
    D --> K[Better Limits]
    D --> L[Smart Queueing]
    
    A --> E[Cost Optimization]
    E --> M[Price Comparison]
    E --> N[Auto-Routing]
    
    A --> F[Multi-Provider Access]
    F --> O[Multiple Models]
    F --> P[Easy Switching]

    style A fill:#4a9eff
    style B fill:#59c9a5
    style C fill:#ff8c42
    style D fill:#ffd93d
    style E fill:#a06cd5
    style F fill:#d96c75
```

## Testing Strategy

### Test Coverage

```mermaid
graph TD
    A[Test Suite] --> B[Unit Tests]
    B --> E[Model Creation]
    B --> F[Provider Config]
    B --> G[Type Checking]
    
    A --> C[Integration Tests]
    C --> H[Agent Templates]
    C --> I[Custom Agents]
    C --> J[All Models]
    
    A --> D[Live API Tests]
    D --> K[API Key Validation]
    K --> N{Key Present?}
    N -->|Yes| O[Run Live Tests]
    N -->|No| P[Skip Tests]
    
    D --> L[Live Generation]
    D --> M[Error Handling]

    style A fill:#4a9eff
    style B fill:#59c9a5
    style C fill:#ff8c42
    style D fill:#ffd93d
```

Run tests with:

```bash
pnpm test:openrouter
```

## Type Safety

### TypeScript Types

```mermaid
graph TD
    A[Type System] --> B[DeepSeekModel Type]
    B --> E[Union of Model IDs]
    E --> F[Type Safety]
    F --> L[Compile-Time Validation]
    
    A --> C[OpenRouterOptions Interface]
    C --> G[Reasoning Config]
    C --> H[Headers Config]
    C --> I[Error Handling]
    I --> L
    
    A --> D[AgentConfig Interface]
    D --> J[Required Fields]
    D --> K[Optional Fields]
    K --> L

    style A fill:#4a9eff
    style F fill:#59c9a5
    style L fill:#ff8c42
```

## Migration Path

### From Direct DeepSeek SDK

```mermaid
graph TD
    A[Direct DeepSeek] --> B[Migration Steps]

    B --> C[1. Update Imports]
    C --> H["Replace @ai-sdk/deepseek"]
    C --> I["Import from @/openrouter"]

    B --> D[2. Change Model Creation]
    D --> J[deepseek → deepseekModels.chat]

    B --> E[3. Update Config]
    E --> K[Add OPENROUTER_API_KEY]

    B --> F[4. Test Integration]
    F --> L[Run Test Suite]

    B --> G[5. Deploy]
    G --> M[Push to Production]

    style A fill:#d96c75
    style B fill:#4a9eff
    style M fill:#59c9a5
```

## Resources

- **OpenRouter API**: [openrouter.ai/docs](https://openrouter.ai/docs)
- **DeepSeek Models**: [openrouter.ai/models?q=deepseek](https://openrouter.ai/models?q=deepseek)
- **Mastra Framework**: [mastra.ai/docs](https://mastra.ai/docs)
- **Usage Dashboard**: [openrouter.ai/activity](https://openrouter.ai/activity)

## Summary

This OpenRouter integration provides:

- **Unified API Access** - Single interface for all DeepSeek models  
- **Type-Safe** - Full TypeScript support with compile-time validation  
- **Flexible** - Three levels of abstraction for different use cases  
- **Production-Ready** - Error handling, fallbacks, and monitoring  
- **Well-Tested** - Comprehensive test suite with live API validation  
- **Well-Documented** - Complete examples and migration guides

The module is designed for scalability, maintainability, and developer experience while providing reliable access to state-of-the-art AI models through OpenRouter's infrastructure.
