'use server';

/**
 * @fileOverview Turns the architecture, specifications and file structure into a
 * dependency-ordered implementation plan.
 *
 * The planner does not write task details — it decides *what the units of work are*,
 * *what order they go in*, and *which files each one owns*. Getting that skeleton
 * right is what makes the per-task documents implementable, so the output is a
 * structured record per task rather than a bare list of titles.
 *
 * - generateTasks - Produces the ordered task list.
 * - GenerateTasksInput / GenerateTasksOutput - IO types.
 */

import { ai } from '@/ai/litellm';
import { TaskSchema } from '@/types';
import { z } from 'zod';
import {
  MARKDOWN_ONLY_CONTRACT,
  buildContextBlock,
  buildRepairPrompt,
  composePrompt,
} from '@/ai/prompts/shared';
import {
  orderTasks,
  parseTaskPlan,
  validatePlan,
  type PlanIssue,
  type PlannedTask,
} from '@/lib/task-plan';

const _GenerateTasksInputSchema = z.object({
  architecture: z.string().describe('The architecture of the project.'),
  specifications: z.string().describe('The specifications of the project.'),
  fileStructure: z.string().describe('The file structure of the project.'),
  standards: z.string().describe('The engineering standards and quality gates.').optional(),
});
export type GenerateTasksInput = z.infer<typeof _GenerateTasksInputSchema>;

const GenerateTasksOutputSchema = z.object({
  tasks: z.array(TaskSchema).describe('The dependency-ordered task list.'),
});
export type GenerateTasksOutput = z.infer<typeof GenerateTasksOutputSchema> & {
  /** Non-fatal problems found while parsing and ordering the plan. */
  planIssues?: PlanIssue[];
};

const SYSTEM_PROMPT = `You are a lead engineer decomposing a project into a build order for autonomous coding agents. You think in vertical slices that each leave the repository green, and you are ruthless about declaring dependencies.`;

const RECORD_FORMAT = `## Output format

Output a markdown bullet list and nothing else. One line per task, in build order,
using exactly this record format:

- <id> | <title> | depends: <ids or none> | files: <paths> | outcome: <observable result>

Rules for each field:

- **id** — \`T-001\`, \`T-002\`, … numbered sequentially in build order, no gaps.
- **title** — imperative, specific, under 90 characters, naming the thing being built.
  Good: "Implement JWT session issuance in the auth service".
  Bad: "Backend work", "Setup", "Various improvements", "Implement the app".
- **depends** — comma-separated ids that must be finished first, or \`none\`. Declare
  a dependency whenever this task reads, imports, extends or tests something an
  earlier task creates. Do not list transitive dependencies, only direct ones.
- **files** — comma-separated repository-relative paths this task creates or modifies,
  taken from the file structure. 1-8 paths. Include the test files.
- **outcome** — the observable result that proves the task landed: a command that now
  passes, an endpoint that now responds, a screen that now renders. Not "code is written".

Example of the expected shape (do not copy the content):

- T-001 | Initialise the repository, toolchain and pre-commit hooks | depends: none | files: package.json, tsconfig.json, .pre-commit-config.yaml, .github/workflows/ci.yml | outcome: lint, typecheck and an empty test run all pass in CI
- T-002 | Configure the test harness with a smoke test | depends: T-001 | files: jest.config.js, tests/smoke.test.ts | outcome: \`npm test\` runs and reports one passing test

No headings, no grouping labels ("-- BACKEND --", "## Phase 1"), no blank-line
separators, no prose before or after the list.`;

