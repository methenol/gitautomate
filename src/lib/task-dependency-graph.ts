

import type { Task } from '@/types';
import type { ResearchTaskOutput as ResearchedTaskDetails } from '@/ai/flows/research-task';
import type { UnifiedProjectContext, ValidationResult } from '@/types/unified-context';

/**
 * Manages task dependencies and provides dependency-based ordering
 */
export class TaskDependencyGraph {
  private adjacencyList: Map<string, string[]> = new Map();
  private taskTitlesToIds: Map<string, string> = new Map();

  constructor(tasks: Task[]) {
    this.buildGraph(tasks);
  }

  /**
   * Builds the dependency graph from task titles by analyzing content
   */
  private buildGraph(tasks: Task[]): void {
    // Clear existing graph
    this.adjacencyList.clear();
    this.taskTitlesToIds.clear();

    // Create mappings from task titles to IDs
    tasks.forEach((task, index) => {
      const taskId = `task-${index + 1}`;
      this.taskTitlesToIds.set(task.title, taskId);
    });

    // Analyze each task to identify dependencies
    tasks.forEach((task, index) => {
      const taskId = `task-${index + 1}`;
      
      // Initialize with empty dependencies
      this.adjacencyList.set(taskId, []);

      // Analyze task title and content to identify dependencies
      const dependencies = this.extractDependenciesFromTask(task, tasks);
      
      if (dependencies.length > 0) {
        this.adjacencyList.set(taskId, dependencies);
      }
    });
  }

  /**
   * Extracts dependency information from a task by analyzing its content
   */
  private extractDependenciesFromTask(task: Task, allTasks: Task[]): string[] {
    const dependencies: string[] = [];
    
    // Keywords that indicate prerequisites
    const prerequisiteKeywords = [
      'after', 'before', 'requires', 'dependency', 'prerequisite',
      'following', 'preceding', 'once', 'then', 'next'
    ];

    const taskTitleLower = task.title.toLowerCase();
    
    // Check for explicit dependencies in the title
    allTasks.forEach((otherTask, otherIndex) => {
      if (otherTask.title === task.title) return; // Don't depend on self
      
      const otherTaskId = `task-${otherIndex + 1}`;
      
      // Check if this task mentions the other task
      prerequisiteKeywords.forEach(keyword => {
        const keywordPattern = `\\b${keyword}\\s+(?:the )?(${otherTask.title.toLowerCase()})`;
        const regex = new RegExp(keywordPattern, 'i');
        
        if (regex.test(taskTitleLower)) {
          dependencies.push(otherTaskId);
        }
      });

      // Check for sequential ordering keywords
      if (taskTitleLower.includes(`${otherTask.title.toLowerCase()} then`) ||
          taskTitleLower.includes(`after ${otherTask.title.toLowerCase()}`)) {
        dependencies.push(otherTaskId);
      }
    });

    return [...new Set(dependencies)]; // Remove duplicates
  }

  /**
   * Performs topological sort to get execution order
   */
  public getExecutionOrder(): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const result: string[] = [];

    const visit = (nodeId: string): void => {
      if (recursionStack.has(nodeId)) {
        throw new Error(`Circular dependency detected involving task ${nodeId}`);
      }
      
      if (visited.has(nodeId)) {
        return;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      // Visit all dependencies first
      const neighbors = this.adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        visit(neighbor);
      }

      recursionStack.delete(nodeId);
      result.push(nodeId);
    };

    // Visit all nodes
    const allNodes = Array.from(this.adjacencyList.keys());
    for (const node of allNodes) {
      if (!visited.has(node)) {
        visit(node);
      }
    }

