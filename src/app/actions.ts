'use server';

import {
  generateArchitecture,
  GenerateArchitectureInput,
} from '@/ai/flows/generate-architecture';
import { generateTasks, GenerateTasksInput } from '@/ai/flows/generate-tasks';
import { researchTask, ResearchTaskInput, ResearchTaskOutput } from '@/ai/flows/research-task';
import { generateFileStructure, GenerateFileStructureInput } from '@/ai/flows/generate-file-structure';
import { generateAgentsMd, GenerateAgentsMdInput } from '@/ai/flows/generate-agents-md';

type ActionOptions = {
  apiKey?: string;
  model?: string;
  useTDD?: boolean;
};

export async function runGenerateArchitecture(
  input: GenerateArchitectureInput,
  options?: ActionOptions
) {
  if (!input.prd) {
    throw new Error('PRD is required to generate architecture.');
  }
  try {
    const result = await generateArchitecture(
      input,
      options?.apiKey,
      options?.model
    );
    return result;
  } catch (error) {
    console.error('Error generating architecture:', error);
    if (
      error instanceof Error &&
      (error.message.includes('API key not found') ||
        error.message.includes('API key is invalid') ||
        error.message.includes('Please check your LLM API key'))
    ) {
      throw new Error(
        'Failed to generate architecture: Your LLM API key is missing or invalid. Please check it in settings.'
      );
    }
    throw new Error(
      'Architecture generation failed. The model may have returned an unexpected response. Try a different model or adjust the PRD.'
    );
  }
}

export async function runGenerateTasks(
  input: GenerateTasksInput,
  options?: ActionOptions
) {
  if (!input.architecture || !input.specifications || !input.fileStructure) {
    throw new Error(
      'Architecture, specifications, and file structure are required to generate tasks.'
    );
  }
  try {
    const result = await generateTasks(input, options?.apiKey, options?.model, options?.useTDD);
    return result;
  } catch (error) {
    console.error('Error generating tasks:', error);
    throw new Error(
      'Failed to generate tasks. The model may have returned an unexpected response.'
    );
  }
}

/**
 * Generates a proposed file/folder structure for a software project.
 * @param input - { prd, architecture, specifications }
 * @param options - { apiKey, model }
 * @returns { fileStructure: string }
 */
export async function runGenerateFileStructure(
  input: GenerateFileStructureInput,
  options?: ActionOptions
) {
  if (!input.prd || !input.architecture || !input.specifications) {
    throw new Error(
      'PRD, architecture, and specifications are required to generate the file structure.'
    );
  }
  try {
    const result = await generateFileStructure(
      input,
      options?.apiKey,
      options?.model
    );
    return result;
  } catch (error) {
    console.error('Error generating file structure:', error);
    if (
      error instanceof Error &&
      (error.message.includes('API key not found') ||
        error.message.includes('API key is invalid') ||
        error.message.includes('Please check your LLM API key'))
    ) {
      throw new Error(
        'Failed to generate file structure: Your LLM API key is missing or invalid. Please check it in settings.'
      );
    }
    throw new Error(
      'File structure generation failed. The model may have returned an unexpected response. Try a different model or adjust the PRD, architecture, or specifications.'
    );
  }
}

export async function runResearchTask(
  input: ResearchTaskInput,
  options?: ActionOptions
): Promise<ResearchTaskOutput> {
  if (!input.title || !input.architecture || !input.specifications || !input.fileStructure) {
    throw new Error(
      'Task title, architecture, specifications, and file structure are required for research.'
    );
  }

  const MAX_RETRIES = 3;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const result = await researchTask(input, options?.apiKey, options?.model, options?.useTDD);
      return result;
    } catch (error) {
      console.error(
        `Error researching task "${input.title}" (Attempt ${i + 1}/${MAX_RETRIES}):`,
        error
      );
      if (i === MAX_RETRIES - 1) {
        throw new Error(
          `Failed to research task "${input.title}" after ${MAX_RETRIES} attempts. The AI may have refused to answer or returned an invalid format. Please try a different model if the issue persists.`
        );
      }
      // Optional: wait a bit before retrying
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // This should not be reachable due to the throw inside the loop
  throw new Error(`Failed to research task "${input.title}".`);
}

export async function runGenerateAgentsMd(
  input: GenerateAgentsMdInput,
  options?: ActionOptions
) {
  if (!input.prd || !input.architecture || !input.specifications || !input.fileStructure) {
    throw new Error(
      'PRD, architecture, specifications, and file structure are required to generate AGENTS.md content.'
    );
  }
  try {
    const result = await generateAgentsMd(
      input,
      options?.apiKey,
      options?.model
    );
    return result;
  } catch (error) {
    console.error('Error generating AGENTS.md content:', error);
    if (
      error instanceof Error &&
      (error.message.includes('API key not found') ||
        error.message.includes('API key is invalid') ||
        error.message.includes('Please check your LLM API key'))
    ) {
      throw new Error(
        'Failed to generate AGENTS.md content: Your LLM API key is missing or invalid. Please check it in settings.'
      );
    }
    throw new Error(
      'AGENTS.md generation failed. The model may have returned an unexpected response.'
    );
  }
}


