'use server';

// Import both old and new unified systems for migration
import {
  generateArchitecture,
  GenerateArchitectureInput as OldGenerateArchitectureInput,
} from '@/ai/flows/generate-architecture';
import { generateTasks, GenerateTasksInput as OldGenerateTasksInput } from '@/ai/flows/generate-tasks';
import { researchTask, ResearchTaskInput as OldResearchTaskInput, ResearchTaskOutput } from '@/ai/flows/research-task';
import { generateFileStructure, GenerateFileStructureInput as OldGenerateFileStructureInput } from '@/ai/flows/generate-file-structure';
import { listAvailableModels } from '@/ai/genkit';

// Import new unified system
import {
  generateUnifiedProjectPlan,
} from '@/ai/flows/task-generation-orchestrator';
import {
  generateUnifiedTasksWithResearch,
} from '@/ai/flows/unified-actions';

type ActionOptions = {
  apiKey?: string;
  model?: string;
  useTDD?: boolean;
};

// Feature flag to control which system is used
const USE_UNIFIED_SYSTEM = true; // Set to false to use old system during development/testing

export async function runGenerateArchitecture(
  input: OldGenerateArchitectureInput,
  options?: ActionOptions
) {
  if (!input.prd) {
    throw new Error('PRD is required to generate architecture.');
  }

  if (USE_UNIFIED_SYSTEM) {
    try {
      const projectPlanInput = {
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
      console.error('Error generating architecture with unified system:', error);
      throw new Error(
        `Unified architecture generation failed: ${(error as Error).message}`
      );
    }
  }

  // Old system (fallback)
  try {
    const result = await generateArchitecture(
      input,
      options?.apiKey,
      options?.model
    );
    return result;
  } catch (error) {
    console.error('Error generating architecture:', error);
    if (
      error instanceof Error &&
      (error.message.includes('API key not found') ||
        error.message.includes('API key is invalid') ||
        error.message.includes('Please check your Google AI API key'))
    ) {
      throw new Error(
        'Failed to generate architecture: Your Google AI API key is missing or invalid. Please check it in settings.'
      );
    }
    throw new Error(
      'Architecture generation failed. The model may have returned an unexpected response. Try a different model or adjust the PRD.'
    );
  }
}

export async function runGenerateTasks(
  input: OldGenerateTasksInput,
  options?: ActionOptions
) {
  if (!input.architecture || !input.specifications || !input.fileStructure) {
    throw new Error(
      'Architecture, specifications, and file structure are required to generate tasks.'
    );
  }

  if (USE_UNIFIED_SYSTEM) {
    try {
      const projectPlanInput = {
        prd: `Architecture:\n${input.architecture}\n\nSpecifications:\n${input.specifications}`,
        apiKey: options?.apiKey,
        model: options?.model || 'gemini-1.5-flash-latest',
        useTDD: options?.useTDD || false,
      };

      return await generateUnifiedTasksWithResearch(projectPlanInput);
    } catch (error) {
      console.error('Error generating tasks with unified system:', error);
      throw new Error(
        `Unified task generation failed: ${(error as Error).message}`
      );
    }
  }

  // Old system (fallback)
  try {
    const result = await generateTasks(input, options?.apiKey, options?.model, options?.useTDD);
    return result;
  } catch (error) {
    console.error('Error generating tasks:', error);
    throw new Error(
      'Failed to generate tasks. The model may have returned an unexpected response.'
    );
  }
}

/**
 * Generates a proposed file/folder structure for a software project.
 */
export async function runGenerateFileStructure(
  input: OldGenerateFileStructureInput,
  options?: ActionOptions
) {
  if (!input.prd || !input.architecture || !input.specifications) {
    throw new Error(
      'PRD, architecture, and specifications are required to generate the file structure.'
    );
  }

  if (USE_UNIFIED_SYSTEM) {
    try {
      const projectPlanInput = {
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
      console.error('Error generating file structure with unified system:', error);
      throw new Error(
        `Unified file structure generation failed: ${(error as Error).message}`
      );
    }
  }

  // Old system (fallback)
  try {
    const result = await generateFileStructure(
      input,
      options?.apiKey,
      options?.model
    );
    return result;
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
      'File structure generation failed. The model may have returned an unexpected response. Try a different model or adjust the PRD, architecture, or specifications.'
    );
  }
}

export async function runResearchTask(
  input: OldResearchTaskInput,
  options?: ActionOptions
): Promise<ResearchTaskOutput> {
  if (!input.title || !input.architecture || !input.specifications || !input.fileStructure) {
    throw new Error(
      'Task title, architecture, specifications, and file structure are required for research.'
    );
  }

  if (USE_UNIFIED_SYSTEM) {
    try {
      const projectPlanInput = {
        prd: `Architecture:\n${input.architecture}\n\nSpecifications:\n${input.specifications}`,
        apiKey: options?.apiKey,
        model: options?.model || 'gemini-1.5-flash-latest',
        useTDD: options?.useTDD || false,
      };

      const projectPlan = await generateUnifiedProjectPlan(projectPlanInput);
      
      // Find the research result for this specific task
      const task = projectPlan.tasks.find(t => t.title === input.title);
      if (!task) {
        throw new Error(`Task not found: ${input.title}`);
      }

      const researchResult = projectPlan.researchResults.get(task.id);
      
      if (!researchResult) {
        throw new Error(`Failed to research task: ${input.title}`);
      }

      return researchResult;
    } catch (error) {
      console.error(`Error researching task "${input.title}" with unified system:`, error);
      throw new Error(
        `Unified task research failed: ${(error as Error).message}`
      );
    }
  }

  // Old system (fallback)
  const MAX_RETRIES = 3;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const result = await researchTask(input, options?.apiKey, options?.model, options?.useTDD);
      return result;
    } catch (error) {
      console.error(
        `Error researching task "${input.title}" (Attempt ${i + 1}/${MAX_RETRIES}):`,
        error
      );
      if (i === MAX_RETRIES - 1) {
        throw new Error(
          `Failed to research task "${input.title}" after ${MAX_RETRIES} attempts. The AI may have refused to answer or returned an invalid format. Please try a different model if the issue persists.`
        );
      }
      // Optional: wait a bit before retrying
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // This should not be reachable due to the throw inside the loop
  throw new Error(`Failed to research task "${input.title}".`);
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

  // NEW: Add unified system validation endpoint
}

export async function validateUnifiedProjectPlan(
  prd: string,
  options?: ActionOptions
): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
}> {
  try {
    const projectPlanInput = {
      prd,
      apiKey: options?.apiKey,
      model: options?.model || 'gemini-1.5-flash-latest',
    };

    const projectPlan = await generateUnifiedProjectPlan(projectPlanInput);
    
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check validation results
    projectPlan.validationResults.forEach((result) => {
      if (!result.passed && result.severity === 'error') {
        errors.push(result.message);
      } else if (!result.passed && result.severity === 'warning') {
        warnings.push(result.message);
      }
    });

    // Additional consistency checks
    if (!projectPlan.context.architecture) {
      errors.push('Could not generate project architecture');
    }

    if (!projectPlan.context.fileStructure) {
      errors.push('Could not generate file structure');
    }

    if (projectPlan.tasks.length === 0) {
      errors.push('No tasks were generated');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [`Validation failed: ${(error as Error).message}`],
      warnings: []
    };
  }
}


