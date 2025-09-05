'use server';

/**
 * @fileOverview Researches a single development task and generates detailed implementation notes.
 *
 * - researchTask - A function that takes a task title and project context and returns detailed implementation steps.
 * - ResearchTaskInput - The input type for the researchTask function.
 * - ResearchTaskOutput - The return type for the researchTask function.
 */

import {ai} from '@/ai/litellm';
import {z} from 'zod';
import { MarkdownLinter } from '@/services/markdown-linter';

const _ResearchTaskInputSchema = z.object({
  title: z.string().describe('The title of the development task to research.'),
  architecture: z.string().describe('The overall architecture of the project.'),
  fileStructure: z.string().describe('The file/folder structure of the project.'),
  specifications: z.string().describe('The specifications of the project.'),
});
export type ResearchTaskInput = { title: string; architecture: string; fileStructure: string; specifications: string };

const ResearchTaskOutputSchema = z.object({
  markdownContent: z
    .string()
    .describe('Complete markdown-formatted task documentation ready for GitHub issues. Must include proper markdown headers, formatting, and structure.'),
});
export type ResearchTaskOutput = z.infer<typeof ResearchTaskOutputSchema>;

const standardPrompt = `You are an expert project manager and senior software engineer. Your task is to perform detailed research for a specific development task and provide a comprehensive implementation plan in markdown format.

You MUST return your response as a valid JSON object with a single "markdownContent" field containing a complete, properly formatted markdown document that is ready to be submitted as a GitHub issue.

The markdown content must follow this exact structure:

# {Task Title}

## Context

{Briefly explain how this task fits into the overall architecture}

## Implementation Steps

{Provide a detailed, step-by-step implementation guide. Describe what needs to be implemented without including actual code snippets. Focus on:
- Files that need to be created or modified
- Functions/components that need to be implemented
- Integration points with other system components
- The expected behavior and functionality
- Any specific considerations or edge cases}

## Required Libraries

{List all libraries, packages, frameworks, and tools needed for this specific task as a comma-separated list. Be comprehensive and specific. Examples:
- react, typescript, @types/node, tailwindcss, react-router-dom
- express, mongodb, mongoose, bcryptjs, jsonwebtoken, cors
- jest, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event}

## Documentation

Refer to the reference documentation for the required libraries listed above to understand their APIs, best practices, and implementation details before beginning development.

## Acceptance Criteria

{Define what it means for this task to be considered "done" as a bulleted list}

Overall Project Architecture:
{{{architecture}}}

File Structure:
{{{fileStructure}}}

Overall Project Specifications:
{{{specifications}}}

Now, provide the detailed implementation plan as a JSON object with properly formatted markdown content for the following task:

**Task Title: {{{title}}}**
`;

const tddPrompt = `You are an expert project manager and senior software engineer. Your task is to perform detailed research for a specific development task and provide a comprehensive implementation plan in markdown format following Test-Driven Development (TDD) methodology.

You MUST return your response as a valid JSON object with a single "markdownContent" field containing a complete, properly formatted markdown document that is ready to be submitted as a GitHub issue.

The markdown content must follow this exact structure:

# {Task Title}

## Context

{Briefly explain how this task fits into the overall architecture}

## Implementation Steps (TDD Approach)

{Provide a detailed, step-by-step implementation guide following Red-Green-Refactor methodology. Describe what needs to be implemented without including actual code snippets. Focus on:
- Files that need to be created or modified
- Functions/components that need to be implemented
- Integration points with other system components
- The expected behavior and functionality
- Any specific considerations or edge cases
- Test-Driven Development phases (Red-Green-Refactor)}

## Required Libraries

{List all libraries, packages, frameworks, and tools needed for this specific task as a comma-separated list. Be comprehensive and specific. Examples:
- react, typescript, @types/node, tailwindcss, react-router-dom
- express, mongodb, mongoose, bcryptjs, jsonwebtoken, cors
- jest, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event}

## Documentation

Refer to the reference documentation for the required libraries listed above to understand their APIs, best practices, and implementation details before beginning development.

## Acceptance Criteria

{Define what it means for this task to be considered "done" as a bulleted list}

Overall Project Architecture:
{{{architecture}}}

File Structure:
{{{fileStructure}}}

Overall Project Specifications:
{{{specifications}}}

Now, provide the detailed implementation plan as a JSON object with properly formatted markdown content for the following task:

**Task Title: {{{title}}}**
`;

export async function researchTask(
  input: ResearchTaskInput,
  apiKey?: string,
  model?: string,
  apiBase?: string,
  useTDD?: boolean
): Promise<ResearchTaskOutput> {
  if (!model) {
    throw new Error('Model is required. Please provide a model in "provider/model" format in settings.');
  }
  const modelName = model;
  
  const promptTemplate = useTDD ? tddPrompt : standardPrompt;
  const prompt = promptTemplate
    .replace('{{{architecture}}}', input.architecture)
    .replace('{{{fileStructure}}}', input.fileStructure)
    .replace('{{{specifications}}}', input.specifications)
    .replace('{{{title}}}', input.title);

  let retries = 3;
  while (retries > 0) {
    const {output} = await ai.generate({
      model: modelName,
      prompt: prompt + '\n\n**CRITICAL: You MUST output valid markdown format in the markdownContent field. Use proper headers, lists, code blocks, and formatting. The content will be automatically validated and you may be asked to retry if the markdown is invalid.**',
      output: {
        schema: ResearchTaskOutputSchema,
      },
      config: (apiKey || apiBase) ? {
        ...(apiKey && {apiKey}),
        ...(apiBase && {apiBase})
      } : undefined,
    });

    if (!output) {
      throw new Error('An unexpected response was received from the server.');
    }

    // Cast output to proper type
    const typedOutput = output as ResearchTaskOutput;

    // Lint and fix the generated task markdown
    const lintResult = await MarkdownLinter.lintAndFix(typedOutput.markdownContent, `task-${input.title.replace(/[^a-zA-Z0-9]/g, '-')}.md`);

    // If document is valid or can be fixed, return the result
    if (lintResult.isValid) {
      return {
        markdownContent: lintResult.fixedContent || typedOutput.markdownContent
      };
    }

    // If markdown is invalid and can't be fixed, retry
    retries--;
    if (retries === 0) {
      // Return the best we have with fixes applied
      return {
        markdownContent: lintResult.fixedContent || typedOutput.markdownContent
      };
    }
  }

  throw new Error('Failed to generate valid markdown after retries');
}