    return result;
  }

  /**
   * Gets tasks that have no dependencies (can be executed first)
   */
  public getRootTasks(): string[] {
    const allTaskIds = Array.from(this.adjacencyList.keys());
    const hasIncomingEdges = new Set<string>();
    
    // Collect all nodes that are depended upon
    for (const dependencies of this.adjacencyList.values()) {
      for (const depId of dependencies) {
        hasIncomingEdges.add(depId);
      }
    }

    // Root tasks are those with no incoming edges
    return allTaskIds.filter(taskId => !hasIncomingEdges.has(taskId));
  }

  /**
   * Validates that the dependency graph is acyclic
   */
  public validate(): ValidationResult {
    const errors: string[] = [];
    
    try {
      this.getExecutionOrder();
    } catch (error) {
      if (error instanceof Error && error.message.includes('Circular dependency')) {
        errors.push(error.message);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      timestamp: new Date(),
    };
  }

  /**
   * Gets the dependency chain for a specific task
   */
  public getDependencyChain(taskId: string): string[] {
    const chain: string[] = [];
    const visited = new Set<string>();
    
    const buildChain = (nodeId: string): void => {
      if (visited.has(nodeId)) return;
      
      visited.add(nodeId);
      chain.push(nodeId);
      
      const dependencies = this.adjacencyList.get(nodeId) || [];
      for (const depId of dependencies) {
        buildChain(depId);
      }
    };
    
    // Build chain in reverse order (dependencies first)
    const dependencies = this.adjacencyList.get(taskId) || [];
    for (const depId of dependencies) {
      buildChain(depId);
    }
    
    return chain.reverse();
  }

  /**
   * Converts task IDs back to task titles
   */
  public getTaskTitlesForIds(taskIds: string[]): string[] {
    return taskIds.map(id => {
      // Extract the original index from taskId (e.g., "task-1" -> 0)
      const match = id.match(/task-(\d+)/);
      if (match) {
        const index = parseInt(match[1]) - 1;
        // Find the task by its original position
        const allTasks = Array.from(this.taskTitlesToIds.keys());
        return allTasks[index] || id;
      }
      return id;
    });
  }

  /**
   * Checks if a task can be executed (all dependencies completed)
   */
  public isTaskReady(taskId: string, completedTasks: Set<string>): boolean {
    const dependencies = this.adjacencyList.get(taskId) || [];
    
    // Check if all dependencies are completed
    return dependencies.every(depId => completedTasks.has(depId));
  }
}

/**
 * Creates a dependency-aware task researcher that considers dependencies
 */
export class DependencyAwareTaskResearcher {
  private context: UnifiedProjectContext;

  constructor(context: UnifiedProjectContext) {
    this.context = context;
  }

  /**
   * Researches a single task with full knowledge of dependencies and completed work
   */
  async researchTaskWithDependencies(
    taskIndex: number
  ): Promise<ResearchedTaskDetails> {
    const task = this.context.tasks[taskIndex];
    
    if (!task) {
      throw new Error(`Task not found at index ${taskIndex}`);
    }

    // Import the research task function
    const { runResearchTask } = await import('@/app/actions');
    
    return await runResearchTask(
      {
        title: task.title,
        architecture: this.context.architecture || '',
        fileStructure: this.context.fileStructure || '', 
        specifications: this.context.specifications || '',
      },
      {
        apiKey: process.env.GOOGLE_API_KEY,
        model: 'gemini-1.5-pro-latest',
      }
    );
  }

  /**
   * Gets the optimal research order based on dependencies
   */
  getResearchOrder(): number[] {
    const dependencyGraph = new TaskDependencyGraph(this.context.tasks);
    
    try {
      const executionOrder = dependencyGraph.getExecutionOrder();
      
      // Convert task IDs back to array indices
      return executionOrder.map(taskId => {
        const match = taskId.match(/task-(\d+)/);
        return match ? parseInt(match[1]) - 1 : 0;
      });
    } catch (error) {
      // Fallback to original order if there are circular dependencies
      console.warn('Circular dependency detected, using research order:', error);
      return this.context.tasks.map((_, index) => index);
    }
  }

  /**
   * Validates that research is complete and consistent
   */
  validateResearchCompleteness(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if all tasks have been researched
    const unresearchedTasks = this.context.tasks.filter(
      (_, index) => !this.context.researchedTasks.has(`task-${index + 1}`)
    );

    if (unresearchedTasks.length > 0) {
      warnings.push(`${unresearchedTasks.length} tasks have not been researched`);
    }

    // Check for consistency between architecture and task details
    if (this.context.architecture && this.tasksMatchArchitecture()) {
      warnings.push('Some task details may not align with the proposed architecture');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      timestamp: new Date(),
    };
  }

  private tasksMatchArchitecture(): boolean {
    // This is a simplified check - in production, you'd want more sophisticated analysis
    if (!this.context.architecture || this.context.tasks.length === 0) {
      return false;
    }

    // Check if architecture mentions key concepts that should appear in tasks
    const archKeywords = ['authentication', 'database', 'api', 'frontend', 'backend'];
    const hasArchKeywords = archKeywords.some(keyword => 
      this.context.architecture!.toLowerCase().includes(keyword)
    );

    return hasArchKeywords;
  }
}

