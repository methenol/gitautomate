'use server';

/**
 * @fileOverview Researches a single development task and generates detailed implementation notes following spec-kit patterns.
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

const standardPrompt = `You are an expert project manager and senior software engineer following spec-kit patterns. Your task is to perform detailed research for a specific development task and provide a comprehensive implementation plan in markdown format that aligns with spec-kit quality standards.

**CRITICAL: You MUST output ONLY valid markdown format. DO NOT output JSON format. Use proper headers, lists, code blocks, and formatting. The content will be automatically validated.**

The markdown content must follow this exact structure with spec-kit required sections:

# {Task Title}

## Context & Dependencies

{Briefly explain how this task fits into the overall architecture and what dependencies it has (e.g., "Depends on: user model, authentication service")}

## Implementation Plan

{Provide a detailed, step-by-step implementation guide following these sections:}

### Files to Modify/Create
- [List all files that need to be created or modified, with full paths]

### Core Components to Implement
- [List functions/components/classes that need to be implemented with brief descriptions]

### Integration Points
- [Describe how this component integrates with other system components]

### Behavior & Functionality
- [Explain the expected behavior and user-facing functionality]

### Edge Cases & Considerations
- [List any boundary conditions, error scenarios, or special cases to handle]

## Technical Requirements

### Required Libraries
{List all libraries, packages, frameworks, and tools needed for this specific task as a comma-separated list with versions if critical:
Examples: react@18+, typescript@5.0+, express@4.18+, mongoose@8.0+}

### Environment Setup
{Any specific environment variables, configuration files, or setup steps required}

## Acceptance Criteria

{Define what it means for this task to be considered "done" using clear, testable criteria as a bulleted list}

## Quality Gates

{List any quality checks that must pass before this task is considered complete:
- [ ] Code passes linting/formatting checks
- [ ] All tests pass (unit/integration)  
- [ ] Performance meets requirements
- [ ] Security checks passed}

Overall Project Architecture:
{{{architecture}}}

File Structure:
{{{fileStructure}}}

Overall Project Specifications:
{{{specifications}}}

Now, provide the detailed implementation plan in markdown format for the following task:

**Task Title: {{{title}}}**

**IMPORTANT: Output ONLY markdown content following the exact structure above. Do not include JSON or any other formatting.**
`;

const tddPrompt = `You are an expert project manager and senior software engineer following spec-kit patterns. Your task is to perform detailed research for a specific development task and provide a comprehensive implementation plan in markdown format following strict Test-Driven Development (TDD) methodology.

**CRITICAL: You MUST output ONLY valid markdown format. DO NOT output JSON format. Use proper headers, lists, code blocks, and formatting. The content will be automatically validated.**

The markdown content must follow this exact structure with spec-kit TDD requirements:

# {Task Title} (TDD-Focused)

## Context & Dependencies
{Briefly explain how this task fits into the overall architecture and what dependencies it has}

## TDD Implementation Plan (Red → Green → Refactor)

{Provide a detailed, phase-based implementation guide following strict TDD methodology:}

### Phase 1: Red (Write Failing Tests First)
- **Files to Create**: Test files with expected failure scenarios
- **Test Coverage**: What specific functionality should be tested?  
- **Expected Behavior**: "This test should fail initially because [feature] is not implemented"

### Phase 2: Green (Implement Minimum Code to Pass Tests)
- **Files to Modify**: Implementation files needed to make tests pass
- **Minimum Viable Code**: What's the simplest solution that satisfies the tests?
- **No Overengineering**: Avoid implementing extra features beyond test requirements

### Phase 3: Refactor (Improve Design Without Breaking Tests)
- **Code Cleanup**: How can the implementation be made more maintainable?
- **Design Patterns**: Are there appropriate design patterns to apply?
- **Performance**: Can we optimize without changing behavior?

### Integration Points
- How does this component integrate with other system components?
- What dependencies must be available before this phase can begin?

## Technical Requirements (TDD Specific)

### Test Tools Required
{List TDD-specific tools needed: jest@29+, vitest@1.0+, react-testing-library@14+, etc.}

### Environment Setup
{Any specific test environment configuration required}

## Acceptance Criteria (TDD Focus)
- [ ] All Red Phase tests written and failing as expected
- [ ] Green Phase implementation passes all tests  
- [ ] Refactor Phase maintains 100% test coverage
- [ ] No new bugs introduced during refactoring
- [ ] Code meets project quality standards

## Quality Gates (TDD Specific)
- [ ] Tests are written before implementation code
- [ ] Each test has a clear failure message
- [ ] Implementation follows "Minimum Viable" principle
- [ ] Refactoring does not break existing tests
- [ ] Code coverage meets project requirements

Overall Project Architecture:
{{{architecture}}}

File Structure:
{{{fileStructure}}}

Overall Project Specifications:
{{{specifications}}}

Now, provide the detailed TDD implementation plan in markdown format for the following task:

**Task Title: {{{title}}}**

**IMPORTANT: Output ONLY markdown content following the exact TDD structure above. Do not include JSON or any other formatting.**
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
  const modelName = model;
  
  const promptTemplate = useTDD ? tddPrompt : standardPrompt;
  const prompt = promptTemplate
    .replace('{{{architecture}}}', input.architecture)
    .replace('{{{fileStructure}}}', input.fileStructure)
    .replace('{{{specifications}}}', input.specifications)
    .replace('{{{title}}}', input.title);

  let retries = 3;
  while (retries > 0) {
    const {output} = await ai.generate({
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

    // Parse markdown output
    const markdownContent = output as string;

    // Lint and fix the generated task markdown
    const lintResult = await MarkdownLinter.lintAndFix(markdownContent, `task-${input.title.replace(/[^a-zA-Z0-9]/g, '-')}.md`);

    // If document is valid or can be fixed, return the result
    if (lintResult.isValid) {
      return {
        markdownContent: lintResult.fixedContent || markdownContent
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
