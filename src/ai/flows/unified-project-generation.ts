


'use server';

/**
 * @fileOverview Unified project generation flow that orchestrates all components with proper context sharing and dependency management.
 *
 * This addresses the critical architectural flaws described in Issue #7:
 * - Sequential Silo Processing: Now operates with unified context
 * - Lack of Inter-Task Dependency Modeling: Implements dependency-aware task generation and research
 * - Insufficient Context Propagation: Single source of truth with validation loops
 * - Missing Iterative Refinement Loop: Cross-consistency checking and validation
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  generateArchitecture,
  GenerateArchitectureInput,
} from './generate-architecture';
import { generateFileStructure, GenerateFileStructureInput } from './generate-file-structure';
import { generateTasks, GenerateTasksInput } from './generate-tasks';
import { researchTask, ResearchTaskInput } from './research-task';

// Import new types
import type {
  UnifiedProjectContext,
  ProjectPlanOutput,
  ValidationResult,
} from '@/types/unified-context';

// Import dependency management
import { TaskDependencyGraph, DependencyAwareTaskResearcher } from '@/lib/task-dependency-graph';
import type { Task } from '@/types';

// Input schema for unified project generation
const UnifiedProjectInputSchema = z.object({
  prd: z.string().min(1, 'PRD is required to generate project plan.'),
});

export type UnifiedProjectInput = z.infer<typeof UnifiedProjectInputSchema>;

// Output schema for unified project generation
const ProjectPlanOutputSchema = z.object({
  context: z.any().describe('The unified project context containing all generated data.'),
  validationResults: z.array(z.object({
    isValid: z.boolean(),
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
    timestamp: z.date(),
  })).describe('Validation results from cross-consistency checking.'),
});

export type ProjectPlanOutput = z.infer<typeof ProjectPlanOutputSchema>;

/**
 * Options for unified project generation
 */
export interface UnifiedGenerationOptions {
  apiKey?: string;
  model?: string;
  useTDD?: boolean;
  enableValidation?: boolean;
  maxRetries?: number;
}

/**
 * Generates a complete project plan with unified context and dependency management
 */
