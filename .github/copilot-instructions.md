# GitAutomate: AI-Powered Project Planning Tool

GitAutomate is a Next.js web application that turns a Product Requirements Document into an architecture, a
specification, engineering standards, and a dependency-ordered set of task briefs that can each be handed to a coding
agent as its entire prompt. It exports the plan as a zip or creates GitHub issues from it.

Always reference these instructions first, and fall back to search or bash commands only when you hit something that
does not match what is written here.

## Working Effectively

### Bootstrap and Setup

- **Node.js Version**: Node.js 20.x (specified in `.nvmrc`)
- **Dependencies**: `npm install` -- takes 1-2 minutes. NEVER CANCEL. Set timeout to 5+ minutes.
- **Environment Setup**: `.env` is optional. API keys can be set there (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
  `GOOGLE_API_KEY`) or entered in the application's settings UI.
- **No separate AI backend.** LLM calls go through `src/ai/litellm.ts`, an OpenAI-compatible HTTP client, from within
  the Next.js server. There is no Genkit process; `src/ai/genkit.ts.bak` is a leftover.

### Build and Test Process

- **Build**: `npm run build` -- takes ~30 seconds. NEVER CANCEL. Set timeout to 2+ minutes.
- **Lint**: `npm run lint` -- takes ~5 seconds. Must report zero errors.
- **Markdown Lint**: `npm run lint:md` (`npm run lint:md:fix` to autofix) -- must report zero errors.
- **Type Check**: `npm run typecheck` -- takes ~10 seconds
- **Tests**: `npm test` -- Jest, ~15 seconds. All suites must pass.
- **Security Scan**: `npm audit --audit-level=high --exit-code`
- **Pre-commit Validation**: `./scripts/pre-commit.sh` runs every check above in one pass. NEVER CANCEL. Set timeout to
  3+ minutes.

### Development Server

One process only:

- Command: `npm run dev`
- Port: 9002 — <http://localhost:9002>
- Uses Turbopack

### Production/Docker

- **Production Start**: `npm run start` (or `npm run prod:start`)
- **Docker**: `docker compose up --build` serves the app on port 9002

## Validation

### Manual Testing Scenarios

Validate changes by walking the real flow:

1. **Basic Application Load**: `npm run dev`, open <http://localhost:9002>, confirm Step 1 (Select Repository) and
   Step 2 (Provide PRD) render.
2. **Settings Configuration**: open settings (⚙️), set LLM model in `provider/model` form, API key, API base URL,
   temperature, and the TDD toggle; save and confirm the dialog closes.
3. **Plan Generation**: paste a small PRD, click "Generate Architecture", and confirm architecture, specifications,
   file structure and standards all populate, with quality gates detected under the standards editor.
4. **Task Briefs**: click "Generate Tasks" and confirm tasks carry ids and dependencies, and that opening one shows a
   passing contract check.

### CI/CD Validation

Run before committing (mirrors `.github/workflows/ci.yml`):

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm test`
- `npm audit --audit-level=high --exit-code`
- `./scripts/pre-commit.sh` runs all of the above

## Architecture and Key Components

### Technology Stack

- **Framework**: Next.js 15.3.3 with App Router and Turbopack
- **Language**: TypeScript with strict mode
- **LLM Access**: provider-agnostic OpenAI-compatible client (`src/ai/litellm.ts`)
- **UI**: React with ShadCN UI components and Tailwind CSS
- **State**: React hooks; settings persisted through `/api/settings`
- **Forms**: React Hook Form with Zod validation
- **Tests**: Jest with ts-jest

### Project Structure

```text
src/
├── ai/
│   ├── litellm.ts         # OpenAI-compatible LLM client
│   ├── prompts/           # Shared prompt building blocks
│   ├── flows/             # One planning step per file
│   ├── engines/           # Task research engines
│   ├── orchestrator/      # Multi-step orchestration (not on the main UI path)
│   └── validation/        # Context validation
├── app/
│   ├── page.tsx           # The whole wizard UI
│   ├── actions.ts         # Server actions wrapping the flows
│   ├── github-actions.ts  # Repository listing and issue creation
│   └── api/               # settings + documentation routes
├── lib/                   # Deterministic contracts: task-document, task-plan,
│                          # quality-gates, frontmatter, markdown, export-docs
├── services/              # Markdown linting, documentation fetching, library identification
├── components/ui/         # ShadCN components
├── test/                  # Jest suites (+ test/helpers for LLM doubles)
└── types/                 # Shared Zod schemas and types
```

### Key Files

- `src/lib/task-document.ts` -- the task contract: validation and assembly of app-owned sections
- `src/lib/task-plan.ts` -- plan parsing, dependency ordering, `PLAN.md` rendering
- `src/lib/quality-gates.ts` -- parses the ```gates block from the standards document
- `src/ai/prompts/shared.ts` -- output contract, context injection, repair prompts
- `.github/workflows/ci.yml` -- CI pipeline definition
- `scripts/pre-commit.sh` -- local mirror of CI

