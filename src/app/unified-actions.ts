'use server';

import { generateCompleteProjectPlan, UnifiedGenerationOptions, UnifiedGenerationResult } from '@/lib/unified-project-manager';

export async function generateUnifiedProjectPlan(
  prd: string,
  options: UnifiedGenerationOptions = {}
): Promise<UnifiedGenerationResult> {
  if (!prd?.trim()) {
    throw new Error('PRD is required to generate project plan.');
  }

  try {
    const result = await generateCompleteProjectPlan(prd, options);
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
    
    throw new Error(
      `Project plan generation failed: ${(error as Error).message}. The model may have returned an unexpected response. Try a different model or adjust the PRD.`
    );
  }
}