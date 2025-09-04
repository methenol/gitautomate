'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating a software architecture and specifications from a PRD.
 *
 * - generateArchitecture - A function that takes a PRD as input and returns a proposed software architecture and specifications.
 * - GenerateArchitectureInput - The input type for the generateArchitecture function, which includes the PRD.
 * - GenerateArchitectureOutput - The return type for the generateArchitecture function, which includes the architecture and specifications.
 */

import {ai} from '@/ai/litellm';
import {z} from 'zod';

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
  model?: string,
  apiBase?: string
): Promise<GenerateArchitectureOutput> {
  if (!model) {
    throw new Error('Model is required. Please provide a model in "provider/model" format in settings.');
  }
  
  const {output} = await ai.generate({
    model: model,
    prompt: `You are a senior software architect tasked with creating a comprehensive software architecture and detailed specifications from a Product Requirements Document (PRD).

Based on the following PRD, generate BOTH a software architecture AND detailed specifications. These are two separate deliverables that must both be fully developed.

**ARCHITECTURE** should include:
- High-level system design and component structure
- Technology stack and framework choices
- Data flow and integration patterns
- Security considerations and architecture patterns
- Scalability and performance considerations
- Deployment and infrastructure approach

**SPECIFICATIONS** should include:
- Detailed functional requirements
- User stories and use cases
- API endpoints and data models
- User interface requirements
- Business logic and workflows
- Non-functional requirements (performance, security, etc.)
- Integration requirements
- Data processing and validation rules

CRITICAL: The specifications MUST be comprehensive and standalone - they should NOT reference the architecture or say "see architecture above". Both sections must contain detailed, actionable content. You MUST include BOTH an architecture and specification.

PRD:
${input.prd}

Respond with ONLY a valid JSON object that conforms to the output schema. Use markdown formatting for both the "architecture" and "specifications" fields.`,
    output: {
      schema: GenerateArchitectureOutputSchema,
    },
    config: (apiKey || apiBase) ? {
      ...(apiKey && {apiKey}),
      ...(apiBase && {apiBase})
    } : undefined,
  });

  return output as GenerateArchitectureOutput;
}
