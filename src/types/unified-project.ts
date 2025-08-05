import { z } from 'zod';

// Dependency types
export const DependencyType = z.enum(['requires', 'blocks', 'enabled_by']);
export type DependencyType = z.infer<typeof DependencyType>;

// Priority types
export const DependencyPriority = z.enum(['critical', 'high', 'medium', 'low']);
export type DependencyPriority = z.infer<typeof DependencyPriority>;

export interface Dependency {
  id: string;
  type: z.infer<typeof DependencyType>;
  priority: z.infer<typeof DependencyPriority>;
  description?: string;
}

export const TaskDependencySchema = z.object({
  taskId: z.string(),
  dependsOnTaskId: z.string(),
  dependency: z.object({
    id: z.string(),
    type: DependencyType,
    priority: DependencyPriority,
    description: z.string().optional()
  })
});

export interface TaskDependency {
  taskId: string;
  dependsOnTaskId: string;
  dependency: Dependency;
}

// Unified Project Context - Single source of truth
export const UnifiedProjectContextSchema = z.object({
  id: z.string().uuid(),
  prd: z.string().min(1, 'PRD is required'),
  architecture: z.string(),
  specifications: z.string(), 
  fileStructure: z.string(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date())
});
export type UnifiedProjectContext = z.infer<typeof UnifiedProjectContextSchema>;

// Enhanced Task with dependency information
export const EnhancedTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  
  // Core task information
  description: z.string().default(''),
  category: z.enum([
    'setup', 
    'architecture',
    'feature',
    'testing',
    'documentation',
    'deployment',
    'optimization'
  ]).default('feature'),
  
  // Dependency management
  dependencies: z.array(z.string()).describe('Task IDs this task depends on'),
  dependents: z.array(z.string()).describe('Tasks that depend on this task'),
  
  // Context information
  context: z.string().describe('How this task fits into the overall architecture'),
  
  // Implementation details
  implementationSteps: z.string().default(''),
  acceptanceCriteria: z.string().default(''),
  
  // Metadata
  estimatedDuration: z.number().positive().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  tags: z.array(z.string()).default([]),
  
  // State management
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).default('pending'),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date())
});
export type EnhancedTask = z.infer<typeof EnhancedTaskSchema>;

// Dependency Graph
export const DependencyGraphSchema = z.object({
  tasks: z.record(z.string(), EnhancedTaskSchema),
  edges: z.array(TaskDependencySchema)
});
export type DependencyGraph = z.infer<typeof DependencyGraphSchema>;

// Project Plan with unified context
export const ProjectPlanSchema = z.object({
  id: z.string().uuid(),
  context: UnifiedProjectContextSchema,
  dependencyGraph: DependencyGraphSchema,
  
  // Validation and metadata
  validationResults: z.array(z.object({
    type: z.enum(['consistency', 'completeness', 'dependency']),
    message: z.string(),
    severity: z.enum(['info', 'warning', 'error'])
  })).default([]),
  
  // Execution order
  executionOrder: z.array(z.string()).describe('Optimal task execution order'),
  
  // Metadata
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date())
});
export type ProjectPlan = z.infer<typeof ProjectPlanSchema>;

// Validation interfaces
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Simplified validation result for direct usage
export interface ValidationResultItem {
  message: string;
  type: 'consistency' | 'completeness' | 'dependency';
  severity: 'info' | 'warning' | 'error';
}

// Legacy types for compatibility
export interface ResearchTaskOutput {
  context: string;
  implementationSteps: string;
  acceptanceCriteria: string;
}

// Task generation orchestrator interfaces
export interface TaskGenerationOrchestrator {
  generateProjectPlan(context: UnifiedProjectContext): Promise<ProjectPlan>;
  validateTaskConsistency(plan: ProjectPlan): ValidationResultItem[];
  optimizeDependencyOrdering(tasks: EnhancedTask[]): string[]; // Returns task IDs in optimal order
}

// Research engine interfaces  
export interface TaskResearchEngine {
  researchTaskWithDependencies(
    taskId: string,
    context: UnifiedProjectContext,
    completedTasks: Set<string>,
    dependencyGraph: DependencyGraph
  ): Promise<EnhancedTask>;
}

// Project validator interfaces
export interface ProjectPlanValidator {
  validateCompleteWorkflow(plan: ProjectPlan): Promise<ValidationResult>;
}

// Error handling
export interface GenerationError {
  type: 'consistency' | 'dependency' | 'context' | 'research';
  message: string;
  taskIds?: string[];
}
