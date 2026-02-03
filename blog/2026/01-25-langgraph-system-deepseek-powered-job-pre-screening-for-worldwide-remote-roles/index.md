---

title: "Agentic Job Pre-Screening with LangGraph + DeepSeek: Auto-Reject Fake “Remote” Roles"
description: "Build a production-grade job pre-screening agent with LangGraph + DeepSeek structured extraction to detect remote constraints, visa sponsorship blockers, and hidden location/timezone requirements before you waste a single application"
date: 2026-01-25
authors: [nicolad]
tags: [langgraph, ai-agents, deepseek, langchain, python, job-search, remote-work, automation, structured-output]
---

# LangGraph System: DeepSeek-Powered Job Pre-Screening for Worldwide Remote Roles

## Introduction

Remote job postings are noisy, inconsistent, and often misleading. A role is labeled **“Remote”**, but the actual constraints show up in one sentence buried halfway down the description:

- “Remote (US only)”
- “Must be authorized to work in the U.S. without sponsorship”
- “EU/EEA only due to payroll constraints”
- “Must overlap PST business hours”
- “Hybrid, 2 days/week in-office”

This article breaks down a **LangGraph System** that pre-screens job postings using **DeepSeek structured extraction**, then applies deterministic rules to instantly decide:

✅ Apply  
❌ Reject (with reasons + quotes)

The goal is simple: **filter out non-viable jobs before you spend time applying.**

---

## The Problem: “Remote” Doesn’t Mean “Work From Anywhere”

### Why Traditional Filters Fail

Keyword filters (“remote”, “anywhere”) fail because job descriptions are written inconsistently and constraints can be phrased in dozens of ways:

1. **Remote but country-restricted**
2. **Remote but timezone-restricted**
3. **Remote but payroll-limited**
4. **Remote but no visa sponsorship**
5. **Remote but actually hybrid**

Instead of relying on fragile string matching, we use an LLM to read the description like a human, but output **machine-usable constraints**.

---

## System Overview

This agent evaluates job postings in two phases:

1. **Analyze job text** (DeepSeek + structured schema)
2. **Check eligibility** (deterministic rules)

### What It Detects

- **Location scope**
  - US-only / EU-only / Global / Specific regions / Unknown
- **Remote status**
  - fully-remote / remote-with-restrictions / hybrid / on-site / unknown
- **Visa sponsorship**
  - explicit yes/no/unknown
- **Work authorization requirements**
  - must be authorized in US/EU, or not specified
- **Timezone restrictions**
  - PST overlap / CET overlap / etc.

### Tech Stack

- **LangGraph**: workflow orchestration and state transitions
- **DeepSeek**: high-signal extraction from messy job text (`deepseek-chat`)
- **LangChain structured output**: strict schema → stable parsing
- **Deterministic rules engine**: eligibility enforcement without “LLM vibes”

---

## Architecture Patterns

### 1) LangGraph Workflow

Instead of a linear script, the system is a graph-driven workflow:

```mermaid
stateDiagram-v2
    [*] --> Analyze: DeepSeek Structured Extraction
    Analyze --> CheckEligibility: Deterministic Rules
    CheckEligibility --> [*]: Eligible or Rejected
````

This shape is production-friendly because the workflow can expand safely:

- add salary checks
- add tech stack fit scoring
- add seniority mismatch detection
- add contractor vs employee constraints

---

## Typed State + Structured Extraction

### State Model (TypedDict)

LangGraph becomes far more reliable when state is explicit:

```python
class JobScreeningState(TypedDict):
    job_title: str
    company: str
    description: str
    location: str
    url: str

    # Candidate requirements
    candidate_needs_visa_sponsorship: bool
    requires_fully_remote: bool
    requires_worldwide_remote: bool
    candidate_locations: List[str]

    # Output
    is_eligible: bool
    rejection_reasons: List[str]

    # Extracted requirements
    location_requirement: Optional[str]
    specific_regions: List[str]
    excluded_regions: List[str]
    visa_sponsorship_available: Optional[bool]
    work_authorization_required: Optional[str]
    remote_status: str
    timezone_restrictions: List[str]
    confidence: str
    key_phrases: List[str]
    analysis_explanation: Optional[str]
```

---

## DeepSeek Extraction: Converting Messy Text Into Policy Constraints

### Why Structured Output Is Non-Negotiable

Freeform LLM output is fragile. A production system needs predictable extraction. This agent forces DeepSeek into a strict schema:

```python
class JobAnalysisSchema(TypedDict):
    location_requirement: Literal["US-only", "EU-only", "Global", "Specific-regions", "Unknown"]
    specific_regions: List[str]
    excluded_regions: List[str]
    remote_status: Literal["fully-remote", "remote-with-restrictions", "hybrid", "on-site", "unknown"]
    visa_sponsorship_available: Optional[bool]
    work_authorization_required: Literal["US-only", "EU-only", "Any", "Unknown"]
    timezone_restrictions: List[str]
    confidence: Literal["high", "medium", "low"]
    key_phrases: List[str]
    explanation: str
```

With this contract, the agent can safely feed extracted requirements into deterministic logic.

---

## Token Efficiency: Keep Only High-Signal Lines

Job descriptions are long. Constraints are usually short. To reduce tokens and improve extraction precision, the system trims input to keyword-adjacent lines:

```python
KEYWORDS = (
    "remote", "anywhere", "worldwide", "timezone", "sponsor", "visa",
    "authorized", "work authorization", "must be located", "eligible to work",
    "location", "region", "country", "overlap", "hours", "time zone"
)

