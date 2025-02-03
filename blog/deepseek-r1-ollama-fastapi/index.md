---
slug: deepseek-r1-ollama-fastapi
title: How to Set Up and Run DeepSeek-R1 Locally With Ollama and FastAPI
date: 2025-01-30
authors: [nicolad]
tags:
  [
    machine-learning,
    large-language-models,
    local-deployment,
    generative-ai,
    open-source,
    deepseek,
    fastapi,
    ollama,
    python,
    api,
  ]
---

## Introduction

**DeepSeek-R1** is a family of large language models (LLMs) known for advanced natural language capabilities. While hosting an LLM in the cloud can be convenient, local deployment provides greater control over latency, privacy, and resource utilization. Tools like **Ollama** simplify this process by handling model downloading and quantization. However, to truly scale or integrate these capabilities into other services, you often need a robust REST API layer—**FastAPI** is perfect for this.

This article covers the entire pipeline:

1. Installing and configuring **Ollama** to serve DeepSeek-R1 locally
2. Interacting with DeepSeek-R1 using the CLI, Python scripts, or a **FastAPI** endpoint for streaming responses
3. Demonstrating a minimal **FastAPI** integration, so you can easily wrap your model in a web service

By the end, you’ll see **how to run DeepSeek-R1 locally** while benefiting from **FastAPI**’s scalability, logging, and integration features—all without sending your data to external servers.

---

## 1. Why Run DeepSeek-R1 Locally?

Running DeepSeek-R1 on your own machine has multiple advantages:

- **Privacy & Security**: No data is sent to third-party services
- **Performance & Low Latency**: Local inference avoids remote API calls
- **Customization**: Fine-tune or adjust inference parameters as needed
- **No Rate Limits**: In-house solution means no usage caps or unexpected cost spikes
- **Offline Availability**: Once downloaded, the model runs even without internet access

---

## 2. Setting Up DeepSeek-R1 Locally With Ollama

### 2.1 Installing Ollama

