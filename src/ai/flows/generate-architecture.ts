'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating a software architecture and specifications from a PRD.
 * Inspired by spec-kit patterns, this implementation includes:
 * - Phase-based execution (Research → Design → Planning)
 * - Technical context extraction with NEEDS CLARIFICATION markers  
 * - Structured output formats aligned with spec-kit templates
 * - Quality gates for requirement completeness
 *
 * - generateArchitecture - A function that takes a PRD as input and returns a proposed software architecture and specifications.
 * - GenerateArchitectureInput - The input type for the generateArchitecture function, which includes the PRD.
 * - GenerateArchitectureOutput - The return type for the generateArchitecture function, which includes the architecture and specifications.
 */

import {ai} from '@/ai/litellm';
import {z} from 'zod';
import { MarkdownLinter } from '@/services/markdown-linter';

// Load spec-kit inspired templates
import specTemplate from '@/ai/templates/spec-template.md?raw';
import planTemplate from '@/ai/templates/plan-template.md?raw';

const _GenerateArchitectureInputSchema = z.object({
  prd: z
    .string()
    .describe(
      'The Product Requirements Document (PRD) to generate the architecture from.'
    ),
});
export type GenerateArchitectureInput = z.infer<
  typeof _GenerateArchitectureInputSchema
>;

const _GenerateArchitectureOutputSchema = z.object({
  architecture: z.string().describe('The proposed software architecture. Use markdown formatting.'),
  specifications: z
    .string()
    .describe('The generated specifications based on the PRD. Use markdown formatting.'),
});
export type GenerateArchitectureOutput = z.infer<
  typeof _GenerateArchitectureOutputSchema
>;

export async function generateArchitecture(
  input: GenerateArchitectureInput,
  apiKey?: string,
  model?: string,
  apiBase?: string,
  temperature?: number
): Promise<GenerateArchitectureOutput> {
  if (!model) {
    throw new Error('Model is required. Please provide a model in "provider/model" format in settings.');
  }
  
  let retries = 3;
  while (retries > 0) {
    const {output} = await ai.generate({
      model: model,
      prompt: `You are a senior software architect following spec-kit patterns to create comprehensive software architecture, specifications, and implementation plans from a Product Requirements Document (PRD).

**FOLLOW THIS EXACT WORKFLOW**:
1. Phase 0: Research & Clarification - Extract all unknowns and mark with [NEEDS CLARIFICATION]
2. Phase 1: Design - Create structured architecture and specifications  
3. Phase 2: Planning - Generate implementation plan structure

**CRITICAL OUTPUT FORMAT**: You MUST output ONLY valid markdown following spec-kit template patterns. Use proper headers, lists, code blocks, and formatting.

**REFERENCE TEMPLATES**: 
- For specifications: Use spec-template.md as your structure guide
${specTemplate}
- For implementation plan: Use plan-template.md as your structure guide  
${planTemplate}

**ARCHITECTURE REQUIREMENTS**:
- High-level system design with clear component boundaries
- Technology stack selection with rationale (avoid vague choices)
- Data flow diagrams (as text descriptions)
- Security architecture with threat mitigation strategies
- Scalability considerations and performance bottleneck planning
- Deployment strategy with infrastructure recommendations

**SPECIFICATIONS REQUIREMENTS**:
- Detailed functional requirements (testable, measurable)
- User stories in Gherkin-style format (Given/When/Then)
- Data models with entity relationships and validation rules
- API specifications (REST/GraphQL endpoints, request/response formats)
- UI wireframe descriptions (key screens, user flows)
- Non-functional requirements with clear success criteria
- Integration points and external dependency specifications

**QUALITY GATES**:
- All technical assumptions must be marked with [NEEDS CLARIFICATION] if not explicitly stated in PRD
- Requirements must be actionable and implementable (no vague "improve performance" statements)
- Data models must include all entities mentioned in user stories
- Architecture must align with common industry best practices for the identified technology stack

PRD:
${input.prd}

**STRUCTURE YOUR RESPONSE WITH THESE SECTIONS**:

# Feature Specification
{Follow the spec-template.md format with all mandatory sections}

# Implementation Plan  
{Follow the plan-template.md format including Technical Context, Project Structure, and Phases}

# Architecture Details
{Your complete architecture content with clear component diagrams as text}

**IMPORTANT: Output ONLY markdown content. DO NOT output JSON format. Use proper section headers and follow the spec-kit template structures provided.**`,
      config: (apiKey || apiBase || temperature !== undefined) ? {
        ...(apiKey && {apiKey}),
        ...(apiBase && {apiBase}),
        ...(temperature !== undefined && {temperature})
      } : undefined,
    });

    // Parse the markdown output to extract architecture and specifications
    const markdownContent = output as string;
    
    // Simple fallback approach - use the entire content for both sections if parsing fails
    let architecture = markdownContent;
    let specifications = markdownContent;
    
    // Try to extract sections, but don't fail if parsing is complex
    try {
      const lines = markdownContent.split('\n');
      let inArchitectureSection = false;
      let inSpecsSection = false;
      
      const architectureLines: string[] = [];
      const specsLines: string[] = [];
      
      for (const line of lines) {
        if (line.startsWith('# Architecture') || line.toLowerCase().includes('architecture')) {
          inArchitectureSection = true;
          inSpecsSection = false;
        } else if (line.startsWith('# Specifications') || line.toLowerCase().includes('specification')) {
          inSpecsSection = true;
          inArchitectureSection = false;
        } else if (line.startsWith('# ')) {
          // New section found, reset flags
          inArchitectureSection = false;
          inSpecsSection = false;
        }
        
        if (inArchitectureSection && !line.startsWith('# ')) {
          architectureLines.push(line);
        }
        
        if (inSpecsSection && !line.startsWith('# ')) {
          specsLines.push(line);
        }
      }
      
      if (architectureLines.length > 0) {
        architecture = architectureLines.join('\n').trim();
      }
      
      if (specsLines.length > 0) {
        specifications = specsLines.join('\n').trim();
      }
    } catch (error) {
      // If parsing fails, use the entire content for both sections
      console.log('Section parsing failed, using full content');
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
