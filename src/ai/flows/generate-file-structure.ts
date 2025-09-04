'use server';

/**
 * @fileOverview Genkit flow for generating a proposed file/folder structure for a software project.
 *
 * - generateFileStructure - Generates a comprehensive, human-editable file/folder structure based on PRD, architecture, and specifications.
 * - GenerateFileStructureInput - Input type: { prd: string, architecture: string, specifications: string }
 * - GenerateFileStructureOutput - Output type: { fileStructure: string }
 */

import { ai } from '@/ai/litellm';
import { z } from 'zod';

const GenerateFileStructureInputSchema = z.object({
  prd: z
    .string()
    .describe('The Product Requirements Document (PRD) for the project.'),
  architecture: z
    .string()
    .describe('The proposed software architecture for the project.'),
  specifications: z
    .string()
    .describe('The detailed specifications for the project.'),
});
export type GenerateFileStructureInput = z.infer<typeof GenerateFileStructureInputSchema>;

const GenerateFileStructureOutputSchema = z.object({
  fileStructure: z
    .string()
    .describe('A comprehensive, proposed file/folder structure for the project, formatted as a markdown code block or JSON tree.'),
});
export type GenerateFileStructureOutput = z.infer<typeof GenerateFileStructureOutputSchema>;

const fileStructurePrompt = `You are a senior software architect. Your task is to generate a comprehensive, proposed file and folder structure for a new software project, based on the following Product Requirements Document (PRD), architecture, and specifications.

**Instructions:**
- Carefully analyze the PRD, architecture, and specifications provided below.
- Propose a complete file/folder structure that reflects best practices for the project's stack and requirements.
- Include all major directories, key files, and any configuration or setup files that would be expected at project start.
- Use clear, descriptive names for folders and files.
- If relevant, group related components, utilities, and assets into logical subdirectories.
- Do not include implementation details or code—only the structure.
- Output the structure as:
  - A markdown code block using tree notation (e.g., \`project-root/\n  src/\n    index.ts\n  README.md\`)
- Make sure the output is easily human-editable and ready for further refinement.
- Do not add any explanations or commentary outside the code block or JSON tree.
- Make sure the proposed tree covers all aspects of the project, including testing, documentation, and configuration, as well as CI/CD if described in the documentation. Do not focus on just one aspect of the project, the folder structure is for the entire project.

**PRD:**
{{{prd}}}

**Architecture:**
{{{architecture}}}

**Specifications:**
{{{specifications}}}

Respond with ONLY the proposed file/folder structure as a markdown code block or JSON tree.
`;

export async function generateFileStructure(
  input: GenerateFileStructureInput,
  apiKey?: string,
  model?: string
): Promise<GenerateFileStructureOutput> {
  // Use model directly without provider prefix
  const modelName = model || 'gpt-4o';

  const prompt = fileStructurePrompt
    .replace('{{{prd}}}', input.prd)
    .replace('{{{architecture}}}', input.architecture)
    .replace('{{{specifications}}}', input.specifications);

  const { output } = await ai.generate<GenerateFileStructureOutput>({
    model: modelName,
    prompt: prompt,
    output: {
      schema: GenerateFileStructureOutputSchema,
    },
    config: apiKey ? { apiKey } : undefined,
  });

  if (!output) {
    throw new Error(
      'An unexpected response was received from the server.'
    );
  }
  return output;
}