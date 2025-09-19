'use server';

/**
 * @fileOverview Transforms the architecture and specifications into actionable task titles following spec-kit patterns.
 *
 * - generateTasks - A function that transforms architecture and specifications into structured, ordered tasks.
 * - GenerateTasksInput - The input type for the generateTasks function.
 * - GenerateTasksOutput - The return type for the generateTasks function.
 * - Task - The type for an individual task. Details are populated in a separate step.
 */

import {ai} from '@/ai/litellm';
import { TaskSchema } from '@/types';
import {z} from 'zod';

// Load spec-kit inspired templates
// import tasksTemplate from '@/ai/templates/tasks-template.md?raw';


const __GenerateTasksInputSchema = z.object({
  architecture: z.string().describe('The architecture of the project.'),
  specifications: z.string().describe('The specifications of the project.'),
  fileStructure: z.string().describe('The file structure of the project.'),
});
export type GenerateTasksInput = z.infer<typeof _GenerateTasksInputSchema>;


const _GenerateTasksOutputSchema = z.object({
  tasks: z.array(TaskSchema).describe('A list of actionable task titles.'),
});
export type GenerateTasksOutput = z.infer<typeof _GenerateTasksOutputSchema>;

const standardPrompt = `You are a lead software engineer following spec-kit patterns to create a detailed, structured project plan for an AI programmer. Your task is to break down a project's architecture, file structure, and specifications into a series of actionable development tasks following strict phase-based organization.

**FOLLOW SPEC-KIT TASK GENERATION RULES**:
1. **Phase Order**: Setup → Tests → Core Implementation → Integration → Polish (Tests MUST come before implementation)
2. **Task Structure**: Use the tasks-template.md format with clear phases and sections  
3. **Dependency Awareness**: Ensure tasks follow logical dependency order (models before services, tests before implementation)
4. **File Specificity**: Include exact file paths when relevant (e.g., "models/user.ts", "tests/unit/auth.test.ts")
5. **Comprehensiveness**: Cover ALL aspects of the architecture, specifications, and file structure

**CRITICAL OUTPUT FORMAT**: You MUST output ONLY valid markdown following the tasks-template.md structure. Use proper headers, lists, and code blocks. DO NOT output JSON or any other format.

**TASK CATEGORIES TO INCLUDE**:
- **Phase 1: Setup**: Project initialization, dependencies, configuration  
- **Phase 2: Tests First**: Test structure and failing tests (MUST come before implementation)
- **Phase 3: Core Implementation**: Models, services, core functionality (ONLY after tests are failing)
- **Phase 4: Integration**: Database connections, API routes, external integrations
- **Phase 5: Polish**: Documentation, performance tuning, final validation

**TASK QUALITY STANDARDS**:
- Each task must be actionable and represent a single, implementable unit of work
- Avoid overly granular tasks (e.g., "Implement user login" is good; "Add password field" is too small)
- Include file paths for all code-related tasks
- Follow strict sequential ordering based on dependencies

Architecture:
{{{architecture}}}

File Structure:
{{{fileStructure}}}

Specifications:
{{{specifications}}}

**OUTPUT FORMAT**: Follow the exact structure from tasks-template.md with these sections:
# Tasks: [Feature Name]
## Phase 1: Setup
- [ ] Task title with file path if relevant
## Phase 2: Tests First ⚠️ (MUST complete before implementation)
- [ ] Task title with file path if relevant  
## Phase 3: Core Implementation (ONLY after tests are failing)
- [ ] Task title with file path if relevant
## Phase 4: Integration
- [ ] Task title with file path if relevant
## Phase 5: Polish & Validation
- [ ] Task title with file path if relevant

**IMPORTANT: Output ONLY markdown content following the tasks-template.md structure. Do not include JSON or any other formatting.**`;

const tddPrompt = `You are a lead software engineer following spec-kit patterns to create a Test-Driven Development (TDD) focused project plan for an AI programmer. Your task is to break down architecture, file structure, and specifications into actionable tasks that strictly follow Red-Green-Refactor methodology.

**FOLLOW SPEC-KIT TDD RULES**:
1. **Strict Phase Order**: Setup → Test Structure → Red (Failing Tests) → Green (Implement Minimum Code) → Refactor → Next Feature
2. **Test-Driven Structure**: Every implementation task must be preceded by its corresponding test task  
3. **Explicit TDD Markers**: Clearly distinguish between test tasks and implementation tasks
4. **Dependency Enforcement**: Tests for Component A must be written before tests for Component B that depends on A
5. **File Specificity**: Include exact file paths for both tests and implementation files

**CRITICAL OUTPUT FORMAT**: You MUST output ONLY valid markdown following the tasks-template.md structure with TDD emphasis. Use proper headers, lists, and code blocks. DO NOT output JSON or any other format.

**TASK CATEGORIES TO INCLUDE (TDD SPECIFIC)**:
- **Phase 1: Setup**: Project initialization, dependencies, TDD tool configuration  
- **Phase 2: Test Structure**: Create test directories and skeleton files for ALL future features
- **Phase 3: Red Phase**: Write failing tests for core functionality (MUST come first)
- **Phase 4: Green Phase**: Implement minimum code to make tests pass
- **Phase 5: Refactor Phase**: Clean up code, improve design while maintaining test coverage
- **Phase 6: Integration**: Connect components with TDD approach
- **Phase 7: Polish**: Documentation, performance testing, final validation

**TDD-SPECIFIC QUALITY STANDARDS**:
- For every implementation task, there MUST be a corresponding test task that comes before it
- Test tasks must specify expected failure behavior ("This test should fail initially")
- Implementation tasks must reference the specific test they are making pass
- Include both test file paths and implementation file paths for all tasks

Architecture:
{{{architecture}}}

File Structure:
{{{fileStructure}}}

Specifications:
{{{specifications}}}

**OUTPUT FORMAT**: Follow the exact structure from tasks-template.md but with TDD emphasis:
# Tasks: [Feature Name] (TDD-Focused)
## Phase 1: Setup & Test Configuration
- [ ] Task title with file path if relevant  
## Phase 2: Red Phase - Write Failing Tests (MUST complete first)
- [ ] Task title with file path and expected failure behavior
## Phase 3: Green Phase - Implement Minimum Code to Pass Tests
- [ ] Task title with file path and referenced test
## Phase 4: Refactor Phase - Improve Design
- [ ] Task title with file path and refactoring goal
## Phase 5: Integration & Polish
- [ ] Task title with file path if relevant

**IMPORTANT: Output ONLY markdown content following the tasks-template.md structure with TDD-specific requirements. Do not include JSON or any other formatting.**`;

