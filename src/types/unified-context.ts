import { z } from 'zod';
import { TaskSchema } from './index';

export const DependencySchema = z.object({
  taskId: z.string(),
  dependsOn: z.array(z.string()).default([]),
  blockedBy: z.array(z.string()).default([]),
});

export type TaskDependency = z.infer<typeof DependencySchema>;

export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  issues: z.array(z.string()).default([]),
  component: z.enum(['architecture', 'fileStructure', 'tasks', 'dependencies']),
  severity: z.enum(['error', 'warning', 'info']).default('info'),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;

export const UnifiedProjectContextSchema = z.object({
  prd: z.string(),
  architecture: z.string(),
  fileStructure: z.string(), 
  specifications: z.string(),
  tasks: z.array(z.object({
    ...TaskSchema.shape,
    id: z.string(),
    order: z.number(),
    dependencies: z.array(z.string()).default([]),
    status: z.enum(['pending', 'researching', 'completed', 'failed']).default('pending'),
  })),
  dependencyGraph: z.array(DependencySchema).default([]),
  validationHistory: z.array(ValidationResultSchema).default([]),
  lastUpdated: z.string(),
  version: z.number().default(1),
});

export type UnifiedProjectContext = z.infer<typeof UnifiedProjectContextSchema>;

export interface ProjectOrchestrator {
  generateUnifiedPlan(context: Partial<UnifiedProjectContext>): Promise<UnifiedProjectContext>;
  validateContext(context: UnifiedProjectContext): ValidationResult[];
  updateContext(context: UnifiedProjectContext, updates: Partial<UnifiedProjectContext>): UnifiedProjectContext;
  researchTasksWithDependencies(context: UnifiedProjectContext): Promise<UnifiedProjectContext>;
  optimizeTaskOrdering(tasks: UnifiedProjectContext['tasks']): UnifiedProjectContext['tasks'];
}

export interface TaskResearchEngine {
  researchWithContext(
    task: UnifiedProjectContext['tasks'][0], 
    context: UnifiedProjectContext,
    completedTasks: string[]
  ): Promise<{ 
    context: string; 
    implementationSteps: string; 
    acceptanceCriteria: string;
    discoveredDependencies: string[];
  }>;
}