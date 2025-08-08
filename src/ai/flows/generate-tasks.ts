'use server';

/**
 * @fileOverview Transforms the architecture and specifications into actionable task titles.
 *
 * - generateTasks - A function that transforms architecture and specifications into task titles.
 * - GenerateTasksInput - The input type for the generateTasks function.
 * - GenerateTasksOutput - The return type for the generateTasks function.
 * - Task - The type for an individual task. Details are populated in a separate step.
 */

import {ai} from '@/ai/genkit';
import { TaskSchema } from '@/types';
import {z} from 'genkit';


const _GenerateTasksInputSchema = z.object({
  architecture: z.string().describe('The architecture of the project.'),
  specifications: z.string().describe('The specifications of the project.'),
  fileStructure: z.string().describe('The file structure of the project.'),
});
export type GenerateTasksInput = z.infer<typeof _GenerateTasksInputSchema>;


const GenerateTasksOutputSchema = z.object({
  tasks: z.array(TaskSchema).describe('A list of actionable task titles.'),
});
export type GenerateTasksOutput = z.infer<typeof GenerateTasksOutputSchema>;

const standardPrompt = `You are a lead software engineer creating a detailed project plan for an AI programmer. Your task is to break down a project's architecture, file structure, and specifications into a series of actionable, granular development task *titles*.

The tasks must be generated in a strict, sequential order that a developer would follow. Start with foundational tasks like project setup (which must include configuring pre-commit git hooks to enforce code styles, run tests, and check for syntax errors), creating the component library, and configuring CI/CD. Then, build out the features in a logical sequence, ensuring that any dependencies are addressed in prior tasks. For example, user authentication should be built before features that require a logged-in user.

These tasks are for an AI programmer, so they must be clear, unambiguous, and represent a single, contained unit of work. The tasks should represent meaningful chunks of work. Avoid creating tasks that are too small or trivial. For example, "Implement user login page" is a good task, but "Add password input to login form" is too granular.

Architecture:
{{{architecture}}}

File Structure:
{{{fileStructure}}}

Specifications:
{{{specifications}}}

Generate the complete, exhaustive, and sequentially ordered list of task titles now.`;

const tddPrompt = `You are a lead software engineer creating a detailed project plan for an AI programmer. Your task is to break down a project's architecture, file structure, and specifications into a series of actionable, granular development task *titles*.

The tasks must be generated in a strict, sequential order that a developer would follow. Start with foundational tasks like project setup (which must include configuring pre-commit git hooks to enforce code styles, run tests, and check for syntax errors), creating the component library, and configuring CI/CD. The very next task must be to "Configure the testing environment". Then, build out the features in a logical sequence, ensuring that any dependencies are addressed in prior tasks. For example, user authentication should be built before features that require a logged-in user.

These tasks are for an AI programmer, so they must be clear, unambiguous, and represent a single, contained unit of work. The tasks should represent meaningful chunks of work. Avoid creating tasks that are too small or trivial. For example, "Implement user login page" is a good task, but "Add password input to login form" is too granular.

For each task, the implementation must strictly follow all phases of Test-Driven Development (Red-Green-Refactor).

Architecture:
{{{architecture}}}

File Structure:
{{{fileStructure}}}

Specifications:
{{{specifications}}}

Generate the complete, exhaustive, and sequentially ordered list of task titles now.`;

// Define the flow at module level to avoid runtime definition errors
const generateTasksFlow = ai.defineFlow(
  {
    name: 'generateTasksFlow',
    inputSchema: _GenerateTasksInputSchema,
    outputSchema: GenerateTasksOutputSchema,
  },
  async (input, { apiKey, model, useTDD }: { apiKey?: string; model?: string; useTDD?: boolean } = {}) => {
    const modelName = model ? `googleai/${model}` : 'googleai/gemini-1.5-flash-latest';
    
    const promptTemplate = useTDD ? tddPrompt : standardPrompt;

    const prompt = promptTemplate
      .replace('{{{architecture}}}', input.architecture)
      .replace('{{{fileStructure}}}', input.fileStructure)
      .replace('{{{specifications}}}', input.specifications);

    const {output} = await ai.generate({
      model: modelName,
      prompt: prompt,
      output: {
        schema: GenerateTasksOutputSchema
      },
      config: apiKey ? { apiKey } : undefined,
    });
    
    if (output?.tasks) {
      output.tasks = output.tasks.map((task) => ({ ...task, details: '' }));
    }
    return output!;
  }
);

export async function generateTasks(input: GenerateTasksInput, apiKey?: string, model?: string, useTDD?: boolean): Promise<GenerateTasksOutput> {
  return await generateTasksFlow(input, { apiKey, model, useTDD });
}
