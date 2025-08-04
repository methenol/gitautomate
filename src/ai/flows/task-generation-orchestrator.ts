

'use server';

/**
 * @fileOverview Task generation orchestrator that coordinates the workflow with dependency awareness.
 *
 * - TaskGenerationOrchestrator - Coordinates architecture, file structure, and task generation with proper context sharing
 * - TaskGenerationOrchestratorInput - Input type for the orchestrator
 * - TaskGenerationOrchestratorOutput - Output type containing complete project plan
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  generateArchitecture,
  GenerateArchitectureInput,
  GenerateArchitectureOutput,
} from './generate-architecture';
import {
  generateFileStructure,
  GenerateFileStructureInput,
  GenerateFileStructureOutput,
} from './generate-file-structure';
import {
  generateTasks,
  GenerateTasksInput,
  GenerateTasksOutput,
} from './generate-tasks';
import {
  researchTask,
  ResearchTaskInput,
  ResearchTaskOutput,
} from './research-task';
import { 
  UnifiedProjectContext, 
  ProjectPlan, 
  ResearchedTask,
  Task,
  createUnifiedProjectContext,
  ValidationResult
} from './unified-context';

const TaskGenerationOrchestratorInputSchema = z.object({
  prd: z
    .string()
    .describe('The Product Requirements Document (PRD) to generate the project plan from.'),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  useTDD: z.boolean().default(false),
});

export type TaskGenerationOrchestratorInput = z.infer<typeof TaskGenerationOrchestratorInputSchema>;

const TaskGenerationOrchestratorOutputSchema = z.object({
  projectPlan: z.string().describe('The complete project plan with architecture, file structure, and researched tasks.'),
  validationResults: z.array(z.object({
    isValid: z.boolean(),
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
  })).describe('Validation results for each step of the generation process.'),
});

export type TaskGenerationOrchestratorOutput = z.infer<typeof TaskGenerationOrchestratorOutputSchema>;

/**
 * Validates that generated tasks are consistent with the project context
 */
