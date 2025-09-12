'use server';

/**
 * @fileOverview Unified project orchestrator that coordinates all AI flows
 * and maintains consistent context throughout the workflow.
 */

import { 
  UnifiedProjectContext, 
  ProjectOrchestrator, 
  ValidationResult,
  TaskDependency
} from '@/types/unified-context';
import { generateTasks } from '@/ai/flows/generate-tasks';
import { generateArchitecture } from '@/ai/flows/generate-architecture';
import { generateFileStructure } from '@/ai/flows/generate-file-structure';
import { researchTask } from '@/ai/flows/research-task';

export class UnifiedProjectOrchestrator implements ProjectOrchestrator {
  
  async generateUnifiedPlan(
    input: Partial<UnifiedProjectContext>, 
    apiKey?: string, 
    model?: string,
    apiBase?: string,
    useTDD: boolean = false
  ): Promise<UnifiedProjectContext> {
    const context: UnifiedProjectContext = {
      prd: input.prd || '',
      architecture: input.architecture || '',
      fileStructure: input.fileStructure || '',
      specifications: input.specifications || '',
      tasks: input.tasks || [],
      dependencyGraph: input.dependencyGraph || [],
      validationHistory: input.validationHistory || [],
      lastUpdated: new Date().toISOString(),
      version: (input.version || 0) + 1,
    };

    // Step 1: Generate architecture & specifications if needed
    if (!context.architecture && context.prd) {
      const archResult = await generateArchitecture(
        { prd: context.prd },
        apiKey,
        model,
        apiBase
      );
      context.architecture = archResult.architecture;
      context.specifications = archResult.specifications;
    }

    // Step 2: Generate file structure if needed
    if (!context.fileStructure && context.architecture && context.specifications) {
      const fileResult = await generateFileStructure(
        {
          prd: context.prd,
          architecture: context.architecture,
          specifications: context.specifications
        },
        apiKey,
        model,
        apiBase
      );
      context.fileStructure = fileResult.fileStructure || '';
    }

    // Step 3: Generate tasks with dependency awareness
    if (context.architecture && context.specifications && context.fileStructure) {
      const tasksResult = await generateTasks(
        {
          architecture: context.architecture,
          specifications: context.specifications,
          fileStructure: context.fileStructure
        },
        apiKey,
        model,
        apiBase,
        useTDD
      );
      
      // Transform tasks to include dependency tracking
      context.tasks = tasksResult.tasks.map((task, index) => ({
        ...task,
        id: `task-${index + 1}`,
        order: index + 1,
        dependencies: this.inferTaskDependencies(task.title, tasksResult.tasks, index),
        status: 'pending' as const,
      }));

      // Build dependency graph
      context.dependencyGraph = this.buildDependencyGraph(context.tasks);
    }

    // Step 4: Validate the final context
    const validationResults = this.validateContext(context);
    context.validationHistory = validationResults;

    context.lastUpdated = new Date().toISOString();
    return context;
  }

  validateContext(context: UnifiedProjectContext): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Validate architecture consistency
    if (context.architecture && context.fileStructure) {
      if (!this.architectureMatchesFileStructure(context.architecture, context.fileStructure)) {
        results.push({
          isValid: false,
          issues: ['File structure does not align with proposed architecture'],
          component: 'architecture',
          severity: 'error'
        });
      }
    }

    // Validate task dependencies
    const dependencyIssues = this.validateTaskDependencies(context.tasks);
    if (dependencyIssues.length > 0) {
      results.push({
        isValid: false,
        issues: dependencyIssues,
        component: 'dependencies',
        severity: 'error'
      });
    }

    // Validate task-file structure alignment
    const taskFileIssues = this.validateTaskFileAlignment(context.tasks, context.fileStructure);
    if (taskFileIssues.length > 0) {
      results.push({
        isValid: false,
        issues: taskFileIssues,
        component: 'tasks',
        severity: 'warning'
      });
    }

