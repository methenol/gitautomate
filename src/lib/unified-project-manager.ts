import { 
  UnifiedProjectContext, 
  ValidationResult, 
  GenerationOptions, 
  ProjectManager, 
  EnhancedTask,
  TaskDependency 
} from '@/types/unified-context';
import { TaskDependencyGraph } from '@/lib/dependency-graph';
import { generateArchitecture } from '@/ai/flows/generate-architecture';
import { generateFileStructure } from '@/ai/flows/generate-file-structure';
import { generateTasks } from '@/ai/flows/generate-tasks';
import { researchTask } from '@/ai/flows/research-task';

export class UnifiedProjectManager implements ProjectManager {
  
  initializeContext(prd: string): UnifiedProjectContext {
    return {
      prd,
      architecture: '',
      specifications: '',
      fileStructure: '',
      tasks: [],
      dependencyGraph: new TaskDependencyGraph<EnhancedTask>(),
      validationHistory: [],
      componentVersions: {
        architecture: 1,
        specifications: 1,
        fileStructure: 1,
        tasks: 1,
      },
      researchContext: {
        completedTasks: [],
        activeResearch: [],
        researchInsights: [],
      },
    };
  }

  updateContext(context: UnifiedProjectContext, updates: Partial<UnifiedProjectContext>): UnifiedProjectContext {
    const newContext = { ...context, ...updates };
    
    // Update component versions when key components change
    if (updates.architecture && updates.architecture !== context.architecture) {
      newContext.componentVersions.architecture += 1;
    }
    if (updates.specifications && updates.specifications !== context.specifications) {
      newContext.componentVersions.specifications += 1;
    }
    if (updates.fileStructure && updates.fileStructure !== context.fileStructure) {
      newContext.componentVersions.fileStructure += 1;
    }
    if (updates.tasks && updates.tasks !== context.tasks) {
      newContext.componentVersions.tasks += 1;
    }
    
    return newContext;
  }

