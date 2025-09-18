'use server';

/**
 * @fileOverview Researches a single development task and generates detailed implementation notes.
 *
 * - researchTask - A function that takes a task title and project context and returns detailed implementation steps.
 * - ResearchTaskInput - The input type for the researchTask function.
 * - ResearchTaskOutput - The return type for the researchTask function.
 */

import {ai} from '@/ai/litellm';
import {z} from 'zod';
import { MarkdownLinter } from '@/services/markdown-linter';

const _ResearchTaskInputSchema = z.object({
  title: z.string().describe('The title of the development task to research.'),
  architecture: z.string().describe('The overall architecture of the project.'),
  fileStructure: z.string().describe('The file/folder structure of the project.'),
  specifications: z.string().describe('The specifications of the project.'),
});
export type ResearchTaskInput = { title: string; architecture: string; fileStructure: string; specifications: string };

const ResearchTaskOutputSchema = z.object({
  markdownContent: z
    .string()
    .describe('Complete markdown-formatted task documentation ready for GitHub issues. Must include proper markdown headers, formatting, and structure.'),
});
export type ResearchTaskOutput = z.infer<typeof ResearchTaskOutputSchema>;

const specKitTaskPrompt = `You are an expert project manager and senior software engineer following Spec-Kit principles. Your task is to perform detailed research for a specific development task and provide a comprehensive implementation plan in markdown format using structured specification-driven methodology.

**CRITICAL: You MUST output ONLY valid markdown format. DO NOT output JSON format. Use proper headers, lists, code blocks, and formatting. The content will be automatically validated and you may be asked to retry if the markdown is invalid.**

The markdown content must follow this exact structure based on Spec-Kit's specification-driven approach:

# Task Implementation Plan: {Task Title}

## Context

This task is part of a larger feature implementation. The architecture emphasizes modular design with clear separation of concerns.

### Position in Architecture
- **Feature**: [Extract from architecture]
- **Dependencies**: [Related tasks and components]  
- **Integration Points**: [How this connects to other systems]

## Implementation Steps (Spec-Kit TDD Approach)

### Phase 1: Test-Driven Development Setup
1. **Write Failing Tests** (RED phase)
   - Create test file: {{{testFilePath}}}
   - Define test scenarios that must pass
   - Ensure tests fail with current implementation

2. **Implement to Pass Tests** (GREEN phase)
   - Create minimal implementation to make tests pass
   - Follow architecture patterns and conventions
   - Integrate with existing systems

3. **Refactor** (REFACTOR phase)
   - Improve code quality without changing behavior
   - Apply coding standards and best practices
   - Ensure tests still pass

### Phase 2: Implementation Details
#### Files to Create/Modify
- **{{{mainFile}}}**: [Primary implementation]
- **{{{testFile}}}**: [Unit and integration tests]  
- **{{{configFile}}}?**: [Configuration if needed]

#### Key Components
1. **Core Logic**: [Describe the main functionality]
2. **Data Validation**: [Input validation rules]
3. **Error Handling**: [Exception handling patterns]
4. **Integration Points**: [How this connects to other services]

### Phase 3: Integration & Validation
1. **Unit Testing**: Verify individual components work correctly
2. **Integration Testing**: Test with dependent modules
3. **Contract Compliance**: Ensure API contracts are satisfied

## Technical Requirements (from Architecture & Specifications)
- Technology Stack: [Extract from architecture]
- Performance Constraints: [Response times, scalability]
- Security Requirements: [Authentication, authorization]  
- Data Models: [Entity definitions and relationships]

## Acceptance Criteria
This task is complete when:
- [ ] All tests pass consistently  
- [ ] Implementation follows architecture patterns
- [ ] Integration points work correctly
- [ ] Performance targets are met
- [ ] Security requirements satisfied

## Dependencies and Prerequisites
- **Required Tasks**: [List dependent task IDs]
- **External Services**: [APIs, databases, etc.]
- **Configuration Setup**: [Environment variables, configs]

## Required Libraries
List all libraries, packages, frameworks, and tools needed for this specific task as a comma-separated list. Be comprehensive and specific based on the architecture:
- [Extract dependencies from architecture specifications]

## Documentation
Refer to the reference documentation for the required libraries listed above to understand their APIs, best practices, and implementation details before beginning development.

## Implementation Notes
- Follow Test-Driven Development principles strictly
- Maintain separation of concerns between components  
- Use established coding patterns from the architecture
- Ensure proper error handling and logging
- Document any assumptions or design decisions

---

Architecture Context:
{{{architecture}}}

Specifications:  
{{{specifications}}}
`;

