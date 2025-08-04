


'use server';

/**
 * @fileOverview Task Generation Orchestrator - Coordinates all flows with proper context sharing.
 *
 * - TaskGenerationOrchestrator - Main orchestrator that coordinates architecture, file structure, and task generation
 * - ProjectPlanGenerator - High-level function for complete project plan generation with validation
 */

import { ai } from '@/ai/genkit';
import { TaskDependencyGraph, type DependencyGraph } from './task-dependency-graph';
import { 
  ProjectContextManager, 
  type UnifiedProjectContext,
  type ValidationResult as ContextValidationResult
} from './unified-project-context';
import { generateArchitecture, GenerateArchitectureInput } from './generate-architecture';
import { generateFileStructure, GenerateFileStructureInput } from './generate-file-structure';
import { generateTasks, GenerateTasksInput } from './generate-tasks';
import { researchTask, ResearchTaskInput, ResearchTaskOutput } from './research-task';
import { Task } from '@/types';
import z from 'genkit';

export interface ProjectPlanGenerationInput {
  prd: string;
  options?: {
    apiKey?: string;
    model?: string;
    useTDD?: boolean;
  };
}

export interface ProjectPlan {
  context: UnifiedProjectContext;
  dependencyGraph: DependencyGraph;
  validationResults: {
    contextValidation: ContextValidationResult;
    dependencyValidation: import('./task-dependency-graph').ValidationResult;
  };
}

export interface TaskResearchEngineOptions {
  apiKey?: string;
  model?: string;
  useTDD?: boolean;
}

export class TaskGenerationOrchestrator {
 private contextManager: ProjectContextManager;
 private dependencyGraph?: DependencyGraph;

 constructor(initialPRD: string) {
    this.contextManager = new ProjectContextManager({ prd: initialPRD });
  }

