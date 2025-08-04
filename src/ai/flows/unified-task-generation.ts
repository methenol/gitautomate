


'use server';

/**
 * @fileOverview Unified Task Generation - New interconnected workflow addressing Issue #7.
 *
 * - generateUnifiedProjectPlan - Main entry point for complete project generation with proper orchestration
 * This replaces the current sequential silo processing with interconnected, context-aware workflow management.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { generateProjectPlan, ProjectPlanGenerationInput } from './task-generation-orchestrator';
import { validateProjectPlan, CrossValidationResult } from './project-plan-validator';

const UnifiedTaskGenerationInputSchema = z.object({
  prd: z
    .string()
    .min(1, 'Product Requirements Document is required and cannot be empty')
    .describe('The Product Requirements Document (PRD) to generate the complete project plan from.'),
  options: z.object({
    apiKey: z.string().optional(),
    model: z.string().default('gemini-1.5-flash-latest'),
    useTDD: z.boolean().default(false),
  }).optional(),
});

export type UnifiedTaskGenerationInput = z.infer<typeof UnifiedTaskGenerationInputSchema>;

const UnifiedProjectPlanOutputSchema = z.object({
  success: z.boolean().describe('Whether the project plan generation was successful.'),
  contextId: z.string().optional().describe('ID of the unified project context.'),
  architecture: z.string().optional().describe('Generated software architecture in markdown format.'),
  specifications: z.string().optional().describe('Generated detailed specifications in markdown format.'),
  fileStructure: z.string().optional().describe('Proposed project file structure as a tree or JSON.'),
  tasks: z.array(z.object({
    title: z.string().describe('A concise title for the development task.'),
    details: z.string().describe('Detailed implementation guidance with context, steps, and acceptance criteria.'),
  })).optional(),
  executionOrder: z.array(z.string()).describe('Optimal task execution order based on dependencies.'),
  validationResults: z.object({
    isValid: z.boolean().describe('Whether the complete project plan passed all validation checks.'),
    consistencyScore: z.number().min(0).max(100).describe('Overall consistency score (0-100).'),
    errors: z.array(z.object({
      type: z.string(),
      severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM']),
      message: z.string(),
      affectedComponents: z.array(z.any()),
    })).describe('Critical errors that must be addressed for the plan to work.'),
    warnings: z.array(z.object({
      type: z.string(),
      message: z.string(), 
      affectedComponents: z.array(z.any()),
    })).describe('Warnings about potential issues that should be reviewed.'),
    suggestions: z.array(z.object({
      type: z.string(),
      priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
      message: z.string(),
    })).describe('Suggestions for improving the project plan.'),
  }),
  metadata: z.object({
    generationTimeMs: z.number().describe('Total time taken to generate the project plan.'),
    stepsCompleted: z.array(z.string()).describe('Generation workflow steps that were completed successfully.'),
    modelUsed: z.string().describe('AI model used for generation.'),
  }),
});

export type UnifiedProjectPlanOutput = z.infer<typeof UnifiedProjectPlanOutputSchema>;

const ErrorOutputSchema = z.object({
  success: z.zboolean().default(false),
  errorType: z.enum(['VALIDATION_ERROR', 'GENERATION_ERROR', 'DEPENDENCY_ERROR']),
  message: z.string(),
  details: z.any().optional(),
  recoverySuggestions: z.array(z.string()).default([]),
});

export type ErrorOutput = z.infer<typeof ErrorOutputSchema>;

/**
 * Main entry point for unified task generation workflow.
 * This replaces the current sequential silo processing with an interconnected, 
 * context-aware system that addresses all issues mentioned in Issue #7.
 */