export async function generateUnifiedProjectPlan(
  input: UnifiedProjectInput,
  options?: UnifiedGenerationOptions
): Promise<ProjectPlanOutput> {
  const startTime = new Date();
  
  try {
    console.log('Starting unified project generation...');
    
    // Initialize unified context
    const context: UnifiedProjectContext = {
      prd: input.prd,
      tasks: [],
      researchedTasks: new Map(),
      dependencyGraph: new Map(),
      validationHistory: [],
    };

    const validationResults: ValidationResult[] = [];
    
    // Phase 1: Generate Architecture
 console.log('Phase 1: Generating architecture...');
    const archResult = await generateArchitectureWithRetry(
      { prd: input.prd },
      options
    );
    
    context.architecture = archResult.architecture;
    context.specifications = archResult.specifications;

    // Validate architecture phase
    const archValidation = validateArchitecturePhase(context);
    validationResults.push(archValidation);

    if (archValidation.isValid === false) {
      throw new Error(`Architecture validation failed: ${archValidation.errors.join(', ')}`);
    }

    // Phase 2: Generate File Structure
 console.log('Phase 2: Generating file structure...');
    const fileStructureResult = await generateFileStructureWithRetry(
      {
        prd: input.prd,
        architecture: context.architecture,
        specifications: context.specifications!,
      },
      options
    );
    
    context.fileStructure = fileStructureResult.fileStructure;

    // Validate file structure phase
    const fileValidation = validateFileStructurePhase(context);
    validationResults.push(fileValidation);

    if (fileValidation.isValid === false) {
      throw new Error(`File structure validation failed: ${fileValidation.errors.join(', ')}`);
    }

    // Phase 3: Generate Tasks
 console.log('Phase 3: Generating tasks...');
    const tasksResult = await generateTasksWithRetry(
      {
        architecture: context.architecture,
        specifications: context.specifications!,
        fileStructure: context.fileStructure!,
      },
      options
    );
    
    context.tasks = tasksResult.tasks.map((task, index) => ({
      ...task,
      details: '', // Will be populated during research phase
    }));

    // Validate tasks against architecture and file structure
    const tasksValidation = validateTasksAgainstContext(context);
    validationResults.push(tasksValidation);

    if (tasksValidation.isValid === false) {
      console.warn('Task validation warnings:', tasksValidation.warnings);
    }

    // Phase 4: Build Dependency Graph
 console.log('Phase 4: Building dependency graph...');
    const dependencyGraph = new TaskDependencyGraph(context.tasks);
    context.dependencyGraph = buildSimpleDependencyMap(dependencyGraph);

    // Validate dependency graph
    const depValidation = dependencyGraph.validate();
    validationResults.push(depValidation);

    if (depValidation.isValid === false) {
      throw new Error(`Dependency graph validation failed: ${depValidation.errors.join(', ')}`);
    }

    // Phase 5: Research Tasks with Dependency Awareness
 console.log('Phase 5: Researching tasks with dependency awareness...');
    await researchTasksWithDependencies(context, options);

    // Final validation
    const finalValidation = validateCompleteProjectPlan(context);
    validationResults.push(finalValidation);

 console.log('Unified project generation completed successfully.');
    
    return {
      context,
      validationResults,
    };

  } catch (error) {
 console.error('Unified project generation failed:', error);
    
    // Add final validation result with errors
    const errorValidation: ValidationResult = {
      isValid: false,
      errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
      warnings: [],
      timestamp: new Date(),
    };
    
    validationResults.push(errorValidation);
    
    // Re-throw the error for handling by caller
    throw new Error(`Unified project generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generates architecture with retry logic
 */
async function generateArchitectureWithRetry(
  input: GenerateArchitectureInput,
  options?: UnifiedGenerationOptions
) {
  const maxRetries = options?.maxRetries || 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateArchitecture(
        input,
        options?.apiKey,
        options?.model
      );
    } catch (error) {
      console.error(`Architecture generation attempt ${attempt}/${maxRetries} failed:`, error);
      
      if (attempt === maxRetries) {
        throw new Error(`Failed to generate architecture after ${maxRetries} attempts`);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  throw new Error('Architecture generation failed');
}

/**
 * Generates file structure with retry logic
 */
async function generateFileStructureWithRetry(
  input: GenerateFileStructureInput,
  options?: UnifiedGenerationOptions
) {
  const maxRetries = options?.maxRetries || 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateFileStructure(
        input,
        options?.apiKey,
        options?.model
      );
    } catch (error) {
      console.error(`File structure generation attempt ${attempt}/${maxRetries} failed:`, error);
      
      if (attempt === maxRetries) {
        throw new Error(`Failed to generate file structure after ${maxRetries} attempts`);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  throw new Error('File structure generation failed');
}

/**
 * Generates tasks with retry logic
 */
async function generateTasksWithRetry(
  input: GenerateTasksInput,
  options?: UnifiedGenerationOptions
) {
  const maxRetries = options?.maxRetries || 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateTasks(
        input,
        options?.apiKey,
        options?.model,
        options?.useTDD
      );
    } catch (error) {
      console.error(`Task generation attempt ${attempt}/${maxRetries} failed:`, error);
      
      if (attempt === maxRetries) {
        throw new Error(`Failed to generate tasks after ${maxRetries} attempts`);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  throw new Error('Task generation failed');
}

/**
 * Researches tasks with dependency awareness
 */
async function researchTasksWithDependencies(
  context: UnifiedProjectContext,
  options?: UnifiedGenerationOptions
) {
  const researcher = new DependencyAwareTaskResearcher(context);
  const researchOrder = researcher.getResearchOrder();
  
 console.log(`Researching ${context.tasks.length} tasks in dependency-aware order...`);
  
  for (let i = 0; i < researchOrder.length; i++) {
    const taskIndex = researchOrder[i];
    const taskId = `task-${taskIndex + 1}`;
    
 console.log(`Researching task ${i + 1}/${researchOrder.length}: "${context.tasks[taskIndex].title}"`);
    
    try {
      const completedTasks = new Set(
        Array.from(context.researchedTasks.keys()).map(id => 
          parseInt(id.replace('task-', '')) - 1
        ).filter(index => index < taskIndex)
      );
      
      const researchResult = await researcher.researchTaskWithDependencies(
        taskId,
        taskIndex,
        completedTasks,
        new TaskDependencyGraph(context.tasks.slice(0, taskIndex + 1))
      );
      
      // Store research result
      context.researchedTasks.set(taskId, researchResult);
      
      // Update task with formatted details
      const formattedDetails = `### Context\n${researchResult.context}\n\n### Implementation Steps\n${researchResult.implementationSteps}\n\n### Acceptance Criteria\n${researchResult.acceptanceCriteria}`;
      context.tasks[taskIndex].details = formattedDetails;
      
    } catch (error) {
 console.error(`Failed to research task "${context.tasks[taskIndex].title}":`, error);
      
      // Set error details for the task
      context.tasks[taskIndex].details = `Failed to research task: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}

/**
 * Builds a simple dependency map for compatibility
 */
function buildSimpleDependencyMap(dependencyGraph: TaskDependencyGraph): Map<string, string[]> {
  const simpleMap = new Map<string, string[]>();
  
  // Get execution order and build dependencies
  try {
    const executionOrder = dependencyGraph.getExecutionOrder();
    
    for (let i = 0; i < executionOrder.length; i++) {
      const taskId = executionOrder[i];
      simpleMap.set(taskId, []);
    }
  } catch (error) {
    // If there are circular dependencies, use a simple linear approach
 console.warn('Circular dependency detected, using simple mapping:', error);
    
    for (let i = 0; i < dependencyGraph['getExecutionOrder'].length || 10; i++) {
      const taskId = `task-${i + 1}`;
      simpleMap.set(taskId, []);
    }
  }
  
  return simpleMap;
}

/**
 * Validates architecture generation phase
 */
function validateArchitecturePhase(context: UnifiedProjectContext): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!context.architecture || context.architecture.trim().length === 0) {
    errors.push('Architecture is empty');
  }

  if (!context.specifications || context.specifications.trim().length === 0) {
    errors.push('Specifications are empty');
  }

  if (context.architecture && context.prd) {
    // Check if architecture is responsive to the PRD
    const prdKeywords = extractKeyWords(context.prd);
    const hasPrdCoverage = prdKeywords.some(keyword => 
      context.architecture!.toLowerCase().includes(keyword)
    );

    if (!hasPrdCoverage) {
      warnings.push('Architecture may not fully address key requirements from PRD');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    timestamp: new Date(),
  };
}

/**
 * Validates file structure generation phase
 */
function validateFileStructurePhase(context: UnifiedProjectContext): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!context.fileStructure || context.fileStructure.trim().length === 0) {
    errors.push('File structure is empty');
  }

  if (context.architecture && context.fileStructure) {
    // Check consistency between architecture and file structure
    const archKeywords = extractKeyWords(context.architecture);
    const hasFileStructureCoverage = archKeywords.some(keyword => 
      context.fileStructure!.toLowerCase().includes(keyword)
    );

    if (!hasFileStructureCoverage) {
      warnings.push('File structure may not fully implement the proposed architecture');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    timestamp: new Date(),
  };
}

/**
 * Validates tasks against context
 */
function validateTasksAgainstContext(context: UnifiedProjectContext): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (context.tasks.length === 0) {
    errors.push('No tasks were generated');
  }

  if (context.architecture && context.tasks.length > 0) {
    // Check if task titles reference architectural components
    const archKeywords = extractKeyWords(context.architecture);
    
    for (const task of context.tasks) {
      const hasArchCoverage = archKeywords.some(keyword => 
        task.title.toLowerCase().includes(keyword)
      );

      if (!hasArchCoverage) {
        // Only warn, don't error - tasks might be valid even if not directly mentioning architecture
        warnings.push(`Task "${task.title}" may not directly reference architectural components`);
      }
    }
  }

  if (context.fileStructure && context.tasks.length > 0) {
    // Check for potential file-task mismatches
    const fileKeywords = extractKeyWords(context.fileStructure);
    
    for (const task of context.tasks) {
      const hasFileCoverage = fileKeywords.some(keyword => 
        task.title.toLowerCase().includes(keyword)
      );

      if (!hasFileCoverage) {
        warnings.push(`Task "${task.title}" may not align with proposed file structure`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    timestamp: new Date(),
  };
}

/**
 * Validates complete project plan
 */
function validateCompleteProjectPlan(context: UnifiedProjectContext): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if all required components are present
  if (!context.architecture) errors.push('Missing architecture');
  if (!context.specifications) errors.push('Missing specifications');  
  if (!context.fileStructure) errors.push('Missing file structure');
  if (context.tasks.length === 0) errors.push('No tasks generated');

  // Check research completeness
  const researchedCount = context.researchedTasks.size;
  if (researchedCount < context.tasks.length) {
    warnings.push(`${context.tasks.length - researchedCount} tasks not fully researched`);
  }

  // Cross-validate consistency
  if (context.architecture && context.fileStructure) {
    const archFiles = extractKeyWords(context.architecture);
    const fileStructKeywords = extractKeyWords(context.fileStructure);
    
    const missingFiles = archFiles.filter(keyword => 
      !fileStructKeywords.some(fileKeyword => keyword.includes(fileKeyword))
    );

    if (missingFiles.length > 0) {
      warnings.push('Some architectural components may not be reflected in file structure');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    timestamp: new Date(),
  };
}

/**
 * Extracts key words from text for validation
 */
function extractKeyWords(text: string): string[] {
  // Simple keyword extraction - in production, use more sophisticated NLP
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3 && !['this', 'that', 'with', 'from', 'they'].includes(word))
    .slice(0, 10); // Limit to top keywords
}


