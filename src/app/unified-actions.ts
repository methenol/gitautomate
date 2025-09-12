'use server';

/**
 * @fileOverview Unified actions that replace the existing sequential workflow
 * with a coordinated, dependency-aware system.
 */

import { UnifiedProjectOrchestrator } from '@/ai/orchestrator/project-orchestrator';
import { ContextValidator } from '@/ai/validation/context-validator';
import { UnifiedProjectContext } from '@/types/unified-context';

export interface UnifiedGenerationOptions {
  apiKey?: string;
  model?: string;
  apiBase?: string;
  useTDD?: boolean;
}

export interface UnifiedGenerationResult {
  context: UnifiedProjectContext;
  success: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * COMPLETE REPLACEMENT for the existing sequential workflow.
 * This function coordinates all AI flows in a unified manner.
 */
export async function generateUnifiedProject(
  prd: string,
  options: UnifiedGenerationOptions = {}
): Promise<UnifiedGenerationResult> {
  const orchestrator = new UnifiedProjectOrchestrator();
  
  try {
    // Step 1: Generate complete project context
    const context = await orchestrator.generateUnifiedPlan({
      prd,
      tasks: [],
      dependencyGraph: [],
      validationHistory: [],
      lastUpdated: new Date().toISOString(),
      version: 1,
    }, options.apiKey, options.model, options.apiBase, options.useTDD);

    // Step 2: Validate the generated context
    const validationResults = ContextValidator.validateFullContext(context);
    
    // Step 3: Categorize validation results
    const errors = validationResults
      .filter(r => r.severity === 'error')
      .flatMap(r => r.issues);
    
    const warnings = validationResults
      .filter(r => r.severity === 'warning')
      .flatMap(r => r.issues);

    // Step 4: Return unified result
    return {
      context,
      success: errors.length === 0,
      errors,
      warnings,
    };

  } catch (error) {
    return {
      context: {
        prd,
        architecture: '',
        fileStructure: '',
        specifications: '',
        tasks: [],
        dependencyGraph: [],
        validationHistory: [],
        lastUpdated: new Date().toISOString(),
        version: 1,
      },
      success: false,
      errors: [(error as Error).message],
      warnings: [],
    };
  }
}

/**
 * Research all tasks with full dependency awareness and context propagation.
 * REPLACES the existing isolated task research.
 */
export async function researchUnifiedTasks(
  context: UnifiedProjectContext,
  options: UnifiedGenerationOptions = {}
): Promise<UnifiedGenerationResult> {
  const orchestrator = new UnifiedProjectOrchestrator();
  
  try {
    // Research tasks with dependency awareness
    const updatedContext = await orchestrator.researchTasksWithDependencies(context, options.apiKey, options.model, options.apiBase, options.useTDD);
    
    // Validate the updated context
    const validationResults = ContextValidator.validateFullContext(updatedContext);
    
    const errors = validationResults
      .filter(r => r.severity === 'error')
      .flatMap(r => r.issues);
    
    const warnings = validationResults
      .filter(r => r.severity === 'warning')
      .flatMap(r => r.issues);

    return {
      context: updatedContext,
      success: errors.length === 0,
      errors,
      warnings,
    };

  } catch (error) {
    return {
      context,
      success: false,
      errors: [(error as Error).message],
      warnings: [],
    };
  }
}

/**
 * Update project context with user edits and re-validate consistency.
 * REPLACES manual state updates with proper context propagation.
 */
export async function updateUnifiedContext(
  context: UnifiedProjectContext,
  updates: Partial<Pick<UnifiedProjectContext, 'architecture' | 'specifications' | 'fileStructure'>>,
  options: UnifiedGenerationOptions = {}
): Promise<UnifiedGenerationResult> {
  const orchestrator = new UnifiedProjectOrchestrator();
  
  try {
    // Apply updates with proper context propagation
    const updatedContext = orchestrator.updateContext(context, updates);
    
    // If architecture, specifications, or file structure changed significantly,
    // regenerate tasks to ensure consistency
    const significantChanges = updates.architecture || updates.specifications || updates.fileStructure;
    
    let finalContext = updatedContext;
    if (significantChanges) {
      // Regenerate tasks with new context
      finalContext = await orchestrator.generateUnifiedPlan({
        ...updatedContext,
        tasks: [], // Clear existing tasks to regenerate
      }, options.apiKey, options.model, options.apiBase, options.useTDD);
    }
    
    // Validate the final context
    const validationResults = ContextValidator.validateFullContext(finalContext);
    
    const errors = validationResults
      .filter(r => r.severity === 'error')
      .flatMap(r => r.issues);
    
    const warnings = validationResults
      .filter(r => r.severity === 'warning')
      .flatMap(r => r.issues);

    return {
      context: finalContext,
      success: errors.length === 0,
      errors,
      warnings,
    };

  } catch (error) {
    return {
      context,
      success: false,
      errors: [(error as Error).message],
      warnings: [],
    };
  }
}

/**
 * Get ordered tasks based on dependency resolution.
 * REPLACES simple task iteration with dependency-aware ordering.
 */
export function getOrderedTasks(context: UnifiedProjectContext): UnifiedProjectContext['tasks'] {
  const orchestrator = new UnifiedProjectOrchestrator();
  return orchestrator.optimizeTaskOrdering(context.tasks);
}

/**
 * Convert unified context to legacy format for export compatibility.
 * Maintains backward compatibility with existing export functionality.
 */
export function convertToLegacyFormat(context: UnifiedProjectContext) {
  return {
    prd: context.prd,
    architecture: context.architecture,
    specifications: context.specifications,
    fileStructure: context.fileStructure,
    tasks: context.tasks.map(task => ({
      title: task.title,
      details: task.details,
    })),
  };
}