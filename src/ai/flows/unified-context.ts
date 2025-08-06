
'use server';

/**
 * @fileOverview Unified Project Context Manager - Single source of truth for all project data
 *
 * This module provides a centralized context management system that addresses the architectural flaws
 * described in Issue #7 by ensuring all components have access to consistent, interconnected data.
 */

import { z } from 'genkit';

// Define the unified project context schema
export const UnifiedProjectContextSchema = z.object({
  prd: z.string().describe('The Product Requirements Document (PRD) for the project.'),
  architecture: z.string().describe('The proposed software architecture for the project.'),
  specifications: z.string().describe('The detailed specifications for the project.'),
  fileStructure: z.string().describe('The proposed file/folder structure for the project.'),
  tasks: z.array(z.object({
    title: z.string().describe('A concise title for the development task.'),
    details: z.string().describe('Detailed implementation guidance.'),
    dependencies: z.array(z.string()).optional().default([]).describe('List of task titles this task depends on.'),
    status: z.enum(['pending', 'in_progress', 'completed', 'failed']).optional().default('pending'),
    researchContext: z.string().optional().describe('Research context specific to this task.'),
  })).default([]).describe('List of generated tasks with dependencies and status tracking.'),
  validationHistory: z.array(z.object({
    timestamp: z.string().describe('When the validation was performed.'),
    type: z.enum(['architecture_consistency', 'task_dependency_validation', 'file_structure_alignment']),
    status: z.enum(['passed', 'failed', 'warning']),
    message: z.string().describe('Validation result details.'),
  })).default([]).describe('History of validation checks performed on the project context.')
});

export type UnifiedProjectContext = z.infer<typeof UnifiedProjectContextSchema>;

// Context manager class for managing the unified project state
export class ProjectContextManager {
  private context: UnifiedProjectContext;

  constructor(initialPrd: string = '') {
    this.context = {
      prd: initialPrd,
      architecture: '',
      specifications: '',
      fileStructure: '',
      tasks: [],
      validationHistory: []
    };
  }

  // Get the current context
  getContext(): UnifiedProjectContext {
    return { ...this.context };
  }

  // Update PRD and trigger context validation
  updatePrd(prd: string): void {
    this.context.prd = prd;
    this.addValidationToHistory('context_update', 'warning', 'PRD updated - dependent components may need regeneration');
  }

  // Update architecture and trigger validation
  updateArchitecture(architecture: string, specifications: string): void {
    this.context.architecture = architecture;
    this.context.specifications = specifications;
    
    // Mark tasks as needing revalidation due to architecture changes
    this.context.tasks = this.context.tasks.map(task => ({
      ...task,
      status: 'pending' as const
    }));
    
    this.addValidationToHistory('architecture_consistency', 'warning', 'Architecture updated - tasks marked for revalidation');
  }

  // Update file structure and trigger validation
  updateFileStructure(fileStructure: string): void {
    this.context.fileStructure = fileStructure;
    
    // Add validation to check task-file structure alignment
    this.addValidationToHistory('file_structure_alignment', 'warning', 'File structure updated - validating task alignment');
  }

  // Add a new task with dependency analysis
  addTask(taskTitle: string, details?: string): void {
    // Check for circular dependencies and validate against existing tasks
    const newTask = {
      title: taskTitle,
      details: details || '',
      dependencies: this.analyzeTaskDependencies(taskTitle),
      status: 'pending' as const,
      researchContext: ''
    };
    
    this.context.tasks.push(newTask);
    this.addValidationToHistory('task_dependency_validation', 'passed', `Task "${taskTitle}" added with ${newTask.dependencies.length} dependencies`);
  }

  // Update task details and mark as completed
  updateTaskDetails(taskTitle: string, details: string): void {
    const taskIndex = this.context.tasks.findIndex(t => t.title === taskTitle);
    if (taskIndex !== -1) {
      this.context.tasks[taskIndex] = {
        ...this.context.tasks[taskIndex],
        details,
        status: 'completed' as const
      };
    }
  }

