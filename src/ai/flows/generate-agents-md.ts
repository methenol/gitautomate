/**
 * @fileOverview This file defines a Genkit flow for generating an AGENTS.md file with project-specific instructions for AI agents.
 *
 * - generateAgentsMd - A function that takes PRD, architecture, specifications, and file structure as input and returns an AGENTS.md content.
 * - GenerateAgentsMdInput - The input type for the generateAgentsMd function, which includes project data.
 * - GenerateAgentsMdOutput - The return type for the generateAgentsMd function, which includes the AGENTS.md content.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateAgentsMdInputSchema = z.object({
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
  tasks: z
    .string()
    .describe(
      'The list of generated tasks to infer development patterns and conventions.'
    ),
});
export type GenerateAgentsMdInput = z.infer<
  typeof GenerateAgentsMdInputSchema
>;

const GenerateAgentsMdOutputSchema = z.object({
  agentsMdContent: z.string().describe('The generated AGENTS.md content with project-specific instructions for AI agents.'),
});
export type GenerateAgentsMdOutput = z.infer<
  typeof GenerateAgentsMdOutputSchema
>;

export async function generateAgentsMd(
  input: GenerateAgentsMdInput,
  apiKey?: string,
  model?: string
): Promise<GenerateAgentsMdOutput> {
  const modelName = model
    ? `googleai/${model}`
    : 'googleai/gemini-1.5-flash-latest';
  
  const generateAgentsMdFlow = ai.defineFlow(
    {
      name: 'generateAgentsMdFlow',
      inputSchema: GenerateAgentsMdInputSchema,
      outputSchema: GenerateAgentsMdOutputSchema,
    },
    async (input) => {
      const {output} = await ai.generate({
        model: modelName,
        prompt: `Generate an AGENTS.md file with project-specific instructions for AI agents working on the following software project.

Use ONLY the provided data sources to extract relevant information:

PRD:
${input.prd}

Architecture:
${input.architecture}

Specifications: 
${input.specifications}

File Structure:
${input.fileStructure}

Tasks:
${input.tasks}

The AGENTS.md file should be 20-50 lines and include:

1. **Project Overview**: Brief description based on PRD
2. **Tech Stack**: Extract technologies, tools, and versions from architecture/specs  
3. **Project Structure**: Outline key directories and their roles based on file structure
4. **Setup Instructions**: How to start the project from the file structure
5. **Testing Guidelines**: Testing approach mentioned in specs or architecture  
6. **Key Conventions**: Important patterns and conventions used
7. **Development Rules**: General rules for the project

Content should be concise but comprehensive, providing valuable guidance for AI coding assistants. Use clear markdown formatting with appropriate section headers.`,
        output: {
          schema: GenerateAgentsMdOutputSchema,
        },
        config: apiKey ? {apiKey} : undefined,
      });

      return output!;
    }
  );
  
  return await generateAgentsMdFlow(input);
}
