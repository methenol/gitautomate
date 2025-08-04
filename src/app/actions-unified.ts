


'use server';

/**
 * @fileOverview Unified actions that use the new orchestrator to fix siloed architecture issues.
 *
 * These actions provide a coordinated workflow that addresses the architectural flaws identified in Issue #7:
 * - Context sharing between components
 * - Dependency-aware task generation and research  
 * - Iterative validation loops
 */

import {
  generateProjectPlanWithOrchestrator,
  TaskGenerationOrchestratorInput,
  TaskGenerationOrchestratorOutput,
} from '@/ai/flows/task-generation-orchestrator';
import {
  validateCompleteProjectPlan,
  ValidateProjectPlanInput,
} from '@/ai/flows/project-plan-validator';
import { ProjectPlan, ResearchedTask } from '@/ai/flows/unified-context';

type ActionOptions = {
  apiKey?: string;
  model?: string;
  useTDD?: boolean;
};

/**
 * Unified action that generates a complete project plan using the new orchestrator.
 * This addresses the siloed architecture by coordinating all components in a single workflow.
 */
export async function runUnifiedProjectGeneration(
  input: TaskGenerationOrchestratorInput
): Promise<TaskGenerationOrchestratorOutput> {
  try {
    console.log('Starting unified project generation with orchestrator...');
    
    const result = await generateProjectPlanWithOrchestrator(input);
    
    console.log('Unified project generation completed successfully');
    return result;
    
  } catch (error) {
    console.error('Error in unified project generation:', error);
    
    // Provide more detailed error context for debugging
    const errorMessage = (error as Error).message;
    
    if (errorMessage.includes('API key')) {
      throw new Error(
        'Unified generation failed: Your Google AI API key is missing or invalid. Please check it in settings.'
      );
    } else if (errorMessage.includes('model')) {
      throw new Error(
        'Unified generation failed: The AI model returned an unexpected response. Try a different model or adjust the PRD.'
      );
    } else {
      throw new Error(
        `Unified generation failed: ${errorMessage}`
      );
    }
  }
}

/**
 * Validates an existing project plan for consistency and quality.
 */
export async function runProjectPlanValidation(
  input: ValidateProjectPlanInput,
  options?: ActionOptions
): Promise<any> {
  
  try {
    console.log('Starting project plan validation...');
    
    const validationResult = await validateCompleteProjectPlan(input, 'comprehensive');
    
    console.log('Project plan validation completed:', {
      isValid: validationResult.isValid,
      errorCount: validationResult.errors.length,
      warningCount: validationResult.warnings.length
    });
    
    return {
      validationResults: [validationResult],
      summary: validationResult.isValid 
        ? 'Project plan is valid with minor considerations'
        : `Project plan has ${validationResult.errors.length} critical issues that need to be addressed`,
    };
    
  } catch (error) {
    console.error('Error in project plan validation:', error);
    throw new Error(
      `Validation failed: ${(error as Error).message}`
    );
  }
}

/**
 * Enhanced action that generates and validates a complete project plan in one go.
 */
export async function runCompleteProjectWorkflow(
  prd: string,
  options?: ActionOptions
): Promise<{
  projectPlan: ProjectPlan;
  validationResults: any[];
  summary: string;
}> {
  
  try {
    console.log('Starting complete project workflow...');
    
    // Step 1: Generate the complete project plan using orchestrator
    const generationInput: TaskGenerationOrchestratorInput = {
      prd,
      model: options?.model,
      apiKey: options?.apiKey,
      useTDD: options?.useTDD || false,
    };

    const generationOutput = await runUnifiedProjectGeneration(generationInput);
    
    // Parse the project plan
    const projectPlan: ProjectPlan = JSON.parse(generationOutput.projectPlan);
    
    // Step 2: Validate the generated plan
    const validationInput: ValidateProjectPlanInput = {
      prd,
      architecture: projectPlan.architecture,
      specifications: projectPlan.specifications,
      fileStructure: projectPlan.fileStructure,
      tasks: projectPlan.tasks.map(task => ({
        title: task.title,
        details: task.details || '',
      })),
    };

    const validationOutput = await runProjectPlanValidation(validationInput, options);
    
    // Step 3: Generate summary
    const hasCriticalErrors = validationOutput.validationResults.some(
      (result: any) => !result.isValid && result.errors.length > 0
    );
    
    let summary = '';
    if (hasCriticalErrors) {
      const totalErrors = validationOutput.validationResults.reduce(
        (sum: number, result: any) => sum + result.errors.length, 0
      );
      summary = `Generated project plan with ${projectPlan.tasks.length} tasks, but has ${totalErrors} critical validation issues that need to be addressed.`;
    } else {
      const totalWarnings = validationOutput.validationResults.reduce(
        (sum: number, result: any) => sum + result.warnings.length, 0
      );
      summary = `Successfully generated project plan with ${projectPlan.tasks.length} tasks. Found ${totalWarnings} minor considerations for improvement.`;
    }
    
    return {
      projectPlan,
      validationResults: validationOutput.validationResults,
      summary,
    };
    
  } catch (error) {
    console.error('Error in complete project workflow:', error);
    throw new Error(
      `Complete project workflow failed: ${(error as Error).message}`
    );
  }
}

/**
 * Legacy action wrapper for backward compatibility
 */
export async function runUnifiedArchitectureGeneration(
  prd: string,
  options?: ActionOptions
): Promise<{
  architecture: string;
  specifications: string;
  fileStructure: string;
  tasks: ResearchedTask[];
  validationResults?: any[];
}> {
  
  try {
    const workflowResult = await runCompleteProjectWorkflow(prd, options);
    
    return {
      architecture: workflowResult.projectPlan.architecture,
      specifications: workflowResult.projectPlan.specifications,
      fileStructure: workflowResult.projectPlan.fileStructure,
      tasks: workflowResult.projectPlan.tasks,
      validationResults: workflowResult.validationResults,
    };
  } catch (error) {
    console.error('Error in unified architecture generation:', error);
    
    // For backward compatibility, throw the same format as original actions
    if ((error as Error).message.includes('API key')) {
      throw new Error(
        'Failed to generate architecture: Your Google AI API key is missing or invalid. Please check it in settings.'
      );
    } else {
      throw new Error(
        'Architecture generation failed. The model may have returned an unexpected response.'
      );
    }
  }
}