def _keep_relevant(text: str, window: int = 2) -> str:
    lines = text.splitlines()
    keep = set()
    for i, ln in enumerate(lines):
        if any(k in ln.lower() for k in KEYWORDS):
            for j in range(max(0, i - window), min(len(lines), i + window + 1)):
                keep.add(j)
    return "\n".join(lines[i] for i in sorted(keep)) or text
```

This improves the system in four ways:

- lower inference cost
- faster runtime
- less noise
- fewer hallucination opportunities

---

## Heuristics + DeepSeek: Hybrid Extraction That Wins

Before invoking DeepSeek, the system runs a tiny heuristic pre-check:

- detects obvious “Remote (Worldwide)”
- detects “Remote (US only)”
- detects “Hybrid / On-site”

```python
def _fast_heuristic_precheck(state: JobScreeningState) -> Optional[Dict[str, Any]]:
    loc = state.get("location", "") or ""
    desc = state.get("description", "") or ""
    seed: Dict[str, Any] = {}

    if _looks_worldwide(loc) or _looks_worldwide(desc):
        seed["location_requirement"] = "Global"
        seed["remote_status"] = "fully-remote"

    if (_looks_us_only(loc) or _looks_us_only(desc)) and not seed.get("location_requirement"):
        seed["location_requirement"] = "US-only"

    if _looks_hybrid_or_onsite(loc):
        seed["remote_status"] = "hybrid"

    return seed if seed else None
```

DeepSeek still performs the full extraction, but seeding improves resilience against incomplete metadata.

---

## Eligibility Rules: Enforcing Worldwide Remote Strictly

The most valuable mode is strict worldwide remote filtering:

If `requires_worldwide_remote=True`, the job must satisfy ALL of the following:

- `remote_status == "fully-remote"`
- `location_requirement == "Global"`
- no `specific_regions`
- no `timezone_restrictions`

```python
if state["requires_worldwide_remote"]:
    if state["remote_status"] != "fully-remote":
        rejection_reasons.append(
            f"Not worldwide-remote: remote status is '{state['remote_status']}'"
        )
    if state["location_requirement"] != "Global":
        rejection_reasons.append(
            f"Not worldwide-remote: location requirement is '{state['location_requirement']}'"
        )
    if state["specific_regions"]:
        rejection_reasons.append(
            f"Not worldwide-remote: restricted to {state['specific_regions']}"
        )
    if state["timezone_restrictions"]:
        rejection_reasons.append(
            f"Not worldwide-remote: timezone restrictions {state['timezone_restrictions']}"
        )
```

This instantly rejects “remote marketing” jobs like:

- “Remote, EU only”
- “Remote, US/Canada preferred”
- “Remote, PST overlap required”

---

## Visa Sponsorship Semantics: Correct and Safe

Sponsorship logic is easy to get wrong. The correct behavior:

- reject only when sponsorship is explicitly not available (`False`)
- do not reject on unknown (`None`)

```python
if state["candidate_needs_visa_sponsorship"]:
    if state["visa_sponsorship_available"] is False:
        rejection_reasons.append(
            "Job does not offer visa sponsorship, but candidate needs sponsorship"
        )
```

This avoids dropping jobs that simply don’t mention sponsorship.

---

## Explainability: Rejection Reasons + Key Phrases

Trust requires receipts. The system stores:

- `rejection_reasons` (deterministic outcomes)
- `key_phrases` (quotes that triggered the decision)
- `analysis_explanation` (LLM summary for debugging)

That produces outputs like:

- “Job requires US location; candidate is not in US”
- “Not worldwide-remote: timezone restrictions ['US Pacific business hours']”
- key phrases like “Must be authorized to work in the U.S. without sponsorship”

---

## Real-World Test Scenarios

The included test suite covers the most common job board traps:

1. **US-only remote + no sponsorship**
2. **Remote worldwide (work from anywhere)**
3. **EU-only remote**
4. **Remote with timezone overlap requirement**

This validates both extraction quality and deterministic enforcement.

---

## Production Enhancements

### 1) Add a Match Score (Not Only Pass/Fail)

Binary decisions are clean, but scoring improves ranking:

- 100 = perfect match
- 70 = acceptable
- 30 = not worth it
- 0 = reject

### 2) Cache Results by URL Hash

You already compute a stable `thread_id` from the job URL. Persist results keyed by:

- url_hash
- model version
- rule version

This prevents re-analyzing duplicate postings.

### 3) Detect Payroll Constraints Explicitly

Add signals for:

- “We can only hire in countries where we have an entity”
- “Deel/Remote.com limited coverage”
- “W2 only / no contractors”

This is one of the highest ROI improvements for global applicants.

---

## Conclusion

This LangGraph System turns job descriptions into enforceable constraints:

- DeepSeek extracts remote reality, location scope, and sponsorship signals
- Structured output makes extraction stable and machine-safe
- Deterministic rules enforce candidate requirements precisely
- Worldwide-remote mode filters out fake “remote” listings instantly
- Decisions are explainable with reasons and quotes

This is how you scale job hunting without wasting time: **automate rejection early, apply only where it can actually work.**

## References

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [LangChain Structured Output](https://python.langchain.com/docs/concepts/structured_outputs/)
- [DeepSeek Platform](https://platform.deepseek.com/)
- [LangChain ChatOpenAI Integration](https://python.langchain.com/docs/integrations/chat/openai/)
