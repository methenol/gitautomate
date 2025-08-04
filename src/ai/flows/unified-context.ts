
'use server';

/**
 * @fileOverview Unified project context that serves as a single source of truth for all project data.
 *
 * - UnifiedProjectContext - A unified context that contains all project information and manages state consistency
 * - DependencyGraph - Interface for modeling inter-task relationships
 * - ValidationResult - Type for validation results and consistency checks
 */

import { z } from 'genkit';

export interface DependencyGraph<T> {
  addDependency(taskId: string, dependsOn: string): void;
  getDependencies(taskId: string): string[];
  getOrdering(): T[];
  validateCycles(): ValidationResult;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface UnifiedProjectContext {
  prd: string;
  architecture?: string;
  specifications?: string;
  fileStructure?: string;
  tasks: Task[];
  dependencyGraph: DependencyGraph<Task>;
  validationHistory: ValidationResult[];
}

export interface ProjectPlan {
  prd: string;
  architecture: string;
  specifications: string;
  fileStructure: string;
  tasks: ResearchedTask[];
}

export interface Task {
  title: string;
  details?: string;
  id: string;
  dependencies: string[];
}

export interface ResearchedTask extends Task {
  context: string;
  implementationSteps: string;
  acceptanceCriteria: string;
}

export const UnifiedProjectContextSchema = z.object({
  prd: z.string().describe('The Product Requirements Document (PRD) for the project.'),
  architecture: z.string().optional().describe('The proposed software architecture.'),
  specifications: z.string().optional().describe('The detailed specifications for the project.'),
  fileStructure: z.string().optional().describe('The proposed file/folder structure for the project.'),
  tasks: z.array(z.object({
    title: z.string(),
    details: z.string().optional(),
    id: z.string(),
    dependencies: z.array(z.string()),
  })),
  validationHistory: z.array(z.object({
    isValid: z.boolean(),
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
  })),
});

export type UnifiedProjectContextInput = Omit<UnifiedProjectContext, 'validationHistory' | 'dependencyGraph'>;

/**
 * Creates a unified project context with proper initialization
 */
export function createUnifiedProjectContext(input: UnifiedProjectContextInput): UnifiedProjectContext {
  const dependencyGraph = new InMemoryDependencyGraph();
  
  // Initialize tasks in the graph
  input.tasks.forEach(task => {
    task.dependencies.forEach(depId => {
      dependencyGraph.addDependency(task.id, depId);
    });
  });

  return {
    ...input,
    dependencyGraph,
    validationHistory: [],
  };
}

/**
 * In-memory implementation of DependencyGraph
 */
export class InMemoryDependencyGraph implements DependencyGraph<Task> {
  private adjacencyList = new Map<string, string[]>();
  
  addDependency(taskId: string, dependsOn: string): void {
    if (!this.adjacencyList.has(taskId)) {
      this.adjacencyList.set(taskId, []);
    }
    
    if (!this.adjacencyList.get(taskId)!.includes(dependsOn)) {
      this.adjacencyList.set(taskId, [...this.adjacencyList.get(taskId)!, dependsOn]);
    }
  }

  getDependencies(taskId: string): string[] {
    return this.adjacencyList.get(taskId) || [];
  }

  getOrdering(): Task[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: Task[] = [];
    
    // Simple topological sort implementation
    const visit = (taskId: string): boolean => {
      if (visiting.has(taskId)) {
        // Cycle detected
        return false;
      }
      
      if (visited.has(taskId)) {
        return true;
      }
      
      visiting.add(taskId);
      
      const dependencies = this.getDependencies(taskId);
      for (const dep of dependencies) {
        if (!visit(dep)) {
          return false; // Cycle detected
        }
      }
      
      visiting.delete(taskId);
      visited.add(taskId);
      return true;
    };
    
    // Visit all nodes
    for (const taskId of this.adjacencyList.keys()) {
      if (!visited.has(taskId)) {
        if (!visit(taskId)) {
          throw new Error('Cycle detected in dependency graph');
        }
      }
    }
    
    // For now, return empty array - this would need to be connected with actual task data
    return result;
  }

  validateCycles(): ValidationResult {
    try {
      this.getOrdering();
      
      // Additional validation checks
      const errors: string[] = [];
      const warnings: string[] = [];
      
      // Check for tasks with circular dependencies
      for (const [taskId, deps] of this.adjacencyList.entries()) {
        if (deps.includes(taskId)) {
          errors.push(`Task "${taskId}" has a circular dependency on itself`);
        }
        
        for (const dep of deps) {
          if (!this.adjacencyList.has(dep)) {
            warnings.push(`Task "${taskId}" depends on non-existent task "${dep}"`);
          }
        }
      }
      
      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Cycle detected in dependency graph: ${(error as Error).message}`],
        warnings: [],
      };
    }
  }
}