export function validateTaskConsistency(
  architecture: string,
  specifications: string, 
  fileStructure: string,
  tasks: Task[]
): ValidationResult {
  
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check that tasks reference files that exist in the file structure
  if (fileStructure) {
    const taskFiles = new Set<string>();
    
    tasks.forEach(task => {
      // Extract file references from task details (if available)
      if (task.details) {
        const fileMatches = task.details.match(/[-\w/.]+\.tsx|[-\w/.]+\.ts|[-\w/.]+\.jsx|[-\w/.]+\.js/g);
        if (fileMatches) {
          fileMatches.forEach(file => taskFiles.add(file));
        }
      }
    });

    // This would be enhanced with actual file structure parsing
    if (taskFiles.size > 0 && !fileStructure.includes('src/')) {
      warnings.push('Generated tasks reference files but file structure may not contain corresponding directories');
    }
  }

  // Check for logical dependencies between tasks
  const setupTasks = tasks.filter(task => 
    task.title.toLowerCase().includes('setup') ||
    task.title.toLowerCase().includes('install') ||
    task.title.toLowerCase().includes('configure')
  );

  const featureTasks = tasks.filter(task => 
    !task.title.toLowerCase().includes('setup') &&
    !task.title.toLowerCase().includes('install') &&
    !task.title.toLowerCase().includes('configure')
  );

  if (setupTasks.length === 0 && featureTasks.length > 2) {
    warnings.push('No setup tasks found, but multiple feature tasks generated. Consider adding project setup steps.');
  }

  // Check for authentication-related tasks
  const authTasks = tasks.filter(task => 
    task.title.toLowerCase().includes('auth') ||
    task.title.toLowerCase().includes('login')
  );

  if (authTasks.length > 0) {
    const hasSetup = setupTasks.some(task => 
      task.title.toLowerCase().includes('auth') ||
      task.title.toLowerCase().includes('login')
    );

    if (!hasSetup) {
      warnings.push('Authentication tasks found but no dedicated authentication setup task');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates that the complete workflow is consistent
 */
export function validateCompleteWorkflow(
  architecture: string,
  specifications: string,
  fileStructure: string,
  tasks: Task[]
): ValidationResult {
  
  const errors: string[] = [];
  const warnings: string[] = [];

  // Cross-validate architecture and file structure
  if (architecture && fileStructure) {
    const hasComponents = architecture.toLowerCase().includes('component');
    const hasComponentFiles = fileStructure.includes('/components') || fileStructure.includes('\\components');

    if (hasComponents && !hasComponentFiles) {
      warnings.push('Architecture mentions components but file structure may be missing component directories');
    }
  }

  // Cross-validate specifications and tasks
  if (specifications && tasks.length > 0) {
    const specKeywords = specifications.toLowerCase().split(/\s+/);
    const taskTitles = tasks.map(task => task.title.toLowerCase());

    // Check if major features from specs are reflected in tasks
    const importantFeatures = specKeywords.filter(keyword => 
      keyword.length > 4 && !['this', 'that', 'with', 'from', 'they'].includes(keyword)
    );

    for (const feature of importantFeatures.slice(0, 5)) { // Check top 5 features
      if (!taskTitles.some(title => title.includes(feature))) {
        warnings.push(`Feature "${feature}" mentioned in specifications but may not have corresponding tasks`);
      }
    }
  }

  // Check for complete project lifecycle
  const hasSetup = tasks.some(task => 
    task.title.toLowerCase().includes('setup') ||
    task.title.toLowerCase().includes('init')
  );

  const hasTesting = tasks.some(task => 
    task.title.toLowerCase().includes('test') ||
    task.title.toLowerCase().includes('spec')
  );

  const hasDeployment = tasks.some(task => 
    task.title.toLowerCase().includes('deploy') ||
    task.title.toLowerCase().includes('build')
  );

  if (!hasSetup && tasks.length > 3) {
    warnings.push('Consider adding project setup tasks for a complete workflow');
  }

  if (!hasTesting && tasks.length > 5) {
    warnings.push('Consider adding testing tasks for better code quality');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Optimizes task ordering based on dependencies
 */
export function optimizeDependencyOrdering(tasks: Task[]): Task[] {
  // For now, return tasks with basic logical sorting
  const setupTasks = tasks.filter(task => 
    task.title.toLowerCase().includes('setup') ||
    task.title.toLowerCase().includes('install') ||
    task.title.toLowerCase().includes('configure')
  );

  const developmentTasks = tasks.filter(task => 
    !task.title.toLowerCase().includes('setup') &&
    !task.title.toLowerCase().includes('install') &&
    !task.title.toLowerCase().includes('configure')
  );

  const testingTasks = tasks.filter(task => 
    task.title.toLowerCase().includes('test') ||
    task.title.toLowerCase().includes('spec')
  );

  const deploymentTasks = tasks.filter(task => 
    task.title.toLowerCase().includes('deploy') ||
    task.title.toLowerCase().includes('build')
  );

  return [...setupTasks, ...developmentTasks, ...testingTasks, ...deploymentTasks];
}

/**
 * Researches tasks with full context of dependencies and completed work
 */
export async function researchTaskWithDependencies(
  task: Task,
  context: {
    architecture: string;
    fileStructure: string; 
    specifications: string;
  },
  completedTasks: Task[],
  useTDD?: boolean,
  apiKey?: string,
  model?: string
): Promise<ResearchedTask> {
  
  // Build context from completed tasks to avoid duplication
  const completedContext = completedTasks.map(t => 
    `Completed Task: ${t.title}\n${t.details ? Details: ''}`
  ).join('\n\n');

  const researchInput: ResearchTaskInput = {
    title: task.title,
    architecture: `${context.architecture}\n\n${completedContext}`,
    fileStructure: context.fileStructure,
    specifications: `${context.specifications}\n\n${completedContext}`,
  };

  const researchResult = await researchTask(researchInput, apiKey, model, useTDD);

  return {
    ...task,
    context: researchResult.context,
    implementationSteps: researchResult.implementationSteps,
    acceptanceCriteria: researchResult.acceptanceCriteria,
  };
}

/**
 * Main orchestrator function that coordinates the entire project generation workflow
 */
export async function generateProjectPlanWithOrchestrator(
  input: TaskGenerationOrchestratorInput
): Promise<TaskGenerationOrchestratorOutput> {
  
  const validationResults: ValidationResult[] = [];
  
  try {
    // Step 1: Generate architecture
    console.log('Step 1: Generating architecture...');
    const generateArchitectureInput: GenerateArchitectureInput = { prd: input.prd };
    const architectureResult: GenerateArchitectureOutput = await generateArchitecture(
      generateArchitectureInput,
      input.apiKey,
      input.model
    );

    validationResults.push({
      isValid: true,
      errors: [],
      warnings: ['Architecture generated successfully'],
    });

    // Step 2: Generate file structure based on architecture
    console.log('Step 2: Generating file structure...');
    const generateFileStructureInput: GenerateFileStructureInput = {
      prd: input.prd,
      architecture: architectureResult.architecture,
      specifications: architectureResult.specifications,
    };
    
    const fileStructureResult: GenerateFileStructureOutput = await generateFileStructure(
      generateFileStructureInput,
      input.apiKey,
      input.model
    );

    validationResults.push({
      isValid: true,
      errors: [],
      warnings: ['File structure generated successfully'],
    });

    // Step 3: Generate tasks based on architecture, specs, and file structure
    console.log('Step 3: Generating tasks...');
    const generateTasksInput: GenerateTasksInput = {
      architecture: architectureResult.architecture,
      specifications: architectureResult.specifications,
      fileStructure: fileStructureResult.fileStructure || '',
    };

    const tasksResult: GenerateTasksOutput = await generateTasks(
      generateTasksInput,
      input.apiKey,
      input.model,
      input.useTDD
    );

    // Generate unique IDs for tasks and optimize ordering
    const tasksWithIds: Task[] = (tasksResult.tasks || []).map((task, index) => ({
      ...task,
      id: `task-${(index + 1).toString().padStart(3, '0')}`,
      dependencies: [], // Initialize empty - could be enhanced with dependency analysis
    }));

    const optimizedTasks = optimizeDependencyOrdering(tasksWithIds);

    validationResults.push(validateTaskConsistency(
      architectureResult.architecture,
      architectureResult.specifications,
      fileStructureResult.fileStructure || '',
      optimizedTasks
    ));

    // Step 4: Research tasks with full context (this would be enhanced in a complete implementation)
    console.log('Step 4: Researching tasks...');
    const researchedTasks: ResearchedTask[] = [];
    
    // For now, use existing research function for each task
    for (const task of optimizedTasks) {
      try {
        const researchInput: ResearchTaskInput = {
          title: task.title,
          architecture: architectureResult.architecture,
          fileStructure: fileStructureResult.fileStructure || '',
          specifications: architectureResult.specifications,
        };

        const researchResult = await researchTask(researchInput, input.apiKey, input.model, input.useTDD);
        
        researchedTasks.push({
          ...task,
          context: researchResult.context,
          implementationSteps: researchResult.implementationSteps,
          acceptanceCriteria: researchResult.acceptanceCriteria,
        });

      } catch (error) {
        console.warn(`Failed to research task "${task.title}":`, error);
        
        // Add placeholder for failed tasks
        researchedTasks.push({
          ...task,
          context: `Context research failed for task "${task.title}"`,
          implementationSteps: 'Implementation steps could not be generated',
          acceptanceCriteria: 'Acceptance criteria could not be defined',
        });
      }
    }

    // Final validation of complete workflow
    const finalValidation = validateCompleteWorkflow(
      architectureResult.architecture,
      architectureResult.specifications,
      fileStructureResult.fileStructure || '',
      optimizedTasks
    );
    
    validationResults.push(finalValidation);

    // Create unified project context
    const unifiedContext = createUnifiedProjectContext({
      prd: input.prd,
      architecture: architectureResult.architecture,
      specifications: architectureResult.specifications,
      fileStructure: fileStructureResult.fileStructure || '',
      tasks: optimizedTasks,
    });

    // Generate final project plan
    const projectPlan: ProjectPlan = {
      prd: input.prd,
      architecture: architectureResult.architecture,
      specifications: architectureResult.specifications,
      fileStructure: fileStructureResult.fileStructure || '',
      tasks: researchedTasks,
    };

    return {
      projectPlan: JSON.stringify(projectPlan, null, 2),
      validationResults,
    };

  } catch (error) {
    console.error('Error in project generation orchestrator:', error);
    
    validationResults.push({
      isValid: false,
      errors: [`Project generation failed: ${(error as Error).message}`],
      warnings: [],
    });

    throw error;
  }
}

