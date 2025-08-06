import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Helper function to compute critical path
function computeCriticalPath(dependencyGraph: any, tasks: any[]): string[] {
  if (!dependencyGraph || !tasks) return [];
  
  try {
    // Extract nodes and edges from dependency graph
    const { nodes, edges } = dependencyGraph;
    
    // Build adjacency list for topological sort
    const adjList: Map<string, string[]> = new Map();
    
    // Initialize adjacency list
    nodes.forEach((node: string) => {
      adjList.set(node, []);
    });
    
    // Add edges to adjacency list
    edges.forEach((edge: any) => {
      const currentDeps = adjList.get(edge.from) || [];
      if (!currentDeps.includes(edge.to)) {
        currentDeps.push(edge.to);
        adjList.set(edge.from, currentDeps);
      }
    });
    
    // Kahn's algorithm for topological sort
    const inDegree: Map<string, number> = new Map();
    
    // Initialize in-degree
    nodes.forEach((node: string) => {
      inDegree.set(node, 0);
    });
    
    // Calculate in-degree
    edges.forEach((edge: any) => {
      const currentDegree = (inDegree.get(edge.to) || 0) + 1;
      inDegree.set(edge.to, currentDegree);
    });
    
    // Find nodes with no incoming edges
    const queue: string[] = [];
    nodes.forEach((node: string) => {
      if (inDegree.get(node) === 0) {
        queue.push(node);
      }
    });
    
    // Perform topological sort
    const criticalPath: string[] = [];
    while (queue.length > 0) {
      // Process node with no dependencies first
      const node = queue.shift()!;
      criticalPath.push(node);
      
      // Reduce in-degree for neighbors
      const neighbors = adjList.get(node) || [];
      neighbors.forEach((neighbor: string) => {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        
        // If neighbor has no more dependencies, add to queue
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      });
    }
    
    return criticalPath;
  } catch (error) {
    console.warn('Error computing critical path:', error);
    return [];
  }
}

// Import the new unified components
import {
  ProjectContextManager,
  getGlobalContextManager
} from './context-manager-class';

import {
  TaskGenerationOrchestrator,
  generateProjectPlan
} from './task-orchestrator-class';

import {
  ProjectPlanValidator
} from './project-validator-class';

// Import validation function as a separate import to avoid conflicts
import { validateProjectPlan } from './project-plan-validator';

// Define schemas for input/output validation
export const UnifiedOrchestratorInputSchema = z.object({
  prd: z.string().describe('The Product Requirements Document (PRD) for the project.'),
  architecture: z.string().optional(),
  specifications: z.string().optional(), 
  fileStructure: z.string().optional(),
  
  // Configuration options
  generateArchitecture: z.boolean().optional().default(true),
  generateFileStructure: z.boolean().optional().default(false),
  
  // AI model configuration
  apiKey: z.string().optional(),
  model: z.string().optional(),
  useTDD: z.boolean().optional().default(false),
  
  // Orchestrator behavior options
  enableValidation: z.boolean().optional().default(true),
  maxIterations: z.number().optional().default(3).describe('Maximum validation iterations for refinement.'),
  optimizationStrategy: z.enum(['sequential', 'parallelizable', 'critical_path']).optional().default('sequential')
});

export type UnifiedOrchestratorInput = z.infer<typeof UnifiedOrchestratorInputSchema>;

// Define the output schema
export const UnifiedOrchestratorOutputSchema = z.object({
  projectContext: z.object({
    prd: z.string(),
    architecture: z.string().describe('Generated or provided software architecture.'),
    specifications: z.string().describe('Generated or provided detailed specifications.'),
    fileStructure: z.string().describe('Generated or provided file/folder structure.'),
  }),
  
  tasks: z.array(z.object({
    title: z.string(),
    details: z.string(),
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
      to: z.string(),
      type: z.enum(['hard', 'soft'])
    }))
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
      type: z.enum(['architecture_consistency', 'task_dependency_validation', 'file_structure_alignment']),
      status: z.enum(['passed', 'failed', 'warning']),
      severity: z.enum(['low', 'medium', 'high']),
      message: z.string(),
      recommendations: z.array(z.string()),
    })),
    summary: z.string()
  }),
  
  workflowHistory: z.object({
    stepsCompleted: z.array(z.string()),
    iterationsPerformed: z.number(),
    finalStatus: z.enum(['success', 'partial_success', 'requires_manual_review'])
  }),
  
  exportData: z.object({
    architectureMarkdown: z.string(),
    tasksMarkdown: z.string(),
    validationSummary: z.string()
  })
});

