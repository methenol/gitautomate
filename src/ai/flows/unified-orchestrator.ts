

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

import { z } from 'genkit';

// Import the new unified components and orchestrator class
import {
  UnifiedProjectOrchestrator 
} from './unified-orchestrator-class';

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
    specificationsMarkdown: z.string().optional(),
    fileStructureMarkdown: z.string().optional(),
    tasksMarkdown: z.string().optional(),
    validationSummary: z.string()
  })
});

export type UnifiedOrchestratorOutput = z.infer<typeof UnifiedOrchestratorOutputSchema>;

// Export the main unified generation function
export async function generateCompleteProject(
  input: UnifiedOrchestratorInput,
  apiKey?: string,
  model?: string
): Promise<UnifiedOrchestratorOutput> {
  
  const orchestrator = new UnifiedProjectOrchestrator();
  return orchestrator.generateCompleteProject(input, apiKey, model);
}