export async function generateTasks(input: GenerateTasksInput, apiKey?: string, model?: string, apiBase?: string, useTDD?: boolean, temperature?: number): Promise<GenerateTasksOutput> {
  if (!model) {
    throw new Error('Model is required. Please provide a model in "provider/model" format in settings.');
  }
  const modelName = model;

  const promptTemplate = useTDD ? tddPrompt : standardPrompt;

  const prompt = promptTemplate
    .replace('{{{architecture}}}', input.architecture)
    .replace('{{{fileStructure}}}', input.fileStructure)
    .replace('{{{specifications}}}', input.specifications);

  const {output} = await ai.generate({
    model: modelName,
    prompt: prompt,
    config: (apiKey || apiBase || temperature !== undefined) ? {
      ...(apiKey && {apiKey}),
      ...(apiBase && {apiBase}),
      ...(temperature !== undefined && {temperature})
    } : undefined,
  });
  
  // Parse markdown output to extract task titles with structure awareness
  const markdownContent = output as string;
  
  // Try to parse by sections (Phase X) which is the spec-kit format first
  const sectionTasks = parseSpecKitTaskStructure(markdownContent);
  
  if (sectionTasks.length > 0) {
    return { tasks: sectionTasks };
  }

  // Fall back to bullet point parsing for backward compatibility
  
  // Extract bullet points from markdown
  const tasks: Array<{ title: string; details: string }> = [];
  const lines = markdownContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const title = trimmed.substring(2).trim();
      if (title) {
        tasks.push({ title, details: '' });
      }
    }
  }
  
  // If no bullet points found, try alternative parsing
  if (tasks.length === 0) {
    // Try to extract lines that look like task titles
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('**')) {
        // Check if it looks like a task title (contains action words)
        const actionWords = ['implement', 'create', 'build', 'setup', 'configure', 'add', 'develop', 'design', 'integrate', 'test'];
        if (actionWords.some(word => trimmed.toLowerCase().includes(word))) {
          tasks.push({ title: trimmed, details: '' });
        }
      }
    }
  }
  
  // Ensure we have at least some tasks
  if (tasks.length === 0) {
    throw new Error('Failed to extract task titles from generated content');
  }
  
  // If no tasks found at all, throw error
  if (tasks.length === 0) {
    throw new Error('Failed to extract task titles from generated content');
  }

  return { tasks };
}

/**
 * Parse tasks from spec-kit structured markdown format with sections like "## Phase X:"
 */
function parseSpecKitTaskStructure(markdownContent: string): Array<{ title: string; details: string }> {
  const tasks: Array<{ title: string; details: string }> = [];
  const lines = markdownContent.split('\n');
  
  let inTaskList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check for section headers (Phase X:)
    if (line.startsWith('## ') && line.toLowerCase().includes('phase')) {
      inTaskList = true;
      continue;
    }

    // Check for end of task list (next section or end of document)
    if ((i + 1 < lines.length && lines[i + 1].trim().startsWith('## ')) || i === lines.length - 1) {
      inTaskList = false;
    }

    // Extract task bullet points within sections
    if (inTaskList && line.startsWith('- [ ] ')) {
      const title = line.substring(5).trim(); // Remove "- [ ] " prefix
      if (title) {
        tasks.push({ title, details: '' });
      }
    }
  }

  return tasks;
}

/**
 * Parse tasks from simple bullet point format (backward compatibility)
 */
function _parseBulletPointTasks(markdownContent: string): Array<{ title; details }> {
  const tasks: Array<{ title: string; details: string }> = [];
  const lines = markdownContent.split('\n');

  // Extract bullet points from markdown
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const title = trimmed.substring(2).trim();
      if (title) {
        tasks.push({ title, details: '' });
      }
    }
  }

  // If no bullet points found, try alternative parsing
  if (tasks.length === 0) {
    // Try to extract lines that look like task titles
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('**')) {
        // Check if it looks like a task title (contains action words)
        const actionWords = ['implement', 'create', 'build', 'setup', 'configure', 'add', 'develop', 'design', 'integrate', 'test'];
        if (actionWords.some(word => trimmed.toLowerCase().includes(word))) {
          tasks.push({ title: trimmed, details: '' });
        }
      }
    }
  }

  return tasks;
}

