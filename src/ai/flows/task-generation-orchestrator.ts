


'use server';

/**
 * @fileOverview Task Generation Orchestrator - Enhanced task generation with dependency analysis
 */

// Import the orchestrator class and types
import {
  TaskGenerationOrchestrator,
  generateProjectPlan as internalGenerateProjectPlan,
} from './task-orchestrator-class';

// Export types for backward compatibility
export type { TaskGenerationOrchestratorInput, TaskGenerationOutput } from './task-orchestrator-class';

// Export the main generation function
export async function generateProjectPlan(
  input: import('./task-orchestrator-class').TaskGenerationOrchestratorInput,
  apiKey?: string,
  model?: string
): Promise<import('./task-orchestrator-class').TaskGenerationOutput> {
  
  return internalGenerateProjectPlan(input, apiKey, model);
}

// Export utility functions
export async function createTaskGenerationOrchestrator(
  contextManager?: import('./context-manager-class').ProjectContextManager
): Promise<TaskGenerationOrchestrator> {
  return new TaskGenerationOrchestrator(contextManager);
}


