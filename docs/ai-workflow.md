# AI Workflow

This document explains how AI-assisted development was used to design, review and validate the public Car Care Geo integration.

The workflow combines human engineering decisions with ChatGPT/Codex-assisted reasoning and Geoapify geospatial tooling.

> **Geoapify solves the spatial problem. The Car Care platform remains the business authority.**

## 1. Role of AI in the project

AI was used as an engineering assistant for:

- architecture review and decomposition
- translating product requirements into implementation steps
- reviewing Geoapify integration boundaries
- generating and refining test ideas
- identifying edge cases and failure modes
- reviewing privacy and security constraints
- documenting reproducible implementation decisions

AI does not own booking, pricing, membership, capacity, payment or driver-assignment authority.

AI suggestions are treated as proposals. Source code, tests, runtime evidence and human review remain authoritative.
## 2. Prompt structure

Prompts were kept narrow and auditable. A typical engineering prompt contained four parts:

1. the current objective
2. the architectural boundary
3. the evidence available from source code or tests
4. the exact output expected from the AI assistant

Representative sanitized prompt:

```text
Objective: review the public Geoapify routing flow.

Boundary:
- Geoapify may solve geocoding, routing, distance and ETA.
- Business rules remain inside the Car Care platform.
- Do not invent booking, pricing, membership or assignment authority.

Evidence:
- inspect the existing address, geocoding and routing modules
- preserve current error contracts
- use tests as the acceptance criteria

Return:
- risks or missing edge cases
- the smallest safe implementation change
- tests required to prove the change
```

This structure reduced broad speculative answers and made AI output easier to compare against the repository.

## 3. Human review and correction loop

AI output was never accepted only because it looked plausible. Each suggestion passed through a review loop:

1. compare the suggestion with the current source code
2. check the proposed responsibility against the architecture boundary
3. reject invented APIs, state transitions or business authority
4. implement only the smallest justified change
5. run focused tests
6. run the full public test suite and TypeScript build
7. review the resulting diff before commit

Representative corrections made during the project included:

- keeping Geoapify as the spatial intelligence layer instead of allowing routing logic to become business authority
- keeping Smart Care, Smart Time, Smart Capacity, Smart Membership and driver assignment decisions outside Geoapify
- preventing supplementary AI/MCP flows from mutating production booking or assignment state
- avoiding raw production customer addresses and coordinates in AI prompts
- requiring route and address behavior to be proven by deterministic tests rather than by AI explanation alone

The acceptance rule was simple: an AI suggestion could accelerate analysis, but it could not replace repository evidence or human approval.


## 4. Geoapify and AI boundary in practice

The AI-assisted workflow separates spatial facts from business decisions.

A representative flow is:

1. the Car Care platform provides an already-authorized task context
2. Geoapify resolves spatial facts such as coordinates, route distance and ETA
3. the platform applies its own booking, membership, time, capacity and assignment rules
4. AI may summarize or explain the spatial result using sanitized context
5. human-reviewed application code decides whether any production action is allowed

Geoapify OpenAPI is used for deterministic geospatial requests from application code.

Geoapify MCP is treated as a supplementary exploration and explanation interface. MCP output does not mutate booking, payment, membership, capacity or driver-assignment state.

Representative sanitized AI request:

```text
Given the spatial result below, explain the operational meaning without changing business state.

Allowed:
- summarize route distance and ETA
- identify possible spatial anomalies
- explain why two candidate routes differ

Not allowed:
- assign a driver
- change a booking
- approve a payment
- alter membership entitlement
- override Smart Time or Smart Capacity

Use only sanitized spatial context. Do not request raw production customer addresses or coordinates.
```

This boundary keeps AI useful for reasoning while leaving authoritative state changes inside deterministic application services.


## 5. Common AI failure modes and guardrails

The workflow was designed around several recurring AI failure modes.

### 5.1 Invented business authority

An AI assistant can propose a technically reasonable action that crosses a business boundary. For example, a routing result must not become implicit permission to assign a driver.

Guardrail: spatial facts are separated from authoritative business decisions.

