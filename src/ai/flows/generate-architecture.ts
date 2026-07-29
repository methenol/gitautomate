'use server';

/**
 * @fileOverview Turns a PRD into an architecture and a specification.
 *
 * Both documents are downstream inputs for the file structure, the standards, the
 * task plan, and every individual task file — so vagueness here multiplies. The
 * prompt therefore demands decisions (named technologies, named modules, named
 * endpoints) rather than a survey of options.
 *
 * - generateArchitecture - Takes a PRD and returns an architecture and specifications.
 * - GenerateArchitectureInput / GenerateArchitectureOutput - IO types.
 */

import { ai } from '@/ai/litellm';
import { z } from 'zod';
import { MarkdownLinter } from '@/services/markdown-linter';
import {
  MARKDOWN_ONLY_CONTRACT,
  NO_HEDGING_CONTRACT,
  buildContextBlock,
  buildRepairPrompt,
  composePrompt,
} from '@/ai/prompts/shared';

const GenerateArchitectureInputSchema = z.object({
  prd: z
    .string()
    .describe('The Product Requirements Document (PRD) to generate the architecture from.'),
});
export type GenerateArchitectureInput = z.infer<typeof GenerateArchitectureInputSchema>;

const GenerateArchitectureOutputSchema = z.object({
  architecture: z.string().describe('The proposed software architecture. Use markdown formatting.'),
  specifications: z
    .string()
    .describe('The generated specifications based on the PRD. Use markdown formatting.'),
});
export type GenerateArchitectureOutput = z.infer<typeof GenerateArchitectureOutputSchema>;

const SYSTEM_PROMPT = `You are a senior software architect. You make decisions and record them, with the trade-off stated in one line. You never present a menu of options and leave the choice to the reader, because the reader is a coding agent that cannot choose.`;

function buildArchitecturePrompt(prd: string): string {
  return composePrompt(
    `# Task

Read the Product Requirements Document below and produce two documents: an
**architecture** and a **specification**. Both are consumed by autonomous coding
agents that will implement the system without further human clarification.`,

    MARKDOWN_ONLY_CONTRACT,
    NO_HEDGING_CONTRACT,

    `## Decision rules

- Choose exactly one technology per concern and name it with a version constraint.
  "React 18 with Next.js 15 App Router", not "a modern frontend framework".
- Prefer the smallest architecture that satisfies the PRD. Do not add queues, caches,
  microservices, or event buses that the requirements do not demand.
- Every component you name must have a home in the eventual repository, a stated
  responsibility, and stated collaborators.
- Anything the PRD leaves open, you decide, and you record it under Assumptions.
- Requirements must be individually identifiable: give each functional requirement a
  stable id (\`FR-1\`, \`FR-2\`, …) and each non-functional requirement \`NFR-1\`, \`NFR-2\`, ….
  Later task files reference these ids, so they must be stable and unique.`,

    `## Required output structure

Emit exactly two top-level sections, in this order, with these exact headings.

# Architecture

## Overview

{2-4 paragraphs: what is being built, the shape of the solution, and the single most
important constraint driving the design.}

## Technology Stack

{Table with columns: Concern | Choice | Version | Why this one. One row per concern
(language, runtime, framework, styling, state, persistence, auth, testing, build,
CI, deployment, observability). Include only concerns the project actually has.}

## Components

{One \`###\` subsection per component. For each: Responsibility (one sentence), Public
interface (the functions/endpoints/events it exposes), Depends on (other components),
and Owns (the data or files it is the only writer of).}

## Data Model

{Entities with their fields and types, relationships, and identity/ownership rules.
Use tables or fenced schema blocks. Include indexes or constraints that matter.}

## Data Flow

{Trace 2-4 representative operations end to end, numbered step by step, naming the
components from the section above at each hop.}

## Cross-Cutting Concerns

{Error handling strategy, validation boundaries, configuration and secrets handling,
logging and observability, and the concurrency or state model.}

## Non-Functional Targets

{Numbered \`NFR-n\` list. Each item must carry a number: latency budget, payload limit,
supported load, bundle size, coverage floor, accessibility level. No "should be fast".}

## Build, Test And Deployment

{How the project is built, how it is tested at each level, how CI runs, how it ships,
and what the local development loop looks like.}

## Risks And Assumptions

{Two lists. Risks: what could invalidate this design, with the early warning sign.
Assumptions: every decision made on the PRD's behalf.}

# Specifications

## Scope

{In scope and out of scope, as two bullet lists. Be explicit about the out-of-scope
items so agents do not gold-plate.}

## Functional Requirements

{Numbered \`FR-n\` list. Each requirement gets: a one-line statement, the actor, the
trigger, the expected outcome, and the observable result that proves it works.
Group related requirements under \`###\` subheadings.}

## User Flows

{For each primary flow: preconditions, numbered steps, success outcome, and the
failure branches with what the user sees in each.}

## Interface Contracts

{The concrete surface area. For an API: method, path, request shape, response shape,
status codes, error bodies. For a library: exported signatures. For a UI: screens,
their states (empty, loading, error, populated), and their controls. Use tables or
fenced blocks.}

## Business Rules And Validation

{Every rule as \`RULE-n\`: the condition, the enforcement point, and the exact behaviour
when violated, including the message shown or returned.}

## State And Persistence Rules

{What is stored, where, for how long, what is derived rather than stored, and what
happens on conflict or concurrent write.}

## Non-Functional Requirements

{Expand the \`NFR-n\` items into testable statements: the measurement, the threshold,
and how it is measured.}

## Acceptance Criteria

{Project-level, checkbox list, each item verifiable by a command or an observation.
This is the definition of "the product is built".}

## Open Questions

{Anything genuinely undecidable from the PRD, each with the assumption adopted so
implementation is never blocked. Write "None." if there are none.}`,

    buildContextBlock([{ label: 'PRD', content: prd, limit: 20_000 }]),

    `Produce the complete markdown document now, starting with \`# Architecture\`.`
  );
}

