

'use server';

/**
 * @fileOverview Enhanced task research engine that considers dependencies and context.
 *
 * - TaskResearchEngine - Enhanced task research with dependency awareness
 * - ResearchTaskWithDependenciesInput - Input type for enhanced research
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  researchTask,
  ResearchTaskInput,
  ResearchTaskOutput,
} from './research-task';
import { Task, ResearchedTask } from './unified-context';

const ResearchTaskWithDependenciesInputSchema = z.object({
  title: z.string().describe('The title of the development task to research.'),
  architecture: z.string().describe('The overall architecture of the project.'),
  fileStructure: z.string().describe('The file/folder structure of the project.'),
  specifications: z.string().describe('The specifications of the project.'),
  dependencies: z.array(z.string()).optional().default([]).describe('IDs of tasks that this task depends on.'),
  completedTasks: z.array(z.object({
    title: z.string(),
    details: z.string().optional(),
  })).optional().default([]).describe('Tasks that have already been completed.'),
  useTDD: z.boolean().optional().default(false),
  apiKey: z.string().optional(),
  model: z.string().optional(),
});

export type ResearchTaskWithDependenciesInput = z.infer<typeof ResearchTaskWithDependenciesInputSchema>;

const EnhancedResearchTaskOutputSchema = z.object({
  context: z
    .string()
    .describe(
      'Briefly explain how this task fits into the overall architecture and its relationship to dependencies.'
    ),
  implementationSteps: z
    .string()
    .describe(
      `Provide a detailed, step-by-step implementation guide. Describe what needs to be implemented without including actual code snippets. Focus on:
- Files that need to be created or modified
- Functions/components that need to be implemented
- Integration points with other system components
- The expected behavior and functionality
- How this task relates to its dependencies
- Any specific considerations or edge cases`
    ),
  acceptanceCriteria: z
    .string()
    .describe('Define what it means for this task to be considered "done".'),
  dependencyNotes: z
    .string()
    .describe('Important notes about how this task depends on or relates to other tasks.'),
});

export type EnhancedResearchTaskOutput = z.infer<typeof EnhancedResearchTaskOutputSchema>;

const enhancedPromptTemplate = `You are an expert project manager and senior software engineer. Your task is to perform detailed research for a specific development task within the context of a larger project and provide a comprehensive implementation plan.

You MUST return your response as a valid JSON object that conforms to the output schema.

**Project Context:**
- **Architecture:** {{{architecture}}}
- **File Structure:** {{{fileStructure}}}  
- **Specifications:** {{{specifications}}}

**Task Context:**
- **Current Task Title:** {{{title}}}  
{{#if dependencies}}
- **Dependencies:** This task depends on: {{dependencies}} (make sure to consider these when planning implementation)
{{/if}}
{{#if completedTasks}}
- **Completed Tasks:** The following tasks have been completed:
  {{completedTasks}}
{{/if}}

**Instructions:**
For the given task, provide a detailed breakdown considering all context above:

1. **Context:** Briefly explain how this task fits into the overall architecture, its relationship to dependencies, and why it's important for project success.

2. **Implementation Steps:** Provide a detailed, step-by-step implementation guide that:
   - Describes what needs to be implemented without including actual code snippets
   - Identifies files that need to be created or modified  
   - Outlines functions/components that need to be implemented
   - Explains integration points with other system components
   - Describes the expected behavior and functionality
   - **Crucially:** Shows how this task relates to its dependencies (what needs to be in place first)
   - Addresses any specific considerations or edge cases

3. **Acceptance Criteria:** Define clear, testable criteria for when this task should be considered complete.

4. **Dependency Notes:** Provide important notes about how this task depends on or relates to other tasks, including any prerequisites that must be satisfied.

Now, provide the detailed implementation plan as a JSON object for the task: **{{{title}}}**
`;

/**
 * Researches tasks with full context of dependencies and completed work
 */
