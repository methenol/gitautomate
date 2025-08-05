

'use server';

import {
  ProjectPlan,
  UnifiedProjectContext,
  ValidationResult,
  ResearchTaskOutput
} from '@/types/unified-project';

/**
 * Project Plan Validator - Implements iterative refinement and cross-validation
 * 
 * This class provides comprehensive validation across all project components:
 * - Architecture-Task consistency checks
 * - File structure implementation alignment  
 * - Dependency validation and circular dependency detection
 * - Completeness and coverage analysis
 */
export class ProjectPlanValidator {
  
  /**
   * Validate complete workflow with cross-component checks
   */
  async validateCompleteWorkflow(plan: ProjectPlan): Promise<ValidationResult> {
    const results: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // Cross-validate architecture and task consistency
      const archTaskIssues = this.validateArchitectureTasksAlignment(plan);
      results.warnings.push(...archTaskIssues);

      // Validate file structure consistency with tasks
      const fileStructureIssues = this.validateFileStructureAlignment(plan);
      results.errors.push(...fileStructureIssues);

      // Check dependency graph integrity
      const dependencyIssues = this.validateDependencyGraphIntegrity(plan);
      results.errors.push(...dependencyIssues);

      // Validate task completeness and coverage
      const completenessIssues = this.validateTaskCompleteness(plan);
      results.warnings.push(...completenessIssues);

      // Validate sequential execution logic
      const sequenceIssues = this.validateExecutionSequence(plan);
      results.warnings.push(...sequenceIssues);

      // Check for missing prerequisites
      const prerequisiteIssues = this.validatePrerequisites(plan);
      results.errors.push(...prerequisiteIssues);

      // Overall project health assessment
      const healthAssessment = this.assessProjectHealth(plan);
      results.warnings.push(...healthAssessment);

    } catch (error) {
      console.error('Error during workflow validation:', error);
      
      results.isValid = false;
      results.errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return results;
  }

  /**
   * Validate that tasks align with architecture
   */
  private validateArchitectureTasksAlignment(plan: ProjectPlan): string[] {
    const issues: string[] = [];
    
    if (!plan.context.architecture) {
      return ['No architecture provided for validation'];
    }

    const tasks = Object.values(plan.dependencyGraph.tasks);
    
    // Check for architecture-specific implementation
    const hasArchitectureImplementation = tasks.some(task => 
      task.category === 'architecture' ||
      task.title.toLowerCase().includes('architectur') ||
      task.implementationSteps.toLowerCase().includes('architecture')
    );

    if (!hasArchitectureImplementation) {
      issues.push('No specific architecture implementation tasks found');
    }

    // Check if architectural concepts are reflected in task context
    const architectureKeywords = [
      'architecture', 'structure', 'design pattern', 'component',
      'module', 'layer', 'service', 'microservice'
    ];

    const architectureTasks = tasks.filter(task => 
      architectureKeywords.some(keyword =>
        task.context.toLowerCase().includes(keyword) ||
        (task.implementationSteps && 
         task.implementationSteps.toLowerCase().includes(keyword))
      )
    );

    if (architectureTasks.length === 0) {
      issues.push('No tasks reference architectural concepts from the architecture document');
    }

    // Check if high-level architectural decisions are addressed
    const hasSetupTasks = tasks.some(task => task.category === 'setup');
    if (hasSetupTasks && !architectureTasks.some(t => t.dependencies.length > 0)) {
      issues.push('Setup tasks may not properly integrate with architectural decisions');
    }

    return issues;
  }

  /**
   * Validate that tasks align with file structure
   */
  private validateFileStructureAlignment(plan: ProjectPlan): string[] {
    const issues: string[] = [];
    
    if (!plan.context.fileStructure) {
      return ['No file structure provided for validation'];
    }

    const tasks = Object.values(plan.dependencyGraph.tasks);
    
    // Extract file references from all task implementations
    const allFileReferences = new Set<string>();
    
    tasks.forEach(task => {
      if (task.implementationSteps) {
        const files = this.extractFileReferences(task.implementationSteps);
        files.forEach(file => allFileReferences.add(file));
      }
    });

    // Check if referenced files exist in the structure
    const missingFiles = this.findMissingFileReferences(
      Array.from(allFileReferences), 
      plan.context.fileStructure
    );

    if (missingFiles.length > 0) {
      issues.push(`${missingFiles.length} file references do not exist in the project structure`);
    }

    // Check for essential directory coverage
    const expectedDirectories = ['src', 'tests', 'docs'];
    const structureLower = plan.context.fileStructure.toLowerCase();
    
    for (const dir of expectedDirectories) {
      if (!structureLower.includes(dir)) {
        const tasksInDir = this.findTasksReferencingDirectory(tasks, dir);
        
        if (tasksInDir.length > 0) {
          issues.push(`Tasks reference ${dir}/ directory but it doesn't exist in file structure`);
        }
      }
    }

    // Check for proper file type usage
    const fileTypeIssues = this.validateFileTypes(tasks, plan.context.fileStructure);
    issues.push(...fileTypeIssues);

    return issues;
  }