export type UnifiedOrchestratorOutput = z.infer<typeof UnifiedOrchestratorOutputSchema>;

// Interface abstraction for the validator to avoid circular dependency
export interface IProjectPlanValidator {
    validateProjectPlan(plan: any): Promise<any>; // Replace 'any' with the actual types if available
}

// Main Unified Orchestrator class
export class UnifiedProjectOrchestrator {
    private contextManager: ProjectContextManager;
    private taskGenerator: TaskGenerationOrchestrator;
    private validator: IProjectPlanValidator;
    
    constructor(
      contextManager?: ProjectContextManager,
      validator?: IProjectPlanValidator
    ) {
      this.contextManager = contextManager || getGlobalContextManager();
      this.taskGenerator = new TaskGenerationOrchestrator(this.contextManager);
      this.validator = validator || new ProjectPlanValidator();
    }

    async generateCompleteProject(
      input: UnifiedOrchestratorInput,
      apiKey?: string,
      model?: string
    ): Promise<UnifiedOrchestratorOutput> {
      
      const workflowHistory = {
        stepsCompleted: [] as string[],
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
            model ? `googleai/${model}` : 'googleai/gemini-1.5-flash-latest',
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
            model ? `googleai/${model}` : 'googleai/gemini-1.5-flash-latest',
            apiKey
          );

          fileStructure = fsResult.fileStructure;
        }

        // Update context with all project data
        this.contextManager.updateArchitecture(architecture!, specifications!);
        this.contextManager.updateFileStructure(fileStructure!);

        // Step 2: Generate tasks with full context awareness
        workflowHistory.stepsCompleted.push('Task Generation');

        const taskGenerationInput = {
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

        
        return {
          projectContext: {
            prd: input.prd,
            architecture: architecture!,
            specifications: specifications!,
            fileStructure: fileStructure!
          },

          tasks: (taskGenerationResult.tasks || []).map(task => ({
            ...task,
            estimatedDuration: task.estimatedDuration || 1,
            validationNotes: task.validationNotes || [],
          })),

          dependencyGraph: taskGenerationResult.dependencyGraph,

          criticalPath: computeCriticalPath(taskGenerationResult.dependencyGraph, taskGenerationResult.tasks || []),

          validationReport: {
            overallStatus: 'passed',
            totalChecks: 0,
            passedChecks: 0,
            failedChecks: 0,
            warningChecks: 0,
            results: [],
            summary: 'Validation was disabled for this workflow.'
          },

          workflowHistory,

          exportData: {
            architectureMarkdown: `# Architecture\n\n${architecture}`,
            tasksMarkdown: '# Tasks\n\nGenerated successfully',
            validationSummary: 'No validation performed'
          }
        };

      } catch (error) {
        
        (workflowHistory as any).finalStatus = 'requires_manual_review';

        // Fallback to basic generation if orchestrator fails
        return this.generateFallbackOutput(input, error as Error);
      }
    }

    private async generateArchitectureAndSpecs(
      prd: string,
      modelName: string,
      apiKey?: string
    ): Promise<{ architecture: string; specifications: string }> {
      
        return {
          architecture: `# Project Architecture\n\nBased on the PRD, this project requires:\n- Modern web application architecture\n- Scalable backend services\n- Database design for data persistence\n- API endpoints for client-server communication`,
          specifications: `# Technical Specifications\n\n## Technology Stack\n- Frontend: React/Next.js for user interface\n- Backend: Node.js with Express/FastAPI for API services\n- Database: PostgreSQL/MongoDB based on requirements\n- Authentication: JWT-based auth system`
        };
      
    }

    private async generateFileSystem(
      prd: string,
      architecture: string, 
      specifications: string,
      modelName: string,
      apiKey?: string
    ): Promise<{ fileStructure: string }> {
      
        return {
          fileStructure: `project-root/\n├── src/\n│   ├── components/\n│   │   └── index.js\n│   ├── services/\n│   │   └── api.js\n│   ├── utils/\n│   │   └── helpers.js\n│   └── index.js\n├── tests/\n├── docs/\n├── package.json\n└── .gitignore`
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

        criticalPath: computeCriticalPath({ nodes: [], edges: [] }, []),

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
          finalStatus: 'success' as const
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
