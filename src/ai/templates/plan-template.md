# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

## Summary
[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context  
**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [single/web/mobile - determines source structure]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (plan output)
├── research.md          # Research output  
├── data-model.md        # Data model output
├── quickstart.md        # Quickstart guide
└── tasks.md             # Task list (generated separately)
```

### Source Code Structure Options  
**Option 1: Single project (DEFAULT)**
```
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/
```

**Option 2: Web application**  
```
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/
```

**Option 3: Mobile + API**  
```
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure]
```

**Structure Decision**: [DEFAULT to Option 1 unless Technical Context indicates web/mobile app]

## Phase 0: Research & Clarification
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task  
   - For each integration → patterns task

2. **Research focus areas**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Expected output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Data model creation**: Extract entities from feature spec → `data-model.md`
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Quickstart creation**: Summarize core functionality and first steps → `quickstart.md`

3. **Expected output**: data-model.md, quickstart.md

## Phase 2: Task Planning  
*This section describes what the task generation will produce - NOT executed during planning*

**Task Generation Strategy**:
- Generate tasks by category: Setup → Tests → Core → Integration → Polish  
- Apply task rules: Different files = sequential, same file = consider dependencies
- Tests before implementation (TDD approach when possible)

**Estimated Output**: 20-30 numbered, ordered tasks in tasks.md

## Progress Tracking
*Manual tracking - updated during execution*

**Phase Status**:
- [ ] Phase 0: Research complete  
- [ ] Phase 1: Design complete
- [ ] Phase 2: Task planning complete

**Quality Gates**:
- [ ] All NEEDS CLARIFICATION resolved from Technical Context
- [ ] Data model covers all key entities from requirements
- [ ] Quickstart provides clear entry point for implementation

---