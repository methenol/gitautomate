

import { z } from 'zod';
import type { Task } from '@/types';
import type { ResearchTaskOutput as ResearchedTaskDetails } from '@/ai/flows/research-task';

/**
 * Represents a dependency relationship between tasks
 */
export interface TaskDependency {
  taskId: string;
  dependsOnTaskId: string;
  dependencyType: 'prerequisite' | 'parallel' | 'optional';
}

/**
 * Represents a validation result for cross-consistency checking
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  timestamp: Date;
}

/**
 * Represents the unified project context - single source of truth for all project data
 */
export interface UnifiedProjectContext {
  prd: string;
  architecture?: string;
  specifications?: string; 
  fileStructure?: string;
  tasks: Task[];
  researchedTasks: Map<string, ResearchedTaskDetails>;
  dependencyGraph: Map<string, string[]>; // taskId -> array of prerequisite taskIds
  validationHistory: ValidationResult[];
}

/**
 * Input schema for unified project generation
 */
export const UnifiedProjectInputSchema = z.object({
  prd: z.string().min(1, 'PRD is required'),
});

export type UnifiedProjectInput = z.infer<typeof UnifiedProjectInputSchema>;

/**
 * Output schema for unified project plan
 */
export const ProjectPlanOutputSchema = z.object({
  context: z.any().describe('The unified project context containing all generated data.'),
  validationResults: z.array(z.object({
    isValid: z.boolean(),
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
    timestamp: z.date(),
  })),
});

export type ProjectPlanOutput = z.infer<typeof ProjectPlanOutputSchema>;

/**
 * Options for the unified project generation
 */
export interface UnifiedGenerationOptions {
  apiKey?: string;
  model?: string;
  useTDD?: boolean;
  enableValidation?: boolean;
  maxRetries?: number;
}
