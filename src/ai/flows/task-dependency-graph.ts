
'use server';

/**
 * @fileOverview Task dependency graph system for modeling inter-task relationships.
 *
 * - DependencyGraph - A directed acyclic graph representing task dependencies
 * - TaskNode - Individual node in the dependency graph with metadata  
 * - DependencyValidationError - Error for circular or invalid dependencies
 */

import { Task } from '@/types';
import { z } from 'genkit';

export interface DependencyGraphNode {
  task: Task;
  dependencies: string[]; // Array of task titles this task depends on
 dependents: string[]; // Array of task titles that depend on this task
  prerequisitesMet: boolean;
}

export interface DependencyGraph {
  nodes: Map<string, DependencyGraphNode>;
  getSortedTasks(): Task[];
  validateDependencies(): ValidationResult[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: 'CIRCULAR_DEPENDENCY' | 'MISSING_PREREQUISITE' | 'INVALID_DEPENDENCY';
  message: string;
  affectedTasks: string[];
}

export interface ValidationWarning {
  type: 'MISSING_DEPENDENCY' | 'ORDERING_WARNING';
  message: string;
  affectedTasks: string[];
}

export class TaskDependencyGraph implements DependencyGraph {
  nodes = new Map<string, DependencyGraphNode>();

 constructor(tasks: Task[] = []) {
    this.initializeTasks(tasks);
  }

 private initializeTasks(tasks: Task[]) {
    // Create nodes for all tasks
    tasks.forEach(task => {
      this.nodes.set(task.title, {
        task,
        dependencies: [],
        dependents: [],
        prerequisitesMet: false,
      });
    });

    // Analyze task details to infer dependencies
    this.analyzeDependencies();
  }

 private analyzeDependencies() {
    for (const [title, node] of this.nodes) {
      const details = node.task.details.toLowerCase();
      
      // Infer dependencies based on task content
      if (details.includes('authentication') || details.includes('auth')) {
        // Auth tasks should typically come first
        const authTasks = Array.from(this.nodes.keys()).filter(t => 
          t.toLowerCase().includes('setup') || 
          t.toLowerCase().includes('config')
        );
        authTasks.forEach(authTask => {
          if (authTask !== title) {
            this.addDependency(title, authTask);
          }
        });
      }

      if (details.includes('database') || details.includes('db')) {
        // Database tasks should depend on setup/config
        const setupTasks = Array.from(this.nodes.keys()).filter(t => 
          t.toLowerCase().includes('setup') || 
          t.toLowerCase().includes('config')
        );
        setupTasks.forEach(setupTask => {
          if (setupTask !== title) {
            this.addDependency(title, setupTask);
          }
        });
      }

      if (details.includes('api') || details.includes('endpoint')) {
        // API tasks might depend on database and authentication
        const authTasks = Array.from(this.nodes.keys()).filter(t => 
          t.toLowerCase().includes('auth')
        );
        const dbTasks = Array.from(this.nodes.keys()).filter(t => 
          t.toLowerCase().includes('database')
        );
        
        authTasks.forEach(authTask => {
          this.addDependency(title, authTask);
        });
        dbTasks.forEach(dbTask => {
          this.addDependency(title, dbTask);
        });
      }
    }
  }

 public addDependency(taskTitle: string, dependencyTitle: string): void {
    const taskNode = this.nodes.get(taskTitle);
    const depNode = this.nodes.get(dependencyTitle);

    if (!taskNode || !depNode) {
      throw new Error(`Task not found: ${!taskNode ? taskTitle : dependencyTitle}`);
    }

    if (!taskNode.dependencies.includes(dependencyTitle)) {
      taskNode.dependencies.push(dependencyTitle);
    }

    if (!depNode.dependents.includes(taskTitle)) {
      depNode.dependents.push(taskTitle);
    }
  }

 public removeDependency(taskTitle: string, dependencyTitle: string): void {
    const taskNode = this.nodes.get(taskTitle);
    if (!taskNode) return;

    taskNode.dependencies = taskNode.dependencies.filter(dep => dep !== dependencyTitle);
    
    const depNode = this.nodes.get(dependencyTitle);
    if (depNode) {
      depNode.dependents = depNode.dependents.filter(dep => dep !== taskTitle);
    }
  }

