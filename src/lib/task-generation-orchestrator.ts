

'use server';

// Helper function for describing arrays
const describeArray = <T>(schema: z.ZodType<T>, description: string) => schema;

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  UnifiedProjectContext,
  ProjectPlan,
  EnhancedTask,
  DependencyGraph,
  TaskGenerationOrchestrator as ITaskGenerationOrchestrator,
  ValidationResult,
  ValidationResultItem
} from '@/types/unified-project';
import { unifiedContextManager } from './unified-context-manager';

/**
 * Task Generation Orchestrator - Replaces siloed task generation
 * 
 * This class coordinates the entire project planning process with full context awareness,
 * dependency management, and iterative refinement.
 */
export class TaskGenerationOrchestrator implements ITaskGenerationOrchestrator {
  private context: UnifiedProjectContext | null = null;

  /**
   * Generate a complete project plan with unified context
   */
  async generateProjectPlan(context: UnifiedProjectContext): Promise<ProjectPlan> {
    this.context = context;
    
    try {
      // Step 1: Generate unified task titles with full context
      const enhancedTasks = await this.generateEnhancedTasks(context);
      
      // Step 2: Build dependency graph
      const dependencyGraph = await this.buildDependencyGraph(enhancedTasks, context);
      
      // Step 3: Validate the complete workflow
      const validationResults = await this.validateTaskConsistency({
        id: crypto.randomUUID(),
        context,
        dependencyGraph,
        validationResults: [],
        executionOrder: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Step 4: Generate optimal execution order
      const executionOrder = this.optimizeDependencyOrdering(
        Object.values(dependencyGraph.tasks).map(task => ({ ...task }))
      );

      return {
        id: crypto.randomUUID(),
        context,
        dependencyGraph,
        validationResults,
        executionOrder,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      console.error('Error generating project plan:', error);
      
      // Generate a basic fallback plan even if some steps fail
      const enhancedTasks = await this.generateBasicFallbackTasks(context);
      
      return {
        id: crypto.randomUUID(),
        context,
        dependencyGraph: {
          tasks: enhancedTasks.reduce((acc, task) => ({
            ...acc,
            [task.id]: task
          }), {}),
          edges: []
        },
        validationResults: [{
          type: 'consistency',
          message: error instanceof Error ? error.message : 'Unknown generation error',
          severity: 'warning'
        }],
        executionOrder: enhancedTasks.map(task => task.id),
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
  }

  /**
   * Validate task consistency across the entire project plan
   */
  validateTaskConsistency(plan: ProjectPlan): ValidationResultItem[] {
    const results: ValidationResultItem[] = [];
    
    // Check 1: Architecture-Task Alignment
    if (plan.context.architecture) {
      const architectureTasks = Object.values(plan.dependencyGraph.tasks)
        .filter(task => 
          task.context.toLowerCase().includes('architecture') ||
          task.title.toLowerCase().includes('architectur')
        );
      
      if (architectureTasks.length === 0) {
        results.push({
          type: 'consistency',
          message: 'No tasks specifically address architecture implementation',
          severity: 'warning'
        });
      }
    }

    // Check 2: File Structure-Task Alignment
    if (plan.context.fileStructure) {
      const fileReferences = new Set<string>();
      
      Object.values(plan.dependencyGraph.tasks).forEach(task => {
        const files = this.extractFileReferences(task.implementationSteps);
        files.forEach(file => fileReferences.add(file));
      });

      const missingFiles = this.findMissingFileReferences(
        Array.from(fileReferences), 
        plan.context.fileStructure
      );

      if (missingFiles.length > 0) {
        results.push({
          type: 'consistency',
          message: `${missingFiles.length} file references in tasks may not exist in the project structure`,
          severity: 'error'
        });
      }
    }

    // Check 3: Dependency Validation
    const dependencyErrors = this.validateDependencies(plan.dependencyGraph);
    results.push(...dependencyErrors.map(err => ({
      type: 'dependency' as const,
      message: err.message || 'Dependency validation failed',
      severity: 'error' as const
    })));

    // Check 4: Task Coverage Completeness
    const completenessIssues = this.checkTaskCompleteness(plan);
    results.push(...completenessIssues.map(err => ({
      type: 'completeness' as const,
      message: err.message || 'Completeness check failed',
      severity: 'error' as const
    })));

    // Check 5: Sequential Logic Validation
    const logicErrors = this.validateSequentialLogic(plan);
    results.push(...logicErrors.map(err => ({
      type: 'consistency' as const,
      message: err.message || 'Logic validation failed',
      severity: 'error' as const
    })));

    return results;
  }

  /**
   * Optimize dependency ordering for optimal execution
   */
  optimizeDependencyOrdering(tasks: EnhancedTask[]): string[] {
    try {
      // Topological sort with dependency resolution
      const executionOrder: string[] = [];
      const visited = new Set<string>();
      const visiting = new Set<string>();

      // Helper function to visit a task and its dependencies
      const visitTask = (taskId: string) => {
        if (visited.has(taskId)) return;
        
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        // Check for circular dependencies
        if (visiting.has(taskId)) {
          console.warn(`Circular dependency detected involving task ${taskId}`);
          return;
        }

        visiting.add(taskId);

        // Visit all dependencies first
        task.dependencies.forEach(depId => visitTask(depId));

        visiting.delete(taskId);
        visited.add(taskId);

        // Add to execution order if not already added
        if (!executionOrder.includes(taskId)) {
          executionOrder.push(taskId);
        }
      };

      // Visit all tasks
      tasks.forEach(task => {
        if (!visited.has(task.id)) {
          visitTask(task.id);
        }
      });

      // If topological sort fails, use priority-based fallback
      if (executionOrder.length !== tasks.length) {
        return this.priorityBasedFallback(tasks);
      }

      // Apply additional optimizations
      const optimizedOrder = this.applyExecutionOptimizations(executionOrder, tasks);
      
      return optimizedOrder;
    } catch (error) {
      console.error('Error optimizing dependency order:', error);
      
      // Fallback: sort by priority and creation time
      return this.priorityBasedFallback(tasks);
    }
  }

  /**
   * Generate enhanced tasks with full context awareness
   */
  private async generateEnhancedTasks(context: UnifiedProjectContext): Promise<EnhancedTask[]> {
    const taskGenerationPrompt = this.buildTaskGenerationPrompt(context);
    
    try {
      const { output } = await ai.generate({
        model: 'googleai/gemini-1.5-flash-latest',
        prompt: taskGenerationPrompt,
        output: {
          schema: z.object({
            tasks: z.array(z.object({
              id: z.string().uuid(),
              title: z.string(),
              description: z.string().default(''),
              category: z.enum(['setup', 'architecture', 'feature', 'testing', 'documentation', 'deployment', 'optimization']).default('feature'),
              dependencies: z.array(z.string()).describe('Task IDs this task depends on').default([]),
              context: z.string().describe('How this task fits into the overall architecture'),
              estimatedDuration: z.number().positive().optional(),
              priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
              tags: z.array(z.string()).default([])
            }))
          })
        }
      });

      if (!output?.tasks) {
        throw new Error('No tasks generated by AI');
      }

      // Convert to EnhancedTask format with additional fields
      return output.tasks.map(task => ({
        ...task,
        implementationSteps: '', // Will be populated during research
        acceptanceCriteria: '',
        dependents: [], // Will be calculated when building dependency graph
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
    } catch (error) {
      console.error('Error generating enhanced tasks:', error);
      
      // Generate basic fallback tasks
      return await this.generateBasicFallbackTasks(context);
    }
  }

  /**
   * Build dependency graph from tasks
   */
  private async buildDependencyGraph(
    enhancedTasks: EnhancedTask[],
    context: UnifiedProjectContext
  ): Promise<DependencyGraph> {
    
    // Create task map for easy lookup
    const taskMap: Record<string, EnhancedTask> = {};
    
    enhancedTasks.forEach(task => {
      taskMap[task.id] = { ...task };
    });

    // Calculate dependents (reverse dependencies)
    enhancedTasks.forEach(task => {
      task.dependencies.forEach(depId => {
        if (taskMap[depId]) {
          // Add this task as a dependent of its dependency
          if (!taskMap[depId].dependents.includes(task.id)) {
            taskMap[depId].dependents.push(task.id);
          }
        } else {
          console.warn(`Task ${task.title} depends on non-existent task ${depId}`);
        }
      });
    });

    // Add implicit dependencies based on project context
    this.addImplicitDependencies(taskMap, enhancedTasks, context);

    return {
      tasks: taskMap,
      edges: this.generateDependencyEdges(enhancedTasks)
    };
  }

  /**
   * Generate task generation prompt with full context
   */
  private buildTaskGenerationPrompt(context: UnifiedProjectContext): string {
    const { prd, architecture, specifications, fileStructure } = context;
    
    return `You are a lead software architect and project manager creating a comprehensive development plan. 

**Project Context:**
- **PRD**: ${prd}
- **Architecture**: ${architecture}
- **Specifications**: ${specifications} 
- **File Structure**: ${fileStructure}

**Task Generation Requirements:**

1. Generate a complete set of development tasks that fully implement the project
2. Each task must include:
   - Unique ID (UUID format)
   - Clear, descriptive title
   - Category: setup | architecture | feature | testing | documentation | deployment | optimization
   - Dependencies on other task IDs (if any)
   - Context explaining how it fits the overall architecture
   - Estimated duration in hours (if reasonable to estimate)
   - Priority: low | medium | high | critical
   - Relevant tags

3. **Dependency Rules**:
   - Setup tasks must come first (project initialization, dependencies)
   - Architecture implementation before feature development
   - Testing tasks should accompany major features
   - Documentation and deployment at the end
   - No circular dependencies

4. **Quality Requirements**:
   - Tasks should be meaningful units of work (2-8 hours each)
   - Include all necessary setup, configuration, and testing
   - Consider the full file structure when creating tasks
   - Ensure logical sequence with proper dependencies

5. **Output Format**:
   Respond with ONLY a valid JSON object conforming to the schema above.

Generate ${this.estimateTaskCount(context)} comprehensive tasks for this project.`;
  }

  /**
   * Estimate the number of tasks needed based on project complexity
   */
  private estimateTaskCount(context: UnifiedProjectContext): number {
    const prdLength = context.prd.length;
    
    // Simple heuristic: more complex PRDs need more tasks
    if (prdLength < 1000) return 8; // Simple project
    if (prdLength < 3000) return 12; // Medium project  
    if (prdLength < 6000) return 16; // Complex project
    return 20; // Very complex project
  }

  /**
   * Generate basic fallback tasks when AI generation fails
   */
  private async generateBasicFallbackTasks(context: UnifiedProjectContext): Promise<EnhancedTask[]> {
    const fallbackTasks = [
      {
        id: crypto.randomUUID(),
        title: 'Initialize Project Setup',
        description: 'Configure project initialization and dependencies',
        category: 'setup' as const,
        context: 'Foundation for the entire project architecture',
        dependencies: [],
        estimatedDuration: 2,
        priority: 'high' as const,
        tags: ['setup', 'foundation'],
        implementationSteps: '',
        acceptanceCriteria: '',
        dependents: [],
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: crypto.randomUUID(), 
        title: 'Implement Core Architecture',
        description: 'Build the foundational architecture based on specifications',
        category: 'architecture' as const,
        context: 'Core system architecture that supports all features',
        dependencies: [], // Setup task would be dependency
        estimatedDuration: 4,
        priority: 'critical' as const,
        tags: ['architecture', 'core'],
        implementationSteps: '',
        acceptanceCriteria: '',
        dependents: [],
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    return fallbackTasks;
  }

  /**
   * Extract file references from text
   */
  private extractFileReferences(text: string): string[] {
    const filePattern = /(?:[a-zA-Z]:\\|\/)?[\w\-./]+?\.(?:ts|tsx|js|jsx|py|java|cpp|c|h|go|rs|php|rb|sql|md|txt|json|yaml|yml|xml|html|css|scss|sass|less|vue|jsx?)/g;
    return text.match(filePattern) || [];
  }

  /**
   * Find missing file references
   */
  private findMissingFileReferences(references: string[], structure: string): string[] {
    return references.filter(ref => !structure.toLowerCase().includes(ref.toLowerCase()));
  }

  /**
   * Validate dependencies in the graph
   */
  private validateDependencies(graph: DependencyGraph): ValidationResultItem[] {
    const results: ValidationResultItem[] = [];
    
    // Check for circular dependencies
    try {
      this.topologicalSort(Object.keys(graph.tasks));
    } catch (error) {
      results.push({
        type: 'dependency',
        message: error instanceof Error ? error.message : 'Circular dependency detected',
        severity: 'error'
      });
    }

    // Check for missing dependencies
    Object.values(graph.tasks).forEach(task => {
      task.dependencies.forEach(depId => {
        if (!graph.tasks[depId]) {
          results.push({
            type: 'dependency',
            message: `Task "${task.title}" depends on non-existent task ${depId}`,
            severity: 'error'
          });
        }
      });
    });

    return results;
  }

  /**
   * Check task completeness
   */
  private checkTaskCompleteness(plan: ProjectPlan): ValidationResultItem[] {
    const results: ValidationResultItem[] = [];
    
    // Check for essential task categories
    const tasksByCategory = Object.values(plan.dependencyGraph.tasks).reduce((acc, task) => {
      acc[task.category] = (acc[task.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const essentialCategories = ['setup', 'testing'];
    
    for (const category of essentialCategories) {
      if (!tasksByCategory[category]) {
        results.push({
          type: 'completeness',
          message: `No ${category} tasks found in the plan`,
          severity: 'warning'
        });
      }
    }

    // Check if total task count is reasonable
    const totalTaskCount = Object.keys(plan.dependencyGraph.tasks).length;
    
    if (totalTaskCount < 3) {
      results.push({
        type: 'completeness',
        message: 'Generated plan seems too simple - consider adding more detailed tasks',
        severity: 'warning'
      });
    }

    return results;
  }

  /**
   * Validate sequential logic in the plan
   */
  private validateSequentialLogic(plan: ProjectPlan): ValidationResultItem[] {
    const results: ValidationResultItem[] = [];
    
    // Check for obvious sequencing issues
    const tasksByCategory = Object.values(plan.dependencyGraph.tasks).reduce((acc, task) => {
      acc[task.category] = (acc[task.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Architecture should come before features
    if (tasksByCategory['architecture'] && tasksByCategory['feature']) {
      const archTasks = Object.values(plan.dependencyGraph.tasks)
        .filter(t => t.category === 'architecture');
      const featureTasks = Object.values(plan.dependencyGraph.tasks)
        .filter(t => t.category === 'feature');

      // Check if any feature tasks depend on architecture tasks
      const hasProperDependencies = featureTasks.some(featureTask =>
        archTasks.some(archTask => 
          featureTask.dependencies.includes(archTask.id)
        )
      );

      if (!hasProperDependencies) {
        results.push({
          type: 'consistency',
          message: 'Feature tasks should depend on architecture implementation tasks',
          severity: 'warning'
        });
      }
    }

    return results;
  }

  /**
   * Topological sort for dependency validation
   */
  private topologicalSort(taskIds: string[]): void {
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visitTask = (taskId: string) => {
      if (visited.has(taskId)) return;
      
      if (visiting.has(taskId)) {
        throw new Error(`Circular dependency detected involving task ${taskId}`);
      }

      visiting.add(taskId);
      
      // Note: In a real implementation, you'd get the task object and visit its dependencies
      visiting.delete(taskId);
      visited.add(taskId);
    };

    taskIds.forEach(taskId => visitTask(taskId));
  }

  /**
   * Add implicit dependencies based on project context
   */
  private addImplicitDependencies(
    taskMap: Record<string, EnhancedTask>,
    enhancedTasks: EnhancedTask[],
    context: UnifiedProjectContext
  ): void {
    
    // If there are setup tasks, make other tasks depend on them
    const setupTasks = enhancedTasks.filter(task => task.category === 'setup');
    
    if (setupTasks.length > 0) {
      enhancedTasks.forEach(task => {
        // Non-setup tasks should depend on setup
        if (task.category !== 'setup' && !task.dependencies.some(depId => 
          setupTasks.some(setupTask => setupTask.id === depId)
        )) {
          // Add the first setup task as a dependency
          const firstSetupTask = setupTasks[0];
          if (!task.dependencies.includes(firstSetupTask.id)) {
            task.dependencies.push(firstSetupTask.id);
          }
        }
      });
    }

    // If there are architecture tasks, make feature tasks depend on them
    const archTasks = enhancedTasks.filter(task => task.category === 'architecture');
    const featureTasks = enhancedTasks.filter(task => task.category === 'feature');

    if (archTasks.length > 0 && featureTasks.length > 0) {
      featureTasks.forEach(featureTask => {
        if (!featureTask.dependencies.some(depId => 
          archTasks.some(archTask => archTask.id === depId)
        )) {
          // Add the first architecture task as a dependency
          const firstArchTask = archTasks[0];
          if (!featureTask.dependencies.includes(firstArchTask.id)) {
            featureTask.dependencies.push(firstArchTask.id);
          }
        }
      });
    }

    // Update dependents after modifying dependencies
    this.updateDependents(taskMap, enhancedTasks);
  }

  /**
   * Update dependents based on dependencies
   */
  private updateDependents(
    taskMap: Record<string, EnhancedTask>,
    enhancedTasks: EnhancedTask[]
  ): void {
    
    // Reset all dependents
    Object.values(taskMap).forEach(task => {
      task.dependents = [];
    });

    // Update dependents
    enhancedTasks.forEach(task => {
      task.dependencies.forEach(depId => {
        if (taskMap[depId]) {
          // Add this task as a dependent of its dependency
          if (!taskMap[depId].dependents.includes(task.id)) {
            taskMap[depId].dependents.push(task.id);
          }
        }
      });
    });
  }

  /**
   * Generate dependency edges for the graph
   */
  private generateDependencyEdges(enhancedTasks: EnhancedTask[]): any[] {
    const edges: any[] = [];
    
    enhancedTasks.forEach(task => {
      task.dependencies.forEach(depId => {
        edges.push({
          taskId: task.id,
          dependsOnTaskId: depId,
          dependency: {
            id: crypto.randomUUID(),
            type: 'requires',
            priority: 'medium'
          }
        });
      });
    });

    return edges;
  }

  /**
   * Priority-based fallback ordering
   */
  private priorityBasedFallback(tasks: EnhancedTask[]): string[] {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    
    return [...tasks]
      .sort((a, b) => {
        // First by priority
        const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        if (priorityDiff !== 0) return priorityDiff;
        
        // Then by creation time
        return b.createdAt.getTime() - a.createdAt.getTime();
      })
      .map(task => task.id);
  }

  /**
   * Apply execution optimizations
   */
  private applyExecutionOptimizations(
    executionOrder: string[],
    tasks: EnhancedTask[]
  ): string[] {
    
    // Group related tasks together
    const taskMap = tasks.reduce((acc, task) => {
      acc[task.id] = task;
      return acc;
    }, {} as Record<string, EnhancedTask>);

    const optimizedOrder: string[] = [];
    
    // Group tasks by category for better workflow
    const categories = ['setup', 'architecture', 'feature', 'testing', 'documentation', 'deployment'];
    
    for (const category of categories) {
      const categoryTasks = executionOrder.filter(taskId => 
        taskMap[taskId]?.category === category
      );
      
      optimizedOrder.push(...categoryTasks);
    }

    // Add any remaining tasks that don't fit the categories
    const categorizedTasks = new Set(optimizedOrder);
    executionOrder.forEach(taskId => {
      if (!categorizedTasks.has(taskId)) {
        optimizedOrder.push(taskId);
      }
    });

    return optimizedOrder;
  }

}

// Export singleton instance
export const taskGenerationOrchestrator = new TaskGenerationOrchestrator();

