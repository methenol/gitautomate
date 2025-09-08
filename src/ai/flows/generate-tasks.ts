'use server';

/**
 * @fileOverview Transforms the architecture and specifications into actionable task titles.
 *
 * - generateTasks - A function that transforms architecture and specifications into task titles.
 * - GenerateTasksInput - The input type for the generateTasks function.
 * - GenerateTasksOutput - The return type for the generateTasks function.
 * - Task - The type for an individual task. Details are populated in a separate step.
 */

import {ai} from '@/ai/litellm';
import { TaskSchema } from '@/types';
import {z} from 'zod';


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

**CRITICAL: You MUST output ONLY valid markdown format. DO NOT output JSON format. Use proper headers, lists, code blocks, and formatting.**

CRITICAL: Each item in your response MUST be an actionable development task. DO NOT include section headings, organizational markers, or grouping labels like "--BACKEND FOUNDATION--" or "## Frontend Tasks". Every single task title must represent a concrete, implementable unit of work that an AI programmer can execute.

You MUST generate a COMPREHENSIVE set of tasks that covers ALL aspects of the PRD, architecture, and specifications. Generate at least 10-15 tasks for a typical project, more for complex projects. Do not generate just 1-2 tasks - break down the work into meaningful, actionable chunks.

The tasks must be generated in a strict, sequential order that a developer would follow. Start with foundational tasks like project setup (which must include configuring pre-commit git hooks to enforce code styles, run tests, and check for syntax errors), creating the component library, and configuring CI/CD. Then, build out the features in a logical sequence, ensuring that any dependencies are addressed in prior tasks. For example, user authentication should be built before features that require a logged-in user.

These tasks are for an AI programmer, so they must be clear, unambiguous, and represent a single, contained unit of work. The tasks should represent meaningful chunks of work. Avoid creating tasks that are too small or trivial. For example, "Implement user login page" is a good task, but "Add password input to login form" is too granular.

Architecture:
{{{architecture}}}

File Structure:
{{{fileStructure}}}

Specifications:
{{{specifications}}}

Output format: List each task as a markdown bullet point. Do not include task details - just the task titles.

**IMPORTANT: Output ONLY markdown content with a bulleted list of task titles. DO NOT output JSON format. Do not wrap your response in JSON objects or use any JSON structure.**`;

const tddPrompt = `You are a lead software engineer creating a detailed project plan for an AI programmer. Your task is to break down a project's architecture, file structure, and specifications into a series of actionable, granular development task *titles*.

**CRITICAL: You MUST output ONLY valid markdown format. DO NOT output JSON format. Use proper headers, lists, code blocks, and formatting.**

CRITICAL: Each item in your response MUST be an actionable development task. DO NOT include section headings, organizational markers, or grouping labels like "--BACKEND FOUNDATION--" or "## Frontend Tasks". Every single task title must represent a concrete, implementable unit of work that an AI programmer can execute.

You MUST generate a COMPREHENSIVE set of tasks that covers ALL aspects of the PRD, architecture, and specifications. Generate at least 10-15 tasks for a typical project, more for complex projects. Do not generate just 1-2 tasks - break down the work into meaningful, actionable chunks.

The tasks must be generated in a strict, sequential order that a developer would follow. Start with foundational tasks like project setup (which must include configuring pre-commit git hooks to enforce code styles, run tests, and check for syntax errors), creating the component library, and configuring CI/CD. The very next task must be to "Configure the testing environment". Then, build out the features in a logical sequence, ensuring that any dependencies are addressed in prior tasks. For example, user authentication should be built before features that require a logged-in user.

These tasks are for an AI programmer, so they must be clear, unambiguous, and represent a single, contained unit of work. The tasks should represent meaningful chunks of work. Avoid creating tasks that are too small or trivial. For example, "Implement user login page" is a good task, but "Add password input to login form" is too granular.

For each task, the implementation must strictly follow all phases of Test-Driven Development (Red-Green-Refactor).

Architecture:
{{{architecture}}}

File Structure:
{{{fileStructure}}}

Specifications:
{{{specifications}}}

Output format: List each task as a markdown bullet point. Do not include task details - just the task titles.

**IMPORTANT: Output ONLY markdown content with a bulleted list of task titles. DO NOT output JSON format. Do not wrap your response in JSON objects or use any JSON structure.**`;

export async function generateTasks(input: GenerateTasksInput, apiKey?: string, model?: string, apiBase?: string, useTDD?: boolean, temperature = 0.7): Promise<GenerateTasksOutput> {
  if (!model) {
    throw new Error('Model is required. Please provide a model in "provider/model" format in settings.');
  }
  const modelName = model;

  const promptTemplate = useTDD ? tddPrompt : standardPrompt;

  const prompt = promptTemplate
    .replace('{{{architecture}}}', input.architecture)
    .replace('{{{fileStructure}}}', input.fileStructure)
    .replace('{{{specifications}}}', input.specifications);

  const {output} = await ai.generate({
    model: modelName,
    prompt: prompt,
    config: (apiKey || apiBase) ? {
      ...(apiKey && {apiKey}),
      ...(apiBase && {apiBase}),
      temperature: temperature
    } : undefined,
  });
  
  // Parse markdown output to extract task titles
  const markdownContent = output as string;
  const tasks: Array<{ title: string; details: string }> = [];
  
  // Extract bullet points from markdown
  const lines = markdownContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const title = trimmed.substring(2).trim();
      if (title) {
        tasks.push({ title, details: '' });
      }
    }
  }
  
  // If no bullet points found, try alternative parsing
  if (tasks.length === 0) {
    // Try to extract lines that look like task titles
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('**')) {
        // Check if it looks like a task title (contains action words)
        const actionWords = ['implement', 'create', 'build', 'setup', 'configure', 'add', 'develop', 'design', 'integrate', 'test'];
        if (actionWords.some(word => trimmed.toLowerCase().includes(word))) {
          tasks.push({ title: trimmed, details: '' });
        }
      }
    }
  }
  
  // Ensure we have at least some tasks
  if (tasks.length === 0) {
    throw new Error('Failed to extract task titles from generated content');
  }
  
  return { tasks };
}