 public getSortedTasks(): Task[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const sorted: Task[] = [];

    const visit = (taskTitle: string): void => {
      if (visiting.has(taskTitle)) {
        throw new Error(`Circular dependency detected involving task: ${taskTitle}`);
      }

      if (visited.has(taskTitle)) {
        return;
      }

      visiting.add(taskTitle);
      
      const node = this.nodes.get(taskTitle);
      if (node) {
        // Visit all dependencies first
        node.dependencies.forEach(dep => visit(dep));
      }

      visiting.delete(taskTitle);
      visited.add(taskTitle);

      const node = this.nodes.get(taskTitle);
      if (node) {
        sorted.push(node.task);
      }
    };

    // Visit all nodes
    for (const taskTitle of this.nodes.keys()) {
      if (!visited.has(taskTitle)) {
        visit(taskTitle);
      }
    }

    return sorted;
  }

 public validateDependencies(): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for circular dependencies
    try {
      this.getSortedTasks();
    } catch (error) {
      if (error instanceof Error && error.message.includes('Circular dependency')) {
        const taskTitle = error.message.split(': ')[1];
        errors.push({
          type: 'CIRCULAR_DEPENDENCY',
          message: `Circular dependency detected involving task: ${taskTitle}`,
          affectedTasks: [taskTitle],
        });
      }
    }

    // Check for missing prerequisites
    for (const [taskTitle, node] of this.nodes) {
      const missingDeps = node.dependencies.filter(dep => !this.nodes.has(dep));
      if (missingDeps.length > 0) {
        errors.push({
          type: 'MISSING_PREREQUISITE',
          message: `Task "${taskTitle}" depends on non-existent tasks: ${missingDeps.join(', ')}`,
          affectedTasks: [taskTitle, ...missingDeps],
        });
      }
    }

    // Check for tasks with no dependencies that might be prerequisites
    const potentialPrerequisites = Array.from(this.nodes.keys()).filter(title => {
      const node = this.nodes.get(title)!;
      return node.dependencies.length === 0 && 
             (title.toLowerCase().includes('setup') || 
              title.toLowerCase().includes('config'));
    });

    if (potentialPrerequisites.length > 0) {
      warnings.push({
        type: 'ORDERING_WARNING',
        message: `These tasks have no dependencies and should be prerequisites for other tasks: ${potentialPrerequisites.join(', ')}`,
        affectedTasks: potentialPrerequisites,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

 public getTaskExecutionOrder(): string[] {
    return this.getSortedTasks().map(task => task.title);
  }

 public getTaskWithPrerequisitesMet(): Task[] {
    const sortedTasks = this.getSortedTasks();
    
    return sortedTasks.filter(task => {
      const node = this.nodes.get(task.title);
      if (!node) return false;

      // Check if all dependencies are met (i.e., have been processed)
      const depsMet = node.dependencies.every(dep => {
        return sortedTasks.some(sortedTask => 
          sortedTask.title === dep && sortedTasks.indexOf(sortedTask) < sortedTasks.indexOf(task)
        );
      });

      return depsMet;
    });
  }

 public static inferDependenciesFromTasks(tasks: Task[]): DependencyGraph {
    return new TaskDependencyGraph(tasks);
  }
}

// Zod schema for API input
const DependencyValidationInputSchema = z.object({
  tasks: z.array(z.string()).describe('Array of task titles to validate dependencies for'),
});

export type DependencyValidationInput = z.infer<typeof DependencyValidationInputSchema>;

// Helper function to create dependency graph from task objects
export async function createDependencyGraph(
  tasks: Task[]
): Promise<DependencyGraph> {
  return new TaskDependencyGraph(tasks);
}

// Helper function to validate task dependencies
export async function validateTaskDependencies(
  tasks: Task[]
): Promise<ValidationResult> {
  const graph = new TaskDependencyGraph(tasks);
  return graph.validateDependencies();
}
