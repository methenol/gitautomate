'use server';

import {
  generateArchitecture,
  GenerateArchitectureInput,
} from '@/ai/flows/generate-architecture';
import { generateTasks, GenerateTasksInput } from '@/ai/flows/generate-tasks';
import { researchTask, ResearchTaskInput, ResearchTaskOutput } from '@/ai/flows/research-task';
import { generateFileStructure, GenerateFileStructureInput } from '@/ai/flows/generate-file-structure';
import { generateAgentsMd, GenerateAgentsMdInput } from '@/ai/flows/generate-agents-md';
import { generateStandards, GenerateStandardsInput } from '@/ai/flows/generate-standards';

type ActionOptions = {
  apiKey?: string;
  model?: string;
  apiBase?: string;
  useTDD?: boolean;
  temperature?: number; // Temperature for LLM calls (0.0 - 2.0)
};

/**
 * Surface the underlying failure instead of replacing it.
 *
 * These handlers used to collapse every fault into "the model may have returned an
 * unexpected response", which sent people hunting for prompt bugs when the real cause was
 * a refused connection or a transport timeout.
 */
function describeFailure(step: string, error: unknown, hint?: string): Error {
  const detail = error instanceof Error ? error.message : String(error);

  if (
    detail.includes('API key not found') ||
    detail.includes('API key is invalid') ||
    detail.includes('Please check your LLM API key')
  ) {
    return new Error(`${step} failed: your LLM API key is missing or invalid. Please check it in settings.`);
  }

  return new Error(`${step} failed: ${detail}${hint ? ` ${hint}` : ''}`);
}

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
      options?.model,
      options?.apiBase,
      options?.temperature
    );
    return result;
  } catch (error) {
    console.error('Error generating architecture:', error);
    throw describeFailure('Architecture generation', error);
  }
}

/**
 * Generates the engineering standards and quality gates for the project.
 *
 * Runs once per project, between the architecture and the task plan: its gate
 * commands are injected into every task file so the whole plan verifies itself the
 * same way.
 */
export async function runGenerateStandards(
  input: GenerateStandardsInput,
  options?: ActionOptions
) {
  if (!input.architecture || !input.specifications) {
    throw new Error('Architecture and specifications are required to generate standards.');
  }
  try {
    return await generateStandards(
      input,
      options?.apiKey,
      options?.model,
      options?.apiBase,
      options?.useTDD,
      options?.temperature
    );
  } catch (error) {
    console.error('Error generating standards:', error);
    throw describeFailure('Standards generation', error);
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
    const result = await generateTasks(input, options?.apiKey, options?.model, options?.apiBase, options?.useTDD, options?.temperature);
    return result;
  } catch (error) {
    console.error('Error generating tasks:', error);
    throw describeFailure('Task planning', error);
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
      options?.model,
      options?.apiBase,
      options?.temperature
    );
    return result;
  } catch (error) {
    console.error('Error generating file structure:', error);
    throw describeFailure('File structure generation', error);
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
      const result = await researchTask(input, options?.apiKey, options?.model, options?.apiBase, options?.useTDD, options?.temperature);
      return result;
    } catch (error) {
      console.error(
        `Error researching task "${input.title}" (Attempt ${i + 1}/${MAX_RETRIES}):`,
        error
      );
      if (i === MAX_RETRIES - 1) {
        throw describeFailure(
          `Research for task "${input.title}" (after ${MAX_RETRIES} attempts)`,
          error,
          'Try a different model if this persists.'
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
  if (!input.prd || !input.architecture || !input.specifications || !input.fileStructure || !input.taskNames || input.taskNames.length === 0) {
    throw new Error(
      'PRD, architecture, specifications, file structure, and task names are required to generate AGENTS.md content.'
    );
  }
  try {
    const result = await generateAgentsMd(
      input,
      options?.apiKey,
      options?.model,
      options?.apiBase,
      options?.temperature
    );
    return result;
  } catch (error) {
    console.error('Error generating AGENTS.md content:', error);
    throw describeFailure('AGENTS.md generation', error);
  }
}