### 5.2 Invented APIs or state transitions

AI suggestions may refer to an endpoint, field or state transition that does not exist in the repository.

Guardrail: existing source code and tests are inspected before any suggestion is accepted.

### 5.3 Overtrusting a geospatial result

The shortest route or lowest distance does not automatically make a driver, timeslot or workshop resource valid.

Such decisions still require Smart Time, Smart Capacity, driver availability and other platform rules.

### 5.4 Sensitive context leakage

AI systems do not require raw production customer addresses or coordinates to explain a spatial result.

Guardrail: prompts and MCP exploration use sanitized context only.

### 5.5 Treating AI output as proof

A plausible AI explanation is not a validation result.

Guardrail: deterministic tests, TypeScript build results, repository diffs and runtime evidence are used to prove behavior.


## 6. Verification and evidence loop

Every AI-assisted change is closed with deterministic evidence rather than an AI confidence statement.

For the public repository, the verification sequence is:

```bash
npm ci
npm test
npm run build
npm audit --audit-level=moderate
git diff --check
git status --short
```

The current reference suite contains seven test files and sixteen tests covering:

- Swedish address normalization and validation
- strict Geoapify geocoding matching
- pickup and return address resolution
- Geoapify routing validation
- booking route aggregation
- Geoapify Route Matrix request and response validation
- deterministic Smart Dispatch ranking by driving ETA and distance

A change is accepted only when the relevant tests pass, the TypeScript build succeeds, the dependency audit remains clean at the configured threshold, and the final diff matches the intended scope.

GitHub Actions repeats install, test, build and security-audit checks on the supported Node.js matrix. CI is evidence of repository reproducibility; it is not replaced by AI review.

## 7. Representative prompt library

The following sanitized prompts show the style used during implementation and review. They are examples of the workflow, not production secrets or raw customer data.

### 7.1 Architecture boundary review

```text
Review this proposed Geoapify integration.

Check:
- which decisions are spatial facts
- which decisions belong to Car Care business services
- whether any AI or MCP step can mutate authoritative state
- whether the proposal introduces an API or state transition that is not present in the repository

Return only:
- boundary violations
- missing evidence
- the smallest safe correction
```

### 7.2 Strict geocoding review

```text
Review the Swedish address geocoding flow.

Requirements:
- keep street, house number, postal code and city structured
- normalize the postal code before the request
- use Geoapify structured geocoding
- accept only a result that matches the expected address components
- fail explicitly when the address cannot be resolved

Verify the behavior against existing tests before proposing changes.
```

### 7.3 Routing and privacy review

```text
Review the Geoapify driving-route flow.

Requirements:
- validate origin and destination coordinates
- keep distance and duration as deterministic spatial outputs
- do not infer driver eligibility, booking approval or capacity from route distance
- do not expose raw production customer addresses or coordinates to supplementary AI
- preserve existing error contracts

Return:
- risks
- required tests
- any privacy boundary that must remain enforced
```

These prompts deliberately constrain the assistant to repository evidence, explicit authority boundaries and testable outputs.

## 8. End-to-end AI-assisted engineering loop

The complete workflow used for this public project is:

1. a human defines the objective and the non-negotiable architecture boundary
2. the AI assistant inspects repository evidence before proposing changes
3. Geoapify responsibilities are separated from Car Care business authority
4. the assistant proposes the smallest testable implementation or documentation change
5. a human reviews the proposal and rejects invented APIs, unsafe authority changes or unnecessary scope
6. deterministic tests and TypeScript build checks validate the implementation
7. Git diff review confirms that only the intended files changed
8. GitHub Actions repeats the reproducibility checks on the supported Node.js matrix
9. only validated, sanitized material is published in the public competition repository

The representative prompts in this document are intentionally sanitized and condensed. They preserve the engineering intent, constraints and review pattern without publishing secrets, raw production customer data, private repository details or full private chat transcripts.

This workflow uses AI to accelerate engineering analysis while keeping security, privacy, business authority and final acceptance under deterministic application controls and human review.