function buildPlanPrompt(input: GenerateTasksInput, useTDD?: boolean): string {
  const foundation = useTDD
    ? `- T-001 sets up the repository, toolchain, formatter, linter, type checker and pre-commit hooks.
- T-002 configures the test harness and coverage reporting, and proves it with one real test.
  No task after T-002 may exist without tests, and every one of them is written test-first.`
    : `- T-001 sets up the repository, toolchain, formatter, linter, type checker and pre-commit hooks.
- T-002 configures the test harness and CI so that later tasks have somewhere to add tests.`;

  return composePrompt(
    `# Task

Decompose the project below into an ordered implementation plan for autonomous coding
agents. Each entry becomes a standalone task document that one agent will implement,
verify and commit before the next entry starts.`,

    MARKDOWN_ONLY_CONTRACT,

    `## How to size a task

- A task is one coherent, shippable slice: roughly a half-day of focused work for a
  competent engineer, ending with the repository green and committable.
- A task must be implementable **without touching files another task owns**, apart from
  files it explicitly declares.
- Too big: "Build the backend", "Implement the UI". Too small: "Add a password field",
  "Rename a variable".
- Prefer vertical slices (one feature end to end, with its tests) over horizontal
  layers (all models, then all controllers), except for the foundation tasks.
- Every functional requirement (\`FR-n\`) in the specifications must be covered by at
  least one task, and no task may exist that serves no requirement.

## Required ordering

${foundation}
- Then shared foundations that many features need: data layer, configuration, error
  handling, authentication, the component or module primitives.
- Then features in dependency order, each with its tests.
- Then the cross-cutting finishers that genuinely need everything else in place:
  end-to-end coverage, packaging, deployment, documentation.
- Nothing may depend on a task that comes after it. If you catch yourself wanting a
  forward dependency, the split is wrong — resize the tasks.

## Coverage checklist

Before you answer, confirm the plan includes tasks for every one of these that the
project needs: project setup and tooling; test harness and CI; configuration and
secrets loading; data model and migrations; core domain logic; each API surface; each
UI screen or CLI command; error handling and validation; observability; packaging or
containerisation; deployment; developer documentation. Aim for 10-25 tasks; go higher
for a large system rather than merging unrelated work into one entry.`,

    RECORD_FORMAT,

    buildContextBlock([
      { label: 'Architecture', content: input.architecture },
      { label: 'Specifications', content: input.specifications },
      { label: 'File structure', content: input.fileStructure, fenced: false },
      { label: 'Engineering standards and quality gates', content: input.standards, limit: 8_000 },
    ]),

    `Output the plan now, one record per line.`
  );
}

function toTasks(planned: PlannedTask[]): GenerateTasksOutput['tasks'] {
  return planned.map((task) => ({
    id: task.id,
    title: task.title,
    details: '',
    dependsOn: task.dependsOn,
    files: task.files,
    ...(task.outcome ? { outcome: task.outcome } : {}),
  }));
}

export async function generateTasks(
  input: GenerateTasksInput,
  apiKey?: string,
  model?: string,
  apiBase?: string,
  useTDD?: boolean,
  temperature?: number
): Promise<GenerateTasksOutput> {
  if (!model) {
    throw new Error('Model is required. Please provide a model in "provider/model" format in settings.');
  }

  const basePrompt = buildPlanPrompt(input, useTDD);
  const config =
    apiKey || apiBase || temperature !== undefined
      ? {
          ...(apiKey && { apiKey }),
          ...(apiBase && { apiBase }),
          ...(temperature !== undefined && { temperature }),
        }
      : undefined;

  let prompt = basePrompt;
  let best: { tasks: PlannedTask[]; issues: PlanIssue[] } = { tasks: [], issues: [] };

  for (let attempt = 0; attempt < 3; attempt++) {
    const { output } = await ai.generate({ model, prompt, system: SYSTEM_PROMPT, config });
    const markdownContent = ((output as string) ?? '').trim();
    if (!markdownContent) {
      throw new Error('An unexpected empty response was received from the model.');
    }

    const parsed = parseTaskPlan(markdownContent);
    const planIssues = validatePlan(parsed.tasks);
    const blocking = planIssues.filter((issue) => issue.severity === 'error');

    if (parsed.tasks.length > best.tasks.length) {
      best = { tasks: parsed.tasks, issues: [...parsed.issues, ...planIssues] };
    }

    if (parsed.tasks.length > 0 && blocking.length === 0) {
      best = { tasks: parsed.tasks, issues: [...parsed.issues, ...planIssues] };
      break;
    }

    const issues =
      parsed.tasks.length === 0
        ? ['No task records could be parsed. Follow the record format exactly, one task per bullet line.']
        : blocking.map((issue) => issue.message);

    prompt = buildRepairPrompt({ originalPrompt: basePrompt, previousOutput: markdownContent, issues });
  }

  if (best.tasks.length === 0) {
    throw new Error('Failed to extract an implementation plan from the generated content.');
  }

  const ordered = orderTasks(best.tasks);

  return {
    tasks: toTasks(ordered.tasks),
    planIssues: [...best.issues, ...ordered.issues],
  };
}
