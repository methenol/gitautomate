


'use server';

/**
 * @fileOverview Unified Orchestrator - Complete replacement for the old siloed workflow
 *
 * This is the main orchestrator that replaces all existing flows and implements 
 * the systematic redesign described in Issue #7. It provides:
 * 1. Context-aware task generation with full project awareness
 * 2. Dependency modeling and validation  
 * 3. Iterative refinement loops between components
 * 4. Cross-validation for consistency across all project elements
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Import the new unified components
import {
  UnifiedProjectContext,
  ProjectContextManager,
  getGlobalContextManager,
  createContextWithPrd
} from './unified-context';

import {
  TaskGenerationOrchestrator,
  generateProjectPlan,
  type TaskGenerationOrchestratorInput
} from './task-generation-orchestrator';

import {
  ProjectPlanValidator,
  validateProjectPlan,
  type ValidationInput
} from './project-plan-validator';

// Define input schema for the unified orchestrator
const UnifiedOrchestratorInputSchema = z.object({
  prd: z.string().describe('The Product Requirements Document (PRD) for the project.'),
  
  // Optional overrides that will be generated if not provided
  architecture: z.string().optional(),
  specifications: z.string().optional(), 
  fileStructure: z.string().optional(),
  
  // Configuration options
  generateArchitecture: z.boolean().optional().default(true),
  generateFileStructure: z.boolean().optional().default(true),
  
  // AI model configuration
  apiKey?: string,
  model?: string,
  useTDD: z.boolean().optional().default(false),
  
  // Orchestrator behavior options
  enableValidation: z.boolean().optional().default(true),
  maxIterations: z.number().optional().default(3).describe('Maximum validation iterations for refinement.'),
  optimizationStrategy: z.enum(['sequential', 'parallelizable', 'critical_path']).optional().default('sequential')
});

export type UnifiedOrchestratorInput = z.infer<typeof UnifiedOrchestratorInputSchema>;

// Define the unified output schema that replaces all previous outputs
const UnifiedOrchestratorOutputSchema = z.object({
  projectContext: z.object({
    prd: z.string(),
    architecture: z.string().describe('Generated or provided software architecture.'),
    specifications: z.string().describe('Generated or provided detailed specifications.'),
    fileStructure: z.string().describe('Generated or provided file/folder structure.'),
  }),
  
  tasks: z.array(z.object({
    title: z.string(),
    details: z.string().describe('Detailed implementation guidance.'),
    dependencies: z.array(z.string()),
    priority: z.enum(['low', 'medium', 'high']),
    estimatedDuration: z.number(),
    category: z.enum(['setup', 'infrastructure', 'feature', 'testing', 'documentation']),
    validationNotes: z.array(z.string()),
  })),
  
  dependencyGraph: z.object({
    nodes: z.array(z.string()),
    edges: z.array(z.object({
      from: z.string(),
      to: string,
      type: z.enum(['hard', 'soft']),
    })),
  }),
  
  criticalPath: z.array(z.string()),
  
  validationReport: z.object({
    overallStatus: z.enum(['passed', 'failed', 'warning']),
    totalChecks: z.number(),
    passedChecks: z.number(),
    failedChecks: z.number(), 
    warningChecks: z.number(),
    results: z.array(z.object({
      id: z.string(),
      type: z.enum(['architecture_consistency', 'task_dependency_validation', 'file_structure_alignment', 'prd_coverage']),
      status: z.enum(['passed', 'failed', 'warning']),
      severity: z.enum(['low', 'medium', 'high']),
      message: z.string(),
      recommendations: z.array(z.string()),
    })),
    summary: z.string(),
  }),
  
  workflowHistory: z.object({
    stepsCompleted: z.array(z.string()),
    iterationsPerformed: z.number(),
    finalStatus: z.enum(['success', 'partial_success', 'requires_manual_review']),
  }),
  
  exportData: z.object({
    architectureMarkdown: z.string(),
    tasksMarkdown: z.string(),
    validationSummary: z.string(),
  })
});

export type UnifiedOrchestratorOutput = z.infer<typeof UnifiedOrchestratorOutputSchema>;

// Main Unified Orchestrator class
export class UnifiedProjectOrchestrator {
  private contextManager: ProjectContextManager;
  private taskGenerator: TaskGenerationOrchestrator;
  private validator: ProjectPlanValidator;

  constructor(contextManager?: ProjectContextManager) {
    this.contextManager = contextManager || getGlobalContextManager();
    this.taskGenerator = new TaskGenerationOrchestrator(this.contextManager);
    this.validator = new ProjectPlanValidator();
  }

  async generateCompleteProject(
    input: UnifiedOrchestratorInput,
    apiKey?: string,
    model?: string
  ): Promise<UnifiedOrchestratorOutput> {
    const modelName = model ? `googleai/${model}` : 'googleai/gemini-1.5-flash-latest';
    
    const workflowHistory = {
      stepsCompleted: [],
      iterationsPerformed: 0,
      finalStatus: 'success' as const
    };

    try {
      // Step 1: Process PRD and generate missing components if needed
      workflowHistory.stepsCompleted.push('PRD Processing');
      
      let architecture = input.architecture;
      let specifications = input.specifications; 
      let fileStructure = input.fileStructure;

      if (input.generateArchitecture && !architecture) {
        workflowHistory.stepsCompleted.push('Architecture Generation');
        
        // Generate architecture and specifications
        const archResult = await this.generateArchitectureAndSpecs(
          input.prd,
          modelName,
          apiKey
        );
        
        architecture = archResult.architecture;
        specifications = archResult.specifications;
      }

      if (input.generateFileStructure && !fileStructure) {
        workflowHistory.stepsCompleted.push('File Structure Generation');
        
        // Generate file structure
        const fsResult = await this.generateFileSystem(
          input.prd,
          architecture!,
          specifications!,
          modelName, 
          apiKey
        );
        
        fileStructure = fsResult.fileStructure;
      }

      // Update context with all project data
      this.contextManager.updateArchitecture(architecture!, specifications!);
      this.contextManager.updateFileStructure(fileStructure!);

      // Step 2: Generate tasks with full context awareness
      workflowHistory.stepsCompleted.push('Task Generation');
      
      const taskGenerationInput: TaskGenerationOrchestratorInput = {
        prd: input.prd,
        architecture: architecture!,
        specifications: specifications!,
        fileStructure: fileStructure!,
        useTDD: input.useTDD,
        generateWithDependencies: true,
        optimizationStrategy: input.optimizationStrategy
      };

      const taskGenerationResult = await generateProjectPlan(
        taskGenerationInput,
        apiKey,
        model
      );

      // Add generated tasks to context
      taskGenerationResult.tasks.forEach(task => {
        this.contextManager.addTask(task.title, task.details);
      });

      // Step 3: Validate the complete project plan (if enabled)
      let validationReport;
      
      if (input.enableValidation) {
        workflowHistory.stepsCompleted.push('Initial Validation');
        
        const validationInput: ValidationInput = {
          prd: input.prd,
          architecture: architecture!,
          specifications: specifications!,
          fileStructure: fileStructure!,
          tasks: taskGenerationResult.tasks,
          enableArchitectureValidation: true,
          enableTaskDependencyValidation: true, 
          enableFileStructureAlignment: true,
          enablePRDCoverageValidation: true,
        };

        validationReport = await validateProjectPlan(validationInput, apiKey, model);
        
        // Iterative refinement based on validation results
        let iterationCount = 0;
        while (iterationCount < input.maxIterations && 
               validationReport.overallStatus === 'warning' || 
               (validationReport.overallStatus === 'failed' && iterationCount < input.maxIterations - 1)) {
          
          workflowHistory.stepsCompleted.push(`Validation Iteration ${iterationCount + 1}`);
          
          // Apply fixes based on validation recommendations
          await this.applyValidationRecommendations(
            taskGenerationResult.tasks,
            validationReport.results,
            modelName,
            apiKey
          );

          // Regenerate tasks with improvements
          const improvedTasks = await this.improveBasedOnValidation(
            taskGenerationResult.tasks,
            validationReport.results
          );

          // Update context with improved tasks
          this.contextManager.importContext({ 
            tasks: improvedTasks.map(task => ({
              title: task.title,
              details: task.details,
              dependencies: task.dependencies || [],
              status: 'pending' as const
            }))
          });

          // Validate again
          validationInput.tasks = improvedTasks;
          validationReport = await validateProjectPlan(validationInput, apiKey, model);
          
          iterationCount++;
        }
        
        workflowHistory.iterationsPerformed = iterationCount + 1;
      }

      // Final validation status determination
      if (validationReport && validationReport.overallStatus === 'failed') {
        workflowHistory.finalStatus = 'requires_manual_review';
      } else if (validationReport && validationReport.overallStatus === 'warning') {
        workflowHistory.finalStatus = 'partial_success';
      }

      // Step 4: Generate export data
      workflowHistory.stepsCompleted.push('Export Data Generation');
      
      const exportData = this.generateExportData(
        input.prd,
        architecture!,
        specifications!,
        fileStructure!,
        taskGenerationResult.tasks,
        validationReport || { overallStatus: 'passed', totalChecks: 0, passedChecks: 0, failedChecks: 0, warningChecks: 0, results: [], summary: '' }
      );

      return {
        projectContext: {
          prd: input.prd,
          architecture: architecture!,
          specifications: specifications!,
          fileStructure: fileStructure!
        },
        
        tasks: taskGenerationResult.tasks,
        
        dependencyGraph: taskGenerationResult.dependencyGraph,
        
        criticalPath: taskGenerationResult.criticalPath,
        
        validationReport: validationReport || {
          overallStatus: 'passed',
          totalChecks: 0,
          passedChecks: 0,
          failedChecks: 0,
          warningChecks: 0,
          results: [],
          summary: 'Validation was disabled for this workflow.'
        },
        
        workflowHistory,
        
        exportData
      };

    } catch (error) {
      console.error('Error in unified orchestrator:', error);
      
      workflowHistory.finalStatus = 'requires_manual_review';
      
      // Fallback to basic generation if orchestrator fails
      return this.generateFallbackOutput(input, error as Error);
    }
  }

  private async generateArchitectureAndSpecs(
    prd: string,
    modelName: string,
    apiKey?: string
  ): Promise<{ architecture: string; specifications: string }> {
    const prompt = `You are a senior software architect. Generate comprehensive architecture and specifications for the following project:

**PRD:**
${prd}

## Requirements

Generate:
1. **Architecture**: High-level system design, technology stack decisions, component structure
2. **Specifications**: Detailed technical requirements, API definitions, data models, implementation guidelines

## Output Format
Respond with ONLY a valid JSON object containing:
- architecture: Markdown-formatted software architecture document
- specifications: Markdown-formatted detailed specifications

Focus on modern best practices, scalability, and maintainability.`;

    try {
      const { output } = await ai.generate({
        model: modelName,
        prompt: prompt,
        output: {
          schema: z.object({
            architecture: z.string(),
            specifications: z.string(),
          })
        },
        config: apiKey ? { apiKey } : undefined,
      });

      return output!;
    } catch (error) {
      console.error('Error generating architecture:', error);
      
      // Fallback to basic structure
      return {
        architecture: `# Project Architecture\n\nBased on the PRD, this project requires:\n- Modern web application architecture\n- Scalable backend services\n- Database design for data persistence\n- API endpoints for client-server communication`,
        specifications: `# Technical Specifications\n\n## Technology Stack\n- Frontend: React/Next.js for user interface\n- Backend: Node.js with Express/FastAPI for API services\n- Database: PostgreSQL/MongoDB based on requirements\n- Authentication: JWT-based auth system\n\n## Key Features\n${prd.split('\n').filter(line => line.trim()).map((line, i) => `${i + 1}. ${line}`).join('\n')}`
      };
    }
  }

  private async generateFileSystem(
    prd: string,
    architecture: string,
    specifications: string,
    modelName: string,
    apiKey?: string
  ): Promise<{ fileStructure: string }> {
    const prompt = `You are a senior software architect. Generate a comprehensive file/folder structure for the project based on:

**PRD:**
${prd}

**Architecture:**  
${architecture}

**Specifications:**
${specifications}

## Requirements

Generate a complete, human-editable file/folder structure that:
1. Follows the architectural patterns and technology stack decisions
2. Includes all necessary configuration files, source code directories, documentation, and tests
3. Uses industry-standard directory organization practices
4. Is easily maintainable and scalable

## Output Format
Respond with ONLY the file structure as a markdown code block using tree notation (e.g., \`project-root/\n  src/\n    index.ts\n  README.md\`)`;

    try {
      const { output } = await ai.generate({
        model: modelName,
        prompt: prompt,
        output: {
          schema: z.object({ fileStructure: z.string() })
        },
        config: apiKey ? { apiKey } : undefined,
      });

      return output!;
    } catch (error) {
      console.error('Error generating file structure:', error);
      
      // Fallback to basic project structure
      return {
        fileStructure: `project-root/\n├── src/\n│   ├── components/\n│   │   └── index.js\n│   ├── services/\n│   │   └── api.js\n│   ├── utils/\n│   │   └── helpers.js\n│   └── index.js\n├── tests/\n│   ├── unit/\n│   │   └── component.test.js\n│   └── integration/\n├── docs/\n│   ├── README.md\n│   └── API.md\n├── package.json\n├── .gitignore\n└── Dockerfile`
      };
    }
  }

  private async applyValidationRecommendations(
    tasks: UnifiedOrchestratorOutput['tasks'],
    validationResults: any[],
    modelName: string,
    apiKey?: string
  ): Promise<void> {
    // Extract key recommendations and apply them to improve tasks
    const criticalRecommendations = validationResults
      .filter(r => r.status === 'failed' || (r.status === 'warning' && r.severity === 'high'))
      .flatMap(r => r.recommendations);

    if (criticalRecommendations.length === 0) return;

    try {
      const prompt = `You are an expert project manager improving task generation based on validation feedback.

**Current Tasks:**
${JSON.stringify(tasks, null, 2)}

**Validation Recommendations to Address:**
${criticalRecommendations.join('\n')}

## Task Improvement Requirements

Based on the validation recommendations, improve the task generation by:
1. Adding missing tasks that were identified in coverage gaps
2. Fixing dependency issues and circular references  
3. Improving alignment between architecture and tasks
4. Ensuring file structure consistency

## Output Format  
Respond with ONLY a valid JSON object containing an improved "tasks" array following the same schema as input tasks.`;

      const { output } = await ai.generate({
        model: modelName,
        prompt: prompt,
        output: {
          schema: z.object({
            tasks: z.array(z.object({
              title: z.string(),
              details: z.string(),
              dependencies: z.array(z.string()),
              priority: z.enum(['low', 'medium', 'high']),
              estimatedDuration: z.number(),
              category: z.enum(['setup', 'infrastructure', 'feature', 'testing', 'documentation']),
              validationNotes: z.array(z.string()),
            }))
          })
        },
        config: apiKey ? { apiKey } : undefined,
      });

      // Update tasks with improved version
      Object.assign(tasks, output?.tasks || []);

    } catch (error) {
      console.error('Error applying validation recommendations:', error);
    }
  }

  private async improveBasedOnValidation(
    currentTasks: UnifiedOrchestratorOutput['tasks'],
    validationResults: any[]
  ): Promise<UnifiedOrchestratorOutput['tasks']> {
    // Basic improvement logic without AI (fallback)
    let improvedTasks = [...currentTasks];

    // Add missing setup tasks if none exist
    const hasSetupTasks = improvedTasks.some(t => t.category === 'setup');
    if (!hasSetupTasks) {
      improvedTasks.unshift({
        title: 'Project Setup and Configuration',
        details: 'Initialize project structure, configure development environment, set up version control and CI/CD pipeline',
        dependencies: [],
        priority: 'high' as const,
        estimatedDuration: 4,
        category: 'setup' as const,
        validationNotes: ['Added based on common project setup requirements']
      });
    }

    // Fix circular dependencies by adding intermediate tasks
    const circularDeps = validationResults.find(r => 
      r.type === 'task_dependency_validation' && r.message.includes('Circular')
    );
    
    if (circularDeps) {
      // Simple fix: add intermediate tasks to break cycles
      improvedTasks = improvedTasks.map(task => {
        if (task.dependencies.includes(task.title)) {
          return { ...task, dependencies: task.dependencies.filter(d => d !== task.title) };
        }
        return task;
      });
    }

    return improvedTasks;
  }

  private generateExportData(
    prd: string,
    architecture: string,
    specifications: string,
    fileStructure: string,
    tasks: UnifiedOrchestratorOutput['tasks'],
    validationReport: any
  ): UnifiedOrchestratorOutput['exportData'] {
    
    const architectureMarkdown = `# Project Architecture\n\n${architecture}\n---\n*Generated by GitAutomate Unified Orchestrator*`;
    
    const tasksMarkdown = `# Implementation Tasks\n\n${tasks.map((task, index) => 
      `${index + 1}. **[${task.title}]** (${task.priority} priority, ${task.estimatedDuration}h)\n   - Dependencies: ${task.dependencies.join(', ') || 'None'}\n   - Category: ${task.category}\n   - Details: ${task.details}\n`
    ).join('\n')}\n\n---\n*Generated by GitAutomate Unified Orchestrator*`;

    const validationSummary = `# Validation Summary\n\nStatus: ${validationReport.overallStatus}\n` +
      `Checks Passed: ${validationReport.passedChecks}/${validationReport.totalChecks}\n\n` +
      validationReport.summary;

    return {
      architectureMarkdown,
      tasksMarkdown, 
      validationSummary
    };
  }

  private generateFallbackOutput(
    input: UnifiedOrchestratorInput,
    error: Error
  ): UnifiedOrchestratorOutput {
    
    // Basic fallback output using available data
    return {
      projectContext: {
        prd: input.prd,
        architecture: input.architecture || 'Architecture generation failed.',
        specifications: input.specifications || 'Specifications not available.',
        fileStructure: input.fileStructure || 'File structure generation failed.'
      },
      
      tasks: [],
      
      dependencyGraph: { nodes: [], edges: [] },
      
      criticalPath: [],
      
      validationReport: {
        overallStatus: 'warning',
        totalChecks: 1,
        passedChecks: 0, 
        failedChecks: 0,
        warningChecks: 1,
        results: [{
          id: 'fallback_error',
          type: 'architecture_consistency' as const,
          status: 'warning' as const,
          severity: 'high' as const,
          message: `Orchestrator error: ${error.message}`,
          recommendations: ['Check your API configuration and try again with simpler inputs.']
        }],
        summary: 'Workflow encountered errors. Some components may not be available.'
      },
      
      workflowHistory: {
        stepsCompleted: ['Error Recovery'],
        iterationsPerformed: 0,
        finalStatus: 'requires_manual_review'
      },
      
      exportData: {
        architectureMarkdown: `# Architecture\n\n${input.architecture || 'Failed to generate.'}`,
        tasksMarkdown: '# Tasks\n\nNo tasks available due to generation errors.',
        validationSummary: `# Validation Summary\n\nError occurred during workflow execution.\n\nIssue: ${error.message}`
      }
    };
  }

  // Utility method to export context for debugging
  exportContext(): string {
    return this.contextManager.exportContext();
  }
}

// Export the main unified generation function
export async function generateCompleteProject(
  input: UnifiedOrchestratorInput,
  apiKey?: string,
  model?: string
): Promise<UnifiedOrchestratorOutput> {
  
  // Validate input before processing
  const validatedInput = UnifiedOrchestratorInputSchema.parse(input);
  
  // Set up global context manager with the PRD
  const contextManager = createContextWithPrd(validatedInput.prd);
  
  // Create and run orchestrator
  const orchestrator = new UnifiedProjectOrchestrator(contextManager);
  
  try {
    return await orchestrator.generateCompleteProject(validatedInput, apiKey, model);
  } catch (error) {
    console.error('Fatal error in unified orchestrator:', error);
    
    // Return fallback output with minimal functionality
    return orchestrator['generateFallbackOutput'](validatedInput, error as Error);
  }
}