/** Split the model's single document back into its two halves. */
function splitSections(markdownContent: string): {
  architecture: string;
  specifications: string;
} {
  let architecture = '';
  let specifications = '';

  const sections = markdownContent.split(/^# /m).filter((section) => section.trim());
  for (const section of sections) {
    const lines = section.trim().split('\n');
    const title = lines[0].toLowerCase();
    const content = lines.slice(1).join('\n').trim();

    if (!architecture && title.includes('architecture')) {
      architecture = content;
    } else if (!specifications && (title.includes('specification') || title.includes('spec'))) {
      specifications = content;
    }
  }

  // Fallbacks for models that drop or rename one of the two headings.
  if (!architecture) {
    architecture = markdownContent
      .split(/^# Specifications?/im)[0]
      .replace(/^# Architecture\s*/i, '')
      .trim();
  }
  if (!specifications) {
    const specMatch = markdownContent.match(/^# Specifications?([\s\S]*)$/im);
    specifications = specMatch ? specMatch[1].trim() : '';
  }

  return { architecture, specifications };
}

/** Structural checks that justify a repair round-trip. */
function validateOutput(architecture: string, specifications: string): string[] {
  const issues: string[] = [];

  if (architecture.length < 400) {
    issues.push('The Architecture section is too short to implement from. Expand every required subsection.');
  }
  if (specifications.length < 400) {
    issues.push('The Specifications section is too short to implement from. Expand every required subsection.');
  }

  const architectureHeadings = ['Technology Stack', 'Components', 'Data Flow', 'Non-Functional Targets'];
  for (const heading of architectureHeadings) {
    if (!architecture.includes(heading)) {
      issues.push(`The Architecture section is missing its "## ${heading}" subsection.`);
    }
  }

  const specHeadings = ['Functional Requirements', 'Interface Contracts', 'Acceptance Criteria'];
  for (const heading of specHeadings) {
    if (!specifications.includes(heading)) {
      issues.push(`The Specifications section is missing its "## ${heading}" subsection.`);
    }
  }

  if (!/\bFR-\d+/.test(specifications)) {
    issues.push('Functional requirements must be labelled with stable ids (FR-1, FR-2, ...).');
  }
  if (/see (the )?architecture/i.test(specifications)) {
    issues.push('The Specifications section defers to the architecture. It must be complete on its own.');
  }
  if (/\{[a-z][a-z ]+\}/i.test(`${architecture}\n${specifications}`)) {
    issues.push('The document still contains unreplaced {placeholder} text from the template.');
  }

  return issues;
}

export async function generateArchitecture(
  input: GenerateArchitectureInput,
  apiKey?: string,
  model?: string,
  apiBase?: string,
  temperature?: number
): Promise<GenerateArchitectureOutput> {
  if (!model) {
    throw new Error('Model is required. Please provide a model in "provider/model" format in settings.');
  }

  const basePrompt = buildArchitecturePrompt(input.prd);
  const config =
    apiKey || apiBase || temperature !== undefined
      ? {
          ...(apiKey && { apiKey }),
          ...(apiBase && { apiBase }),
          ...(temperature !== undefined && { temperature }),
        }
      : undefined;

  let prompt = basePrompt;
  let best = { architecture: '', specifications: '' };

  for (let attempt = 0; attempt < 3; attempt++) {
    const { output } = await ai.generate({ model, prompt, system: SYSTEM_PROMPT, config });
    const markdownContent = ((output as string) ?? '').trim();
    if (!markdownContent) {
      throw new Error('An unexpected empty response was received from the model.');
    }

    const split = splitSections(markdownContent);
    if (split.architecture.length + split.specifications.length > best.architecture.length + best.specifications.length) {
      best = split;
    }

    const issues = validateOutput(split.architecture, split.specifications);
    if (issues.length === 0) {
      break;
    }

    prompt = buildRepairPrompt({
      originalPrompt: basePrompt,
      previousOutput: markdownContent,
      issues,
    });
  }

  const [architectureLint, specificationsLint] = await Promise.all([
    MarkdownLinter.lintAndFix(best.architecture, 'architecture.md'),
    MarkdownLinter.lintAndFix(best.specifications, 'specifications.md'),
  ]);

  return {
    architecture: architectureLint.fixedContent || best.architecture,
    specifications: specificationsLint.fixedContent || best.specifications,
  };
}
