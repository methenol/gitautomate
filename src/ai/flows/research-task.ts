'use server';

/**
 * @fileOverview Produces the agent-ready task document for a single task.
 *
 * This is the artefact the whole app exists to produce: a file that can be handed
 * to a coding agent, in a fresh session, as its entire prompt — with the context it
 * needs, the boundaries it must respect, criteria that can be checked mechanically,
 * and the project's real quality gates.
 *
 * The flow is: prompt → validate against the task contract → re-ask with the specific
 * defects (up to twice) → append the app-owned gate sections → lint.
 *
 * - researchTask - Generates the document for one task.
 * - ResearchTaskInput / ResearchTaskOutput - IO types.
 */

import { ai } from '@/ai/litellm';
import { MarkdownLinter } from '@/services/markdown-linter';
import { preserveFrontmatterAsync } from '@/lib/frontmatter';
import { resolveQualityGates, renderGateSummary } from '@/lib/quality-gates';
import {
  assembleTaskDocument,
  blockingIssues,
  validateTaskDocument,
  type TaskDocumentIssue,
} from '@/lib/task-document';
import {
  AGENT_AUDIENCE_BRIEF,
  MARKDOWN_ONLY_CONTRACT,
  NO_HEDGING_CONTRACT,
  buildContextBlock,
  buildRepairPrompt,
  composePrompt,
  tddDirective,
} from '@/ai/prompts/shared';

export type ResearchTaskInput = {
  title: string;
  architecture: string;
  fileStructure: string;
  specifications: string;
  /** Engineering standards document; supplies the quality gate commands. */
  standards?: string;
  /** Stable task id (`T-004`). Defaults to `T-001` for one-off re-research. */
  taskId?: string;
  /** Ids of tasks that must land first, rendered into Preconditions. */
  dependsOn?: string[];
  /** Paths the planner assigned to this task. */
  files?: string[];
  /** The planner's one-line observable outcome. */
  outcome?: string;
  /** Titles of the tasks that precede this one, so context can reference real prior work. */
  precedingTasks?: Array<{ id: string; title: string }>;
};

export type ResearchTaskOutput = {
  markdownContent: string;
  /** Contract violations that survived the repair attempts, for display in the UI. */
  issues?: TaskDocumentIssue[];
};

const SYSTEM_PROMPT = `You are a senior engineer writing the work order for another engineer who has never seen this codebase and cannot ask you questions. You write briefs that are specific enough to implement and strict enough to verify. You never write code for them — you define the contract, the steps, and the proof.`;