  // Analyze task dependencies based on content and existing tasks
  private analyzeTaskDependencies(taskTitle: string): string[] {
    const dependencies: string[] = [];
    
    // Simple dependency analysis based on common patterns
    const taskKeywords = {
      'setup': ['project setup', 'initialization'],
      'authentication': ['user authentication', 'login system'],
      'database': ['database setup', 'schema design'],
      'api': ['API endpoint', 'service integration'],
      'ui': ['user interface', 'frontend component'],
      'testing': ['test suite', 'unit tests']
    };

    // Look for dependency indicators in task title
    const lowerTitle = taskTitle.toLowerCase();
    
    if (lowerTitle.includes('user') && !lowerTitle.includes('auth')) {
      dependencies.push(...this.findTasksByKeywords(['authentication']));
    }
    
    if (lowerTitle.includes('api') && !lowerTitle.includes('setup')) {
      dependencies.push(...this.findTasksByKeywords(['setup', 'database']));
    }
    
    if (lowerTitle.includes('ui') || lowerTitle.includes('frontend')) {
      dependencies.push(...this.findTasksByKeywords(['setup', 'api']));
    }
    
    if (lowerTitle.includes('test')) {
      dependencies.push(...this.findTasksByKeywords(['ui', 'api', 'authentication']));
    }

    return [...new Set(dependencies)]; // Remove duplicates
  }

  // Find existing tasks by keywords
  private findTasksByKeywords(keywords: string[]): string[] {
    return this.context.tasks
      .filter(task => 
        keywords.some(keyword => task.title.toLowerCase().includes(keyword))
      )
      .map(task => task.title);
  }

  // Add validation entry to history
  private addValidationToHistory(type: string, status: 'passed' | 'failed' | 'warning', message: string): void {
    this.context.validationHistory.push({
      timestamp: new Date().toISOString(),
      type: type as any,
      status,
      message
    });
  }

  // Validate context consistency
  validateContext(): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check if essential components are present
    if (!this.context.prd) {
      issues.push('PRD is missing');
    }
    
    if (!this.context.architecture) {
      issues.push('Architecture is missing');
    }
    
    if (this.context.tasks.length === 0) {
      issues.push('No tasks generated');
    }

    // Check for circular dependencies
    const circularDeps = this.detectCircularDependencies();
    if (circularDeps.length > 0) {
      issues.push(`Circular dependencies detected: ${circularDeps.join(', ')}`);
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  // Detect circular dependencies in tasks
  private detectCircularDependencies(): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const circularDeps: string[] = [];

    // Build dependency graph
    const taskGraph: Record<string, string[]> = {};
    this.context.tasks.forEach(task => {
      taskGraph[task.title] = task.dependencies;
    });

    // DFS to detect cycles
    const hasCycle = (taskTitle: string): boolean => {
      if (!visited.has(taskTitle)) {
        visited.add(taskTitle);
        recursionStack.add(taskTitle);

        const dependencies = taskGraph[taskTitle] || [];
        for (const dep of dependencies) {
          if (!visited.has(dep) && hasCycle(dep)) {
            circularDeps.push(`${dep} → ${taskTitle}`);
            return true;
          } else if (recursionStack.has(dep)) {
            circularDeps.push(`${dep} → ${taskTitle}`);
            return true;
          }
        }
      }

      recursionStack.delete(taskTitle);
      return false;
    };

    // Check all tasks for cycles
    this.context.tasks.forEach(task => {
      if (!visited.has(task.title)) {
        hasCycle(task.title);
      }
    });

    return circularDeps;
  }

  // Export context for debugging
  exportContext(): string {
    return JSON.stringify(this.context, null, 2);
  }

  // Import context from external source
  importContext(context: Partial<UnifiedProjectContext>): void {
    this.context = { ...this.context, ...context };
  }
}

// Singleton instance for global access
let globalContextManager: ProjectContextManager | null = null;

export function getGlobalContextManager(): ProjectContextManager {
  if (!globalContextManager) {
    globalContextManager = new ProjectContextManager();
  }
  return globalContextManager;
}

// Factory function to create context manager with initial PRD
export function createContextWithPrd(prd: string): ProjectContextManager {
  return new ProjectContextManager(prd);
}
