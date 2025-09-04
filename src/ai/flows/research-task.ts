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

const _ResearchTaskInputSchema = z.object({
  title: z.string().describe('The title of the development task to research.'),
  architecture: z.string().describe('The overall architecture of the project.'),
  fileStructure: z.string().describe('The file/folder structure of the project.'),
  specifications: z.string().describe('The specifications of the project.'),
});
export type ResearchTaskInput = { title: string; architecture: string; fileStructure: string; specifications: string };

const ResearchTaskOutputSchema = z.object({
  context: z
    .string()
    .describe(
      'Briefly explain how this task fits into the overall architecture.'
    ),
  implementationSteps: z
    .string()
    .describe(
      `Provide a detailed, step-by-step implementation guide. Describe what needs to be implemented without including actual code snippets. Focus on:
- Files that need to be created or modified
- Functions/components that need to be implemented
- Integration points with other system components
- The expected behavior and functionality
- Any specific considerations or edge cases`
    ),
  acceptanceCriteria: z
    .string()
    .describe('Define what it means for this task to be considered "done".'),
});
export type ResearchTaskOutput = z.infer<typeof ResearchTaskOutputSchema>;

const standardPrompt = `You are an expert project manager and senior software engineer. Your task is to perform detailed research for a specific development task and provide a comprehensive implementation plan.

You MUST return your response as a valid JSON object that conforms to the output schema.

For the given task, provide a detailed breakdown for each of the following fields:
- context: Briefly explain how this task fits into the overall architecture.
- implementationSteps: Provide a detailed, step-by-step implementation guide. Describe what needs to be implemented without including actual code snippets. Focus on:
  - Files that need to be created or modified
  - Functions/components that need to be implemented
  - Integration points with other system components
  - The expected behavior and functionality
  - Any specific considerations or edge cases
- acceptanceCriteria: Define what it means for this task to be considered "done".

Overall Project Architecture:
{{{architecture}}}

File Structure:
{{{fileStructure}}}

Overall Project Specifications:
{{{specifications}}}

Now, provide the detailed implementation plan as a JSON object for the following task:

**Task Title: {{{title}}}**
`;

const tddPrompt = `You are an expert project manager and senior software engineer. Your task is to perform detailed research for a specific development task and provide a comprehensive implementation plan.

You MUST return your response as a valid JSON object that conforms to the output schema.

For the given task, provide a detailed breakdown for each of the following fields:
- context: Briefly explain how this task fits into the overall architecture.
- implementationSteps: Provide a detailed, step-by-step implementation guide. Describe what needs to be implemented without including actual code snippets. Focus on:
  - Files that need to be created or modified
  - Functions/components that need to be implemented
  - Integration points with other system components
  - The expected behavior and functionality
  - Any specific considerations or edge cases. The implementation plan must strictly follow all phases of Test-Driven Development (Red-Green-Refactor).
- acceptanceCriteria: Define what it means for this task to be considered "done".

Overall Project Architecture:
{{{architecture}}}

File Structure:
{{{fileStructure}}}

Overall Project Specifications:
{{{specifications}}}

Now, provide the detailed implementation plan as a JSON object for the following task:

**Task Title: {{{title}}}**
`;

export async function researchTask(
  input: ResearchTaskInput,
  apiKey?: string,
  model?: string,
  apiBase?: string,
  useTDD?: boolean
): Promise<ResearchTaskOutput> {
  const modelName = model || 'gpt-4o';
  
  const promptTemplate = useTDD ? tddPrompt : standardPrompt;
  const prompt = promptTemplate
    .replace('{{{architecture}}}', input.architecture)
    .replace('{{{fileStructure}}}', input.fileStructure)
    .replace('{{{specifications}}}', input.specifications)
    .replace('{{{title}}}', input.title);

  const {output} = await ai.generate({
    model: modelName,
    prompt: prompt,
    output: {
      schema: ResearchTaskOutputSchema,
    },
    config: (apiKey || apiBase) ? {
      ...(apiKey && {apiKey}),
      ...(apiBase && {apiBase})
    } : undefined,
  });

  if (!output) {
    throw new Error(
      'An unexpected response was received from the server.'
    );
  }
  
  return output as ResearchTaskOutput;
}
