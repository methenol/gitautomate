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
import { MarkdownLinter } from '@/services/markdown-linter';

const _GenerateFileStructureInputSchema = z.object({
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
export type GenerateFileStructureInput = z.infer<typeof _GenerateFileStructureInputSchema>;

const _GenerateFileStructureOutputSchema = z.object({
  fileStructure: z
    .string()
    .describe('A comprehensive, proposed file/folder structure for the project, formatted as a markdown code block or JSON tree.'),
});
export type GenerateFileStructureOutput = z.infer<typeof _GenerateFileStructureOutputSchema>;

const fileStructurePrompt = `You are a senior software architect. Your task is to generate a comprehensive, proposed file and folder structure for a new software project, based on the following Product Requirements Document (PRD), architecture, and specifications.

**CRITICAL: You MUST output ONLY valid markdown format. DO NOT output JSON format. Use proper headers, lists, code blocks, and formatting.**

**Instructions:**
- Carefully analyze the PRD, architecture, and specifications provided below.
- Propose a complete file/folder structure that reflects best practices for the project's stack and requirements.
- Include all major directories, key files, and any configuration or setup files that would be expected at project start.
- Use clear, descriptive names for folders and files.
- If relevant, group related components, utilities, and assets into logical subdirectories.
- Do not include implementation details or code—only the structure.
- Output the structure as a markdown code block using tree notation (e.g., \`project-root/\n  src/\n    index.ts\n  README.md\`)
- Make sure the output is easily human-editable and ready for further refinement.
- Do not add any explanations or commentary outside the code block.
- Make sure the proposed tree covers all aspects of the project, including testing, documentation, and configuration, as well as CI/CD if described in the documentation. Do not focus on just one aspect of the project, the folder structure is for the entire project.

**PRD:**
{{{prd}}}

**Architecture:**
{{{architecture}}}

**Specifications:**
{{{specifications}}}

**IMPORTANT: Output ONLY markdown content with a code block containing the file structure. DO NOT output JSON format. Do not wrap your response in JSON objects or use any JSON structure.**`;

export async function generateFileStructure(
  input: GenerateFileStructureInput,
  apiKey?: string,
  model?: string,
  apiBase?: string,
  temperature?: number
): Promise<GenerateFileStructureOutput> {
  console.log('[DEBUG] generateFileStructure called with model:', model);
  if (!model) {
    throw new Error('Model is required. Please provide a model in "provider/model" format in settings.');
  }
  const modelName = model;

  const prompt = fileStructurePrompt
    .replace('{{{prd}}}', input.prd)
    .replace('{{{architecture}}}', input.architecture)
    .replace('{{{specifications}}}', input.specifications);

  let retries = 3;
  while (retries > 0) {
    const { output } = await ai.generate({
      model: modelName,
      prompt: prompt,
      config: (apiKey || apiBase || temperature !== undefined) ? {
        ...(apiKey && {apiKey}),
        ...(apiBase && {apiBase}),
        ...(temperature !== undefined && {temperature})
      } : undefined,
    });

    if (!output) {
      throw new Error('An unexpected response was received from the server.');
    }

    // Parse markdown output to extract file structure
    const markdownContent = output as string;
    
    // Lint and fix the generated file structure
    const lintResult = await MarkdownLinter.lintAndFix(markdownContent, 'file-structure.md');

    // If document is valid or can be fixed, return the result
    if (lintResult.isValid) {
      return {
        fileStructure: lintResult.fixedContent || markdownContent
      };
    }

    // If markdown is invalid and can't be fixed, retry
    retries--;
    if (retries === 0) {
      // Return the best we have with fixes applied
      return {
        fileStructure: lintResult.fixedContent || markdownContent
      };
    }
  }

  throw new Error('Failed to generate valid markdown after retries');
}