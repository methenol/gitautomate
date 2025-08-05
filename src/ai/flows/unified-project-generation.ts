

'use server';

/**
 * @fileOverview Unified Project Generation Flow - Replaces siloed individual flows
 *
 * This flow provides a comprehensive, interconnected approach to project generation:
 * - Single source of truth for all project data
 * - Context-aware task generation with dependency modeling  
 * - Iterative validation and refinement loops
 * - Complete workflow orchestration
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  UnifiedProjectContext,
  ProjectPlan,
  EnhancedTask,
  ValidationResult,
  ValidationResultItem
} from '@/types/unified-project';
import { taskGenerationOrchestrator } from '@/lib/task-generation-orchestrator';
import { taskResearchEngine } from '@/lib/task-research-engine';
import { projectPlanValidator, unifiedContextManager } from '@/lib/unified-context-manager';

const UnifiedProjectGenerationInputSchema = z.object({
  prd: z
    .string()
    .describe('The Product Requirements Document (PRD) to generate the complete project plan from.'),
  apiKey: z.string().optional(),
  model: z.string().default('googleai/gemini-1.5-flash-latest'),
  useTDD: z.boolean().default(false),
});
export type UnifiedProjectGenerationInput = z.infer<typeof UnifiedProjectGenerationInputSchema>;

const UnifiedProjectGenerationOutputSchema = z.object({
  projectPlan: z
    .any()
    .describe('The complete unified project plan with architecture, file structure, and tasks.'),
  validationResults: z
    .array(z.object({
      type: z.enum(['consistency', 'completeness', 'dependency']),
      message: z.string(),
      severity: z.enum(['info', 'warning', 'error'])
    }))
    .describe('Validation results from cross-component analysis.'),
  researchProgress: z
    .number()
    .min(0)
    .max(100)
    .default(0)
    .describe('Progress percentage for task research phase.'),
  executionOrder: z
    .array(z.string())
    .describe('Optimal task execution order based on dependencies.'),
  contextVersion: z
    .string()
    .describe('Version identifier for the project context.'),
});
export type UnifiedProjectGenerationOutput = z.infer<typeof UnifiedProjectGenerationOutputSchema>;

/**
 * Generate complete unified project plan with interconnected architecture
 */
