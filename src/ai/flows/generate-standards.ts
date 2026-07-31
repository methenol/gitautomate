'use server';

/**
 * @fileOverview Generates the project's engineering standards and quality gates.
 *
 * This is the missing keystone of the pipeline. Without it, every task file
 * invents its own build/test commands, its own definition of done, and its own
 * idea of what "good" looks like — so an agent grinding through the plan gets a
 * different contract on every task.
 *
 * The output is one document (`docs/STANDARDS.md`) that contains a
 * machine-readable ```gates fence. Those gate commands are then injected verbatim
 * into every task file, so the whole plan checks itself the same way.
 */

import { ai } from '@/ai/litellm';
import { z } from 'zod';
import { MarkdownLinter } from '@/services/markdown-linter';
import { parseQualityGates, type QualityGate } from '@/lib/quality-gates';
import {
  MARKDOWN_ONLY_CONTRACT,
  NO_HEDGING_CONTRACT,
  buildContextBlock,
  buildRepairPrompt,
  composePrompt,
  tddDirective,
} from '@/ai/prompts/shared';

const _GenerateStandardsInputSchema = z.object({
  prd: z.string().describe('The Product Requirements Document.'),
  architecture: z.string().describe('The proposed architecture.'),
  specifications: z.string().describe('The detailed specifications.'),
});
export type GenerateStandardsInput = z.infer<typeof _GenerateStandardsInputSchema>;

export interface GenerateStandardsOutput {
  /** The full standards document, ready to write to `docs/STANDARDS.md`. */
  standards: string;
  /** Gate commands parsed out of the document. */
  gates: QualityGate[];
}

const SYSTEM_PROMPT = `You are a staff engineer who owns the engineering standards for a new repository. You write terse, executable standards — commands that run, thresholds with numbers, conventions with examples. You never write aspirational fluff like "strive for clean code".`;

function buildStandardsPrompt(input: GenerateStandardsInput, useTDD?: boolean): string {
  return composePrompt(
    `# Task

Define the engineering standards and quality gates for the project described below.
This document is the contract that every future implementation task is checked
against, and it is read by autonomous coding agents rather than humans.`,

    MARKDOWN_ONLY_CONTRACT,
    NO_HEDGING_CONTRACT,

    `## Grounding rules

- Derive the toolchain from the architecture and specifications. Do not introduce a
  language, framework, package manager, or test runner that the architecture does not imply.
- Every command must be real for the chosen stack and runnable from the repository
  root (for example \`npm run lint\`, \`pytest -q\`, \`cargo clippy -- -D warnings\`, \`go test ./...\`).
- If the stack needs a script that does not exist yet (e.g. \`npm run typecheck\`), still
  specify the command and note that the first task must create it.
- Pick numbers, not adjectives: coverage percentages, maximum function length, timeout values.`,

    tddDirective(useTDD),

    `## Required document structure

Use these headings exactly, in this order.

# Engineering Standards

## Toolchain

{Language and runtime versions, package manager, build tool, test runner, linter,
formatter, type checker. One bullet each, with the pinned version where it matters.}

## Repository Commands

{A markdown table with columns: Purpose | Command | Notes. Cover at minimum install,
build, run/dev, lint, format, type check, unit test, integration test, coverage.}

## Quality Gates

{Prose: which gates must pass before a task may be considered complete, and what to
do when a gate fails (fix the code — never weaken the gate, never skip a test, never
lower a threshold to make a run green).}

Then emit the machine-readable gate list. Use a fence tagged exactly \`gates\`, one
\`id: command # what passing proves\` per line, ids from this set where applicable:
\`install\`, \`build\`, \`lint\`, \`format\`, \`typecheck\`, \`test\`, \`coverage\`, \`e2e\`, \`docs\`.
Include only gates that genuinely apply to this stack.

\`\`\`gates
lint: npm run lint # No lint errors introduced.
typecheck: npm run typecheck # No type errors.
test: npm test # Full suite green.
\`\`\`

## Coverage And Test Policy

{Minimum coverage threshold as a number, what must always be tested (error paths,
boundaries, public interfaces), and what is exempt (generated code, config).}

## Code Conventions

{Naming, file layout, module boundaries, error handling, logging, dependency-addition
policy, formatting rules. Concrete, with a short example where a rule is ambiguous.}

## Definition Of Done

{A checkbox list that applies to every single task in this project. Each item must be
verifiable by running a command or reading a named file. 6-10 items.}

## Change Control

{Branch naming, commit message format with one example, expected commit granularity,
and what may never be committed (secrets, generated artefacts, commented-out code).}

## Failure Protocol

{What an agent must do when it cannot finish: what to leave in the working tree, what
to write down, and what it must not do — no partial merges, no disabled tests, no
\`--force\`, no scope expansion beyond the task.}`,

    buildContextBlock([
      { label: 'PRD', content: input.prd, limit: 12_000 },
      { label: 'Architecture', content: input.architecture },
      { label: 'Specifications', content: input.specifications },
    ])
  );
}

/** Structural problems worth a repair round-trip. */
function validateStandards(document: string): string[] {
  const issues: string[] = [];
  const required = [
    '# Engineering Standards',
    '## Toolchain',
    '## Repository Commands',
    '## Quality Gates',
    '## Definition Of Done',
  ];

  for (const heading of required) {
    if (!new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'im').test(document)) {
      issues.push(`Missing required heading: "${heading}".`);
    }
  }

  const gates = parseQualityGates(document);
  if (gates.length === 0) {
    issues.push(
      'Missing the machine-readable gate list. Emit a fence tagged exactly ```gates containing one `id: command # description` per line.'
    );
  } else {
    const unresolved = gates.filter((gate) => /<[^>]+>|TBD|TODO/i.test(gate.command));
    if (unresolved.length > 0) {
      issues.push(
        `These gate commands are placeholders and must be real commands: ${unresolved
          .map((gate) => gate.id)
          .join(', ')}.`
      );
    }
  }

  if (!/- \[ \]/.test(document)) {
    issues.push('The Definition Of Done section must be a markdown checkbox list (`- [ ] ...`).');
  }

  return issues;
}

export async function generateStandards(
  input: GenerateStandardsInput,
  apiKey?: string,
  model?: string,
  apiBase?: string,
  useTDD?: boolean,
  temperature?: number
): Promise<GenerateStandardsOutput> {
  if (!model) {
    throw new Error('Model is required. Please provide a model in "provider/model" format in settings.');
  }

  const basePrompt = buildStandardsPrompt(input, useTDD);
  const config =
    apiKey || apiBase || temperature !== undefined
      ? {
          ...(apiKey && { apiKey }),
          ...(apiBase && { apiBase }),
          ...(temperature !== undefined && { temperature }),
        }
      : undefined;

  let prompt = basePrompt;
  let best = '';

  for (let attempt = 0; attempt < 3; attempt++) {
    const { output } = await ai.generate({ model, prompt, system: SYSTEM_PROMPT, config });
    const document = ((output as string) ?? '').trim();
    if (!document) {
      throw new Error('An unexpected empty response was received from the model.');
    }
    best = document;

    const issues = validateStandards(document);
    if (issues.length === 0) {
      break;
    }

    // Re-ask with the specific defects rather than re-sending the same prompt.
    prompt = buildRepairPrompt({ originalPrompt: basePrompt, previousOutput: document, issues });
  }

  const lint = await MarkdownLinter.lintAndFix(best, 'standards.md');
  const standards = lint.fixedContent || best;

  return { standards, gates: parseQualityGates(standards) };
}
