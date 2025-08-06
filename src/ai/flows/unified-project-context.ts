
'use server';

/**
 * @fileOverview Defines the unified project context system that serves as a single source of truth for all project data.
 * This replaces the previous siloed architecture with interconnected components that maintain consistency.
 */

import { z } from 'genkit';

export interface UnifiedProjectContext {
  /** The Product Requirements Document (PRD) - the foundation of all project planning */
  prd: string;
  
  /** The proposed software architecture - defines the overall system structure */
  architecture: string;
  
  /** The file/folder structure - maps out the project organization */
  fileStructure: string;
  
  /** Detailed specifications - defines functional and non-functional requirements */
  specifications: string;
  
  /** Dependency graph modeling relationships between tasks */
  dependencyGraph: TaskDependencyGraph;
  
  ** Validation history tracking consistency checks and corrections */
  validationHistory: ValidationResult[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedDuration?: number; // in hours
  dependencies: string[]; // task IDs this task depends on
  prerequisites: TaskPrerequisite[];
  context: string;
  implementationSteps: string;
  acceptanceCriteria: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  researchCompleted: boolean;
}

export interface TaskPrerequisite {
  type: 'file_exists' | 'component_ready' | 'auth_configured' | 'database_setup' | 'api_available';
  target: string;
  description: string;
}

export interface TaskDependencyGraph {
  tasks: Record<string, Task>;
  edges: Array<{
    from: string; // task ID
    to: string;   // task ID  
    type: 'hard' | 'soft'; // hard dependencies must be completed, soft are preferred
    weight: number; // importance of dependency (1-10)
  }>;
}

export interface ValidationResult {
  id: string;
  timestamp: Date;
  type: 'consistency_check' | 'dependency_validation' | 'feasibility_analysis';
  passed: boolean;
  message: string;
  details?: any;
  severity: 'info' | 'warning' | 'error';
}

export interface ProjectPlan {
  context: UnifiedProjectContext;
  tasks: Task[];
  executionOrder: string[]; // topological order of task IDs
  validationResults: ValidationResult[];
  metadata: {
    generatedAt: Date;
    modelUsed: string;
    useTDD: boolean;
    confidenceScore: number; // 0-1
  };
}

const UnifiedProjectContextSchema = z.object({
  prd: z.string().min(1, 'PRD is required'),
  architecture: z.string(),
  fileStructure: z.string(), 
  specifications: z.string(),
  dependencyGraph: z.object({
    tasks: z.record(z.any()),
    edges: z.array(z.any())
  }),
  validationHistory: z.array(z.any())
});

export type UnifiedProjectContextInput = Omit<UnifiedProjectContext, 'validationHistory'>;

/**
 * Creates a unified project context from initial inputs (PRD only or PRD + architecture)
 */
export function createProjectContext(
  input: {
    prd: string;
    initialArchitecture?: string;
    initialSpecifications?: string;
  }
): UnifiedProjectContext {
  return {
    prd: input.prd,
    architecture: input.initialArchitecture || '',
    fileStructure: '',
    specifications: input.initialSpecifications || '',
    dependencyGraph: {
      tasks: {},
      edges: []
    },
    validationHistory: []
  };
}

/**
 * Validates that the project context is complete and consistent
 */
export function validateProjectContext(context: UnifiedProjectContext): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  // Check required fields
  if (!context.prd?.trim()) {
    results.push({
      id: `missing-prd-${Date.now()}`,
      timestamp: new Date(),
      type: 'consistency_check',
      passed: false,
      message: 'Product Requirements Document (PRD) is required',
      severity: 'error'
    });
  }
  
  // Check architecture completeness if file structure exists
  if (context.fileStructure && !context.architecture) {
    results.push({
      id: `missing-architecture-${Date.now()}`,
      timestamp: new Date(),
      type: 'consistency_check', 
      passed: false,
      message: 'File structure generated but no architecture defined',
      severity: 'warning'
    });
  }
  
  return results;
}

/**
 * Updates the project context with new data and triggers validation
 */
export function updateProjectContext(
  current: UnifiedProjectContext,
  updates: Partial<UnifiedProjectContext>
): { updated: UnifiedProjectContext; validationResults: ValidationResult[] } {
  const updated = { ...current, ...updates };
  const validationResults = validateProjectContext(updated);
  
  // Add validation results to history
  updated.validationHistory.push(...validationResults);
  
  return { updated, validationResults };
}
