# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`
**Prerequisites**: plan.md (required), research.md, data-model.md

## Execution Flow  
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
2. Load design documents: research.md, data-model.md  
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests (if applicable), unit tests  
   → Core: models, services, core functionality
   → Integration: DB connections, API routes
   → Polish: documentation, performance tuning
4. Apply task rules: Tests before implementation (TDD)  
5. Number tasks sequentially 
6. Validate completeness
```

## Format: `[ID] [Description]`
- Include exact file paths when relevant  
- Focus on actionable, implementable units of work

## Path Conventions
- **Single project**: `src/`, `tests/` at repository root  
- **Web app**: `backend/src/`, `frontend/src/`
- **Mobile**: `api/src/`, `ios/src/` or `android/src/`

## Phase 1: Setup
- [ ] T001 Create project structure per implementation plan  
- [ ] T002 Initialize [language] project with core dependencies
- [ ] T003 Configure linting and formatting tools (eslint/prettier/ruff)
- [ ] T004 Set up version control (git init, .gitignore)

## Phase 2: Tests First ⚠️ MUST COMPLETE BEFORE IMPLEMENTATION
**CRITICAL: These tests MUST be written and fail before ANY implementation code**

- [ ] T005 Create test structure (unit, integration directories)  
- [ ] For each entity in data-model.md: Create unit test skeleton

## Phase 3: Core Implementation (ONLY after tests are failing)
- [ ] T006 Implement core models from data-model.md  
- [ ] T007 Implement core services with business logic
- [ ] T008 Create essential API routes (if applicable)

## Phase 4: Integration
- [ ] T009 Connect models to database/storage  
- [ ] T010 Implement API route handlers
- [ ] T011 Set up authentication/authorization (if required)

## Phase 5: Polish & Validation
- [ ] T012 Write comprehensive unit tests  
- [ ] T013 Update documentation (README, docs folder)
- [ ] T014 Run performance testing and optimize  
- [ ] T015 Create quickstart guide

## Task Generation Rules
*Applied during task creation*

1. **From Data Model**: Each entity → model creation task  
2. **Ordering**: Setup → Tests → Models → Services → API → Polish
3. **Dependencies**: Ensure prerequisite tasks are completed first

## Validation Checklist
- [ ] All entities from data-model.md have implementation tasks  
- [ ] Tests are written before corresponding implementation
- [ ] Each task specifies clear, actionable work  
- [ ] Task order follows logical dependency flow

---