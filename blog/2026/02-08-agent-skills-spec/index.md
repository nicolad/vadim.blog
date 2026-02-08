---
title: Agent Skills spec + Mastra integration
description: How to author SKILL.md skills, structure skill folders, validate them, and wire them into Mastra Workspaces (discovery, activation, search indexing).
authors: [nicolad]
---

import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

## Agent Skills Specification

Source: [https://agentskills.io/specification](https://agentskills.io/specification)

This document defines the Agent Skills format.

### Directory structure

A skill is a directory containing at minimum a `SKILL.md` file:

```
skill-name/
└── SKILL.md          # Required
```

**Tip:** You can optionally include additional directories such as `scripts/`, `references/`, and `assets/` to support your skill.

### SKILL.md format

The `SKILL.md` file must contain YAML frontmatter followed by Markdown content.

#### Frontmatter (required)

Minimal example:

```yaml
---
name: skill-name
description: A description of what this skill does and when to use it.
---
```

With optional fields:

```yaml
---
name: pdf-processing
description: Extract text and tables from PDF files, fill forms, merge documents.
license: Apache-2.0
metadata:
  author: example-org
  version: "1.0"
---
```

| Field | Required | Notes |
|-------|----------|-------|
| name | Yes | Max 64 characters. Lowercase letters, numbers, and hyphens only. Must not start or end with a hyphen. |
| description | Yes | Max 1024 characters. Non-empty. Describes what the skill does and when to use it. |
| license | No | License name or reference to a bundled license file. |
| compatibility | No | Max 500 characters. Indicates environment requirements (intended product, system packages, network access, etc.). |
| metadata | No | Arbitrary key-value mapping for additional metadata. |
| allowed-tools | No | Space-delimited list of pre-approved tools the skill may use. (Experimental) |

##### `name` field

The required `name` field:

- Must be 1-64 characters
- May only contain unicode lowercase alphanumeric characters and hyphens (`a-z` and `-`)
- Must not start or end with `-`
- Must not contain consecutive hyphens (`--`)
- Must match the parent directory name

Valid examples:

```yaml
name: pdf-processing
```

```yaml
name: data-analysis
```

```yaml
name: code-review
```

Invalid examples:

```yaml
name: PDF-Processing  # uppercase not allowed
```

```yaml
name: -pdf  # cannot start with hyphen
```

```yaml
name: pdf--processing  # consecutive hyphens not allowed
```

##### `description` field

The required `description` field:

- Must be 1-1024 characters
- Should describe both what the skill does and when to use it
- Should include specific keywords that help agents identify relevant tasks

Good example:

```yaml
description: Extracts text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents or when the user mentions PDFs, forms, or document extraction.
```

Poor example:

```yaml
description: Helps with PDFs.
```

##### `license` field

The optional `license` field:

- Specifies the license applied to the skill
- We recommend keeping it short (either the name of a license or the name of a bundled license file)

Example:

```yaml
license: Proprietary. LICENSE.txt has complete terms
```

##### `compatibility` field

The optional `compatibility` field:

- Must be 1-500 characters if provided
- Should only be included if your skill has specific environment requirements
- Can indicate intended product, required system packages, network access needs, etc.

Examples:

```yaml
compatibility: Designed for Claude Code (or similar products)
```

```yaml
compatibility: Requires git, docker, jq, and access to the internet
```

**Note:** Most skills do not need the `compatibility` field.

##### `metadata` field

The optional `metadata` field:

- A map from string keys to string values
- Clients can use this to store additional properties not defined by the Agent Skills spec
- We recommend making your key names reasonably unique to avoid accidental conflicts

Example:

```yaml
metadata:
  author: example-org
  version: "1.0"
```

##### `allowed-tools` field

The optional `allowed-tools` field:

- A space-delimited list of tools that are pre-approved to run
- Experimental. Support for this field may vary between agent implementations

Example:

```yaml
allowed-tools: Bash(git:*) Bash(jq:*) Read
```

#### Body content

The Markdown body after the frontmatter contains the skill instructions. There are no format restrictions. Write whatever helps agents perform the task effectively.

Recommended sections:

- Step-by-step instructions
- Examples of inputs and outputs
- Common edge cases

**Note:** The agent will load this entire file once it's decided to activate a skill. Consider splitting longer `SKILL.md` content into referenced files.

### Optional directories

#### scripts/

Contains executable code that agents can run. Scripts should:

- Be self-contained or clearly document dependencies
- Include helpful error messages
- Handle edge cases gracefully

Supported languages depend on the agent implementation. Common options include Python, Bash, and JavaScript.

#### references/

Contains additional documentation that agents can read when needed:

- `REFERENCE.md` - Detailed technical reference
- `FORMS.md` - Form templates or structured data formats
- Domain-specific files (`finance.md`, `legal.md`, etc.)

Keep individual reference files focused. Agents load these on demand, so smaller files mean less use of context.

#### assets/

Contains static resources:

- Templates (document templates, configuration templates)
- Images (diagrams, examples)
- Data files (lookup tables, schemas)

### Progressive disclosure

Skills should be structured for efficient use of context:

1. **Metadata (~100 tokens)**: The `name` and `description` fields are loaded at startup for all skills
2. **Instructions (< 5000 tokens recommended)**: The full `SKILL.md` body is loaded when the skill is activated
3. **Resources (as needed)**: Files (e.g. those in `scripts/`, `references/`, or `assets/`) are loaded only when required

Keep your main `SKILL.md` under 500 lines. Move detailed reference material to separate files.

### File references

When referencing other files in your skill, use relative paths from the skill root:

```
See [the reference guide](references/REFERENCE.md) for details.

Run the extraction script:
scripts/extract.py
```

Keep file references one level deep from `SKILL.md`. Avoid deeply nested reference chains.

### Validation

Use the [skills-ref](https://github.com/agentskills/agentskills/tree/main/skills-ref) reference library to validate your skills:

```bash
skills-ref validate ./my-skill
```

This checks that your `SKILL.md` frontmatter is valid and follows all naming conventions.

---

## Documentation index first

The Agent Skills docs are designed to be discovered via a single index file (`llms.txt`). Use that as the entrypoint whenever you’re exploring the spec surface area.

---

## What are skills?

**Agent Skills** are a lightweight, file-based format for packaging reusable agent instructions and workflows (plus optional scripts/assets). Agents use **progressive disclosure**:

1. **Discovery**: load only `name` + `description` metadata
2. **Activation**: load the full `SKILL.md` body for a matching task
3. **Execution**: read references / run scripts as needed :contentReference[oaicite:1]{index=1}

---

## Skill directory structure

Minimum required:

```text
skill-name/
└── SKILL.md
````

Common optional directories (same convention is used by Mastra workspaces):

```text
skill-name/
├── SKILL.md
├── references/   # extra docs (optional)
├── scripts/      # executable code (optional)
└── assets/       # templates/images/etc. (optional)
```

---

## SKILL.md specification essentials

### Frontmatter requirements

`SKILL.md` must start with YAML frontmatter with at least:

- `name` (strict naming constraints; should match the folder name)
- `description` (non-empty; should say what + when; include “trigger keywords”)

Optional fields defined by the spec include `license`, `compatibility`, `metadata`, and experimental `allowed-tools`.

### Body content

After frontmatter: normal Markdown instructions. The spec recommends practical steps, examples, and edge cases (and keeping `SKILL.md` reasonably small to support progressive disclosure).

### A spec-friendly template

```md
---
name: code-review
description: Reviews code for quality, style, and potential issues. Use when asked to review PRs, diffs, TypeScript/Node projects, or linting failures.
license: Apache-2.0
compatibility: Requires node and access to repository files
metadata:
  version: "1.0.0"
  tags: "development review"
---

# Code Review

## When to use this skill
- Trigger phrases: "review this PR", "code review", "lint errors", "style guide"

## Procedure
1. Identify the change scope and risk.
2. Check for correctness, edge cases, and error handling.
3. Verify style rules in references/style-guide.md.
4. If available, run scripts/lint.ts and summarize results.

## Output format
- Summary
- Issues (by severity)
- Suggested diffs
- Follow-ups/tests
```

> Note: Mastra’s docs show `version` and `tags` as top-level keys in frontmatter. Depending on your validator/tooling, the safest cross-implementation choice is to store extras under `metadata`. ([mastra.ai][1])

---

## Mastra integration

Mastra workspaces support skills starting in `@mastra/core@1.1.0`. ([mastra.ai][1])

### 1) Place skills under your workspace filesystem basePath

Mastra treats skill paths as **relative to the workspace filesystem `basePath`**. ([mastra.ai][1])

In your repo, the main workspace is configured with:

- `basePath: "./src/workspace"`
- `skills: ["/skills"]`

That means the actual on-disk skills folder should be:

```text
./src/workspace/skills/
  /your-skill-name/
    SKILL.md
```

### 2) Configure skills on a workspace

Mastra enables discovery by setting `skills` on the workspace. ([mastra.ai][1])

```ts
import { Workspace, LocalFilesystem } from "@mastra/core/workspace";

export const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: "./src/workspace" }),
  skills: ["/skills"],
});
```

You can provide multiple skill directories (still relative to `basePath`). ([mastra.ai][1])

```ts
skills: [
  "/skills",      // Project skills
  "/team-skills", // Shared team skills
],
```

### 3) Dynamic skill directories (context-aware)

Mastra also supports a function form for `skills`, so you can vary skill sets by user role, tenant, environment, etc. ([mastra.ai][1])

```ts
skills: (context) => {
  const paths = ["/skills"];
  if (context.user?.role === "developer") paths.push("/dev-skills");
  return paths;
},
```

### 4) What Mastra does “under the hood”

When a skill is activated, its instructions are added to the conversation context and the agent can access references/scripts in that skill folder. Mastra describes the runtime flow as: ([mastra.ai][1])

1. List available skills in the system message
2. Allow agents to activate skills during conversation
3. Provide access to skill references and scripts

This maps cleanly onto the Agent Skills “discovery → activation → execution” model. ([agentskills.io][3])

### 5) Skill search and indexing in Mastra

Mastra workspaces support BM25, vector, and hybrid search. ([mastra.ai][4])

If **BM25 or vector search** is enabled, Mastra will **automatically index skills** so agents can search within skill content to find relevant instructions. ([mastra.ai][1])

Example (BM25-only):

```ts
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: "./src/workspace" }),
  skills: ["/skills"],
  bm25: true,
});
```

If you enable vector or hybrid search, indexing uses your embedder and vector store (and BM25 uses tokenization + term statistics). ([mastra.ai][4])

---

## Repo conventions that work well

- **One skill per folder**, folder name matches `frontmatter.name`.
- Keep `SKILL.md` focused on the “operator manual”; push deep theory to `references/`.
- Put runnable helpers in `scripts/` and make them deterministic (clear inputs/outputs).
- Treat destructive actions as opt-in:

  - Use workspace tool gating (approval required, delete disabled) for enforcement.
  - Optionally declare `allowed-tools` in SKILL.md for portability across other skill runtimes. ([agentskills.io][2])

---

[1]: https://mastra.ai/docs/workspace/skills "Skills | Workspace | Mastra Docs"
[2]: https://agentskills.io/specification "Specification"
[3]: https://agentskills.io/integrate-skills "Integrate skills into your agent - Agent Skills"
[4]: https://mastra.ai/docs/workspace/search "Search and Indexing | Workspace | Mastra Docs"
