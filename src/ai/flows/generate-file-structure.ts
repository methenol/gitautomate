'use server';

/**
 * @fileOverview Generates the repository file/folder structure for a project.
 *
 * The tree is the shared vocabulary for the rest of the plan: task files point at
 * paths from this tree, so it must be complete (tests, config, CI, docs) and every
 * path must be a real, sensible path for the chosen stack.
 *
 * - generateFileStructure - Generates a comprehensive, human-editable file/folder structure.
 * - GenerateFileStructureInput - Input type: { prd, architecture, specifications }
 * - GenerateFileStructureOutput - Output type: { fileStructure }
 */

import { ai } from '@/ai/litellm';
import { z } from 'zod';
import { MarkdownLinter } from '@/services/markdown-linter';
import {
  MARKDOWN_ONLY_CONTRACT,
  buildContextBlock,
  buildRepairPrompt,
  composePrompt,
} from '@/ai/prompts/shared';

const GenerateFileStructureInputSchema = z.object({
  prd: z.string().describe('The Product Requirements Document (PRD) for the project.'),
  architecture: z.string().describe('The proposed software architecture for the project.'),
  specifications: z.string().describe('The detailed specifications for the project.'),
});
export type GenerateFileStructureInput = z.infer<typeof GenerateFileStructureInputSchema>;

const GenerateFileStructureOutputSchema = z.object({
  fileStructure: z
    .string()
    .describe('A comprehensive, proposed file/folder structure for the project, as a markdown code block.'),
});
export type GenerateFileStructureOutput = z.infer<typeof GenerateFileStructureOutputSchema>;

const SYSTEM_PROMPT = `You are a senior software architect laying out a new repository. You produce trees that a coding agent can create file-by-file without guessing, using the idiomatic layout of the chosen stack.`;

function buildFileStructurePrompt(input: GenerateFileStructureInput): string {
  return composePrompt(
    `# Task

Propose the complete repository layout for the project described below. A coding
agent will create these files as it works through the implementation plan, and every
task in that plan will reference paths from this tree.`,

    MARKDOWN_ONLY_CONTRACT,

    `## Rules

- Output a single fenced code block containing one tree, using two-space indentation
  and a trailing \`/\` on directories. No box-drawing characters.
- Start at the repository root as \`.\` on the first line.
- Follow the idiomatic layout of the stack named in the architecture. Do not import
  conventions from another ecosystem.
- Every component named in the architecture must have a file or directory here.
- Cover the whole repository, not just application code:
  - source, organised by the architecture's component boundaries
  - tests, mirroring the source layout, including fixtures
  - configuration: package/dependency manifests, lockfile, formatter, linter, type checker
  - CI workflows, and container or deployment files if the architecture implies them
  - \`docs/\` containing \`PRD.md\`, \`ARCHITECTURE.md\`, \`SPECIFICATION.md\`, \`STANDARDS.md\`, \`FILE_STRUCTURE.md\`, \`PLAN.md\`
  - \`tasks/\` for the generated task files
  - \`AGENTS.md\`, \`README.md\`, \`.gitignore\`, and an env example file if configuration is needed
- Annotate a file only when its purpose is not obvious from its name, using a trailing
  \`  # short purpose\`. Keep annotations under 60 characters.
- No placeholder names (\`file1.ts\`, \`module_a/\`), no \`...\`, no commentary outside the fence.
- Do not invent files for features that are out of scope in the specifications.`,

    buildContextBlock([
      { label: 'PRD', content: input.prd, limit: 10_000 },
      { label: 'Architecture', content: input.architecture },
      { label: 'Specifications', content: input.specifications },
    ]),

    `Output the fenced tree now, and nothing else.`
  );
}

const TREE_FENCE = /```[a-z]*\s*\n([\s\S]*?)```/i;

function extractTree(markdown: string): string {
  const match = markdown.match(TREE_FENCE);
  return (match ? match[1] : markdown).trim();
}

function validateFileStructure(markdown: string): string[] {
  const issues: string[] = [];
  const tree = extractTree(markdown);
  const lines = tree.split('\n').filter((line) => line.trim().length > 0);

  if (!TREE_FENCE.test(markdown)) {
    issues.push('The tree must be inside a single fenced code block.');
  }
  if (lines.length < 15) {
    issues.push(
      `The tree has only ${lines.length} entries. Expand it to cover source, tests, config, CI, and docs.`
    );
  }
  if (/[├└│]/.test(tree)) {
    issues.push('Remove box-drawing characters (├ └ │) and use two-space indentation instead.');
  }
  if (/\.\.\./.test(tree)) {
    issues.push('Remove "..." — list every file explicitly.');
  }
  if (!/(^|\/)(tests?|spec|__tests__)\//im.test(tree) && !/\.(test|spec)\./i.test(tree)) {
    issues.push('The tree contains no test files or test directory.');
  }
  if (!/docs\//i.test(tree)) {
    issues.push('The tree is missing the `docs/` directory required by the plan.');
  }
  if (!/AGENTS\.md/i.test(tree)) {
    issues.push('The tree is missing `AGENTS.md` at the repository root.');
  }

  return issues;
}

export async function generateFileStructure(
  input: GenerateFileStructureInput,
  apiKey?: string,
  model?: string,
  apiBase?: string,
  temperature?: number
): Promise<GenerateFileStructureOutput> {
  if (!model) {
    throw new Error('Model is required. Please provide a model in "provider/model" format in settings.');
  }

  const basePrompt = buildFileStructurePrompt(input);
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
    const markdownContent = ((output as string) ?? '').trim();
    if (!markdownContent) {
      throw new Error('An unexpected empty response was received from the model.');
    }
    if (markdownContent.length > best.length) {
      best = markdownContent;
    }

    const issues = validateFileStructure(markdownContent);
    if (issues.length === 0) {
      best = markdownContent;
      break;
    }

    prompt = buildRepairPrompt({
      originalPrompt: basePrompt,
      previousOutput: markdownContent,
      issues,
    });
  }

  const lint = await MarkdownLinter.lintAndFix(best, 'file-structure.md');
  return { fileStructure: lint.fixedContent || best };
}
