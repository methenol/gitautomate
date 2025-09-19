/**
 * @fileOverview This file defines a Genkit flow for generating an AGENTS.md file with project-specific instructions for AI agents.
 *
 * - generateAgentsMd - A function that takes PRD, architecture, specifications, file structure, and task names as input and returns an AGENTS.md content.
 * - GenerateAgentsMdInput - The input type for the generateAgentsMd function, which includes project data.
 * - GenerateAgentsMdOutput - The return type for the generateAgentsMd function, which includes the AGENTS.md content.
 */

import {ai} from '@/ai/litellm';
import {z} from 'zod';

const _GenerateAgentsMdInputSchema = z.object({
  prd: z
    .string()
    .describe(
      'The Product Requirements Document (PRD) to base the AGENTS.md content on.'
    ),
  architecture: z
    .string()
    .describe(
      'The software architecture to extract technical context from.'
    ),
  specifications: z
    .string()
    .describe(
      'The technical specifications to understand project requirements.'
    ),
  fileStructure: z
    .string()
    .describe(
      'The proposed file structure to understand project setup requirements.'
    ),
  taskNames: z
    .array(z.string())
    .describe(
      'The list of task names to infer development patterns and conventions.'
    ),
});
export type GenerateAgentsMdInput = z.infer<
  typeof _GenerateAgentsMdInputSchema
>;

const _GenerateAgentsMdOutputSchema = z.object({
  agentsMdContent: z.string().describe('The generated AGENTS.md content with project-specific instructions for AI agents.'),
});
export type GenerateAgentsMdOutput = z.infer<
  typeof _GenerateAgentsMdOutputSchema
>;

export async function generateAgentsMd(
  input: GenerateAgentsMdInput,
  apiKey?: string,
  model?: string,
  apiBase?: string
): Promise<GenerateAgentsMdOutput> {
  if (!model) {
    throw new Error('Model is required. Please provide a model in "provider/model" format in settings.');
  }
  const modelName = model;
  
  const {output} = await ai.generate({
    model: modelName,
    prompt: `Generate an AGENTS.md file with project-specific instructions for AI agents working on the following software project.

**CRITICAL: You MUST output ONLY valid markdown format. DO NOT output JSON format. Use proper headers, lists, code blocks, and formatting.**

Use ONLY the provided data sources to extract relevant information:

PRD:
${input.prd}

Architecture:
${input.architecture}

Specifications: 
${input.specifications}

File Structure:
${input.fileStructure}

Task Names:
${input.taskNames.join('\n- ')}

The AGENTS.md file should be 20-50 lines and include:

1. **Project Overview**: Brief description based on PRD
2. **Tech Stack**: Extract technologies, tools, and versions from architecture/specs  
3. **Project Structure**: Outline key directories and their roles based on file structure
4. **Development Tasks**: Key development tasks and patterns inferred from task names
5. **Setup Instructions**: How to start the project based on architecture and specs
6. **Testing Guidelines**: Testing approach mentioned in specs or architecture  
7. **Key Conventions**: Important patterns and conventions used
8. **Development Rules**: General rules for the project

Content should be concise but comprehensive, providing valuable guidance for AI coding assistants. Use clear markdown formatting with appropriate section headers.

**IMPORTANT: Output ONLY markdown content. DO NOT output JSON format. Do not wrap your response in JSON objects or use any JSON structure.**`,
    config: (apiKey || apiBase) ? {
      ...(apiKey && {apiKey}),
      ...(apiBase && {apiBase})
    } : undefined,
  });

  // Parse markdown output
  const agentsMdContent = output as string;
  
  return { agentsMdContent };
}