export async function researchTaskWithDependencies(
  input: ResearchTaskWithDependenciesInput
): Promise<EnhancedResearchTaskOutput> {
  
  const modelName = input.model ? `googleai/${input.model}` : 'googleai/gemini-1.5-pro-latest';
  
  // Build enhanced prompt with dependency context
  const dependenciesText = input.dependencies.length > 0 
    ? input.dependencies.join(', ')
    : 'None';
  
  const completedTasksText = input.completedTasks && input.completedTasks.length > 0
    ? input.completedTasks.map(task => `- ${task.title}${task.details ? ': ' + task.details.substring(0, 100) + '...' : ''}`).join('\n')
    : 'None';

  // Enhanced prompt construction
  const enhancedPrompt = `You are an expert project manager and senior software engineer. Your task is to perform detailed research for a specific development task within the context of a larger project and provide a comprehensive implementation plan.

**Project Context:**
- **Architecture:** ${input.architecture}
- **File Structure:** ${input.fileStructure}  
- **Specifications:** ${input.specifications}

**Task Context:**
- **Current Task Title:** ${input.title}
${input.dependencies.length > 0 ? `- **Dependencies:** This task depends on: ${dependenciesText} (make sure to consider these when planning implementation)` : '- **Dependencies:** None'}
${input.completedTasks && input.completedTasks.length > 0 ? `- **Completed Tasks:** The following tasks have been completed:\n${completedTasksText}` : '- **Completed Tasks:** None'}

**Instructions:**
For the given task, provide a detailed breakdown considering all context above:

1. **Context:** Briefly explain how this task fits into the overall architecture, its relationship to dependencies, and why it's important for project success.

2. **Implementation Steps:** Provide a detailed, step-by-step implementation guide that:
   - Describes what needs to be implemented without including actual code snippets
   - Identifies files that need to be created or modified  
   - Outlines functions/components that need to be implemented
   - Explains integration points with other system components
   - Describes the expected behavior and functionality
   - **Crucially:** Shows how this task relates to its dependencies (what needs to be in place first)
   - Addresses any specific considerations or edge cases

3. **Acceptance Criteria:** Define clear, testable criteria for when this task should be considered complete.

4. **Dependency Notes:** Provide important notes about how this task depends on or relates to other tasks, including any prerequisites that must be satisfied.

Now, provide the detailed implementation plan as a JSON object for the task: **${input.title}**
`;

  const enhancedTaskResearchFlow = ai.defineFlow(
    {
      name: 'enhancedTaskResearchFlow',
      inputSchema: z.string(),
      outputSchema: EnhancedResearchTaskOutputSchema,
    },
    async (prompt) => {
      const { output } = await ai.generate({
        model: modelName,
        prompt: prompt,
        output: {
          schema: EnhancedResearchTaskOutputSchema,
        },
        config: input.apiKey ? { apiKey: input.apiKey } : undefined,
      });

      if (!output) {
        throw new Error(
          'An unexpected response was received from the server.'
        );
      }
      
      // Validate that we have all required fields
      if (!output.context || !output.implementationSteps || !output.acceptanceCriteria) {
        throw new Error(
          'Invalid response from AI model. Missing required fields in enhanced task research.'
        );
      }
      
      return output;
    }
  );

  return await enhancedTaskResearchFlow(enhancedPrompt);
}

/**
 * Batch research tasks with dependency awareness
 */
export async function batchResearchTasksWithDependencies(
  tasks: Task[],
  context: {
    architecture: string;
    fileStructure: string; 
    specifications: string;
  },
  useTDD?: boolean,
  apiKey?: string,
  model?: string
): Promise<ResearchedTask[]> {
  
  const researchedTasks: ResearchedTask[] = [];
  const completedTitles = new Set<string>();
  
  // Sort tasks by dependencies (basic topological sort)
  const sortedTasks = [...tasks].sort((a, b) => {
    // Simple heuristic: tasks with fewer dependencies come first
    return a.dependencies.length - b.dependencies.length;
  });

  for (const task of sortedTasks) {
    try {
      const researchInput: ResearchTaskWithDependenciesInput = {
        title: task.title,
        architecture: context.architecture,
        fileStructure: context.fileStructure,
        specifications: context.specifications,
        dependencies: task.dependencies || [],
        completedTasks: researchedTasks.map(rt => ({
          title: rt.title,
          details: rt.details || `${rt.context.substring(0, 100)}...`,
        })),
        useTDD: useTDD || false,
        apiKey,
        model,
      };

      const researchResult = await researchTaskWithDependencies(researchInput);
      
      researchedTasks.push({
        ...task,
        context: researchResult.context,
        implementationSteps: researchResult.implementationSteps,
        acceptanceCriteria: researchResult.acceptanceCriteria,
      });

      completedTitles.add(task.title);
      
    } catch (error) {
      console.warn(`Failed to research task "%s":`, String(task.title), error);
      
      // Add placeholder for failed tasks
      researchedTasks.push({
        ...task,
        context: `Context research failed for task "${task.title}"`,
        implementationSteps: 'Implementation steps could not be generated due to an error.',
        acceptanceCriteria: 'Acceptance criteria could not be defined due to research failure.',
      });
    }
  }

  return researchedTasks;
}

