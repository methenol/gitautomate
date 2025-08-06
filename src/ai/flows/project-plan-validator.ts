



'use server';

/**
 * @fileOverview Project Plan Validator - Validates consistency across project components
 */

// Import the validator class and types
import {
  ProjectPlanValidator,
} from './project-validator-class';

// Export validation function and types
export type { ValidationInput, ValidationResult } from './project-validator-class';

// Export the main validation function
export async function validateProjectPlan(
  input: import('./project-validator-class').ValidationInput,
  apiKey?: string, 
  model?: string
): Promise<import('./project-validator-class').ValidationResult> {
  
  const validator = new ProjectPlanValidator();
  return validator.validateProjectPlan(input, apiKey, model);
}

// Export utility functions
export async function createProjectPlanValidator(
  contextManager?: import('./context-manager-class').ProjectContextManager
): Promise<ProjectPlanValidator> {
  return new ProjectPlanValidator(contextManager);
}



