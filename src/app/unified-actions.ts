'use server';

import { UnifiedProjectManager } from '@/lib/unified-project-manager';
import { 
  UnifiedProjectContext, 
  GenerationOptions, 
  ValidationResult,
  EnhancedTask 
} from '@/types/unified-context';

// Legacy action support - maintaining backward compatibility
export { 
  runGenerateArchitecture,
  runGenerateTasks,
  runGenerateFileStructure,
  runResearchTask,
  getModels 
} from './actions';

// New unified actions
const projectManager = new UnifiedProjectManager();

export async function initializeProject(prd: string): Promise<UnifiedProjectContext> {
  if (!prd.trim()) {
    throw new Error('PRD is required to initialize project.');
  }
  
  return projectManager.initializeContext(prd);
}

export async function generateCompleteProjectPlan(
  context: UnifiedProjectContext,
  options: GenerationOptions = {}
): Promise<UnifiedProjectContext> {
  try {
    return await projectManager.generateProjectPlan(context, options);
  } catch (error) {
    console.error('Error generating complete project plan:', error);
    throw new Error(
      'Failed to generate complete project plan. Please check your API configuration and try again.'
    );
  }
}

export async function generateArchitectureWithContext(
  context: UnifiedProjectContext,
  options: GenerationOptions = {}
): Promise<UnifiedProjectContext> {
  try {
    return await projectManager.generateArchitectureWithDependencies(context, options);
  } catch (error) {
    console.error('Error generating architecture with context:', error);
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
      'Architecture generation failed. The model may have returned an unexpected response.'
    );
  }
}

export async function generateTasksWithContext(
  context: UnifiedProjectContext,
  options: GenerationOptions = {}
): Promise<UnifiedProjectContext> {
  if (!context.architecture || !context.specifications || !context.fileStructure) {
    throw new Error(
      'Architecture, specifications, and file structure are required to generate tasks.'
    );
  }
  
  try {
    return await projectManager.generateTasksWithDependencies(context, options);
  } catch (error) {
    console.error('Error generating tasks with context:', error);
    throw new Error(
      'Failed to generate tasks with dependencies. The model may have returned an unexpected response.'
    );
  }
}

export async function researchTasksWithContext(
  context: UnifiedProjectContext,
  options: GenerationOptions = {}
): Promise<UnifiedProjectContext> {
  if (!context.tasks || context.tasks.length === 0) {
    throw new Error('Tasks are required before research can begin.');
  }
  
  try {
    return await projectManager.researchTasksWithContext(context, options);
  } catch (error) {
    console.error('Error researching tasks with context:', error);
    throw new Error(
      'Failed to research tasks with context. Please try again or adjust the model settings.'
    );
  }
}

export async function validateProjectContext(
  context: UnifiedProjectContext
): Promise<ValidationResult> {
  return projectManager.validateContext(context);
}

export async function validateTaskConsistency(
  context: UnifiedProjectContext
): Promise<ValidationResult> {
  return projectManager.validateTaskConsistency(context);
}

export async function optimizeTaskOrdering(
  context: UnifiedProjectContext
): Promise<UnifiedProjectContext> {
  return projectManager.optimizeDependencyOrdering(context);
}

export async function refineProjectPlan(
  context: UnifiedProjectContext,
  validation: ValidationResult,
  options: GenerationOptions = {}
): Promise<UnifiedProjectContext> {
  return await projectManager.refineContextBasedOnValidation(context, validation);
}

// Utility functions for working with the unified context
export function updateProjectContext(
  context: UnifiedProjectContext,
  updates: Partial<UnifiedProjectContext>
): UnifiedProjectContext {
  return projectManager.updateContext(context, updates);
}

export function convertLegacyTasksToEnhanced(tasks: any[]): EnhancedTask[] {
  return tasks.map(task => ({
    title: task.title,
    details: task.details || '',
    dependencies: {
      taskTitle: task.title,
      dependsOn: [],
      blockedBy: [],
      priority: 3,
      category: 'core' as const,
    },
    researched: Boolean(task.details && task.details.trim() && task.details !== 'Researching...'),
  }));
}

export function convertEnhancedTasksToLegacy(enhancedTasks: EnhancedTask[]): any[] {
  return enhancedTasks.map(task => ({
    title: task.title,
    details: task.details,
  }));
}