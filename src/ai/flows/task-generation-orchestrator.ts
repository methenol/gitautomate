

'use server';

/**
 * @fileOverview The main orchestrator for the unified GitAutomate system.
 * This component coordinates all project generation activities, manages dependencies,
 * and ensures consistency across the entire workflow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  UnifiedProjectContext,
  ProjectPlan,
  TaskGenerationOrchestrator,
  ValidationResult,
  ResearchedTask,
} from './unified-project-context';
import { generateArchitecture, GenerateArchitectureInput } from './generate-architecture';
import { generateFileStructure, GenerateFileStructureInput } from './generate-file-structure';
import { TaskSchema } from '@/types';

const ProjectPlanInputSchema = z.object({
  prd: z.string().describe('The Product Requirements Document (PRD) for the project.'),
  apiKey: z.string().optional(),
  model: z.string().default('gemini-1.5-flash-latest'),
  useTDD: z.boolean().default(false),
});

export type ProjectPlanInput = z.infer<typeof ProjectPlanInputSchema>;

/**
 * Internal orchestrator class that coordinates all project generation activities.
 */
class UnifiedTaskGenerationOrchestrator implements TaskGenerationOrchestrator {
  private apiKey?: string;
  private model: string;
  private useTDD: boolean;

  constructor(apiKey?: string, model = 'gemini-1.5-flash-latest', useTDD = false) {
    this.apiKey = apiKey;
    this.model = model;
    this.useTDD = useTDD;
  }

  /**
   * Generate a complete project plan with unified context and dependency management.
   */
  async generateProjectPlan(context: UnifiedProjectContext): Promise<ProjectPlan> {
    const startTime = Date.now();
    
    try {
      // Step 1: Generate architecture if not provided
      const finalContext = await this.ensureArchitectureGenerated(context);
      
      // Step 2: Generate file structure if not provided
      const contextWithFileStructure = await this.ensureFileStructureGenerated(finalContext);
      
      // Step 3: Generate tasks with dependency awareness
      const { tasks, dependencyGraph } = await this.generateTasksWithDependencies(contextWithFileStructure);
      
      // Step 4: Research all tasks with full context
      const researchResults = await this.researchAllTasksWithDependencies(tasks, dependencyGraph);
      
      // Step 5: Validate the complete project plan
      const validationResults = await this.validateCompleteWorkflow({
        context: contextWithFileStructure,
        tasks,
        researchResults,
        validationResults: []
      });
      
      const endTime = Date.now();
      
      return {
        context: contextWithFileStructure,
        tasks,
        researchResults,
        validationResults
      };
    } catch (error) {
      console.error('Project plan generation failed:', error);
      throw new Error(`Failed to generate project plan: ${(error as Error).message}`);
    }
  }

