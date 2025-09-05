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
import { MarkdownLinter } from '@/services/markdown-linter';

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
  
  let retries = 3;
  while (retries > 0) {
    const {output} = await ai.generate({
      model: model,
      prompt: `You are a senior software architect tasked with creating a comprehensive software architecture and detailed specifications from a Product Requirements Document (PRD).

Based on the following PRD, generate BOTH a software architecture AND detailed specifications. These are two separate deliverables that must both be fully developed.

**CRITICAL: You MUST output valid markdown format. Use proper headers, lists, code blocks, and formatting. The content will be automatically validated and you may be asked to retry if the markdown is invalid.**

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

Respond with ONLY a valid JSON object that conforms to the output schema. Use markdown formatting for both the "architecture" and "specifications" fields. Both fields must be included, each field must contain all required content for that section.`,
      output: {
        schema: GenerateArchitectureOutputSchema,
      },
      config: (apiKey || apiBase) ? {
        ...(apiKey && {apiKey}),
        ...(apiBase && {apiBase})
      } : undefined,
    });

    // Cast output to proper type
    const typedOutput = output as GenerateArchitectureOutput;

    // Lint and fix the generated architecture and specifications
    const architectureLintResult = await MarkdownLinter.lintAndFix(typedOutput.architecture, 'architecture.md');
    const specificationsLintResult = await MarkdownLinter.lintAndFix(typedOutput.specifications, 'specifications.md');

    // If both documents are valid or can be fixed, return the result
    if (architectureLintResult.isValid && specificationsLintResult.isValid) {
      return {
        architecture: architectureLintResult.fixedContent || typedOutput.architecture,
        specifications: specificationsLintResult.fixedContent || typedOutput.specifications
      };
    }

    // If markdown is invalid and can't be fixed, retry
    retries--;
    if (retries === 0) {
      // Return the best we have with fixes applied
      return {
        architecture: architectureLintResult.fixedContent || typedOutput.architecture,
        specifications: specificationsLintResult.fixedContent || typedOutput.specifications
      };
    }
  }

  throw new Error('Failed to generate valid markdown after retries');
}
