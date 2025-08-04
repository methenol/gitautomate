import { z } from 'zod';

// Validation result for consistency checks
export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  issues: z.array(z.string()),
  suggestions: z.array(z.string()).optional(),
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

// Task dependency modeling
export const TaskDependencySchema = z.object({
  taskTitle: z.string(),
  dependsOn: z.array(z.string()).default([]),
  blockedBy: z.array(z.string()).default([]),
  priority: z.number().min(1).max(5).default(3),
  category: z.enum(['setup', 'core', 'feature', 'testing', 'deployment']).default('core'),
});
export type TaskDependency = z.infer<typeof TaskDependencySchema>;

// Dependency graph for task ordering
export interface DependencyGraph<T> {
  nodes: Map<string, T>;
  edges: Map<string, Set<string>>;
  getTopologicalOrder(): string[];
  addDependency(from: string, to: string): void;
  hasCycle(): boolean;
}

// Enhanced task with dependency information
export const EnhancedTaskSchema = z.object({
  title: z.string(),
  details: z.string().default(''),
  dependencies: TaskDependencySchema,
  researched: z.boolean().default(false),
  researchContext: z.object({
    relatedTasks: z.array(z.string()).default([]),
    conflictingRequirements: z.array(z.string()).default([]),
    prerequisiteChecks: z.array(z.string()).default([]),
  }).optional(),
});
export type EnhancedTask = z.infer<typeof EnhancedTaskSchema>;

// Unified project context that tracks all components and their relationships
export const UnifiedProjectContextSchema = z.object({
  // Core project data
  prd: z.string(),
  architecture: z.string(),
  specifications: z.string(),
  fileStructure: z.string(),
  
  // Enhanced task management
  tasks: z.array(EnhancedTaskSchema).default([]),
  dependencyGraph: z.any().optional(), // Will be populated with DependencyGraph instance
  
  // Validation and consistency tracking
  validationHistory: z.array(ValidationResultSchema).default([]),
  lastValidated: z.date().optional(),
  
  // Context propagation tracking
  componentVersions: z.object({
    architecture: z.number().default(1),
    specifications: z.number().default(1),
    fileStructure: z.number().default(1),
    tasks: z.number().default(1),
  }),
  
  // Research context for interconnected task research
  researchContext: z.object({
    completedTasks: z.array(z.string()).default([]),
    activeResearch: z.array(z.string()).default([]),
    researchInsights: z.array(z.object({
      taskTitle: z.string(),
      insights: z.array(z.string()),
      crossTaskImplications: z.array(z.string()),
    })).default([]),
  }).default({}),
});
export type UnifiedProjectContext = z.infer<typeof UnifiedProjectContextSchema>;

// Configuration for different generation options
export interface GenerationOptions {
  apiKey?: string;
  model?: string;
  useTDD?: boolean;
  enableDependencyAnalysis?: boolean;
  enableCrossTaskValidation?: boolean;
  maxRetries?: number;
}

// Interface for the unified project manager
export interface ProjectManager {
  // Context management
  initializeContext(prd: string): UnifiedProjectContext;
  updateContext(context: UnifiedProjectContext, updates: Partial<UnifiedProjectContext>): UnifiedProjectContext;
  validateContext(context: UnifiedProjectContext): ValidationResult;
  
  // Orchestrated generation workflows
  generateProjectPlan(context: UnifiedProjectContext, options?: GenerationOptions): Promise<UnifiedProjectContext>;
  generateArchitectureWithDependencies(context: UnifiedProjectContext, options?: GenerationOptions): Promise<UnifiedProjectContext>;
  generateTasksWithDependencies(context: UnifiedProjectContext, options?: GenerationOptions): Promise<UnifiedProjectContext>;
  researchTasksWithContext(context: UnifiedProjectContext, options?: GenerationOptions): Promise<UnifiedProjectContext>;
  
  // Validation and refinement
  validateTaskConsistency(context: UnifiedProjectContext): ValidationResult;
  optimizeDependencyOrdering(context: UnifiedProjectContext): UnifiedProjectContext;
  refineContextBasedOnValidation(context: UnifiedProjectContext, validation: ValidationResult): Promise<UnifiedProjectContext>;
}