## Common Tasks

### Changing A Prompt

- Prompts live in `src/ai/flows/*.ts`, built from the blocks in `src/ai/prompts/shared.ts`.
- Two rules to respect:
  1. **Anything that must be identical across tasks is not generated per task.** Quality gates, the definition of done
     and the failure protocol are rendered by `assembleTaskDocument` from the standards document.
  2. **Retries carry feedback.** Validation failures build a repair prompt (previous output + specific defects) via
     `buildRepairPrompt`. Never re-send an identical prompt.
- If you change the required sections of a document, update its validator in the same change — `src/lib/task-document.ts`
  for task briefs, or the flow's own `validate*` function.

### Adding New AI Flows

- Create the flow in `src/ai/flows/`, wrap it in a server action in `src/app/actions.ts`, and call it from
  `src/app/page.tsx`.
- A `'use server'` module may only export async functions. Pure helpers belong in `src/lib/`.

### Testing LLM-Dependent Code

- Mock `@/ai/litellm` and assert on the deterministic half (parsing, validation, assembly). See
  `src/test/planning-flows.test.ts` and the stub in `src/test/helpers/fake-llm.ts`.
- Mock `@/services/markdown-linter` in flow tests: it spawns `markdownlint-cli2` via `npx`.

### UI Component Development

- Use ShadCN UI components from `src/components/ui/`
- Follow existing patterns for form handling and validation
- Test responsive design and dark theme compatibility

### Environment Variables

- Provider API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`) -- optional
- `LLM_REQUEST_TIMEOUT_MS` -- optional; unset or `0` means wait indefinitely, which is the
  default because local models routinely exceed any fixed deadline
- Store in `.env` (not committed); can be overridden in the settings UI

### GitHub Integration

- Requires a GitHub Personal Access Token with `repo` scope
- Configured through the application settings UI
- Used for repository selection and issue creation

## Known Issues and Workarounds

### Never Reintroduce An HTTP Timeout

`src/ai/litellm.ts` deliberately routes requests through an undici `Agent` with
`headersTimeout: 0` and `bodyTimeout: 0`. Node's built-in `fetch` defaults both to 300s,
which kills legitimate local-model requests with an undiagnosable `fetch failed` while the
endpoint is still generating. If you change the transport, keep those disabled and keep
classifying errors from the full `cause` chain via `describeFetchError`. Note that
`instanceof Error` cannot be used to walk that chain — the layers come from Node internals
and fail the check across realms.

### Markdown Documents Carry Frontmatter

Task files start with a YAML frontmatter block. Markdown fixers treat `---` as a horizontal rule and will corrupt it,
so every fixer must be wrapped in `preserveFrontmatter` from `src/lib/frontmatter.ts`.

### Build Warnings

- TypeScript and ESLint validation are skipped during `next build` (see `next.config.ts`), so run `npm run typecheck`
  and `npm run lint` separately — the build passing is not sufficient.

## Command Reference

### Most Used Commands

```bash
# Fresh setup
npm install

# Development
npm run dev

# Validation
npm run lint
npm run lint:md
npm run typecheck
npm test
npm run build
./scripts/pre-commit.sh

# Production
npm run start
```

### Timeout Recommendations

- `npm install`: 5+ minutes
- `npm run build`: 2+ minutes
- `./scripts/pre-commit.sh`: 3+ minutes
- Development server: starts immediately, no timeout needed

**CRITICAL**: NEVER CANCEL builds or long-running commands. Wait for completion even if it takes longer than expected.
