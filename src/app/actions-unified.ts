


'use server';

/**
 * @fileOverview Unified Actions - New action functions that use the interconnected task generation system.
 *
 * These actions replace the old sequential workflow with the new unified, context-aware system
 * that addresses all issues mentioned in Issue #7.
 */

import {
  generateUnifiedProjectPlan,
  type UnifiedTaskGenerationInput,
  type UnifiedProjectPlanOutput
} from '@/ai/flows/unified-task-generation';
import { listAvailableModels } from '@/ai/genkit';

type ActionOptions = {
  apiKey?: string;
  model?: string;
  useTDD?: boolean;
};

/**
 * Generate complete project plan using the new unified system.
 * This replaces runGenerateArchitecture + runGenerateFileStructure + handleGenerateTasks
 */
export async function runUnifiedProjectPlanGeneration(
  input: UnifiedTaskGenerationInput,
  options?: ActionOptions
): Promise<UnifiedProjectPlanOutput> {
  
  if (!input.prd || input.prd.trim() === '') {
    throw new Error('PRD is required and cannot be empty.');
  }

  try {
    const result = await generateUnifiedProjectPlan(input);
    
    if (!result.success) {
      throw new Error(
        result.message || 
        'Project plan generation failed. Please check your input and try again.'
      );
    }

    return result;
  } catch (error) {
    console.error('Error generating unified project plan:', error);
    
    if (
      error instanceof Error &&
      (error.message.includes('API key not found') ||
        error.message.includes('API key is invalid') ||
        error.message.includes('Please check your Google AI API key'))
    ) {
      throw new Error(
        'Failed to generate project plan: Your Google AI API key is missing or invalid. Please check it in settings.'
      );
    }
    
    if (error instanceof Error && error.message.includes('validation')) {
      throw new Error(
        `Project plan validation failed: ${error.message}. The system detected inconsistencies in the generated components.`
      );
    }
    
    throw new Error(
      'Project plan generation failed. The AI model may have returned an unexpected response or the PRD may need refinement.'
    );
  }
}

/**
 * Get available models for unified generation
 */
export async function getUnifiedModels(options?: ActionOptions): Promise<string[]> {
  try {
    const models = await listAvailableModels(options?.apiKey);
    return models;
  } catch (error) {
    console.error('Failed to fetch models for unified generation:', error);
    
    if (error instanceof Error) {
      throw new Error(`Failed to fetch models: ${error.message}`);
    }
    
    throw new Error('An unknown error occurred while fetching available models.');
  }
}

/**
 * Validate a generated project plan
 */
export async function validateGeneratedProjectPlan(
  contextId: string,
  options?: ActionOptions
): Promise<{
  isValid: boolean;
  consistencyScore: number;
  errors: string[];
  warnings: string[];
}> {
  // This would integrate with the validation system
  // For now, return a basic structure
  
  try {
    // Placeholder for actual validation logic
    return {
      isValid: true,
      consistencyScore: 85,
      errors: [],
      warnings: ['Review suggested task ordering for optimal workflow'],
    };
  } catch (error) {
    throw new Error(
      `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Export unified project plan in various formats
 */
export async function exportUnifiedProjectPlan(
  contextId: string,
  format: 'json' | 'markdown' | 'zip'
): Promise<Blob> {
  
  try {
    // Placeholder implementation - would retrieve the actual plan
    const content = `Project Plan Export\nContext ID: ${contextId}\nFormat: ${format}`;
    
    switch (format) {
      case 'json':
        return new Blob([JSON.stringify({ contextId, content }, null, 2)], {
          type: 'application/json',
        });
        
      case 'markdown':
        return new Blob([content], {
          type: 'text/markdown',
        });
        
      case 'zip':
        // Would create a proper ZIP with all project files
        return new Blob([content], {
          type: 'application/zip',
        });
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  } catch (error) {
    throw new Error(
      `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get generation statistics and insights
 */
export async function getGenerationInsights(
  contextId: string
): Promise<{
  generationTimeMs: number;
  componentBreakdown: {
    architectureGenerationMs?: number;
    fileStructureGenerationMs?: number; 
    taskGenerationMs: number;
    validationTimeMs: number;
  };
  modelPerformance?: {
    tokenUsage: { inputTokens: number; outputTokens: number };
    costEstimate?: string;
  };
}> {
  
  try {
    // Placeholder implementation
    return {
      generationTimeMs: 45000,
      componentBreakdown: {
        architectureGenerationMs: 8000,
        fileStructureGenerationMs: 10000,
        taskGenerationMs: 20000,
        validationTimeMs: 7000,
      },
      modelPerformance: {
        tokenUsage: { inputTokens: 15000, outputTokens: 8000 },
      },
    };
  } catch (error) {
    throw new Error(
      `Failed to get insights: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}


