# GitAutomate: PRD to Project Plan

GitAutomate is a powerful web application designed to streamline the initial phases of a software project. By
leveraging generative AI, it transforms a Product Requirements Document (PRD) into a comprehensive project plan,
including software architecture, technical specifications, and a granular list of actionable development tasks. You
can then export this plan or automatically create issues in your GitHub repository. This is a simple local tool that
makes it easier to task project building to AI SWE coders like OpenHands or Copilot Coding Agent. You can use the
markdown task files with Claude Code or Roo Code as well.

## Features

- **AI-Powered Planning**: Uses LiteLLM to support multiple AI providers (OpenAI, Anthropic, Google Gemini, and more).
- **Step-by-Step Workflow**: A guided, multi-step process from PRD to final output.
- **Agent-Ready Task Files**: Each task is a self-contained brief — objective, preconditions, explicit in/out of
  scope, the files it may touch, interface contracts, ordered steps, test cases, verifiable acceptance criteria, and
  the project's quality gates.
- **Project-Wide Quality Gates**: A generated standards document defines the real build/lint/test commands once; every
  task file inherits them verbatim, so the whole plan verifies itself the same way.
- **Dependency-Ordered Plan**: Tasks carry ids, declared dependencies and assigned files, are topologically ordered,
  and ship with a `docs/PLAN.md` an agent can work top to bottom.
- **Contract Validation With Repair**: Generated documents are checked against a structural contract; failures are fed
  back to the model as specific defects rather than a blind retry.
- **Provider-Agnostic AI**: Use any LLM provider by specifying "provider/model" strings (e.g., "openai/gpt-4o",
  "anthropic/claude-3-haiku").
- **Local AI Support**: Compatible with LM Studio and other OpenAI-compatible local endpoints.
- **TDD Mode**: Optionally generate tasks and implementation steps following Test-Driven Development principles.
- **GitHub Integration**: Automatically create a main tracking issue and sub-issues for each task in your selected
  repository.