export async function generateUnifiedProject(
  input: UnifiedProjectGenerationInput,
  options?: { researchTasks?: boolean; validatePlan?: boolean }
): Promise<UnifiedProjectGenerationOutput> {
  
  const { prd, apiKey = '', model = 'googleai/gemini-1.5-flash-latest', useTDD } = input;
  
  try {
    // Step 1: Initialize unified context manager and generate core components
    console.log('Initializing project context...');
    
    const context = await unifiedContextManager.initializeProject(prd);
    
    // Step 2: Generate architecture and specifications (replaces separate flows)
    console.log('Generating unified project plan...');
    
    const architecturePrompt = `You are a senior software architect. Based on the following Product Requirements Document, generate comprehensive architecture and specifications.

PRD:
${prd}

**Architecture Requirements:**
- Provide a detailed technical architecture that addresses all requirements
- Include technology stack decisions, patterns, and architectural principles  
- Consider scalability, maintainability, and best practices
- Address any technical challenges or constraints mentioned in the PRD

**Specifications Requirements:**  
- Create detailed functional and non-functional specifications
- Define clear acceptance criteria for major features
- Include data models, APIs, and integration points if applicable
- Address security, performance, and reliability requirements

**Output Format:**
Respond with ONLY a valid JSON object containing:
{
  "architecture": "<detailed technical architecture>",
  "specifications": "<comprehensive specifications>"
}`;

    const { output: archOutput } = await ai.generate({
      model,
      prompt: architecturePrompt,
      config: apiKey ? { apiKey } : undefined
    });

    if (!archOutput?.architecture || !archOutput?.specifications) {
      throw new Error('Failed to generate architecture and specifications');
    }

    // Update context with generated components
    await unifiedContextManager.updateArchitecture(
      archOutput.architecture, 
      archOutput.specifications
    );

    // Step 3: Generate file structure (context-aware)
    console.log('Generating project file structure...');
    
    const fileStructurePrompt = `You are a senior software architect. Based on the following PRD, architecture, and specifications, generate a comprehensive file/folder structure for the project.

PRD:
${prd}

Architecture:
${archOutput.architecture}

Specifications:  
${archOutput.specifications}

**File Structure Requirements:**
- Create a complete, logical file/folder structure that implements the architecture
- Follow industry best practices for the technology stack identified
- Include all necessary directories, configuration files, and entry points
- Organize components by function (source code, tests, docs, configs)
- Make the structure easily human-editable and maintainable

**Output Format:**
Respond with ONLY a valid JSON object containing:
{
  "fileStructure": "<detailed file/folder structure as markdown tree or JSON>"
}`;

    const { output: fsOutput } = await ai.generate({
      model,
      prompt: fileStructurePrompt, 
      config: apiKey ? { apiKey } : undefined
    });

    if (!fsOutput?.fileStructure) {
      throw new Error('Failed to generate file structure');
    }

    // Update context with file structure
    await unifiedContextManager.updateFileStructure(fsOutput.fileStructure);

    // Step 4: Generate enhanced project plan with dependencies
    console.log('Generating unified task plan...');
    
    const currentContext = unifiedContextManager.getContext();
    if (!currentContext) {
      throw new Error('Failed to retrieve project context');
    }

    const enhancedTasks = await taskGenerationOrchestrator.generateProjectPlan(currentContext);
    
    // Update context with generated tasks
    await unifiedContextManager.generateTasks(
      Object.values(enhancedTasks.dependencyGraph.tasks).map(task => ({ ...task }))
    );

    // Step 5: Cross-validate the complete workflow
    console.log('Validating project plan...');
    
    const validationResults = enhancedTasks.validationResults;
    
    // Add additional validation if requested
    if (options?.validatePlan !== false) {
      const workflowValidation = await projectPlanValidator.validateCompleteWorkflow(enhancedTasks);
      
      // Convert validation results to our format
      if (!workflowValidation.isValid) {
        workflowValidation.errors.forEach(error => {
          validationResults.push({
            type: 'consistency',
            message: error,
            severity: 'error'
          });
        });
      }
      
      workflowValidation.warnings.forEach(warning => {
        validationResults.push({
          type: 'consistency',
          message: warning,
          severity: 'warning'
        });
      });
    }

    // Step 6: Research tasks if requested (context-aware)
    let researchProgress = 0;
    
    if (options?.researchTasks !== false && enhancedTasks.executionOrder.length > 0) {
      console.log('Researching tasks with full context...');
      
      const allTasks = unifiedContextManager.getAllTasks();
      const completedTaskIds = new Set<string>();
      
      // Research tasks in optimal execution order
      for (let i = 0; i < enhancedTasks.executionOrder.length; i++) {
        const taskId = enhancedTasks.executionOrder[i];
        
        try {
          const researchedTask = await taskResearchEngine.researchTaskWithDependencies(
            taskId,
            currentContext,
            completedTaskIds,
            enhancedTasks.dependencyGraph
          );
          
          // Update the task in context with research results
          await unifiedContextManager.updateTaskResearch(
            taskId,
            researchedTask.implementationSteps,
            researchedTask.acceptanceCriteria
          );
          
        } catch (error) {
          console.error(`Error researching task ${taskId}:`, error);
          
          // Set placeholder research for failed tasks
          await unifiedContextManager.updateTaskResearch(
            taskId,
            `Error researching task: ${error instanceof Error ? error.message : 'Unknown error'}`,
            ''
          );
        }
        
        // Update progress
        researchProgress = ((i + 1) / enhancedTasks.executionOrder.length) * 100;
        
        // Small delay to avoid rate limiting
        if (i < enhancedTasks.executionOrder.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Refresh the project plan with updated tasks
      const finalContext = unifiedContextManager.getProjectPlan();
      if (finalContext) {
        enhancedTasks.dependencyGraph.tasks = finalContext!.dependencyGraph.tasks;
      }
    }

    // Step 7: Generate final execution order with research context
    const updatedTasks = unifiedContextManager.getAllTasks();
    enhancedTasks.executionOrder = taskGenerationOrchestrator.optimizeDependencyOrdering(updatedTasks);
    
    // Step 8: Final validation
    const finalValidation = unifiedContextManager.getValidationResults();
    
    console.log('Project generation completed successfully');
    
    return {
      projectPlan: enhancedTasks,
      validationResults: [...validationResults, ...finalValidation],
      researchProgress,
      executionOrder: enhancedTasks.executionOrder,
      contextVersion: crypto.randomUUID()
    };

  } catch (error) {
    console.error('Error in unified project generation:', error);
    
    // Generate fallback response
    return {
      projectPlan: createFallbackProject(prd),
      validationResults: [{
        type: 'consistency',
        message: error instanceof Error ? error.message : 'Unknown generation error',
        severity: 'error'
      }],
      researchProgress: 0,
      executionOrder: [],
      contextVersion: crypto.randomUUID()
    };
  }
}

/**
 * Create fallback project plan when generation fails
 */
function createFallbackProject(prd: string): ProjectPlan {
  return {
    id: crypto.randomUUID(),
    context: {
      id: crypto.randomUUID(),
      prd,
      architecture: 'Basic project structure with essential components',
      specifications: 'Standard implementation requirements for the project',
      fileStructure: `
src/
  index.ts
  components/
    Component.tsx
styles/
  main.css  
tests/
  test.spec.ts
README.md`,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    dependencyGraph: {
      tasks: {},
      edges: []
    },
    validationResults: [{
      type: 'consistency',
      message: 'Fallback project created - full generation failed',
      severity: 'warning'
    }],
    executionOrder: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * Validate an existing project plan (standalone function)
 */
export async function validateProjectPlan(
  context: UnifiedProjectContext,
  plan: ProjectPlan
): Promise<ValidationResultItem[]> {
  
  try {
    const validation = await projectPlanValidator.validateCompleteWorkflow(plan);
    
    // Convert to our format
    return [
      ...validation.errors.map(error => ({
        type: 'consistency' as const,
        message: error,
        severity: 'error' as const
      })),
      ...validation.warnings.map(warning => ({
        type: 'consistency' as const,
        message: warning,
        severity: 'warning' as const
      }))
    ];
  } catch (error) {
    return [{
      type: 'consistency' as const,
      message: error instanceof Error ? error.message : 'Validation failed',
      severity: 'error' as const
    }];
  }
}

/**
 * Research a specific task in context of the complete project
 */
export async function researchTaskWithContext(
  taskId: string,
  planId: string,
  apiKey?: string
): Promise<EnhancedTask | null> {
  
  try {
    const projectPlan = unifiedContextManager.getProjectPlan();
    
    if (!projectPlan || projectPlan.id !== planId) {
      throw new Error('Project plan not found or ID mismatch');
    }

    const task = projectPlan.dependencyGraph.tasks[taskId];
    if (!task) {
      throw new Error(`Task ${taskId} not found in project plan`);
    }

    const completedTasks = Object.keys(projectPlan.dependencyGraph.tasks)
      .filter(id => id !== taskId);

    const researchedTask = await taskResearchEngine.researchTaskWithDependencies(
      taskId,
      projectPlan.context,
      new Set(completedTasks),
      projectPlan.dependencyGraph
    );

    // Update the task in context
    await unifiedContextManager.updateTaskResearch(
      taskId,
      researchedTask.implementationSteps,
      researchedTask.acceptanceCriteria
    );

    return researchedTask;

  } catch (error) {
    console.error('Error researching task in context:', error);
    
    // Return fallback
    const projectPlan = unifiedContextManager.getProjectPlan();
    if (!projectPlan) return null;

    const task = projectPlan.dependencyGraph.tasks[taskId];
    if (!task) return null;

    return {
      ...task,
      implementationSteps: `Error researching task: ${error instanceof Error ? error.message : 'Unknown error'}`,
      acceptanceCriteria: ''
    };
  }
}

/**
 * Get the current project status and health
 */
export async function getProjectStatus(planId?: string): Promise<{
  isValid: boolean;
  taskCount: number;
  validationResults: any[];
  contextVersion?: string;
}> {
  
  try {
    const projectPlan = planId ? 
      unifiedContextManager.getProjectPlan() : 
      unifiedContextManager.getContext();
    
    if (!projectPlan) {
      return {
        isValid: false,
        taskCount: 0,
        validationResults: [{
          type: 'consistency',
          message: 'No project plan found',
          severity: 'error'
        }]
      };
    }

    const validationResults = unifiedContextManager.getValidationResults();
    
    return {
      isValid: !validationResults.some(r => r.severity === 'error'),
      taskCount: (projectPlan as any).dependencyGraph ? Object.keys((projectPlan as any).dependencyGraph.tasks).length : 0,
      validationResults,
      contextVersion: projectPlan.id
    };

  } catch (error) {
    return {
      isValid: false,
      taskCount: 0,
      validationResults: [{
        type: 'consistency',
        message: error instanceof Error ? error.message : 'Unknown error',
        severity: 'error'
      }]
    };
  }
}