 public async generateProjectPlan(
   input: ProjectPlanGenerationInput
 ): Promise<ProjectPlan> {
    const { prd, options = {} } = input;
    
    // Update PRD in context
    this.contextManager.updatePRD(prd);

    try {
      // Step 1: Generate architecture and specifications
      console.log('Step 1: Generating architecture...');
      const { architecture, specifications } = await this.generateArchitectureWithValidation(
        prd,
        options
      );

      // Step 2: Generate file structure based on architecture and specifications  
      console.log('Step 2: Generating file structure...');
      const fileStructure = await this.generateFileStructureWithValidation(
        prd,
        architecture, 
        specifications,
        options
      );

      // Step 3: Generate tasks with full context
      console.log('Step 3: Generating tasks...');
      const initialTasks = await this.generateTasksWithValidation(
        architecture,
        specifications, 
        fileStructure,
        options
      );

      // Step 4: Create and validate dependency graph
      console.log('Step 4: Building dependency graph...');
      this.dependencyGraph = new TaskDependencyGraph(initialTasks);
      const dependencyValidation = this.dependencyGraph.validateDependencies();

      // Step 5: Research tasks with proper ordering
      console.log('Step 5: Researching tasks...');
      await this.researchTasksWithDependencies(initialTasks, options);

      // Step 6: Final validation
      console.log('Step 6: Performing final validation...');
      const contextValidation = this.contextManager.validate();

      // Update the final context
      this.contextManager.updateArchitecture(architecture);
      this.contextManager.updateSpecifications(specifications);
      this.contextManager.updateFileStructure(fileStructure);

      const finalTasks = this.dependencyGraph.getSortedTasks();
      this.contextManager.updateTasks(finalTasks);

      return {
        context: this.contextManager.getContext(),
        dependencyGraph: this.dependencyGraph,
        validationResults: {
          contextValidation,
          dependencyValidation,
        },
      };
    } catch (error) {
      console.error('Project plan generation failed:', error);
      throw new Error(`Failed to generate project plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

 private async generateArchitectureWithValidation(
   prd: string,
   options: { apiKey?: string; model?: string }
 ): Promise<{ architecture: string; specifications: string }> {
    const input: GenerateArchitectureInput = { prd };
    
    try {
      // Subscribe to context updates for validation
      const unsubscribe = this.contextManager.subscribe({
        id: 'architecture-generation',
        callback: (event) => {
          if (event.type === 'PRD_UPDATED' && event.newValue !== prd) {
            console.warn('PRD changed during architecture generation - this may affect results');
          }
        },
      });

      const result = await generateArchitecture(input, options.apiKey, options.model);
      
      unsubscribe(); // Clean up subscription

      return {
        architecture: result.architecture,
        specifications: result.specifications,
      };
    } catch (error) {
      throw new Error(`Architecture generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

 private async generateFileStructureWithValidation(
   prd: string,
   architecture: string,
   specifications: string, 
   options: { apiKey?: string; model?: string }
 ): Promise<string> {
    const input: GenerateFileStructureInput = { prd, architecture, specifications };
    
    try {
      const result = await generateFileStructure(input, options.apiKey, options.model);
      
      if (!result.fileStructure) {
        throw new Error('File structure generation returned empty result');
      }

      // Basic validation of file structure format
      if (!result.fileStructure.includes('/') && !result.fileStructure.includes('{')) {
        console.warn('Generated file structure may not be in expected format');
      }

      return result.fileStructure;
    } catch (error) {
      throw new Error(`File structure generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

 private async generateTasksWithValidation(
   architecture: string,
   specifications: string,
   fileStructure: string,
   options: { apiKey?: string; model?: string; useTDD?: boolean }
 ): Promise<Task[]> {
    const input: GenerateTasksInput = { architecture, specifications, fileStructure };
    
    try {
      const result = await generateTasks(input, options.apiKey, options.model, options.useTDD);
      
      if (!result.tasks || result.tasks.length === 0) {
        throw new Error('No tasks were generated');
      }

      // Validate that all tasks have titles
      const invalidTasks = result.tasks.filter(task => !task.title || task.title.trim() === '');
      if (invalidTasks.length > 0) {
        throw new Error(`Generated ${invalidTasks.length} tasks without valid titles`);
      }

      // Add empty details to all tasks for research phase
      return result.tasks.map(task => ({ ...task, details: '' }));
    } catch (error) {
      throw new Error(`Task generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

 private async researchTasksWithDependencies(
   tasks: Task[],
   options: TaskResearchEngineOptions
 ): Promise<void> {
    if (!this.dependencyGraph) {
      throw new Error('Dependency graph not initialized');
    }

    const sortedTasks = this.dependencyGraph.getSortedTasks();
    
    console.log(`Researching ${sortedTasks.length} tasks in dependency order...`);
    console.log('Execution order:', sortedTasks.map(t => t.title).join(' → '));

    for (let i = 0; i < sortedTasks.length; i++) {
      const task = sortedTasks[i];
      
      console.log(`Researching task ${i + 1}/${sortedTasks.length}: "${task.title}"`);
      
      try {
        // Get the node to check dependencies
        const taskNode = this.dependencyGraph.nodes.get(task.title);
        
        if (taskNode) {
          // Check if dependencies are met
          const prerequisitesMet = taskNode.dependencies.every(dep => 
            sortedTasks.slice(0, i).some(completedTask => completedTask.title === dep)
          );

          if (!prerequisitesMet) {
            console.warn(`Warning: Task "${task.title}" has unmet dependencies`);
          }
        }

        const researchInput: ResearchTaskInput = {
          title: task.title,
          architecture: this.contextManager.getContext().architecture!,
          fileStructure: this.contextManager.getContext().fileStructure!,
          specifications: this.contextManager.getContext().specifications!,
        };

        const researchResult = await researchTask(
          researchInput,
          options.apiKey,
          options.model, 
          options.useTDD
        );

        const formattedDetails = this.formatResearchResult(researchResult);
        
        // Update the task in context
        this.contextManager.updateTask(task.title, { details: formattedDetails });

      } catch (error) {
        console.error(`Failed to research task "${task.title}":`, error);
        
        // Set error details for the task
        const errorMessage = `Failed to research task: ${error instanceof Error ? error.message : 'Unknown error'}`;
        this.contextManager.updateTask(task.title, { details: errorMessage });
      }
    }

    console.log('Task research completed');
  }

 private formatResearchResult(result: ResearchTaskOutput): string {
    return `### Context
${result.context}

### Implementation Steps  
${result.implementationSteps}

### Acceptance Criteria
${result.acceptanceCriteria}`;
  }

 public async validateCompleteWorkflow(): Promise<{
   isValid: boolean;
   errors: string[];
   warnings: string[];
 }> {
    const contextValidation = this.contextManager.validate();
    const dependencyValidation = this.dependencyGraph?.validateDependencies() || { isValid: true, errors: [], warnings: [] };

    const allErrors = [
      ...contextValidation.errors.map(error => error.message),
      ...dependencyValidation.errors.map(error => error.message),
    ];

    const allWarnings = [
      ...contextValidation.warnings.map(warning => warning.message),
      ...dependencyValidation.warnings.map(warning => warning.message),
    ];

    return {
      isValid: contextValidation.isValid && dependencyValidation.isValid,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

 public getExecutionOrder(): string[] {
    if (!this.dependencyGraph) {
      return [];
    }
    
    try {
      return this.dependencyGraph.getSortedTasks().map(task => task.title);
    } catch (error) {
      console.error('Failed to get execution order:', error);
      return [];
    }
  }

 public getContext() {
    return this.contextManager.getContext();
  }
}

// High-level function for complete project plan generation
export async function generateProjectPlan(
  input: ProjectPlanGenerationInput
): Promise<ProjectPlan> {
  const orchestrator = new TaskGenerationOrchestrator(input.prd);
  
  try {
    return await orchestrator.generateProjectPlan(input);
  } catch (error) {
    console.error('Failed to generate project plan:', error);
    
    // Return partial results with validation errors if possible
    const context = orchestrator.getContext();
    try {
      return {
        context,
        dependencyGraph: new TaskDependencyGraph(context.tasks),
        validationResults: {
          contextValidation: orchestrator['contextManager'].validate(),
          dependencyValidation: new TaskDependencyGraph(context.tasks).validateDependencies(),
        },
      };
    } catch (validationError) {
      throw error; // Re-throw original error if validation fails too
    }
  }
}

// Zod schema for API input
export const ProjectPlanGenerationInputSchema = z.object({
  prd: z.string().min(1, 'PRD is required and cannot be empty'),
  options: z.object({
    apiKey: z.string().optional(),
    model: z.string().optional(), 
    useTDD: z.boolean().default(false),
  }).default({}),
});

export type ProjectPlanGenerationInputType = z.infer<typeof ProjectPlanGenerationInputSchema>;