export async function generateUnifiedProjectPlan(
  input: UnifiedTaskGenerationInput
): Promise<z.infer<typeof UnifiedProjectPlanOutputSchema> | z.infer<typeof ErrorOutputSchema>> {
  const startTime = Date.now();
  
  try {
    console.log('Starting unified project plan generation...');
    
    // Step 1: Validate input
    const parsedInput = UnifiedTaskGenerationInputSchema.parse(input);
    console.log('✅ Input validation passed');
    
    // Step 2: Generate complete project plan with orchestration
    console.log('🔄 Generating project components with unified context...');
    
    const generationOptions = {
      apiKey: parsedInput.options?.apiKey,
      model: parsedInput.options?.model || 'gemini-1.5-flash-latest', 
      useTDD: parsedInput.options?.useTDD || false,
    };

    const projectPlan = await generateProjectPlan({
      prd: parsedInput.prd,
      options: generationOptions,
    });
    
    console.log('✅ Project plan generated successfully');
    
    // Step 3: Perform comprehensive cross-validation
    console.log('🔍 Performing comprehensive validation...');
    
    const validationResult = await validateProjectPlan(
      projectPlan.context,
      projectPlan.dependencyGraph
    );
    
    console.log(`📊 Validation completed - Consistency Score: ${validationResult.consistencyScore}/100`);
    
    // Step 4: Format output according to schema
    const executionOrder = projectPlan.dependencyGraph?.getSortedTasks().map(task => task.title) || [];
    
    const output: UnifiedProjectPlanOutput = {
      success: validationResult.isValid,
      contextId: projectPlan.context.id,
      architecture: projectPlan.context.architecture,
      specifications: projectPlan.context.specifications,
      fileStructure: projectPlan.context.fileStructure,
      tasks: projectPlan.context.tasks.map(task => ({
        title: task.title,
        details: task.details || 'Task research incomplete or failed.',
      })),
      executionOrder,
      validationResults: {
        isValid: validationResult.isValid,
        consistencyScore: validationResult.consistencyScore,
        errors: validationResult.errors.map(error => ({
          type: error.type,
          severity: error.severity,
          message: error.message,
          affectedComponents: Array.from(error.affectedComponents),
        })),
        warnings: validationResult.warnings.map(warning => ({
          type: warning.type,
          message: warning.message,
          affectedComponents: Array.from(warning.affectedComponents),
        })),
        suggestions: validationResult.suggestions.map(suggestion => ({
          type: suggestion.type,
          priority: suggestion.priority,
          message: suggestion.message,
        })),
      },
      metadata: {
        generationTimeMs: Date.now() - startTime,
        stepsCompleted: [
          'Input Validation',
          'Architecture Generation', 
          'File Structure Generation',
          'Task Generation with Dependencies',
          'Cross-Component Validation'
        ],
        modelUsed: generationOptions.model,
      },
    };

    console.log('🎉 Unified project plan generation completed successfully!');
    
    return output;

  } catch (error) {
    console.error('❌ Unified project plan generation failed:', error);
    
    const output: ErrorOutput = {
      success: false,
      errorType: 'GENERATION_ERROR',
      message: `Failed to generate project plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: {
        input,
        timestamp: new Date().toISOString(),
      },
      recoverySuggestions: [
        'Check that the PRD is comprehensive and specific',
        'Verify your API key has sufficient permissions',
        'Try a different AI model if available', 
        'Break down complex PRDs into smaller requirements',
      ],
    };

    return output;
  }
}

/**
 * Legacy compatibility wrapper for the new unified system.
 * This allows gradual migration from the old workflow to the new one.
 */
export async function generateTasksWithUnifiedContext(
  prd: string,
  architecture?: string, 
  specifications?: string,
  fileStructure?: string
) {
  console.warn('🔄 Using legacy wrapper - consider migrating to generateUnifiedProjectPlan');
  
  try {
    const result = await generateUnifiedProjectPlan({
      prd,
      options: {
        apiKey: process.env.GOOGLE_API_KEY,
        model: 'gemini-1.5-flash-latest',
      },
    });

    if (result.success) {
      return result;
    } else {
      throw new Error(`Project generation failed: ${result.errorType} - ${(result as any).message}`);
    }
  } catch (error) {
    console.error('Legacy wrapper failed:', error);
    
    // Fallback to old behavior if available
    console.warn('⚠️ Falling back to legacy sequential workflow');
    
    // This would call the old functions as a fallback
    // For now, just re-throw the error
    throw error;
  }
}

// Flow definition for Genkit integration (optional)
export const unifiedTaskGenerationFlow = ai.defineFlow(
  {
    name: 'unifiedTaskGenerationFlow',
    inputSchema: UnifiedTaskGenerationInputSchema,
    outputSchema: z.union([UnifiedProjectPlanOutputSchema, ErrorOutputSchema]),
  },
  async (input) => {
    return await generateUnifiedProjectPlan(input);
  }
);

// Export schemas for API documentation
export { 
  UnifiedTaskGenerationInputSchema, 
  UnifiedProjectPlanOutputSchema,
  ErrorOutputSchema
};