1. **Download Ollama** from the [official website](https://ollama.ai/).
2. **Install** it on your machine, just like any application.

:::note
Check Ollama’s documentation for platform-specific support. It’s available on macOS and some Linux distributions.
:::

### 2.2 Download and Test DeepSeek-R1

Ollama makes model retrieval simple:

```bash
ollama run deepseek-r1
```

This command automatically downloads **DeepSeek-R1** (the default variant). If your hardware cannot handle the full 671B-parameter model, specify a smaller distilled version:

```bash
ollama run deepseek-r1:7b
```

:::info
DeepSeek-R1 offers different parameter sizes (e.g., 1.5B, 7B, 14B, 70B, 671B) for various hardware setups.
:::

### 2.3 Running DeepSeek-R1 in the Background

To serve the model continuously (useful for external services like FastAPI):

```bash
ollama serve
```

By default, Ollama listens on `http://localhost:11434`.

---

## 3. Using DeepSeek-R1 Locally

### 3.1 Command-Line (CLI) Inference

You can chat directly with DeepSeek-R1 in your terminal:

```bash
ollama run deepseek-r1
```

Type a question or prompt; responses stream back in real time.

### 3.2 Accessing DeepSeek-R1 via API

If you’re building an application, you can call Ollama’s REST API:

```bash
curl http://localhost:11434/api/chat -d '{
  "model": "deepseek-r1",
  "messages": [{ "role": "user", "content": "Solve: 25 * 25" }],
  "stream": false
}'
```

:::note
Set `"stream": true` to receive chunked streaming responses—a feature you can integrate easily into web apps or server frameworks like FastAPI.
:::

### 3.3 Python Integration

Install the **ollama** Python package:

```bash
pip install ollama
```

Then use:

```python
import ollama

response = ollama.chat(
    model="deepseek-r1",
    messages=[
        {"role": "user", "content": "Explain Newton's second law of motion"},
    ],
)
print(response["message"]["content"])
```

---

## 4. FastAPI Integration and Streaming Responses

To wrap DeepSeek-R1 in a fully customizable **FastAPI** service, you can define streaming endpoints for advanced usage. Below is an example that sends chunked responses to the client:

```python
import os
import json
from typing import List
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi import FastAPI, Query
from fastapi.responses import StreamingResponse
from openai import OpenAI

from .utils.prompt import ClientMessage, convert_to_openai_messages
from .utils.tools import get_current_weather  # example tool
from .utils.tools import available_tools  # hypothetical dict of tool funcs

load_dotenv(".env.local")

app = FastAPI()
client = OpenAI(api_key="ollama", base_url="http://localhost:11434/v1/")

class Request(BaseModel):
    messages: List[ClientMessage]

def stream_text(messages: List[ClientMessage], protocol: str = 'data'):
    stream = client.chat.completions.create(
        messages=messages,
        model="deepseek-r1",
        stream=True,
    )

    if protocol == 'text':
        for chunk in stream:
            for choice in chunk.choices:
                if choice.finish_reason == "stop":
                    break
                else:
                    yield "{text}".format(text=choice.delta.content)

    elif protocol == 'data':
        draft_tool_calls = []
        draft_tool_calls_index = -1

        for chunk in stream:
            for choice in chunk.choices:
                if choice.finish_reason == "stop":
                    continue
                elif choice.finish_reason == "tool_calls":
                    for tool_call in draft_tool_calls:
                        yield f'9:{{"toolCallId":"{tool_call["id"]}","toolName":"{tool_call["name"]}","args":{tool_call["arguments"]}}}\n'

                    for tool_call in draft_tool_calls:
                        tool_result = available_tools[tool_call["name"]](**json.loads(tool_call["arguments"]))
                        yield (
                            f'a:{{"toolCallId":"{tool_call["id"]}","toolName":"{tool_call["name"]}","args":{tool_call["arguments"]},'
                            f'"result":{json.dumps(tool_result)}}}\n'
                        )
                elif choice.delta.tool_calls:
                    for tool_call in choice.delta.tool_calls:
                        id = tool_call.id
                        name = tool_call.function.name
                        arguments = tool_call.function.arguments
                        if id is not None:
                            draft_tool_calls_index += 1
                            draft_tool_calls.append({"id": id, "name": name, "arguments": ""})
                        else:
                            draft_tool_calls[draft_tool_calls_index]["arguments"] += arguments
                else:
                    yield f'0:{json.dumps(choice.delta.content)}\n'

            # usage
            if chunk.choices == []:
                usage = chunk.usage
                prompt_tokens = usage.prompt_tokens
                completion_tokens = usage.completion_tokens
                yield (
                    f'd:{{"finishReason":"{"tool-calls" if len(draft_tool_calls) > 0 else "stop"}",'
                    f'"usage":{{"promptTokens":{prompt_tokens},"completionTokens":{completion_tokens}}}}}\n'
                )

@app.post("/api/chat")
async def handle_chat_data(request: Request, protocol: str = Query('data')):
    messages = request.messages
    openai_messages = convert_to_openai_messages(messages)
    response = StreamingResponse(stream_text(openai_messages, protocol))
    response.headers['x-vercel-ai-data-stream'] = 'v1'
    return response
```

### Key Points:

- **`stream=True`** allows the server to stream content chunk by chunk.
- The code handles optional “tool calls” logic—customizable for your own environment.
- FastAPI’s `StreamingResponse` ensures the client receives partial output in real time.

With this setup, you can embed DeepSeek-R1 into more complex microservices or orchestrate multi-step workflows that rely on streaming LLM responses.

---

## 6. Conclusion

**DeepSeek-R1** combined with **Ollama** and **FastAPI** gives you a powerful local LLM service. You can handle all aspects of data ingestion, retrieval, and inference in one place—without relying on third-party endpoints or paying subscription costs. Here’s a recap:

- **Ollama** manages downloading and serving the DeepSeek-R1 models.
- **FastAPI** provides a flexible web layer for streaming responses or building microservices.

Build your local AI solutions confidently and privately—**DeepSeek-R1** is now at your fingertips.
