/**
 * @fileOverview Generates AGENTS.md — the repository-level brief for coding agents.
 *
 * AGENTS.md answers "where am I and how do I work here"; the task files answer "what
 * am I building right now". So this document is deliberately narrow: orientation,
 * the real commands, the conventions, and the loop for working through the plan.
 * The loop and the plan mechanics are appended deterministically, because they are
 * facts about this export rather than something a model should improvise.
 */

import { ai } from '@/ai/litellm';
import { z } from 'zod';
import { resolveQualityGates, renderGateChecklist } from '@/lib/quality-gates';
import {
  MARKDOWN_ONLY_CONTRACT,
  buildContextBlock,
  composePrompt,
} from '@/ai/prompts/shared';

const GenerateAgentsMdInputSchema = z.object({
  prd: z.string().describe('The Product Requirements Document.'),
  architecture: z.string().describe('The software architecture.'),
  specifications: z.string().describe('The technical specifications.'),
  fileStructure: z.string().describe('The proposed file structure.'),
  taskNames: z.array(z.string()).describe('The list of task names.'),
  standards: z.string().describe('The engineering standards and quality gates.').optional(),
});
export type GenerateAgentsMdInput = z.infer<typeof GenerateAgentsMdInputSchema>;

const GenerateAgentsMdOutputSchema = z.object({
  agentsMdContent: z.string().describe('The generated AGENTS.md content.'),
});
export type GenerateAgentsMdOutput = z.infer<typeof GenerateAgentsMdOutputSchema>;

const SYSTEM_PROMPT = `You write repository briefs for coding agents. You are relentlessly concrete: real paths, real commands, real conventions. You never pad with generic advice about writing good software.`;

/** The parts that describe this export's own mechanics. Not model-generated. */
function buildWorkflowSection(standards?: string): string {
  const gates = resolveQualityGates(standards);

  return `## How To Work In This Repository

The implementation plan is already written. Your job is to execute it one task at a
time, in order, without inventing work.

1. Open \`docs/PLAN.md\` and find the first task whose checkbox is unticked.
2. Confirm every task in its "Depends on" column is ticked. If one is not, work that
   task first.
3. Open its task file in \`tasks/\` and read it in full. That file is your complete
   brief — it lists the files you may touch, the interfaces to produce, the tests to
   write, and the criteria you will be judged on.
4. Verify the task's Preconditions before writing any code.
5. Implement only what that task's Scope allows. Anything you notice outside that scope
   belongs to another task — leave it alone.
6. Run every quality gate. Fix failures at the cause.
7. Tick the acceptance criteria in the task file, tick the task in \`docs/PLAN.md\`, and
   commit using the project's commit convention.
8. Stop. Do not start the next task in the same change.

### Quality gates

Every task must leave these passing:

${renderGateChecklist(gates)}

Never make a gate pass by weakening it. Do not delete or skip a failing test, lower a
coverage threshold, disable a lint rule, add a blanket type-suppression comment, or
loosen a type to \`any\` in order to get a green run.

### Rules that override any task file

- Never commit secrets, credentials or \`.env\` files.
- Never rewrite published history, force-push, or amend someone else's commit.
- If a task's brief contradicts \`docs/SPECIFICATION.md\`, stop and write the conflict
  into the task file under \`## Blocked\` instead of guessing.
- If you cannot complete a task, leave the branch green and record what blocked you.

## Reference Material

- \`docs/PRD.md\` — the product requirements this project exists to satisfy.
- \`docs/ARCHITECTURE.md\` — component boundaries, data model, technology decisions.
- \`docs/SPECIFICATION.md\` — the numbered requirements (\`FR-n\`, \`NFR-n\`) and contracts.
- \`docs/STANDARDS.md\` — toolchain, commands, conventions, definition of done.
- \`docs/FILE_STRUCTURE.md\` — where things belong.
- \`docs/PLAN.md\` — the ordered task list and progress checkboxes.
- \`tasks/\` — one self-contained brief per task.
- \`reference/\` — vendored library documentation, if it was exported.`;
}

function buildAgentsPrompt(input: GenerateAgentsMdInput): string {
  return composePrompt(
    `# Task

Write the orientation half of an \`AGENTS.md\` for the repository described below. A
second half covering the task workflow is appended automatically — do not write it.`,

    MARKDOWN_ONLY_CONTRACT,

    `## Required structure

Use these headings exactly, in this order, and stop after "Conventions".

# AGENTS.md

## Project

{2-4 sentences: what this project is and who it is for, derived from the PRD.}

## Stack

{Bullet list of the technologies with versions, from the architecture. One line each.}

## Layout

{The directories that matter, one bullet each, in \`path\` — responsibility form. Only
include directories that appear in the file structure.}

## Commands

{A markdown table: \`| Purpose | Command |\`. Install, dev/run, build, lint, format,
type check, test, coverage. Use the commands from the engineering standards verbatim
where they are given — do not invent variants.}

## Architecture Notes

{4-8 bullets an agent would otherwise get wrong: module boundaries it must not cross,
where shared state lives, how configuration is loaded, how errors propagate, which
directories are generated.}

## Conventions

{6-12 bullets on naming, file placement, imports, error handling, logging, testing
layout, and the policy for adding a dependency. Take these from the engineering
standards where provided. Each bullet must be a rule that can be followed or broken,
not an aspiration.}

## Constraints

- Total length under 120 lines.
- No section may be empty. Omit a heading only if the project genuinely has no such thing.
- No generic software-engineering advice. If a sentence would be true of every project
  ever written, delete it.`,

    buildContextBlock([
      { label: 'PRD', content: input.prd, limit: 8_000 },
      { label: 'Architecture', content: input.architecture, limit: 14_000 },
      { label: 'Specifications', content: input.specifications, limit: 10_000 },
      { label: 'File structure', content: input.fileStructure },
      { label: 'Engineering standards', content: input.standards, limit: 8_000 },
      {
        label: 'Planned tasks (for context only — do not list them)',
        content: input.taskNames.map((name) => `- ${name}`).join('\n'),
        limit: 4_000,
      },
    ]),

    `Write the document now, starting with \`# AGENTS.md\` and ending with the last
"Conventions" bullet.`
  );
}

export async function generateAgentsMd(
  input: GenerateAgentsMdInput,
  apiKey?: string,
  model?: string,
  apiBase?: string,
  temperature?: number
): Promise<GenerateAgentsMdOutput> {
  if (!model) {
    throw new Error('Model is required. Please provide a model in "provider/model" format in settings.');
  }

  const { output } = await ai.generate({
    model,
    prompt: buildAgentsPrompt(input),
    system: SYSTEM_PROMPT,
    config:
      apiKey || apiBase || temperature !== undefined
        ? {
            ...(apiKey && { apiKey }),
            ...(apiBase && { apiBase }),
            ...(temperature !== undefined && { temperature }),
          }
        : undefined,
  });

  const orientation = ((output as string) ?? '').trim();
  const agentsMdContent = `${orientation || '# AGENTS.md'}\n\n${buildWorkflowSection(input.standards)}\n`;

  return { agentsMdContent };
}
