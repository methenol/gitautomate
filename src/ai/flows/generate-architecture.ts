'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating a software architecture and specifications from a PRD.
 *
 * - generateArchitecture - A function that takes a PRD as input and returns a proposed software architecture and specifications.
 * - GenerateArchitectureInput - The input type for the generateArchitecture function, which includes the PRD.
 * - GenerateArchitectureOutput - The return type for the generateArchitecture function, which includes the architecture and specifications.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateArchitectureInputSchema = z.object({
  prd: z
    .string()
    .describe(
      'The Product Requirements Document (PRD) to generate the architecture from.'
    ),
});
export type GenerateArchitectureInput = z.infer<
  typeof GenerateArchitectureInputSchema
>;

const GenerateArchitectureOutputSchema = z.object({
  architecture: z.string().describe('The proposed software architecture. Use markdown formatting.'),
  specifications: z
    .string()
    .describe('The generated specifications based on the PRD. Use markdown formatting.'),
});
export type GenerateArchitectureOutput = z.infer<
  typeof GenerateArchitectureOutputSchema
>;

export async function generateArchitecture(
  input: GenerateArchitectureInput,
  apiKey?: string,
  model?: string
): Promise<GenerateArchitectureOutput> {
  const modelName = model
    ? `googleai/${model}`
    : 'googleai/gemini-1.5-flash-latest';
  
  const generateArchitectureFlow = ai.defineFlow(
    {
      name: 'generateArchitectureFlow',
      inputSchema: GenerateArchitectureInputSchema,
      outputSchema: GenerateArchitectureOutputSchema,
    },
    async (input) => {
      const {output} = await ai.generate({
        model: modelName,
        prompt: `Generate a software architecture and specifications based on the following Product Requirements Document (PRD).

PRD:
${input.prd}

Respond with ONLY a valid JSON object that conforms to the output schema. Use markdown formatting for the content of the "architecture" and "specifications" fields.`,
        output: {
          schema: GenerateArchitectureOutputSchema,
        },
        config: apiKey ? {apiKey} : undefined,
      });

      return output!;
    }
  );
  
  return await generateArchitectureFlow(input);
}