  /**
   * Validate dependency graph integrity
   */
  private validateDependencyGraphIntegrity(plan: ProjectPlan): string[] {
    const issues: string[] = [];
    
    try {
      // Check for circular dependencies using topological sort
      this.topologicalSort(Object.keys(plan.dependencyGraph.tasks));
    } catch (error) {
      if (error instanceof Error && error.message.includes('Circular dependency')) {
        issues.push(error.message);
      } else {
        issues.push('Unknown circular dependency detected');
      }
    }

    // Check for missing dependencies
    Object.values(plan.dependencyGraph.tasks).forEach(task => {
      task.dependencies.forEach(depId => {
        if (!plan.dependencyGraph.tasks[depId]) {
          issues.push(`Task "${task.title}" depends on non-existent task ${depId}`);
        }
      });
    });

    // Check for orphan tasks (no dependencies and no dependents)
    const isolatedTasks = Object.values(plan.dependencyGraph.tasks).filter(task => 
      task.dependencies.length === 0 && 
      !this.hasDependents(task.id, plan.dependencyGraph)
    );

    if (isolatedTasks.length > 0 && isolatedTasks.length !== Object.keys(plan.dependencyGraph.tasks).length) {
      issues.push(`${isolatedTasks.length} tasks appear to be isolated from the main workflow`);
    }

    // Check for overly complex dependency chains
    const longChains = this.findLongDependencyChains(plan.dependencyGraph);
    
    if (longChains.length > 0) {
      issues.push(`Found ${longChains.length} dependency chains longer than recommended (5+ tasks)`);
    }

    return issues;
  }