  validateContext(context: UnifiedProjectContext): ValidationResult {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Basic validation
    if (!context.prd.trim()) {
      issues.push('PRD is empty or missing');
    }

    if (!context.architecture.trim()) {
      issues.push('Architecture is missing');
    }

    if (!context.specifications.trim()) {
      issues.push('Specifications are missing');
    }

    if (!context.fileStructure.trim()) {
      issues.push('File structure is missing');
    }

    // Task validation
    if (context.tasks.length === 0) {
      suggestions.push('No tasks have been generated yet');
    } else {
      // Check for circular dependencies
      if (context.dependencyGraph && (context.dependencyGraph as TaskDependencyGraph<EnhancedTask>).hasCycle()) {
        issues.push('Task dependency graph contains circular dependencies');
      }

      // Check for orphaned tasks
      const tasksWithoutDeps = context.tasks.filter(task => 
        task.dependencies.dependsOn.length === 0 && 
        task.dependencies.category !== 'setup'
      );
      if (tasksWithoutDeps.length > context.tasks.length * 0.7) {
        suggestions.push('Many tasks have no dependencies - consider adding more dependency relationships');
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
    };
  }

  async generateProjectPlan(context: UnifiedProjectContext, options: GenerationOptions = {}): Promise<UnifiedProjectContext> {
    // Generate architecture and specifications
    let updatedContext = await this.generateArchitectureWithDependencies(context, options);
    
    // Generate tasks with dependencies
    updatedContext = await this.generateTasksWithDependencies(updatedContext, options);
    
    // Research tasks with cross-task context
    updatedContext = await this.researchTasksWithContext(updatedContext, options);
    
    // Validate and optimize
    const validation = this.validateContext(updatedContext);
    updatedContext.validationHistory.push(validation);
    updatedContext.lastValidated = new Date();
    
    if (validation.isValid) {
      updatedContext = this.optimizeDependencyOrdering(updatedContext);
    }
    
    return updatedContext;
  }

  async generateArchitectureWithDependencies(context: UnifiedProjectContext, options: GenerationOptions = {}): Promise<UnifiedProjectContext> {
    const result = await generateArchitecture(
      { prd: context.prd },
      options.apiKey,
      options.model
    );

    const fileStructResult = await generateFileStructure(
      { prd: context.prd, architecture: result.architecture, specifications: result.specifications },
      options.apiKey,
      options.model
    );

    return this.updateContext(context, {
      architecture: result.architecture,
      specifications: result.specifications,
      fileStructure: fileStructResult.fileStructure,
    });
  }

  async generateTasksWithDependencies(context: UnifiedProjectContext, options: GenerationOptions = {}): Promise<UnifiedProjectContext> {
    const result = await generateTasks(
      { architecture: context.architecture, specifications: context.specifications, fileStructure: context.fileStructure },
      options.apiKey,
      options.model,
      options.useTDD
    );

    // Enhance tasks with dependency analysis
    const enhancedTasks = await this.analyzeDependencies(result.tasks, context, options);
    
    // Build dependency graph
    const graph = new TaskDependencyGraph<EnhancedTask>();
    enhancedTasks.forEach(task => {
      graph.addNode(task.title, task);
      task.dependencies.dependsOn.forEach(dep => {
        graph.addDependency(task.title, dep);
      });
    });

    return this.updateContext(context, {
      tasks: enhancedTasks,
      dependencyGraph: graph,
    });
  }

  async researchTasksWithContext(context: UnifiedProjectContext, options: GenerationOptions = {}): Promise<UnifiedProjectContext> {
    const updatedTasks = [...context.tasks];
    const insights: { taskTitle: string; insights: string[]; crossTaskImplications: string[] }[] = [];
    
    // Research tasks in dependency order
    const graph = context.dependencyGraph as TaskDependencyGraph<EnhancedTask>;
    const executionOrder = graph ? graph.getTopologicalOrder() : context.tasks.map(t => t.title);
    
    for (const taskTitle of executionOrder) {
      const taskIndex = updatedTasks.findIndex(t => t.title === taskTitle);
      if (taskIndex === -1) continue;
      
      const task = updatedTasks[taskIndex];
      
      // Add context from previous research
      const previousInsights = insights.map(i => i.insights.join('\n')).join('\n\n');
      const contextualSpecs = context.specifications + 
        (previousInsights ? '\n\n## Previous Task Research Insights:\n' + previousInsights : '');
      
      // Build context-aware research input
      const researchInput = {
        title: task.title,
        architecture: context.architecture,
        fileStructure: context.fileStructure,
        specifications: contextualSpecs,
      };
      
      const result = await researchTask(
        researchInput,
        options.apiKey,
        options.model,
        options.useTDD
      );
      
      // Enhanced task details with cross-task implications
      const formattedDetails = `### Context\n${result.context}\n\n### Implementation Steps\n${result.implementationSteps}\n\n### Acceptance Criteria\n${result.acceptanceCriteria}`;
      
      updatedTasks[taskIndex] = {
        ...task,
        details: formattedDetails,
        researched: true,
        researchContext: {
          relatedTasks: task.dependencies.dependsOn,
          conflictingRequirements: [],
          prerequisiteChecks: task.dependencies.dependsOn,
        },
      };
      
      // Collect insights for next tasks
      insights.push({
        taskTitle: task.title,
        insights: [result.context, result.implementationSteps].filter(Boolean),
        crossTaskImplications: [],
      });
      
      context.researchContext.completedTasks.push(task.title);
    }

    return this.updateContext(context, {
      tasks: updatedTasks,
      researchContext: {
        ...context.researchContext,
        researchInsights: insights,
      },
    });
  }

  validateTaskConsistency(context: UnifiedProjectContext): ValidationResult {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check for task-file structure consistency
    const fileStructureText = context.fileStructure.toLowerCase();
    context.tasks.forEach(task => {
      const taskDetails = task.details.toLowerCase();
      // Simple heuristic: if task mentions specific files, check if they exist in file structure
      const fileReferences = taskDetails.match(/[\w-]+\.(js|ts|tsx|jsx|py|html|css|json|md)/g) || [];
      fileReferences.forEach(file => {
        if (!fileStructureText.includes(file)) {
          issues.push(`Task "${task.title}" references file "${file}" not found in file structure`);
        }
      });
    });

    // Check dependency validity
    context.tasks.forEach(task => {
      task.dependencies.dependsOn.forEach(dep => {
        const dependencyExists = context.tasks.some(t => t.title === dep);
        if (!dependencyExists) {
          issues.push(`Task "${task.title}" depends on non-existent task "${dep}"`);
        }
      });
    });

    // Check for logical task ordering issues
    const authTasks = context.tasks.filter(t => 
      t.title.toLowerCase().includes('auth') || 
      t.title.toLowerCase().includes('login')
    );
    const userFeatureTasks = context.tasks.filter(t => 
      t.title.toLowerCase().includes('user') && 
      !t.title.toLowerCase().includes('auth')
    );
    
    if (authTasks.length > 0 && userFeatureTasks.length > 0) {
      userFeatureTasks.forEach(userTask => {
        const hasAuthDependency = userTask.dependencies.dependsOn.some(dep => 
          authTasks.some(authTask => authTask.title === dep)
        );
        if (!hasAuthDependency) {
          suggestions.push(`Task "${userTask.title}" may need authentication dependency`);
        }
      });
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
    };
  }

  optimizeDependencyOrdering(context: UnifiedProjectContext): UnifiedProjectContext {
    const graph = context.dependencyGraph as TaskDependencyGraph<EnhancedTask>;
    if (!graph) return context;

    try {
      const optimizedOrder = graph.getTopologicalOrder();
      const reorderedTasks = optimizedOrder
        .map(title => context.tasks.find(t => t.title === title))
        .filter(Boolean) as EnhancedTask[];

      return this.updateContext(context, { tasks: reorderedTasks });
    } catch {
      // If topological sort fails due to cycles, return as-is
      console.warn('Could not optimize task ordering due to dependency cycles');
      return context;
    }
  }

  async refineContextBasedOnValidation(context: UnifiedProjectContext, validation: ValidationResult): Promise<UnifiedProjectContext> {
    // For now, this is a placeholder for future AI-powered refinement
    // In a full implementation, this would use AI to fix validation issues
    console.log('Validation issues to address:', validation.issues);
    console.log('Validation suggestions:', validation.suggestions);
    return context;
  }

  private async analyzeDependencies(tasks: { title: string; details?: string }[], _context: UnifiedProjectContext, _options: GenerationOptions): Promise<EnhancedTask[]> {
    // Enhanced dependency analysis using simple heuristics
    const enhancedTasks: EnhancedTask[] = tasks.map(task => {
      const dependencies: TaskDependency = {
        taskTitle: task.title,
        dependsOn: [],
        blockedBy: [],
        priority: 3,
        category: this.categorizeTask(task.title),
      };

      // Simple dependency inference based on task titles and common patterns
      const title = task.title.toLowerCase();
      
      // Setup tasks typically come first
      if (title.includes('setup') || title.includes('init') || title.includes('install')) {
        dependencies.category = 'setup';
        dependencies.priority = 5;
      }
      
      // Testing tasks usually depend on implementation
      if (title.includes('test')) {
        dependencies.category = 'testing';
        dependencies.priority = 2;
        // Find related implementation tasks
        const implementationTasks = tasks.filter(t => 
          !t.title.toLowerCase().includes('test') && 
          this.areTasksRelated(t.title, task.title)
        );
        dependencies.dependsOn = implementationTasks.map(t => t.title);
      }
      
      // UI tasks often depend on API/backend tasks
      if (title.includes('ui') || title.includes('component') || title.includes('page')) {
        const apiTasks = tasks.filter(t => 
          t.title.toLowerCase().includes('api') || 
          t.title.toLowerCase().includes('backend') ||
          t.title.toLowerCase().includes('service')
        );
        dependencies.dependsOn = apiTasks.map(t => t.title);
      }
      
      // Authentication dependencies
      if (title.includes('user') && !title.includes('auth')) {
        const authTasks = tasks.filter(t => 
          t.title.toLowerCase().includes('auth') ||
          t.title.toLowerCase().includes('login')
        );
        dependencies.dependsOn.push(...authTasks.map(t => t.title));
      }

      return {
        title: task.title,
        details: task.details || '',
        dependencies,
        researched: false,
      };
    });

    return enhancedTasks;
  }

  private categorizeTask(title: string): 'setup' | 'core' | 'feature' | 'testing' | 'deployment' {
    const lowerTitle = title.toLowerCase();
    
    if (lowerTitle.includes('setup') || lowerTitle.includes('init') || lowerTitle.includes('install')) {
      return 'setup';
    }
    if (lowerTitle.includes('test')) {
      return 'testing';
    }
    if (lowerTitle.includes('deploy') || lowerTitle.includes('build') || lowerTitle.includes('ci')) {
      return 'deployment';
    }
    if (lowerTitle.includes('core') || lowerTitle.includes('base') || lowerTitle.includes('foundation')) {
      return 'core';
    }
    
    return 'feature';
  }

  private areTasksRelated(title1: string, title2: string): boolean {
    const words1 = title1.toLowerCase().split(/\s+/);
    const words2 = title2.toLowerCase().split(/\s+/);
    
    // Simple word overlap heuristic
    const overlap = words1.filter(word => 
      words2.includes(word) && 
      word.length > 3 && 
      !['test', 'implement', 'create', 'add', 'build'].includes(word)
    );
    
    return overlap.length > 0;
  }
}