- **Local Mode**: Don't want to connect to GitHub? Export the entire project plan as a structured `.zip` file.
- **Interactive Task Management**: View, edit, and refine the AI-generated task details before exporting.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (with App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **AI Backend**: [LiteLLM](https://litellm.ai/) for provider-agnostic LLM integration
- **UI**: [React](https://reactjs.org/), [ShadCN UI](https://ui.shadcn.com/), [Tailwind CSS](https://tailwindcss.com/)
- **State Management**: React State & Hooks
- **Form Handling**: [React Hook Form](https://react-hook-form.com/) & [Zod](https://zod.dev/)
- **Containerization**: [Docker](https://www.docker.com/)

---

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and
testing purposes.

### Prerequisites

- **Node.js**: Version 20 or later.
- **npm** package manager.
- **Docker** and **Docker Compose** (for containerized deployment).
- An **LLM API Key** for your chosen provider (OpenAI, Anthropic, Google AI, etc.).
- (Optional) A **GitHub Personal Access Token** with `repo` scope if you wish to use the GitHub integration feature.

### Installation & Setup

1. **Clone the repository:**

    ```bash
    git clone https://github.com/methenol/gitautomate.git
    cd gitautomate
    ```

2. **Set up environment variables (optional):**
    Create a new file named `.env` in the root of the project to set default API keys:

    ```dotenv
    # .env - Optional: Set default API keys
    OPENAI_API_KEY="your_openai_api_key"
    ANTHROPIC_API_KEY="your_anthropic_api_key"
    GOOGLE_API_KEY="your_google_ai_api_key"

    # Optional: impose a request timeout in milliseconds.
    # Unset or 0 (the default) waits indefinitely, which is what slow local models need.
    # LLM_REQUEST_TIMEOUT_MS=0
    ```

    You can also configure API keys directly in the application's settings UI.

### Running the Application (Local npm)

This application now runs as a single Next.js server with integrated LiteLLM support.

1. **Install dependencies:**

    ```bash
    npm install
    ```

2. **Run the development server:**

    ```bash
    npm run dev
    ```

The application will be available at `http://localhost:9002`.

## LLM Configuration

Configure your preferred LLM provider in the application settings:

- **LLM Model**: Enter "provider/model" format (e.g., "openai/gpt-4o", "anthropic/claude-3-haiku", "gemini-pro")
- **LLM API Key**: Your provider's API key (optional if set in environment variables)
- **LLM API Base URL**: Custom endpoint for local providers like LM Studio (e.g., "<http://localhost:1234/v1>")

### Local Models And Long Requests

Planning prompts are long, and a local model on modest hardware can take many minutes —
sometimes over an hour — to answer one. Two things used to break that, both fixed:

- **The HTTP client's own deadline.** Node's built-in `fetch` enforces undici's
  `headersTimeout` and `bodyTimeout`, **both 300 seconds by default**. A model that spends
  more than five minutes before its first byte was killed with a bare `fetch failed` while
  the endpoint was still generating. Requests now go through a dispatcher with both
  timeouts disabled.
- **The application's deadline.** There is no request timeout by default. Set
  `LLM_REQUEST_TIMEOUT_MS` to a positive number of milliseconds if you want one; leave it
  unset (or `0`) to wait indefinitely.

Private, LAN and loopback endpoints are explicitly allowed — that is where LM Studio,
Ollama, llama.cpp and vLLM live. If you run GitAutomate in Docker, remember that
`localhost` refers to the container: use the host's IP or `host.docker.internal`.

Failures now name their cause (`UND_ERR_HEADERS_TIMEOUT`, `ECONNREFUSED`, `ENOTFOUND`,
`finish_reason: length`) instead of reporting "the model may have returned an unexpected
response".

### Supported Providers

- **OpenAI**: "openai/gpt-4o", "openai/gpt-3.5-turbo", etc.
- **Anthropic**: "anthropic/claude-3-haiku", "anthropic/claude-3-sonnet", etc.
- **Google**: "gemini-pro", "gemini-1.5-pro", etc.
- **Local/Custom**: Any OpenAI-compatible endpoint (LM Studio, Ollama, etc.)

### Running with Docker (Recommended)

This method uses Docker Compose to build the necessary images and run the application in a containerized environment.
It simplifies the setup by managing the Next.js application for you.

1. **Build and start the services:**
    From the root of the project directory, run:

    ```bash
    docker-compose up --build
    ```

    This command will build the Docker image for the application and start the Next.js service. The `-d` flag can be
    added to run the containers in detached mode (in the background).

2. **Access the application:**
    Once the containers are running, the application will be available at `http://localhost:9002`.

3. **Stopping the services:**
    To stop the application, press `Ctrl+C` in the terminal where `docker-compose` is running. If you are running in
    detached mode, use the following command:

    ```bash
    docker-compose down
    ```

---

## Workflow Overview

The core workflow is as follows:

1. **Configure Settings**: Set up your GitHub and LLM credentials.
2. **Select Repository**: Choose between Local Mode or a GitHub repository.
3. **Provide PRD**: Enter your Product Requirements Document.
4. **Generate Architecture & Specifications**: AI generates an architecture (with a decided technology stack,
   components, data model and numbered `NFR-n` targets) and a standalone specification (with numbered `FR-n`
   requirements, interface contracts and project-level acceptance criteria).
5. **File Structure & Standards**: In the same step, AI proposes the repository tree and an engineering standards
   document containing the project's quality gates.
6. **Review & Edit**: Everything above is editable before tasks are generated. Fixing a gate command here fixes it in
   every task file.
7. **Generate Plan**: AI decomposes the work into a dependency-ordered plan — each task with an id, declared
   dependencies, assigned files and an observable outcome.
8. **Generate Task Briefs**: Each task is expanded into a self-contained agent brief, validated against the task
   contract, and repaired if it falls short.
9. **Review & Refine Tasks**: Edit any task; the UI re-runs the same contract check on your edits.
10. **Export or Create Issues**: Export the whole plan or create GitHub issues.

### The Task Document Contract

Every generated task file has the same shape, so an agent can be pointed at any one of them cold:

| Section | Purpose |
| --- | --- |
| Frontmatter (`id`, `depends_on`, `files`, `status`, `gates`) | Machine-readable, for orchestration |
| Objective | What will be true when the task is done |
| Context | Where it sits in the architecture, which `FR-n` it serves |
| Preconditions | Checkable prerequisites before starting |
| Scope (in/out) | The guardrail against scope creep |
| Files | Table of path / action / purpose |
| Interfaces And Contracts | Signatures and schemas — not implementations |
| Implementation Steps | Ordered steps, TDD-phased when TDD mode is on |
| Testing Requirements | Named test files and specific cases |
| Required Libraries / Documentation | Dependencies and what to read |
| Acceptance Criteria | 4-8 mechanically verifiable checkboxes |
| Quality Gates | The project's real commands, identical across all tasks |
| Definition Of Done | Uniform completion checklist |
| If You Cannot Finish | The stop-and-report protocol |

The last three sections are appended by the app from `docs/STANDARDS.md` rather than generated per task — that is what
keeps a 20-task plan internally consistent. The contract is enforced by
[`src/lib/task-document.ts`](src/lib/task-document.ts).

### Export Layout

```text
AGENTS.md                     # orientation + how to work the plan
.github/copilot-instructions.md
.openhands/microagents/repo.md
docs/PRD.md
docs/ARCHITECTURE.md
docs/SPECIFICATION.md
docs/STANDARDS.md             # toolchain, conventions, ```gates block
docs/FILE_STRUCTURE.md
docs/PLAN.md                  # dependency table + progress checkboxes
tasks/README.md               # how to hand a task to an agent
tasks/tasks.md
tasks/task-001.md …           # one agent-ready brief per task
reference/<library>/…         # vendored library docs (optional)
```

### Handing A Task To An Agent

```text
Implement the task described in tasks/task-003.md.
Read AGENTS.md first for repository conventions.
Work only within that task's scope, satisfy every acceptance criterion, and make every
quality gate pass before you finish. Do not start any other task.
```

## How to Use GitAutomate

Using the application involves a simple, sequential process.

### 1. Configure Settings

- Click the **Settings** icon (⚙️) in the top-right corner.
- **GitHub Token**: Add your GitHub Personal Access Token here to enable fetching your repositories and creating
  issues. This is stored securely using server-side encryption.
- **LLM Model**: Enter "provider/model" format (e.g., "openai/gpt-4o", "anthropic/claude-3-haiku", "gemini-pro")
- **LLM API Key**: Your provider's API key (optional if set in environment variables)
- **LLM API Base URL**: Custom endpoint for local providers like LM Studio (e.g., "<http://localhost:1234/v1>")
- **Use TDD**: Toggle this switch to generate tasks and implementation plans that follow Test-Driven Development
  principles.

### 2. Select Repository

- **Local Mode**: By default, "Local Mode" is selected. In this mode, all generated data can be exported as a `.zip`
  file at the end of the process. No GitHub connection is required.
- **GitHub Repository**: If you have configured your GitHub token, a dropdown list of your repositories will appear.
  Select the repository where you want to create the implementation plan issues.

### 3. Provide PRD

- Paste your Product Requirements Document into the text area. Be as descriptive as possible for the best results.
- Click **"Generate Architecture"**. The AI will process your PRD and return a proposed architecture and technical
  specifications.

### 4. Review Plan

- The architecture, specifications, file structure and **Standards & Quality Gates** are shown in editable text areas.
- Review and modify anything before continuing. This is the cheapest place to correct the plan.
- The standards document contains a fenced ```gates block. Those commands are copied verbatim into every task file,
  and the detected gates are listed under the editor so you can confirm they are real commands for your stack. Fix
  them here once rather than in twenty task files.
- When ready, click **"Generate Tasks"**.

### 5. Review & Refine Tasks

- First the AI produces the plan: ids, dependencies, assigned files and an observable outcome per task, topologically
  ordered. Any problems it could not resolve (thin plans, vague titles, dropped dependencies) appear as plan warnings
  above the list.
- Then each task is expanded into a full agent brief, one at a time, validated against the task contract and repaired
  with the specific defects if it falls short.
- Click any task to open it. The editor runs the same contract check on your edits and lists anything unmet, so a
  hand-edited task is held to the same standard as a generated one.
- If research for a task fails, click **"Retry Research"** in the task detail view.

### 6. Export or Create Issues

- **Export Data**: Click the **"Export Data"** button at any time after tasks have been generated. This downloads a
  `.zip` laid out as described in [Export Layout](#export-layout) — docs, standards, the ordered plan, one brief per
  task, `AGENTS.md`, and optionally vendored library docs. This is the only option available in Local Mode.
- **Create GitHub Issue**: If you have selected a repository, click the **"Create GitHub Issue"** button. This will:
    1. Create one issue per task, titled `T-00n — Title`, with its dependencies, assigned files and outcome in a
       header above the full brief.
    2. Create a main "Implementation Plan" parent issue that opens with how to work the plan, then links every
       sub-task in dependency order.
    3. Provide you with a link to the main plan issue.

---

## Architecture Of The Generator

The prompt pipeline lives in `src/ai` and the deterministic contracts in `src/lib`:

| Module | Responsibility |
| --- | --- |
| [`src/ai/prompts/shared.ts`](src/ai/prompts/shared.ts) | Reusable prompt blocks: output contract, audience brief, bounded context injection, repair prompts, TDD directive |
| [`src/ai/flows/generate-architecture.ts`](src/ai/flows/generate-architecture.ts) | Architecture + specification, with `FR-n`/`NFR-n` ids |
| [`src/ai/flows/generate-file-structure.ts`](src/ai/flows/generate-file-structure.ts) | Repository tree |
| [`src/ai/flows/generate-standards.ts`](src/ai/flows/generate-standards.ts) | Standards document and the parsed quality gates |
| [`src/ai/flows/generate-tasks.ts`](src/ai/flows/generate-tasks.ts) | The dependency-ordered plan |
| [`src/ai/flows/research-task.ts`](src/ai/flows/research-task.ts) | One agent-ready task brief |
| [`src/lib/task-plan.ts`](src/lib/task-plan.ts) | Plan record parsing, validation, topological ordering, `PLAN.md` rendering |
| [`src/lib/task-document.ts`](src/lib/task-document.ts) | The task contract: validation and assembly of the app-owned sections |
| [`src/lib/quality-gates.ts`](src/lib/quality-gates.ts) | Parsing and rendering of the ```gates block |
| [`src/lib/frontmatter.ts`](src/lib/frontmatter.ts) | Frontmatter parsing, and keeping it intact through the markdown fixers |

Two design rules are worth knowing before changing prompts:

1. **Anything that must be consistent across tasks is not generated per task.** Quality gates, the definition of done
   and the failure protocol are rendered from the standards document by
   [`assembleTaskDocument`](src/lib/task-document.ts). Models cannot keep twenty documents in agreement; code can.
2. **Retries carry feedback.** A failed validation builds a repair prompt containing the previous output and the
   specific defects. Re-sending an identical prompt just asks for the same mistake again.
