'use server';

/**
 * @fileOverview Unified Project Orchestrator that coordinates the entire project planning workflow.
 * 
 * This orchestrator replaces the previous sequential silo processing with a unified, 
 * dependency-aware system that ensures consistency across architecture, file structure, 
 * and task generation.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { 
  UnifiedProjectContext,
  ProjectPlan,
  ValidationResult,
  DependencyGraph,
  Task
} from '@/types';
import { generateArchitecture } from './generate-architecture';
import { generateFileStructure } from './generate-file-structure';
import { generateTasks } from './generate-tasks';
import { researchTask } from './research-task';

export type UnifiedProjectOrchestrationInput = {
  prd: string;
  useTDD?: boolean;
  apiKey?: string;
  model?: string;
};

/**
 * Validates consistency between architecture, file structure, and tasks
 */
async function validateProjectConsistency(context: UnifiedProjectContext): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Basic validation checks
  if (!context.prd.trim()) {
    errors.push('PRD is empty or missing');
  }
  
  if (!context.architecture.trim()) {
    errors.push('Architecture is empty or missing');
  }
  
  if (!context.specifications.trim()) {
    errors.push('Specifications are empty or missing');
  }
  
  if (!context.fileStructure.trim()) {
    errors.push('File structure is empty or missing');
  }
  
  // Advanced consistency validation using AI
  if (errors.length === 0) {
    try {
      const validationPrompt = `Analyze the following project components for logical consistency and completeness:

PRD:
${context.prd}

Architecture:
${context.architecture}

File Structure:
${context.fileStructure}

Specifications:
${context.specifications}

Check for:
1. Does the architecture support all requirements in the PRD?
2. Does the file structure reflect the proposed architecture?
3. Do the specifications align with both PRD and architecture?
4. Are there any obvious gaps or contradictions?

Respond with a JSON object containing "errors" (critical issues) and "warnings" (minor concerns) arrays.`;

      const { output } = await ai.generate({
        model: context.metadata.model ? `googleai/${context.metadata.model}` : 'googleai/gemini-1.5-flash-latest',
        prompt: validationPrompt,
        output: {
          schema: z.object({
            errors: z.array(z.string()),
            warnings: z.array(z.string()),
          }),
        },
        config: context.metadata.apiKey ? { apiKey: context.metadata.apiKey } : undefined,
      });

      if (output) {
        errors.push(...output.errors);
        warnings.push(...output.warnings);
      }
    } catch {
      warnings.push('Could not perform advanced consistency validation');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Builds a dependency graph from generated tasks
 */
function buildDependencyGraph(tasks: Task[]): DependencyGraph {
  const dependencies: Record<string, string[]> = {};
  
  tasks.forEach(task => {
    dependencies[task.title] = task.dependencies || [];
  });
  
  return {
    tasks,
    dependencies,
  };
}

/**
 * Generates tasks with dependency awareness and context propagation
 */
async function generateDependencyAwareTasks(context: UnifiedProjectContext): Promise<Task[]> {
  // First, generate initial task list
  const tasksResult = await generateTasks(
    {
      architecture: context.architecture,
      specifications: context.specifications,
      fileStructure: context.fileStructure,
    },
    context.metadata.apiKey,
    context.metadata.model,
    context.metadata.useTDD
  );
  
  const initialTasks = tasksResult.tasks;
  
  // Research each task with dependency awareness
  const researchedTasks: Task[] = [];
  const completedTaskTitles = new Set<string>();
  
  for (let i = 0; i < initialTasks.length; i++) {
    const task = initialTasks[i];
    
    try {
      // Enhanced research with dependency context
      const researchResult = await researchTask(
        {
          title: task.title,
          architecture: context.architecture,
          fileStructure: context.fileStructure,
          specifications: context.specifications,
        },
        context.metadata.apiKey,
        context.metadata.model,
        context.metadata.useTDD
      );
      
      // Enhance the prompt for dependency-aware research
      const dependencyPrompt = `
Given the following task and project context, also consider:

COMPLETED TASKS: ${Array.from(completedTaskTitles).join(', ') || 'None yet'}
REMAINING TASKS: ${initialTasks.slice(i + 1).map(t => t.title).join(', ')}
TASK POSITION: ${i + 1} of ${initialTasks.length}

Analyze what other tasks this one depends on and provide an updated implementation plan that considers:
1. Prerequisites that should be completed first
2. How this task builds on previous work
3. What this task enables for future tasks
4. Any specific ordering requirements

Current task context: ${researchResult.context}
Current implementation steps: ${researchResult.implementationSteps}
Current acceptance criteria: ${researchResult.acceptanceCriteria}

Suggest any task dependencies (by exact title from the task list) this task requires.`;
      
      // Generate dependency suggestions
      let taskDependencies: string[] = [];
      try {
        const { output: depOutput } = await ai.generate({
          model: context.metadata.model ? `googleai/${context.metadata.model}` : 'googleai/gemini-1.5-flash-latest',
          prompt: dependencyPrompt,
          output: {
            schema: z.object({
              dependencies: z.array(z.string()).describe('Task titles this task depends on'),
              reasoning: z.string().describe('Why these dependencies are needed'),
            }),
          },
          config: context.metadata.apiKey ? { apiKey: context.metadata.apiKey } : undefined,
        });
        
        if (depOutput) {
          // Filter dependencies to only include valid task titles
          const validTaskTitles = initialTasks.map(t => t.title);
          taskDependencies = depOutput.dependencies.filter(dep => 
            validTaskTitles.includes(dep) && dep !== task.title
          );
        }
      } catch {
        // If dependency analysis fails, continue without dependencies
        console.warn(`Could not analyze dependencies for task: ${task.title}`);
      }
      
      const formattedDetails = `### Context\n${researchResult.context}\n\n### Implementation Steps\n${researchResult.implementationSteps}\n\n### Acceptance Criteria\n${researchResult.acceptanceCriteria}`;
      
      researchedTasks.push({
        ...task,
        details: formattedDetails,
        dependencies: taskDependencies,
        priority: i, // Maintain original ordering as priority
      });
      
      completedTaskTitles.add(task.title);
      
    } catch (error) {
      // If research fails, add task with error details
      researchedTasks.push({
        ...task,
        details: `Failed to research task: ${(error as Error).message}`,
        dependencies: [],
        priority: i,
      });
      completedTaskTitles.add(task.title);
    }
  }
  
  return researchedTasks;
}

/**
 * Determines optimal execution order based on dependencies
 */
function optimizeTaskExecution(tasks: Task[]): string[] {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const executionOrder: string[] = [];
  
  function visit(taskTitle: string): void {
    if (visited.has(taskTitle)) return;
    if (visiting.has(taskTitle)) {
      // Circular dependency detected, skip to avoid infinite loop
      return;
    }
    
    visiting.add(taskTitle);
    
    const task = tasks.find(t => t.title === taskTitle);
    if (task) {
      // Visit dependencies first
      task.dependencies.forEach(dep => visit(dep));
      
      // Then add this task
      if (!visited.has(taskTitle)) {
        executionOrder.push(taskTitle);
        visited.add(taskTitle);
      }
    }
    
    visiting.delete(taskTitle);
  }
  
  // Sort by priority first, then resolve dependencies
  const sortedTasks = [...tasks].sort((a, b) => a.priority - b.priority);
  sortedTasks.forEach(task => visit(task.title));
  
  // Add any remaining tasks not included due to dependency issues
  tasks.forEach(task => {
    if (!visited.has(task.title)) {
      executionOrder.push(task.title);
    }
  });
  
  return executionOrder;
}

/**
 * Main orchestrator function that coordinates the entire project planning workflow
 */
export async function generateUnifiedProjectPlan(
  input: UnifiedProjectOrchestrationInput
): Promise<ProjectPlan> {
  // Initialize unified context
  const context: UnifiedProjectContext = {
    prd: input.prd,
    architecture: '',
    fileStructure: '',
    specifications: '',
    validationHistory: [],
    metadata: {
      useTDD: input.useTDD || false,
      model: input.model,
      apiKey: input.apiKey,
      timestamp: new Date().toISOString(),
    },
  };
  
  try {
    // Step 1: Generate architecture and specifications
    const architectureResult = await generateArchitecture(
      { prd: input.prd },
      input.apiKey,
      input.model
    );
    
    context.architecture = architectureResult.architecture;
    context.specifications = architectureResult.specifications;
    
    // Step 2: Generate file structure based on architecture and specs
    const fileStructureResult = await generateFileStructure(
      {
        prd: input.prd,
        architecture: context.architecture,
        specifications: context.specifications,
      },
      input.apiKey,
      input.model
    );
    
    context.fileStructure = fileStructureResult.fileStructure;
    
    // Step 3: Validate initial consistency
    const initialValidation = await validateProjectConsistency(context);
    context.validationHistory.push(initialValidation);
    
    // Step 4: Generate dependency-aware tasks
    const tasks = await generateDependencyAwareTasks(context);
    
    // Step 5: Build dependency graph
    const dependencyGraph = buildDependencyGraph(tasks);
    context.dependencyGraph = dependencyGraph;
    
    // Step 6: Optimize execution order
    const executionOrder = optimizeTaskExecution(tasks);
    
    // Step 7: Final validation
    const finalValidation = await validateProjectConsistency(context);
    context.validationHistory.push(finalValidation);
    
    return {
      context,
      tasks,
      executionOrder,
      validation: finalValidation,
    };
    
  } catch (error) {
    // If orchestration fails, return with error information
    const errorValidation: ValidationResult = {
      isValid: false,
      errors: [`Orchestration failed: ${(error as Error).message}`],
      warnings: [],
      timestamp: new Date().toISOString(),
    };
    
    context.validationHistory.push(errorValidation);
    
    return {
      context,
      tasks: [],
      executionOrder: [],
      validation: errorValidation,
    };
  }
}