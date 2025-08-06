

'use server';

/**
 * @fileOverview Compatibility layer that provides the same interface as the old action system
 * but internally uses the new unified orchestrator. This allows for a gradual migration path.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  generateUnifiedProjectPlan,
  ProjectPlanInput,
} from './task-generation-orchestrator';
import { TaskSchema } from '@/types';

// Import old types for compatibility
export type GenerateArchitectureInput = {
  prd: string;
};

export type GenerateTasksInput = {
  architecture: string;
  specifications: string;
  fileStructure: string;
};

export type ResearchTaskInput = {
  title: string;
  architecture: string;
  fileStructure: string;
  specifications: string;
};

export type GenerateFileStructureInput = {
  prd: string;
  architecture: string;
  specifications: string;
};

// Import old output types
import type { GenerateArchitectureOutput } from './generate-architecture';
import type { GenerateTasksOutput, Task as OldTask } from './generate-tasks';
import type { ResearchTaskOutput } from './research-task';

// Unified project plan output
export interface UnifiedProjectPlan {
  context: any;
  tasks: OldTask[];
  researchResults: Map<string, ResearchTaskOutput>;
  validationResults: any[];
}

const UnifiedProjectPlanSchema = z.object({
  context: z.any(),
  tasks: z.array(TaskSchema),
  researchResults: z.record(z.any()),
  validationResults: z.array(z.any()).default([]),
});

export type UnifiedProjectPlanOutput = z.infer<typeof UnifiedProjectPlanSchema>;

/**
 * Generate architecture using the unified system (for compatibility).
 */
export async function generateUnifiedArchitecture(
  input: GenerateArchitectureInput,
  options?: { apiKey?: string; model?: string }
): Promise<GenerateArchitectureOutput> {
  try {
    const projectPlanInput: ProjectPlanInput = {
      prd: input.prd,
      apiKey: options?.apiKey,
      model: options?.model || 'gemini-1.5-flash-latest',
    };

    const projectPlan = await generateUnifiedProjectPlan(projectPlanInput);
    
    if (!projectPlan.context.architecture) {
      throw new Error('Failed to generate architecture');
    }

    return {
      architecture: projectPlan.context.architecture.architecture,
      specifications: projectPlan.context.architecture.specifications
    };
  } catch (error) {
    throw new Error(`Unified architecture generation failed: ${(error as Error).message}`);
  }
}

/**
 * Generate file structure using the unified system (for compatibility).
 */
export async function generateUnifiedFileStructure(
  input: GenerateFileStructureInput,
  options?: { apiKey?: string; model?: string }
): Promise<{ fileStructure: string }> {
  try {
    const projectPlanInput: ProjectPlanInput = {
      prd: input.prd,
      apiKey: options?.apiKey,
      model: options?.model || 'gemini-1.5-flash-latest',
    };

    const projectPlan = await generateUnifiedProjectPlan(projectPlanInput);
    
    if (!projectPlan.context.fileStructure) {
      throw new Error('Failed to generate file structure');
    }

    return {
      fileStructure: projectPlan.context.fileStructure.fileStructure
    };
  } catch (error) {
    throw new Error(`Unified file structure generation failed: ${(error as Error).message}`);
  }
}

/**
 * Generate tasks using the unified system (for compatibility).
 */
export async function generateUnifiedTasks(
  input: GenerateTasksInput,
  options?: { apiKey?: string; model?: string; useTDD?: boolean }
): Promise<GenerateTasksOutput> {
  try {
    const projectPlanInput: ProjectPlanInput = {
      prd: `Architecture:\n${input.architecture}\n\nSpecifications:\n${input.specifications}`,
      apiKey: options?.apiKey,
      model: options?.model || 'gemini-1.5-flash-latest',
      useTDD: options?.useTDD || false,
    };

    const projectPlan = await generateUnifiedProjectPlan(projectPlanInput);

    return {
      tasks: projectPlan.tasks
    };
  } catch (error) {
    throw new Error(`Unified task generation failed: ${(error as Error).message}`);
  }
}

/**
 * Research a single task using the unified system (for compatibility).
 */
export async function researchUnifiedTask(
  input: ResearchTaskInput,
  options?: { apiKey?: string; model?: string; useTDD?: boolean }
): Promise<ResearchTaskOutput> {
  try {
    const projectPlanInput: ProjectPlanInput = {
      prd: `Architecture:\n${input.architecture}\n\nSpecifications:\n${input.specifications}`,
      apiKey: options?.apiKey,
      model: options?.model || 'gemini-1.5-flash-latest',
      useTDD: options?.useTDD || false,
    };

    const projectPlan = await generateUnifiedProjectPlan(projectPlanInput);
    
    // Find the research result for this specific task
    const researchResult = projectPlan.researchResults.get(input.title);
    
    if (!researchResult) {
      throw new Error(`Failed to research task: ${input.title}`);
    }

    return researchResult;
  } catch (error) {
    throw new Error(`Unified task research failed: ${(error as Error).message}`);
  }
}

/**
 * Generate a complete project plan using the unified system.
 */
export async function generateCompleteUnifiedProjectPlan(
  input: ProjectPlanInput
): Promise<UnifiedProjectPlanOutput> {
  try {
    const projectPlan = await generateUnifiedProjectPlan(input);
    
    // Convert research results to the expected format
    const formattedResearchResults: Record<string, ResearchTaskOutput> = {};
    
    for (const [taskId, researchResult] of projectPlan.researchResults) {
      const task = projectPlan.tasks.find(t => t.id === taskId);
      if (task) {
        formattedResearchResults[task.title] = researchResult;
      }
    }

    return {
      context: projectPlan.context,
      tasks: projectPlan.tasks.map(task => ({
        title: task.title,
        details: '' // Will be filled by the research results
      })),
      researchResults: formattedResearchResults,
      validationResults: projectPlan.validationResults
    };
  } catch (error) {
    throw new Error(`Complete unified project plan generation failed: ${(error as Error).message}`);
  }
}

/**
 * Generate tasks with full research using the unified system.
 */
export async function generateUnifiedTasksWithResearch(
  input: ProjectPlanInput
): Promise<GenerateTasksOutput> {
  try {
    const projectPlan = await generateUnifiedProjectPlan(input);
    
    // Format tasks with research details
    const tasksWithDetails = projectPlan.tasks.map(task => {
      const researchResult = projectPlan.researchResults.get(task.id);
      
      if (researchResult) {
        const formattedDetails = `### Context\n${researchResult.context}\n\n### Implementation Steps\n${researchResult.implementationSteps}\n\n### Acceptance Criteria\n${researchResult.acceptanceCriteria}`;
        return {
          ...task,
          details: formattedDetails
        };
      }
      
      return task;
    });

    return {
      tasks: tasksWithDetails
    };
  } catch (error) {
    throw new Error(`Unified task generation with research failed: ${(error as Error).message}`);
  }
}

