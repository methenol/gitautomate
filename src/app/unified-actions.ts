


'use server';

/**
 * @fileOverview Actions for the unified project generation system.
 *
 * This provides backward-compatible wrappers for the new unified architecture
 * while maintaining compatibility with existing UI components.
 */

import {
  generateUnifiedProjectPlan,
} from '@/ai/flows/unified-project-generation';
import type {
  UnifiedProjectInput,
  ProjectPlanOutput,
  UnifiedProjectContext,
  ValidationResult,
} from '@/types/unified-context';

type ActionOptions = {
  apiKey?: string;
  model?: string;
  useTDD?: boolean;
};

/**
 * Runs unified project generation with error handling
 */
export async function runUnifiedProjectGeneration(
  input: UnifiedProjectInput,
  options?: ActionOptions
): Promise<ProjectPlanOutput> {
  if (!input.prd) {
    throw new Error('PRD is required to generate project plan.');
  }

  try {
    const result = await generateUnifiedProjectPlan(
      input,
      options
    );
    
 return result;
  } catch (error) {
 console.error('Error in unified project generation:', error);
    
    if (
      error instanceof Error &&
      (error.message.includes('API key not found') ||
        error.message.includes('API key is invalid') ||
        error.message.includes('Please check your Google AI API key'))
    ) {
      throw new Error(
        'Failed to generate project plan: Your Google AI API key is missing or invalid. Please check it in settings.'
      );
    }
    
 throw new Error(
      'Project generation failed. The model may have returned an unexpected response. Try a different model or adjust the PRD.'
    );
  }
}

/**
 * Extracts individual components from unified project result for backward compatibility
 */
export async function extractComponentsFromUnifiedResult(
  result: ProjectPlanOutput
): Promise<{
    architecture: string;
    specifications: string;
    fileStructure: string;
    tasks: Array<{
      title: string;
      details: string;
    }>;
}> {
  const context = result.context as UnifiedProjectContext;
  
 return {
    architecture: context.architecture || '',
    specifications: context.specifications || '',
    fileStructure: context.fileStructure || '',
    tasks: (context.tasks || []).map((task) => ({
      title: task.title,
      details: task.details || '',
    })),
  };
}

/**
 * Validates unified project result
 */
export async function validateUnifiedProjectResult(
  result: ProjectPlanOutput
): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
}> {
  const allValidationResults = (result.validationResults as ValidationResult[]) || [];
  
  // Combine all validation results
  const errors: string[] = [];
  const warnings: string[] = [];
  
  allValidationResults.forEach(validation => {
    errors.push(...validation.errors);
    warnings.push(...validation.warnings);
  });
  
 return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Gets summary of validation results
 */
export async function getValidationSummary(
  result: ProjectPlanOutput
): Promise<string> {
  const validation = await validateUnifiedProjectResult(result);
  
  if (validation.isValid) {
    return '✅ Project generation completed successfully with no critical errors.';
  }
  
 let summary = `⚠️ Project generation completed with ${validation.errors.length} error(s) and ${validation.warnings.length} warning(s).\n\n`;
  
  if (validation.errors.length > 0) {
    summary += 'Errors:\n';
 validation.errors.forEach(error => {
      summary += `• ${error}\n`;
    });
  }
  
  if (validation.warnings.length > 0) {
    summary += '\nWarnings:\n';
 validation.warnings.forEach(warning => {
      summary += `• ${warning}\n`;
    });
  }
  
 return summary;
}

/**
 * Options for backward compatibility with existing actions
 */
export interface BackwardCompatibleOptions extends ActionOptions {
  useUnifiedGeneration?: boolean;
}

/**
 * Unified action that can work with both old and new generation systems
 */
export async function generateProjectWithUnifiedSystem(
  prd: string,
  options?: BackwardCompatibleOptions
): Promise<{
    architecture: string;
    specifications: string;
    fileStructure: string;
    tasks: Array<{
      title: string;
      details: string;
    }>;
  validationSummary?: string;
}> {
  const useUnified = options?.useUnifiedGeneration ?? true; // Default to unified system
  
 if (useUnified) {
    console.log('Using unified project generation...');
    
 const result = await runUnifiedProjectGeneration(
      { prd },
      options
    );
    
    const components = extractComponentsFromUnifiedResult(result);
    const validationSummary = getValidationSummary(result);
    
 return {
      ...components,
      validationSummary,
    };
  } else {
 console.log('Using legacy generation system...');
    
 // For backward compatibility, we'll keep the old logic here
 throw new Error('Legacy generation system has been deprecated. Please use unified generation.');
  }
}