const tddPrompt = `You are an expert project manager and senior software engineer. Your task is to perform detailed research for a specific development task and provide a comprehensive implementation plan in markdown format following Test-Driven Development (TDD) methodology.

**CRITICAL: You MUST output ONLY valid markdown format. DO NOT output JSON format. Use proper headers, lists, code blocks, and formatting. The content will be automatically validated and you may be asked to retry if the markdown is invalid.**

The markdown content must follow this exact structure:

# {Task Title}

## Context

{Briefly explain how this task fits into the overall architecture}

## Implementation Steps (TDD Approach)

{Provide a detailed, step-by-step implementation guide following Red-Green-Refactor methodology. Describe what needs to be implemented without including actual code snippets. Focus on:
- Files that need to be created or modified
- Functions/components that need to be implemented
- Integration points with other system components
- The expected behavior and functionality
- Any specific considerations or edge cases
- Test-Driven Development phases (Red-Green-Refactor)}

## Required Libraries

{List all libraries, packages, frameworks, and tools needed for this specific task as a comma-separated list. Be comprehensive and specific. Examples:
- react, typescript, @types/node, tailwindcss, react-router-dom
- express, mongodb, mongoose, bcryptjs, jsonwebtoken, cors
- jest, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event}

## Documentation

Refer to the reference documentation for the required libraries listed above to understand their APIs, best practices, and implementation details before beginning development.

## Acceptance Criteria

{Define what it means for this task to be considered "done" as a bulleted list}

Overall Project Architecture:
{{{architecture}}}

File Structure:
{{{fileStructure}}}

Overall Project Specifications:
{{{specifications}}}

Now, provide the detailed implementation plan in markdown format for the following task:

**Task Title: {{{title}}}**

**IMPORTANT: Output ONLY markdown content. DO NOT output JSON format. Do not wrap your response in JSON objects or use any JSON structure.**
`;

export async function researchTask(
  input: ResearchTaskInput,
  apiKey?: string,
  model?: string,
  apiBase?: string,
  useTDD?: boolean,
  temperature?: number
): Promise<ResearchTaskOutput> {
  if (!model) {
    throw new Error('Model is required. Please provide a model in "provider/model" format in settings.');
  }
  
  // Use spec-kit enhanced prompt by default, fallback to TDD if requested
  const useSpecKit = !useTDD; // Spec-kit is the primary enhanced approach
  
  let promptTemplate: string;
  
  if (useSpecKit) {
    // Use spec-kit enhanced task template
    const testFilePath = `tests/${input.title.toLowerCase().replace(/\s+/g, '-')}.test.ts`;
    const mainFile = `src/${input.title.toLowerCase().replace(/\s+/g, '-')}.ts`;
    const configFile = input.fileStructure ? 'config/index.ts' : undefined;
    
    promptTemplate = specKitTaskPrompt
      .replace('{{{architecture}}}', input.architecture)
      .replace('{{{fileStructure}}}', input.fileStructure || '')
      .replace('{{{specifications}}}', input.specifications)
      .replace('{{{title}}}', input.title)
      .replace('{{{testFilePath}}}', testFilePath)
      .replace('{{{mainFile}}}', mainFile)
      .replace('{{{testFile}}}', testFilePath)
      .replace('{{{configFile}}}', configFile || '');
  } else {
    // Use legacy TDD prompt
    promptTemplate = tddPrompt;
  }

  let retries = 3;
  while (retries > 0) {
    const {output} = await ai.generate({
      model: model,
      prompt: promptTemplate,
      config: (apiKey || apiBase || temperature !== undefined) ? {
        ...(apiKey && {apiKey}),
        ...(apiBase && {apiBase}),
        ...(temperature !== undefined && {temperature})
      } : undefined,
    });

    if (!output) {
      throw new Error('An unexpected response was received from the server.');
    }

    // Parse markdown output
    const markdownContent = output as string;

    // Lint and fix the generated task markdown using spec-kit naming
    const lintResult = await MarkdownLinter.lintAndFix(
      markdownContent, 
      `task-${input.title.toLowerCase().replace(/\s+/g, '-')}.md`
    );

    // If document is valid or can be fixed, return the result
    if (lintResult.isValid) {
      // Apply spec-kit validation and enhancement to generate actual detailed content
      const enhancedContent = useSpecKit ? await enhanceWithSpecKitPrinciples(lintResult.fixedContent!, input) : lintResult.fixedContent!;
      
      return {
        markdownContent: enhancedContent
      };
    }

    // If markdown is invalid and can't be fixed, retry
    retries--;
    if (retries === 0) {
      // Return the best we have with fixes applied
      return {
        markdownContent: lintResult.fixedContent || markdownContent
      };
    }
  }

  throw new Error('Failed to generate valid markdown after retries');
}