  /**
   * Ensure architecture is generated for the context.
   */
  private async ensureArchitectureGenerated(context: UnifiedProjectContext): Promise<UnifiedProjectContext> {
    if (context.architecture) {
      return context;
    }

    const architectureInput: GenerateArchitectureInput = { prd: context.prd };
    
    try {
      const architectureResult = await generateArchitecture(
        architectureInput,
        this.apiKey,
        this.model
      );

      return {
        ...context,
        architecture: {
          architecture: architectureResult.architecture,
          specifications: architectureResult.specifications
        },
        validationHistory: [
          ...context.validationHistory,
          {
            id: `arch-gen-${Date.now()}`,
            type: 'completeness',
            passed: true,
            message: 'Architecture generated successfully',
            severity: 'info'
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to generate architecture: ${(error as Error).message}`);
    }
  }

  /**
   * Ensure file structure is generated for the context.
   */
  private async ensureFileStructureGenerated(context: UnifiedProjectContext): Promise<UnifiedProjectContext> {
    if (context.fileStructure) {
      return context;
    }

    const fileStructureInput = {
      prd: context.prd,
      architecture: context.architecture!.architecture,
      specifications: context.architecture!.specifications
    };

    try {
      const fileStructureResult = await generateFileStructure(
        fileStructureInput,
        this.apiKey,
        this.model
      );

      return {
        ...context,
        fileStructure: { fileStructure: fileStructureResult.fileStructure },
        validationHistory: [
          ...context.validationHistory,
          {
            id: `file-gen-${Date.now()}`,
            type: 'completeness',
            passed: true,
            message: 'File structure generated successfully',
            severity: 'info'
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to generate file structure: ${(error as Error).message}`);
    }
  }

  /**
   * Generate tasks with dependency modeling and validation.
   */
  private async generateTasksWithDependencies(context: UnifiedProjectContext): Promise<{ tasks: any[]; dependencyGraph: any }> {
    const taskGenerationPrompt = this.buildTaskGenerationPrompt(context);
    
    try {
      const { output } = await ai.generate({
        model: `googleai/${this.model}`,
        prompt: taskGenerationPrompt,
        output: {
          schema: z.object({
            tasks: z.array(TaskSchema).describe('A list of actionable task titles with dependencies.'),
          }),
        },
        config: this.apiKey ? { apiKey: this.apiKey } : undefined,
      });

      if (!output?.tasks) {
        throw new Error('No tasks were generated');
      }

      // Build dependency graph from task generation
      const { tasks, dependencyGraph } = this.buildDependencyGraph(output.tasks);

      return {
        tasks,
        dependencyGraph
      };
    } catch (error) {
      throw new Error(`Failed to generate tasks: ${(error as Error).message}`);
    }
  }

  /**
   * Build task generation prompt with dependency awareness.
   */
  private buildTaskGenerationPrompt(context: UnifiedProjectContext): string {
    const tddInstruction = this.useTDD ? 
      '\n\nFor each task, the implementation must strictly follow all phases of Test-Driven Development (Red-Green-Refactor).' : '';

    return `You are a lead software engineer creating a detailed project plan for an AI programmer. Your task is to break down a project's architecture, file structure, and specifications into a series of actionable, granular development task *titles*.

The tasks must be generated in a strict, sequential order that follows dependency relationships. Each task should identify its prerequisites and dependencies.

${tddInstruction}

Architecture:
${context.architecture?.architecture || 'Not available'}

File Structure:
${context.fileStructure?.fileStructure || 'Not available'}

Specifications:
${context.specifications || context.architecture?.specifications || 'Not available'}

Generate the complete, exhaustive, and correctly dependency-ordered list of task titles. For each task, identify:
1. The main title
2. Prerequisites (what must be completed before this task)
3. Dependencies (which other tasks this task depends on)

Respond with ONLY a valid JSON object that conforms to the output schema.`;
  }

  /**
   * Build dependency graph from generated tasks.
   */
  private buildDependencyGraph(tasks: any[]): { tasks: any[]; dependencyGraph: any } {
    const taskMap = new Map<string, any>();
    
    // Create unique IDs for tasks and build initial map
    const enhancedTasks = tasks.map((task, index) => {
      const taskId = `task-${index + 1}`;
      const enhancedTask = {
        ...task,
        id: taskId,
        prerequisites: [], // To be determined by analysis
        dependencies: [], // To be determined by analysis
        status: 'pending' as const,
      };
      taskMap.set(taskId, enhancedTask);
      return enhancedTask;
    });

    // Simple dependency analysis based on task ordering and content
    const tasksWithDependencies = enhancedTasks.map((task, index) => {
      if (index === 0) return task; // First task has no dependencies
      
      const previousTasks = enhancedTasks.slice(0, index);
      
      // Analyze task content to determine dependencies
      const dependencyKeywords = [
        'authentication', 'auth', 'login', 'user setup',
        'database', 'db', 'storage',
        'api', 'endpoint', 'server',
        'frontend', 'ui', 'client',
        'configuration', 'config', 'setup'
      ];

      const dependencies = previousTasks.filter(prevTask => {
        const taskTitleLower = task.title.toLowerCase();
        const prevTitleLower = prevTask.title.toLowerCase();
        
        // Check if this task depends on previous tasks based on keywords
        return dependencyKeywords.some(keyword => 
          (taskTitleLower.includes(keyword) && prevTitleLower.includes('setup')) ||
          (prevTitleLower.includes(keyword) && taskTitleLower.includes('config'))
        );
      });

      return {
        ...task,
        dependencies: dependencies.map(dep => dep.id),
        prerequisites: [...new Set(dependencies.flatMap(dep => [dep.id, ...dep.dependencies]))]
      };
    });

    return {
      tasks: tasksWithDependencies,
      dependencyGraph: {
        nodes: Object.fromEntries(taskMap),
        edges: tasksWithDependencies.reduce((acc, task) => {
          acc[task.id] = task.dependencies;
          return acc;
        }, {} as Record<string, string[]>)
      }
    };
  }

  /**
   * Research all tasks with full dependency context.
   */
  private async researchAllTasksWithDependencies(
    tasks: any[], 
    dependencyGraph: any
  ): Promise<Map<string, ResearchedTask>> {
    const researchResults = new Map<string, ResearchedTask>();
    
    // Process tasks in dependency order
    const orderedTasks = this.topologicalSort(tasks, dependencyGraph.edges);
    
    for (const task of orderedTasks) {
      const completedTaskIds = Array.from(researchResults.keys());
      
      try {
        const researchedTask = await this.researchSingleTaskWithDependencies(
          task,
          completedTaskIds
        );
        
        researchResults.set(task.id, researchedTask);
      } catch (error) {
        console.error(`Failed to research task ${task.id}:`, error);
        
        // Add placeholder for failed tasks
        researchResults.set(task.id, {
          taskId: task.id,
          context: `Failed to research task: ${(error as Error).message}`,
          implementationSteps: '',
          acceptanceCriteria: '',
          researchContext: {
            completedTasks: new Set(completedTaskIds),
            availableResources: []
          }
        });
      }
    }

    return researchResults;
  }

  /**
   * Research a single task with full dependency context.
   */
  private async researchSingleTaskWithDependencies(
    task: any,
    completedTaskIds: string[],
    context?: UnifiedProjectContext
  ): Promise<ResearchedTask> {
    const researchPrompt = this.buildResearchPrompt(task, completedTaskIds, context);
    
    try {
      const { output } = await ai.generate({
        model: `googleai/${this.model}`,
        prompt: researchPrompt,
        output: {
          schema: z.object({
            context: z.string().describe('Briefly explain how this task fits into the overall architecture.'),
            implementationSteps: z.string().describe('Detailed step-by-step implementation guide.'),
            acceptanceCriteria: z.string().describe('Define what it means for this task to be considered "done".'),
          }),
        },
        config: this.apiKey ? { apiKey: this.apiKey } : undefined,
      });

      return {
        taskId: task.id,
        context: output?.context || '',
        implementationSteps: output?.implementationSteps || '',
        acceptanceCriteria: output?.acceptanceCriteria || '',
        researchContext: {
          completedTasks: new Set(completedTaskIds),
          availableResources: []
        }
      };
    } catch (error) {
      throw new Error(`Failed to research task: ${(error as Error).message}`);
    }
  }

  /**
   * Build research prompt with dependency context.
   */
  private buildResearchPrompt(task: any, completedTaskIds: string[], context?: UnifiedProjectContext): string {
    const tddInstruction = this.useTDD ? 
      '\n\nThe implementation plan must strictly follow all phases of Test-Driven Development (Red-Green-Refactor).' : '';

    return `You are an expert project manager and senior software engineer. Your task is to perform detailed research for a specific development task and provide a comprehensive implementation plan.

Completed tasks that you can reference: ${completedTaskIds.join(', ')}

${tddInstruction}

Overall Project Architecture:
${context?.architecture?.architecture || 'Not available'}

File Structure:
${context?.fileStructure?.fileStructure || 'Not available'}

Overall Project Specifications:
${context?.specifications || context?.architecture?.specifications || 'Not available'}

Now, provide the detailed implementation plan as a JSON object for the following task:

**Task Title: ${task.title}**
**Dependencies: ${task.dependencies.join(', ') || 'None'}**

You MUST return your response as a valid JSON object that conforms to the output schema.`;
  }

  /**
   * Topological sort for dependency ordering.
   */
  private topologicalSort(tasks: any[], edges: Record<string, string[]>): any[] {
    const visited = new Set<string>();
    const tempVisited = new Set<string>();
    const result: any[] = [];

    function visit(taskId: string) {
      if (tempVisited.has(taskId)) {
        throw new Error(`Circular dependency detected involving task ${taskId}`);
      }
      
      if (!visited.has(taskId)) {
        tempVisited.add(taskId);
        
        const dependencies = edges[taskId] || [];
        for (const dep of dependencies) {
          visit(dep);
        }
        
        tempVisited.delete(taskId);
        visited.add(taskId);
        
        const task = tasks.find(t => t.id === taskId);
        if (task) result.push(task);
      }
    }

    for (const task of tasks) {
      visit(task.id);
    }

    return result;
  }

  /**
   * Validate the complete workflow for consistency.
   */
  private async validateCompleteWorkflow(plan: ProjectPlan): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Check architecture-task consistency
    if (plan.context.architecture && plan.tasks.length > 0) {
      const architectureConsistency = this.validateArchitectureTaskConsistency(
        plan.context.architecture,
        plan.tasks
      );
      results.push(architectureConsistency);
    }

    // Check file structure-task consistency
    if (plan.context.fileStructure && plan.tasks.length > 0) {
      const fileConsistency = this.validateFileStructureTaskConsistency(
        plan.context.fileStructure,
        plan.tasks
      );
      results.push(fileConsistency);
    }

    // Check dependency completeness
    const dependencyValidation = this.validateDependencyCompleteness(plan.tasks);
    results.push(dependencyValidation);

    return results;
  }

  /**
   * Validate that tasks are consistent with architecture.
   */
  private validateArchitectureTaskConsistency(architecture: any, tasks: any[]): ValidationResult {
    // Simple heuristic-based validation
    const architectureKeywords = [
      'authentication', 'authorization', 'security',
      'database', 'storage', 'persistence',
      'api', 'microservices', 'architecture'
    ];

    const taskArchitectureKeywords = tasks.flatMap(task => 
      architectureKeywords.filter(keyword => 
        task.title.toLowerCase().includes(keyword)
      )
    );

    const hasArchitectureConsistency = taskArchitectureKeywords.length > 0;

    return {
      id: 'arch-consistency',
      type: 'consistency' as const,
      passed: hasArchitectureConsistency,
      message: hasArchitectureConsistency ? 
        'Tasks are consistent with architecture' : 
        'No clear architectural consistency found in tasks',
      severity: hasArchitectureConsistency ? 'info' as const : 'warning'
    };
  }

  /**
   * Validate that tasks are consistent with file structure.
   */
  private validateFileStructureTaskConsistency(fileStructure: any, tasks: any[]): ValidationResult {
    // Simple heuristic-based validation
    const fileKeywords = [
      'component', 'page', 'view',
      'service', 'controller', 'handler',
      'util', 'helper', 'lib'
    ];

    const taskFileKeywords = tasks.flatMap(task => 
      fileKeywords.filter(keyword => 
        task.title.toLowerCase().includes(keyword)
      )
    );

    const hasFileConsistency = taskFileKeywords.length > 0;

    return {
      id: 'file-consistency',
      type: 'consistency' as const,
      passed: hasFileConsistency,
      message: hasFileConsistency ? 
        'Tasks are consistent with file structure' : 
        'No clear file structure consistency found in tasks',
      severity: hasFileConsistency ? 'info' as const : 'warning'
    };
  }

  /**
   * Validate dependency completeness.
   */
  private validateDependencyCompleteness(tasks: any[]): ValidationResult {
    const missingDependencies = tasks.filter(task => 
      task.dependencies.length === 0 && tasks.indexOf(task) > 0
    );

    const hasDependencyIssues = missingDependencies.length > 0;

    return {
      id: 'dependency-completeness',
      type: 'completeness' as const,
      passed: !hasDependencyIssues,
      message: hasDependencyIssues ? 
        `${missingDependencies.length} tasks may be missing explicit dependencies` : 
        'Dependency relationships appear complete',
      severity: hasDependencyIssues ? 'warning' as const : 'info'
    };
  }

  /**
   * Optimize task ordering based on dependencies.
   */
  optimizeDependencyOrdering(tasks: any[]): any[] {
    const edges = tasks.reduce((acc, task) => {
      acc[task.id] = task.dependencies;
      return acc;
    }, {} as Record<string, string[]>);

    try {
      return this.topologicalSort(tasks, edges);
    } catch (error) {
      console.warn('Circular dependency detected, using original order');
      return tasks;
    }
  }

  /**
   * Validate task consistency in a project plan.
   */
  async validateTaskConsistency(plan: ProjectPlan): Promise<ValidationResult[]> {
    return this.validateCompleteWorkflow(plan);
  }
}

/**
 * Generate a complete project plan using the unified orchestrator.
 */
export async function generateUnifiedProjectPlan(
  input: ProjectPlanInput
): Promise<ProjectPlan> {
  const orchestrator = new UnifiedTaskGenerationOrchestrator(
    input.apiKey,
    input.model,
    input.useTDD
  );

  const context: UnifiedProjectContext = {
    prd: input.prd,
    dependencyGraph: {
      nodes: {},
      edges: {}
    },
    validationHistory: []
  };

  return await orchestrator.generateProjectPlan(context);
}