  /**
   * Validate task completeness and coverage
   */
  private validateTaskCompleteness(plan: ProjectPlan): string[] {
    const issues: string[] = [];
    
    const tasksByCategory = Object.values(plan.dependencyGraph.tasks).reduce((acc, task) => {
      acc[task.category] = (acc[task.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Check for essential categories
    const missingCategories = ['setup', 'testing'].filter(
      category => !tasksByCategory[category]
    );

    if (missingCategories.length > 0) {
      issues.push(`Missing essential task categories: ${missingCategories.join(', ')}`);
    }

    // Check for reasonable task count
    const totalTaskCount = Object.keys(plan.dependencyGraph.tasks).length;
    
    if (totalTaskCount < 3) {
      issues.push('Plan seems too simple - consider adding more detailed implementation steps');
    }

    if (totalTaskCount > 25) {
      issues.push('Plan may be overly complex - consider breaking down large tasks');
    }

    // Check for task detail completeness
    const incompleteTasks = Object.values(plan.dependencyGraph.tasks).filter(task => 
      !task.implementationSteps || task.implementationSteps.trim().length < 50
    );

    if (incompleteTasks.length > totalTaskCount * 0.3) {
      issues.push(`${Math.round((incompleteTasks.length / totalTaskCount) * 100)}% of tasks lack detailed implementation steps`);
    }

    // Check for acceptance criteria
    const missingAcceptanceCriteria = Object.values(plan.dependencyGraph.tasks).filter(task => 
      !task.acceptanceCriteria || task.acceptanceCriteria.trim().length < 20
    );

    if (missingAcceptanceCriteria.length > totalTaskCount * 0.5) {
      issues.push(`${Math.round((missingAcceptanceCriteria.length / totalTaskCount) * 100)}% of tasks lack proper acceptance criteria`);
    }

    return issues;
  }

  /**
   * Validate execution sequence logic
   */
  private validateExecutionSequence(plan: ProjectPlan): string[] {
    const issues: string[] = [];
    
    // Check if setup tasks come first
    const setupTasks = Object.values(plan.dependencyGraph.tasks)
      .filter(task => task.category === 'setup');
    
    if (setupTasks.length > 0) {
      const nonSetupBeforeSetup = plan.executionOrder
        .slice(0, setupTasks.length)
        .filter(taskId => {
          const task = plan.dependencyGraph.tasks[taskId];
          return task && task.category !== 'setup';
        });

      if (nonSetupBeforeSetup.length > 0) {
        issues.push('Non-setup tasks should not come before setup tasks in execution order');
      }
    }

    // Check if architecture implementation comes before features
    const archTasks = Object.values(plan.dependencyGraph.tasks)
      .filter(task => task.category === 'architecture');
    const featureTasks = Object.values(plan.dependencyGraph.tasks)
      .filter(task => task.category === 'feature');

    if (archTasks.length > 0 && featureTasks.length > 0) {
      const firstFeatureIndex = plan.executionOrder.findIndex(taskId => 
        featureTasks.some(ft => ft.id === taskId)
      );
      
      const lastArchIndex = plan.executionOrder.reduce((lastIndex, taskId) => {
        return archTasks.some(at => at.id === taskId) ? 
          plan.executionOrder.indexOf(taskId) : lastIndex;
      }, -1);

      if (lastArchIndex !== -1 && firstFeatureIndex !== -1 && lastArchIndex > firstFeatureIndex) {
        issues.push('Architecture implementation should come before feature development');
      }
    }

    return issues;
  }

  /**
   * Validate prerequisites and dependencies
   */
  private validatePrerequisites(plan: ProjectPlan): string[] {
    const issues: string[] = [];
    
    // Check for authentication tasks before protected features
    const authTasks = Object.values(plan.dependencyGraph.tasks).filter(task => 
      task.title.toLowerCase().includes('auth') ||
      task.title.toLowerCase().includes('login') ||
      task.title.toLowerCase().includes('user')
    );

    const protectedFeatureTasks = Object.values(plan.dependencyGraph.tasks).filter(task => 
      task.title.toLowerCase().includes('dashboard') ||
      task.title.toLowerCase().includes('profile') ||
      task.title.toLowerCase().includes('settings')
    );

    if (authTasks.length > 0 && protectedFeatureTasks.length > 0) {
      const missingAuthDependencies = protectedFeatureTasks.filter(featureTask =>
        !authTasks.some(authTask => 
          featureTask.dependencies.includes(authTask.id)
        )
      );

      if (missingAuthDependencies.length > 0) {
        issues.push(`${missingAuthDependencies.length} protected features lack authentication dependencies`);
      }
    }

    // Check for database setup before data operations
    const dbSetupTasks = Object.values(plan.dependencyGraph.tasks).filter(task => 
      task.title.toLowerCase().includes('database') ||
      task.title.toLowerCase().includes('schema')
    );

    const dataTasks = Object.values(plan.dependencyGraph.tasks).filter(task => 
      task.title.toLowerCase().includes('data') ||
      task.title.toLowerCase().includes('crud')
    );

    if (dbSetupTasks.length > 0 && dataTasks.length > 0) {
      const missingDbDependencies = dataTasks.filter(dataTask =>
        !dbSetupTasks.some(dbTask => 
          dataTask.dependencies.includes(dbTask.id)
        )
      );

      if (missingDbDependencies.length > 0) {
        issues.push(`${missingDbDependencies.length} data operations lack database setup dependencies`);
      }
    }

    return issues;
  }

  /**
   * Assess overall project health
   */
  private assessProjectHealth(plan: ProjectPlan): string[] {
    const issues: string[] = [];
    
    const tasks = Object.values(plan.dependencyGraph.tasks);
    
    // Check priority distribution
    const criticalTasks = tasks.filter(t => t.priority === 'critical');
    if (criticalTasks.length > tasks.length * 0.3) {
      issues.push('Too many critical tasks - consider prioritizing work');
    }

    if (criticalTasks.length === 0) {
      issues.push('No critical tasks identified - consider adding high-priority items');
    }

    // Check estimated time distribution
    const totalEstimatedTime = tasks.reduce((sum, task) => 
      sum + (task.estimatedDuration || 0), 0
    );
    
    if (totalEstimatedTime > 120) { // More than 5 days of work
      issues.push(`Plan spans ${Math.ceil(totalEstimatedTime / 8)}+ days - consider breaking down large tasks`);
    }

    if (totalEstimatedTime < 8) { // Less than 1 day
      issues.push('Plan seems too short - consider adding more comprehensive implementation steps');
    }

    // Check for balanced workload distribution
    const tasksByCategory = Object.values(plan.dependencyGraph.tasks).reduce((acc, task) => {
      acc[task.category] = (acc[task.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const maxCategoryTasks = Math.max(...Object.values(tasksByCategory));
    if (maxCategoryTasks > tasks.length * 0.5) {
      const maxCategory = Object.keys(tasksByCategory).find(
        category => tasksByCategory[category] === maxCategoryTasks
      );
      
      if (maxCategory) {
        issues.push(`Unbalanced distribution: ${Math.round((maxCategoryTasks / tasks.length) * 100)}% of tasks are in ${maxCategory} category`);
      }
    }

    return issues;
  }

  /**
   * Topological sort for circular dependency detection
   */
  private topologicalSort(taskIds: string[]): void {
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visitTask = (taskId: string, taskMap: Record<string, any>) => {
      if (visited.has(taskId)) return;
      
      if (visiting.has(taskId)) {
        throw new Error(`Circular dependency detected involving task ${taskId}`);
      }

      visiting.add(taskId);
      
      const task = taskMap[taskId];
      if (task) {
        task.dependencies.forEach((depId: string) => visitTask(depId, taskMap));
      }

      visiting.delete(taskId);
      visited.add(taskId);
    };

    const taskMap = plan.dependencyGraph.tasks;
    
    for (const taskId of Object.keys(taskMap)) {
      if (!visited.has(taskId)) {
        visitTask(taskId, taskMap);
      }
    }
  }

  /**
   * Check if a task has dependents
   */
  private hasDependents(taskId: string, dependencyGraph: any): boolean {
    return Object.values(dependencyGraph.tasks).some((task: any) => 
      task.dependencies.includes(taskId)
    );
  }

  /**
   * Find long dependency chains
   */
  private findLongDependencyChains(dependencyGraph: any): string[][] {
    const chains: string[][] = [];
    
    Object.keys(dependencyGraph.tasks).forEach(taskId => {
      const chain = this.getDependencyChain(taskId, dependencyGraph);
      
      if (chain.length > 5) {
        chains.push(chain.slice(0, chain.length)); // Just the count matters
      }
    });

    return chains;
  }

  /**
   * Get dependency chain for a task
   */
  private getDependencyChain(taskId: string, dependencyGraph: any): string[] {
    const task = dependencyGraph.tasks[taskId];
    if (!task || task.dependencies.length === 0) return [taskId];

    const chain = [taskId];
    
    // Find the longest dependency path
    let maxChainLength = 0;
    let longestsDependency: string[] = [];

    task.dependencies.forEach(depId => {
      const depChain = this.getDependencyChain(depId, dependencyGraph);
      
      if (depChain.length > maxChainLength) {
        maxChainLength = depChain.length;
        longestsDependency = depChain;
      }
    });

    return [...chain, ...longestsDependency];
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
   * Find tasks referencing a specific directory
   */
  private findTasksReferencingDirectory(tasks: any[], dirName: string): any[] {
    return tasks.filter(task => 
      (task.implementationSteps && task.implementationSteps.toLowerCase().includes(`${dirName}/`)) ||
      (task.title.toLowerCase().includes(dirName))
    );
  }

  /**
   * Validate file types used in tasks
   */
  private validateFileTypes(tasks: any[], structure: string): string[] {
    const issues: string[] = [];
    
    // Check for TypeScript/JavaScript usage consistency
    const tsFiles = this.extractFileReferences(structure).filter(file => 
      file.endsWith('.ts') || file.endsWith('.tsx')
    );
    
    const jsTasks = tasks.filter(task => 
      task.implementationSteps && (
        task.implementationSteps.includes('.js') ||
        task.implementationSteps.includes('.jsx')
      )
    );

    if (tsFiles.length > 0 && jsTasks.length > 0) {
      issues.push('Mixing TypeScript and JavaScript files - recommend consistent typing');
    }

    return issues;
  }
}

// Export singleton instance
export const projectPlanValidator = new ProjectPlanValidator();