    return results;
  }

  updateContext(context: UnifiedProjectContext, updates: Partial<UnifiedProjectContext>): UnifiedProjectContext {
    const updatedContext = {
      ...context,
      ...updates,
      lastUpdated: new Date().toISOString(),
      version: context.version + 1,
    };

    // Re-validate after updates
    const validationResults = this.validateContext(updatedContext);
    updatedContext.validationHistory = [...context.validationHistory, ...validationResults];

    return updatedContext;
  }

  async researchTasksWithDependencies(
    context: UnifiedProjectContext, 
    apiKey?: string, 
    model?: string,
    apiBase?: string,
    useTDD: boolean = false
  ): Promise<UnifiedProjectContext> {
    const updatedTasks = [...context.tasks];
    const completedTaskIds: string[] = [];

    // Research tasks in dependency order
    const orderedTasks = this.optimizeTaskOrdering(context.tasks);
    
    for (const task of orderedTasks) {
      try {
        // Mark as researching
        const taskIndex = updatedTasks.findIndex(t => t.id === task.id);
        updatedTasks[taskIndex] = { ...task, status: 'researching' };

        // Research with full context of completed tasks
        const researchResult = await researchTask(
          {
            title: task.title,
            architecture: context.architecture,
            fileStructure: context.fileStructure,
            specifications: context.specifications
          },
          apiKey,
          model,
          apiBase,
          useTDD
        );

        // Update task with research results
        const formattedDetails = researchResult.markdownContent;
        
        updatedTasks[taskIndex] = {
          ...task,
          details: formattedDetails,
          status: 'completed'
        };

        completedTaskIds.push(task.id);

      } catch (error) {
        const taskIndex = updatedTasks.findIndex(t => t.id === task.id);
        updatedTasks[taskIndex] = {
          ...task,
          details: `Failed to research task: ${(error as Error).message}`,
          status: 'failed'
        };
      }
    }

    return {
      ...context,
      tasks: updatedTasks,
      lastUpdated: new Date().toISOString(),
      version: context.version + 1,
    };
  }

  optimizeTaskOrdering(tasks: UnifiedProjectContext['tasks']): UnifiedProjectContext['tasks'] {
    // Topological sort based on dependencies
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: UnifiedProjectContext['tasks'] = [];

    const visit = (taskId: string) => {
      if (visiting.has(taskId)) {
        throw new Error(`Circular dependency detected involving task: ${taskId}`);
      }
      if (visited.has(taskId)) return;

      visiting.add(taskId);
      
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        // Visit all dependencies first
        task.dependencies.forEach(depId => visit(depId));
        visiting.delete(taskId);
        visited.add(taskId);
        result.push(task);
      }
    };

    // Visit all tasks
    tasks.forEach(task => {
      if (!visited.has(task.id)) {
        visit(task.id);
      }
    });

    return result;
  }

  private inferTaskDependencies(taskTitle: string, allTasks: Array<{title: string}>, currentIndex: number): string[] {
    const dependencies: string[] = [];
    
    // Basic dependency inference logic
    const lowerTitle = taskTitle.toLowerCase();
    
    // Setup tasks come first
    if (lowerTitle.includes('setup') || lowerTitle.includes('configure') || lowerTitle.includes('initialize')) {
      return []; // No dependencies for setup tasks
    }
    
    // Authentication dependencies
    if (lowerTitle.includes('login') || lowerTitle.includes('auth') || lowerTitle.includes('user') && !lowerTitle.includes('setup')) {
      const authTasks = allTasks.slice(0, currentIndex).filter((t) => 
        t.title.toLowerCase().includes('auth') || t.title.toLowerCase().includes('user setup')
      );
      if (authTasks.length > 0) {
        dependencies.push(`task-${allTasks.indexOf(authTasks[authTasks.length - 1]) + 1}`);
      }
    }
    
    // UI/Component dependencies
    if (lowerTitle.includes('page') || lowerTitle.includes('component')) {
      const setupTasks = allTasks.slice(0, currentIndex).filter((t) => 
        t.title.toLowerCase().includes('setup') || t.title.toLowerCase().includes('configure')
      );
      if (setupTasks.length > 0) {
        dependencies.push(`task-${allTasks.indexOf(setupTasks[setupTasks.length - 1]) + 1}`);
      }
    }

    return dependencies;
  }

  private buildDependencyGraph(tasks: UnifiedProjectContext['tasks']): TaskDependency[] {
    return tasks.map(task => ({
      taskId: task.id,
      dependsOn: task.dependencies,
      blockedBy: tasks.filter(t => t.dependencies.includes(task.id)).map(t => t.id),
    }));
  }

  private architectureMatchesFileStructure(architecture: string, fileStructure: string): boolean {
    // Basic heuristic checks
    const archLower = architecture.toLowerCase();
    const structLower = fileStructure.toLowerCase();
    
    // Check for common patterns
    if (archLower.includes('react') && !structLower.includes('components')) return false;
    if (archLower.includes('api') && !structLower.includes('api')) return false;
    if (archLower.includes('database') && !structLower.includes('db') && !structLower.includes('models')) return false;
    
    return true;
  }

  private validateTaskDependencies(tasks: UnifiedProjectContext['tasks']): string[] {
    const issues: string[] = [];
    const taskIds = new Set(tasks.map(t => t.id));
    
    tasks.forEach(task => {
      task.dependencies.forEach(depId => {
        if (!taskIds.has(depId)) {
          issues.push(`Task "${task.title}" has invalid dependency: ${depId}`);
        }
      });
    });

    return issues;
  }

  private validateTaskFileAlignment(_tasks: UnifiedProjectContext['tasks'], _fileStructure: string): string[] {
    const issues: string[] = [];
    // This would check if tasks reference files that exist in the structure
    // Implementation would depend on specific file structure format
    return issues;
  }
}