'use server';

import {
  generateUnifiedProject,
  UnifiedProjectGenerationInput,
  validateProjectPlan
} from '@/ai/flows/unified-project-generation';
import { listAvailableModels } from '@/ai/genkit';

// Legacy type definitions for compatibility
export interface GenerateTasksInput {
  architecture: string;
  specifications: string;
  fileStructure: string;
}

export interface GenerateFileStructureInput {
  prd: string;
  architecture: string;
  specifications: string;
}

export interface ResearchTaskInput {
  title: string;
  architecture: string;
  specifications: string;
  fileStructure: string;
}

export interface ResearchTaskOutput {
  context: string;
  implementationSteps: string;
  acceptanceCriteria: string;
}

type ActionOptions = {
  apiKey?: string;
  model?: string;
  useTDD?: boolean;
};

/**
 * Generate complete unified project plan (replaces separate generation functions)
 */
export async function runGenerateUnifiedProject(
  input: { prd: string },
  options?: ActionOptions & {
    researchTasks?: boolean;
    validatePlan?: boolean;
  }
) {
  if (!input.prd) {
    throw new Error('PRD is required to generate project plan.');
  }
  
  try {
    const unifiedInput: UnifiedProjectGenerationInput = {
      prd: input.prd,
      apiKey: options?.apiKey,
      model: options?.model || 'googleai/gemini-1.5-flash-latest',
      useTDD: options?.useTDD || false
    };

    const result = await generateUnifiedProject(unifiedInput, {
      researchTasks: options?.researchTasks,
      validatePlan: options?.validatePlan
    });

    return result;
  } catch (error) {
    console.error('Error generating unified project:', error);
    
    if (
      error instanceof Error &&
      (error.message.includes('API key not found') ||
        error.message.includes('API key is invalid') ||
        error.message.includes('Please check your Google AI API key'))
    ) {
      throw new Error(
        'Failed to generate project: Your Google AI API key is missing or invalid. Please check it in settings.'
      );
    }
    
    throw new Error(
      'Project generation failed. The model may have returned an unexpected response. Try a different model or adjust the PRD.'
    );
  }
}

/**
 * Legacy functions - kept for compatibility but deprecated
 * @deprecated Use runGenerateUnifiedProject instead
 */
export async function runGenerateTasks(
  input: GenerateTasksInput,
  options?: ActionOptions
) {
  console.warn('runGenerateTasks is deprecated. Use runGenerateUnifiedProject instead.');
  
  if (!input.architecture || !input.specifications || !input.fileStructure) {
    throw new Error(
      'Architecture, specifications, and file structure are required to generate tasks.'
    );
  }
  
  try {
    // Generate unified project instead
    const result = await runGenerateUnifiedProject({
      prd: `Architecture:\n${input.architecture}\n\nSpecifications:\n${input.specifications}\n\nFile Structure:\n${input.fileStructure}`
    }, options);
    
    return {
      tasks: Object.values(result.projectPlan.dependencyGraph.tasks).map(task => ({
        title: (task as any).title,
        details: (task as any).implementationSteps
      }))
    };
  } catch (error) {
    console.error('Error generating tasks:', error);
    throw new Error(
      'Failed to generate tasks. The model may have returned an unexpected response.'
    );
  }
}

/**
 * Legacy function - kept for compatibility but deprecated
 * @deprecated Use runGenerateUnifiedProject instead
 */
export async function runGenerateFileStructure(
  input: GenerateFileStructureInput,
  options?: ActionOptions
) {
  console.warn('runGenerateFileStructure is deprecated. Use runGenerateUnifiedProject instead.');
  
  if (!input.prd || !input.architecture || !input.specifications) {
    throw new Error(
      'PRD, architecture, and specifications are required to generate the file structure.'
    );
  }
  
  try {
    // Generate unified project instead
    const result = await runGenerateUnifiedProject({
      prd: input.prd,
    }, options);
    
    return {
      fileStructure: result.projectPlan.context.fileStructure
    };
  } catch (error) {
    console.error('Error generating file structure:', error);
    
    if (
      error instanceof Error &&
      (error.message.includes('API key not found') ||
        error.message.includes('API key is invalid') ||
        error.message.includes('Please check your Google AI API key'))
    ) {
      throw new Error(
        'Failed to generate file structure: Your Google AI API key is missing or invalid. Please check it in settings.'
      );
    }
    
    throw new Error(
      'File structure generation failed. The model may have returned an unexpected response.'
    );
  }
}

/**
 * Legacy function - kept for compatibility but deprecated
 * @deprecated Use runGenerateUnifiedProject instead
 */
export async function runResearchTask(
  input: ResearchTaskInput,
  options?: ActionOptions
): Promise<ResearchTaskOutput> {
  console.warn('runResearchTask is deprecated. Use runGenerateUnifiedProject with researchTasks=true instead.');
  
  if (!input.title || !input.architecture || !input.specifications || !input.fileStructure) {
    throw new Error(
      'Task title, architecture, specifications, and file structure are required for research.'
    );
  }

  try {
    // Generate unified project with task research instead
    const result = await runGenerateUnifiedProject({
      prd: `Research for task: ${input.title}\n\nArchitecture:\n${input.architecture}\n\nSpecifications:\n${input.specifications}\n\nFile Structure:\n${input.fileStructure}`
    }, {
      ...options,
      researchTasks: true
    });
    
    const tasks = Object.values(result.projectPlan.dependencyGraph.tasks);
    const researchTask = tasks.find((task: any) => 
      (task as any).title.toLowerCase().includes(input.title.toLowerCase())
    );
    
    if (researchTask) {
      return {
        context: (researchTask as any).context,
        implementationSteps: (researchTask as any).implementationSteps,
        acceptanceCriteria: (researchTask as any).acceptanceCriteria
      };
    }
    
    throw new Error(`Research task "${input.title}" not found in generated plan.`);
  } catch (error) {
    console.error('Error researching task:', error);
    
    const MAX_RETRIES = 3;
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        // Fallback to original research if unified generation fails
        const result = await import('@/ai/flows/research-task').then(m => 
          m.researchTask(input, options?.apiKey, options?.model, options?.useTDD)
        );
        
        return result;
      } catch (fallbackError) {
        console.error(
          `Fallback error researching task "${input.title}" (Attempt ${i + 1}/${MAX_RETRIES}):`,
          fallbackError
        );
        
        if (i === MAX_RETRIES - 1) {
          throw new Error(
            `Failed to research task "${input.title}" after ${MAX_RETRIES} attempts. The AI may have refused to answer or returned an invalid format. Please try a different model if the issue persists.`
          );
        }
        
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // This should not be reachable due to the throw inside loop
    throw new Error(`Failed to research task "${input.title}".`);
  }
}

export async function getModels(options?: ActionOptions): Promise<string[]> {
  try {
    const models = await listAvailableModels(options?.apiKey);
    return models;
  } catch (error) {
    console.error('Failed to fetch models:', error);
    if (error instanceof Error) {
      // Pass the specific error message to the client.
      throw new Error(`Failed to fetch models: ${error.message}`);
    }
    throw new Error('An unknown error occurred while fetching models.');
  }
}
