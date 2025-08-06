
'use server';

/**
 * @fileOverview Defines the unified project context and orchestrator for the redesigned GitAutomate system.
 * This replaces the siloed architecture with a cohesive, interconnected system that manages dependencies
 * and ensures consistency across all components.
 */

import { z } from 'genkit';

export interface UnifiedProjectContext {
  prd: string;
  architecture?: ArchitectureSpec;
  fileStructure?: FileTree;
  specifications?: SpecDocument;
  dependencyGraph: DependencyGraph<Task>;
  validationHistory: ValidationResult[];
}

export interface ArchitectureSpec {
  architecture: string;
  specifications: string;
}

export interface FileTree {
  fileStructure: string;
}

export interface SpecDocument {
  specifications: string;
}

export interface Task {
  id: string;
  title: string;
  details: string;
  prerequisites: string[];
  dependencies: string[]; // IDs of other tasks
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
}

export interface DependencyGraph<T> {
  nodes: Map<string, T>;
  edges: Map<string, string[]>; // task_id -> [dependent_task_ids]
}

export interface ValidationResult {
  id: string;
  type: 'consistency' | 'completeness' | 'dependency';
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ProjectPlan {
  context: UnifiedProjectContext;
  tasks: Task[];
  researchResults: Map<string, ResearchedTask>;
  validationResults: ValidationResult[];
}

export interface ResearchedTask {
  taskId: string;
  context: string;
  implementationSteps: string;
  acceptanceCriteria: string;
  researchContext: {
    completedTasks: Set<string>;
    availableResources: string[];
  };
}

export interface TaskGenerationOrchestrator {
  generateProjectPlan(context: UnifiedProjectContext): Promise<ProjectPlan>;
  validateTaskConsistency(plan: ProjectPlan): ValidationResult[];
  optimizeDependencyOrdering(tasks: Task[]): Task[];
}

const UnifiedProjectContextSchema = z.object({
  prd: z.string().describe('The Product Requirements Document (PRD) for the project.'),
  architecture: z.object({
    architecture: z.string().describe('The proposed software architecture. Use markdown formatting.'),
    specifications: z.string().describe('The generated specifications based on the PRD. Use markdown formatting.'),
  }).optional(),
  fileStructure: z.object({
    fileStructure: z.string().describe('A comprehensive, proposed file/folder structure for the project.'),
  }).optional(),
  specifications: z.string().describe('The detailed specifications for the project.').optional(),
  dependencyGraph: z.object({
    nodes: z.record(z.any()),
    edges: z.record(z.array(z.string())),
  }).default({
    nodes: {},
    edges: {}
  }),
  validationHistory: z.array(z.any()).default([]),
});

export type UnifiedProjectContextInput = z.infer<typeof UnifiedProjectContextSchema>;

const ProjectPlanSchema = z.object({
  context: UnifiedProjectContextSchema,
  tasks: z.array(z.any()),
  researchResults: z.record(z.any()).default({}),
  validationResults: z.array(z.any()).default([]),
});

export type ProjectPlanOutput = z.infer<typeof ProjectPlanSchema>;