/**
 * Enhance task content with spec-kit principles and validation
 */
async function enhanceWithSpecKitPrinciples(content: string, input: ResearchTaskInput): Promise<string> {
  
  // Apply TDD validation from spec-kit constitution
  const tddValidation = validateTDDCompliance(content);
  
  // Apply simplicity gate check
  const contentWithSimplicity = applySimplicityGate(content, input);
  
  // Apply anti-abstraction principle check
  const contentWithAbstractionCheck = applyAntiAbstractionPrinciple(contentWithSimplicity);
  
  // Add parallel execution guidance if applicable
  const finalContent = enhanceWithParallelExecutionGuidance(contentWithAbstractionCheck, input);
  
  return finalContent;
}

/**
 * Validate TDD compliance following spec-kit constitution
 */
function validateTDDCompliance(content: string): boolean {
  const hasRedGreenRefactor = content.toLowerCase().includes('red') && 
                            content.toLowerCase().includes('green') &&
                            content.toLowerCase().includes('refactor');
  
  const hasTestFirstOrder = /tests.*before.*implementation|failing tests.*pass/im.test(content);
  
  return hasRedGreenRefactor && hasTestFirstOrder;
}

/**
 * Apply simplicity gate from spec-kit constitution
 */
function applySimplicityGate(content: string, input: ResearchTaskInput): string {
  const projectCount = (content.match(/project|service/g) || []).length;
  
  if (projectCount > 3 && !content.includes('justified complexity')) {
    content += '\n\n## Constitution Check\n- [ ] Simplicity Gate: Task involves multiple projects - ensure complexity is justified';
  }
  
  return content;
}

/**
 * Apply anti-abstraction principle from spec-kit constitution
 */
function applyAntiAbstractionPrinciple(content: string): string {
  const hasUnnecessaryWrappers = /wrapper|abstraction layer|interface overuse/im.test(content);
  
  if (hasUnnecessaryWrappers) {
    content += '\n\n## Anti-Abstraction Check\n- [ ] Consider using framework features directly rather than unnecessary wrappers';
  }
  
  return content;
}

/**
 * Enhance with parallel execution guidance from spec-kit
 */
function enhanceWithParallelExecutionGuidance(content: string, input: ResearchTaskInput): string {
  const fileMatches = content.match(/src\/[^/]+\.ts|tests\/[^/]+\.test\.ts/g);
  
  if (fileMatches && fileMatches.length > 1) {
    const uniqueFiles = [...new Set(fileMatches)];
    
    if (uniqueFiles.length > 1 && !content.includes('[P]')) {
      const parallelGuidance = `\n## Parallel Execution\nThis task involves ${uniqueFiles.length} different files and can be marked [P] for parallel execution if dependencies allow.`;
      content += parallelGuidance;
    }
  }
  
  return content;
}
