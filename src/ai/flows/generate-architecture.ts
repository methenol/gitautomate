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

**CRITICAL: You MUST output ONLY valid markdown format. DO NOT output JSON format. Use proper headers, lists, code blocks, and formatting. The content will be automatically validated and you may be asked to retry if the markdown is invalid.**

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

You must structure your response with two main sections separated by a markdown heading:

# Architecture

{Your complete architecture content here in markdown format}

# Specifications

{Your complete specifications content here in markdown format}

**IMPORTANT: Output ONLY markdown content. DO NOT output JSON format. Do not wrap your response in JSON objects or use any JSON structure.**`,
      config: (apiKey || apiBase) ? {
        ...(apiKey && {apiKey}),
        ...(apiBase && {apiBase})
      } : undefined,
    });

    // Parse the markdown output to extract architecture and specifications
    const markdownContent = output as string;
    const sections = markdownContent.split(/^# /m).filter(section => section.trim());
    
    let architecture = '';
    let specifications = '';
    
    for (const section of sections) {
      const lines = section.trim().split('\n');
      const title = lines[0].toLowerCase();
      const content = lines.slice(1).join('\n').trim();
      
      if (title.includes('architecture')) {
        architecture = content;
      } else if (title.includes('specification') || title.includes('spec')) {
        specifications = content;
      }
    }
    
    // If sections not found by header parsing, try fallback splitting
    if (!architecture || !specifications) {
      const fallbackSplit = markdownContent.split(/(?=# (?:Architecture|Specifications?))/i);
      for (const part of fallbackSplit) {
        if (part.toLowerCase().includes('architecture')) {
          architecture = part.replace(/^# Architecture\s*/i, '').trim();
        } else if (part.toLowerCase().includes('specification')) {
          specifications = part.replace(/^# Specifications?\s*/i, '').trim();
        }
      }
    }
    
    // Ensure we have both sections
    if (!architecture) {
      architecture = markdownContent.split(/# Specifications?/i)[0].replace(/^# Architecture\s*/i, '').trim();
    }
    if (!specifications) {
      const specMatch = markdownContent.match(/# Specifications?([\s\S]*)$/i);
      specifications = specMatch ? specMatch[1].trim() : '';
    }

    // Lint and fix the generated architecture and specifications
    const architectureLintResult = await MarkdownLinter.lintAndFix(architecture, 'architecture.md');
    const specificationsLintResult = await MarkdownLinter.lintAndFix(specifications, 'specifications.md');

    // If both documents are valid or can be fixed, return the result
    if (architectureLintResult.isValid && specificationsLintResult.isValid) {
      return {
        architecture: architectureLintResult.fixedContent || architecture,
        specifications: specificationsLintResult.fixedContent || specifications
      };
    }

    // If markdown is invalid and can't be fixed, retry
    retries--;
    if (retries === 0) {
      // Return the best we have with fixes applied
      return {
        architecture: architectureLintResult.fixedContent || architecture,
        specifications: specificationsLintResult.fixedContent || specifications
      };
    }
  }

  throw new Error('Failed to generate valid markdown after retries');
}