function buildTaskPrompt(input: ResearchTaskInput, useTDD?: boolean): string {
  const taskId = input.taskId ?? 'T-001';
  const gates = resolveQualityGates(input.standards);

  const priorWork =
    input.precedingTasks && input.precedingTasks.length > 0
      ? `## Work already completed

These tasks are finished and merged before this one starts. Their output already
exists in the repository — build on it, and never re-implement it:

${input.precedingTasks.map((task) => `- ${task.id} — ${task.title}`).join('\n')}`
      : `## Work already completed

Nothing. This is the first task, so the repository is empty or near-empty. Do not
assume any tooling, configuration or dependency already exists.`;

  const assignment = composePrompt(
    `## The task

- **Id:** ${taskId}
- **Title:** ${input.title}`,
    input.outcome ? `- **Planned outcome:** ${input.outcome}` : '',
    input.dependsOn && input.dependsOn.length > 0
      ? `- **Depends on:** ${input.dependsOn.join(', ')}`
      : '- **Depends on:** nothing',
    input.files && input.files.length > 0
      ? `- **Files assigned by the plan:** ${input.files.map((file) => `\`${file}\``).join(', ')}\n\nTreat these as the task's boundary. You may add a file the task genuinely needs, but say why.`
      : ''
  );

  return composePrompt(
    `# Task

Write the complete implementation brief for the task described below.`,

    AGENT_AUDIENCE_BRIEF,
    MARKDOWN_ONLY_CONTRACT,
    NO_HEDGING_CONTRACT,

    `## Hard rules

- **No implementation code.** Signatures, type/schema definitions, interface stubs,
  config keys, commands and file paths are welcome. Function bodies are not — the
  implementing agent writes those. Keep any code block under 25 lines.
- **Scope discipline.** This task does exactly what its title says. Everything adjacent
  belongs to another task; list those things under "Out of scope" instead of doing them.
- **Verifiability.** Every acceptance criterion must be checkable by running a command,
  inspecting a named file, or observing a named behaviour. If you cannot say how to check
  it, it is not a criterion — delete it or rewrite it.
- **No cross-task drift.** Do not restate the whole architecture, and do not redefine the
  project's tooling. The gates are fixed project-wide: ${renderGateSummary(gates)}.`,

    tddDirective(useTDD),

    assignment,
    priorWork,

    `## Required structure

Use these headings exactly, in this order, at this level. Do not add, rename, reorder or
omit any of them. Stop after "Acceptance Criteria" — the sections after it are appended
automatically and must not be written by you.

# ${taskId} — ${input.title}

## Objective

{One or two sentences: what will be true when this task is done, in terms of behaviour.}

## Context

{Where this sits in the architecture, which components it touches, and what it unblocks.
Reference the specific \`FR-n\`/\`NFR-n\` requirements it serves. 1-2 short paragraphs.}

## Preconditions

{A checkbox list of what must already be true before starting: which prior tasks are
merged, which commands must already succeed, which config or credentials must exist.
Each item must be checkable, for example: "- [ ] the test suite passes on a clean checkout".}

## Scope

### In scope

{Bullet list of what this task changes.}

### Out of scope

{Bullet list of adjacent work that belongs to other tasks, and any files or subsystems
this task must not modify. Be specific — this is the guardrail that stops scope creep.}

## Files

{A markdown table: \`| Path | Action | Purpose |\`. One row per file, path in backticks
and relative to the repository root, action one of create/modify/delete. Include the
test files. Paths must come from the project file structure.}

## Interfaces And Contracts

{The exact surface area this task must produce: function and method signatures, type or
schema definitions, endpoint shapes with request/response bodies and status codes, CLI
flags, events, or component props. Include error shapes. Signatures only — no bodies.}

## Implementation Steps

{Numbered steps, in the order they should be performed.${
      useTDD
        ? ' Every behaviour follows Red → Green → Refactor: name the test and its expected failure, then the minimal production change, then the cleanup.'
        : ''
    } Each step names the file it
touches and the change it makes. Include the wiring steps (registration, exports, config,
migrations) that are easy to forget. Call out edge cases and failure modes to handle.}

## Testing Requirements

{The tests this task must ship. Name each test file in backticks, then list the specific
cases as bullets: the happy path, boundaries, invalid input, and failure handling. State
what must be mocked or faked and what must be exercised for real. Note the coverage
expectation from the project standards.}

## Required Libraries

{Comma-separated list of the libraries, packages and tools this specific task needs,
using their real package names. Include test-only dependencies. Write "None." if the
task adds no dependency. Do not list the whole project's stack — only what this task uses.}

## Documentation

{For each library above that is non-obvious, one bullet naming what to look up (the API,
the migration guide, the config option). The exported reference documentation is available
under \`reference/<library>/\` in this repository — say which files to read.}

## Acceptance Criteria

{A checkbox list of 4-8 criteria, each independently verifiable and each referencing a
command, path, symbol or observable behaviour in backticks. Cover the behaviour, the
tests, and the integration with prior work. No subjective wording — no "clean", "robust",
"properly", "well-structured".}`,

    buildContextBlock([
      { label: 'Architecture', content: input.architecture },
      { label: 'Specifications', content: input.specifications },
      { label: 'File structure', content: input.fileStructure },
      { label: 'Engineering standards and quality gates', content: input.standards, limit: 8_000 },
    ]),

    `Write the document for **${taskId} — ${input.title}** now, starting with the H1 heading
and ending with the last acceptance criterion.`
  );
}

export async function researchTask(
  input: ResearchTaskInput,
  apiKey?: string,
  model?: string,
  apiBase?: string,
  useTDD?: boolean,
  temperature?: number
): Promise<ResearchTaskOutput> {
  if (!model) {
    throw new Error('Model is required. Please provide a model in "provider/model" format in settings.');
  }

  const taskId = input.taskId ?? 'T-001';
  const gates = resolveQualityGates(input.standards);
  const basePrompt = buildTaskPrompt(input, useTDD);
  const config =
    apiKey || apiBase || temperature !== undefined
      ? {
          ...(apiKey && { apiKey }),
          ...(apiBase && { apiBase }),
          ...(temperature !== undefined && { temperature }),
        }
      : undefined;

  let prompt = basePrompt;
  let bestBody = '';
  let bestIssues: TaskDocumentIssue[] = [];

  for (let attempt = 0; attempt < 3; attempt++) {
    const { output } = await ai.generate({ model, prompt, system: SYSTEM_PROMPT, config });
    const body = ((output as string) ?? '').trim();
    if (!body) {
      throw new Error('An unexpected empty response was received from the model.');
    }

    const issues = validateTaskDocument(body, { taskId, title: input.title });
    const blocking = blockingIssues(issues);

    // Keep the attempt with the fewest contract violations, not merely the last one.
    if (!bestBody || blocking.length < blockingIssues(bestIssues).length) {
      bestBody = body;
      bestIssues = issues;
    }

    if (blocking.length === 0) {
      break;
    }

    prompt = buildRepairPrompt({ originalPrompt: basePrompt, previousOutput: body, issues: blocking });
  }

  const assembled = assembleTaskDocument({
    taskId,
    title: input.title,
    body: bestBody,
    dependsOn: input.dependsOn,
    files: input.files,
    gates,
    useTDD,
  });

  // Lint the body only — the frontmatter block must survive byte-identical.
  const markdownContent = await preserveFrontmatterAsync(assembled, async (body) => {
    const lint = await MarkdownLinter.lintAndFix(body, `task-${taskId}.md`);
    return lint.fixedContent || body;
  });

  return {
    markdownContent,
    issues: bestIssues.length > 0 ? bestIssues : undefined,
  };
}
