'use server';

import { ProjectContext, UnifiedTask, ValidationIssue } from '@/types/unified-context';
import { TaskDependencyGraph } from './dependency-graph';
import { generateArchitecture } from '@/ai/flows/generate-architecture';
import { generateFileStructure } from '@/ai/flows/generate-file-structure';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

export interface UnifiedGenerationOptions {
  apiKey?: string;
  model?: string;
  useTDD?: boolean;
}

export interface UnifiedGenerationResult {
  context: ProjectContext;
  executionOrder: UnifiedTask[];
  validationIssues: ValidationIssue[];
  stats: {
    totalTasks: number;
    hasCycles: boolean;
    categoryCounts: Record<string, number>;
  };
}

const UnifiedTasksOutputSchema = z.object({
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    category: z.enum(['setup', 'core', 'feature', 'testing', 'deployment']),
    dependsOn: z.array(z.string()).default([]),
    priority: z.number().min(1).max(5).default(3),
    context: z.string(),
    implementationSteps: z.string(),
    acceptanceCriteria: z.string(),
    fileReferences: z.array(z.string()).default([]),
  })),
});

export async function generateCompleteProjectPlan(
  prd: string,
  options: UnifiedGenerationOptions = {}
): Promise<UnifiedGenerationResult> {
  try {
    // Step 1: Generate architecture and specifications
    const archResult = await generateArchitecture(
      { prd },
      options.apiKey,
      options.model
    );

    // Step 2: Generate file structure
    const fileStructResult = await generateFileStructure(
      {
        prd,
        architecture: archResult.architecture,
        specifications: archResult.specifications,
      },
      options.apiKey,
      options.model
    );

    // Step 3: Generate unified tasks with dependencies
    const unifiedTasks = await generateUnifiedTasks(
      {
        prd,
        architecture: archResult.architecture,
        specifications: archResult.specifications,
        fileStructure: fileStructResult.fileStructure || '',
      },
      options
    );

    // Validate unified tasks
    if (!unifiedTasks || unifiedTasks.length === 0) {
      throw new Error('No tasks were generated. Please try again with a more detailed PRD.');
    }

    // Step 4: Build dependency graph
    const dependencyGraph = new TaskDependencyGraph();
    dependencyGraph.addMultipleTasks(unifiedTasks);

    // Step 5: Validate and get execution order
    const validationIssues = validateProject(unifiedTasks, fileStructResult.fileStructure || '', dependencyGraph);
    const executionOrder = dependencyGraph.getExecutionOrder();

    // Ensure we have a valid execution order - this is critical
    if (!executionOrder || !Array.isArray(executionOrder) || executionOrder.length === 0) {
      // If we have tasks but no execution order, there's likely a serious issue
      if (unifiedTasks && unifiedTasks.length > 0) {
        throw new Error('Failed to determine task execution order despite having tasks. This indicates a critical issue with dependency processing.');
      } else {
        throw new Error('No tasks were generated and execution order is empty. Please try again with a more detailed PRD.');
      }
    }

    // Step 6: Create unified context
    const context: ProjectContext = {
      prd,
      architecture: archResult.architecture,
      specifications: archResult.specifications,
      fileStructure: fileStructResult.fileStructure || '',
      tasks: unifiedTasks,
      dependencies: extractDependencyEdges(unifiedTasks),
      validationResults: {
        architectureFileConsistency: true,
        taskFileReferences: validationIssues.filter(i => i.category === 'fileReferences').length === 0,
        dependencyOrder: !dependencyGraph.hasCycles(),
        circularDependencies: dependencyGraph.hasCycles(),
        issues: validationIssues.filter(i => i.type === 'error').map(i => i.message),
        warnings: validationIssues.filter(i => i.type === 'warning').map(i => i.message),
      },
      version: 1,
      lastUpdated: new Date().toISOString(),
    };

    return {
      context,
      executionOrder,
      validationIssues,
      stats: dependencyGraph.getStats(),
    };
  } catch (error) {
    throw new Error(`Failed to generate unified project plan: ${(error as Error).message}`);
  }
}

async function generateUnifiedTasks(
  input: {
    prd: string;
    architecture: string;
    specifications: string;
    fileStructure: string;
  },
  options: UnifiedGenerationOptions
): Promise<UnifiedTask[]> {
  const prompt = options.useTDD
    ? getUnifiedTDDPrompt(input)
    : getUnifiedStandardPrompt(input);

  const modelName = options.model
    ? `googleai/${options.model}`
    : 'googleai/gemini-1.5-pro';

  const generateUnifiedTasksFlow = ai.defineFlow(
    {
      name: 'generateUnifiedTasks',
      inputSchema: z.object({
        prd: z.string(),
        architecture: z.string(),
        specifications: z.string(),
        fileStructure: z.string(),
      }),
      outputSchema: UnifiedTasksOutputSchema,
    },
    async (input) => {
      const { output } = await ai.generate({
        model: modelName,
        prompt: prompt,
        output: {
          schema: UnifiedTasksOutputSchema,
        },
        config: options.apiKey ? { apiKey: options.apiKey } : undefined,
      });

      return output!;
    }
  );

  const result = await generateUnifiedTasksFlow(input);

  // Validate the result
  if (!result || !result.tasks || !Array.isArray(result.tasks)) {
    throw new Error('AI generated invalid tasks response. Expected an object with a tasks array.');
  }

  if (result.tasks.length === 0) {
    throw new Error('AI generated no tasks. Please try again with a more detailed PRD or a different model.');
  }

  // Transform the result into UnifiedTask format
  const transformedTasks = result.tasks.map((task, index) => {
    // Validate each task has required properties
    if (!task || typeof task !== 'object') {
      throw new Error(`Invalid task at index ${index}: Task is not an object`);
    }
    
    if (!task.title || typeof task.title !== 'string') {
      throw new Error(`Invalid task at index ${index}: Missing or invalid title`);
    }
    
    return {
      id: task.id || `task-${index + 1}`,
      title: task.title,
      details: `### Context\n${task.context || 'No context provided'}\n\n### Implementation Steps\n${task.implementationSteps || 'No implementation steps provided'}\n\n### Acceptance Criteria\n${task.acceptanceCriteria || 'No acceptance criteria provided'}`,
      dependencies: {
        id: task.id || `task-${index + 1}`,
        dependsOn: Array.isArray(task.dependsOn) ? task.dependsOn : [],
        category: task.category || 'feature',
        priority: typeof task.priority === 'number' ? task.priority : 3,
      },
      context: task.context || '',
      implementationSteps: task.implementationSteps || '',
      acceptanceCriteria: task.acceptanceCriteria || '',
      fileReferences: Array.isArray(task.fileReferences) ? task.fileReferences : [],
    };
  });
  
  // Final validation that we have valid tasks
  if (!Array.isArray(transformedTasks) || transformedTasks.length === 0) {
    throw new Error('Task transformation resulted in empty or invalid task array.');
  }
  
  return transformedTasks;
}

function getUnifiedStandardPrompt(input: {
  prd: string;
  architecture: string;
  specifications: string;
  fileStructure: string;
}): string {
  return `You are a lead software engineer creating a comprehensive, dependency-aware project plan. Generate a complete list of development tasks with proper dependencies, categories, and detailed implementation guidance.

CRITICAL REQUIREMENTS:
1. Each task MUST have a unique ID (format: category-number, e.g., "setup-1", "core-1")
2. Tasks MUST be categorized: setup, core, feature, testing, deployment
3. Dependencies MUST reference existing task IDs (dependsOn array)
4. NO circular dependencies allowed
5. Tasks must reference actual files from the file structure
6. Implementation steps must be detailed but not include actual code

DEPENDENCY RULES:
- setup tasks: foundational work (project setup, CI/CD, pre-commit hooks)
- core tasks: essential functionality that features depend on (auth, database, core APIs)
- feature tasks: user-facing features that depend on core tasks
- testing tasks: test implementation that depends on corresponding features
- deployment tasks: final deployment steps that depend on testing

PROJECT DETAILS:
PRD: ${input.prd}

Architecture: ${input.architecture}

Specifications: ${input.specifications}

File Structure: ${input.fileStructure}

Generate the complete task list with proper dependencies, ensuring a logical execution order that eliminates broken workflows.`;
}

function getUnifiedTDDPrompt(input: {
  prd: string;
  architecture: string;
  specifications: string;
  fileStructure: string;
}): string {
  return `You are a lead software engineer creating a comprehensive, dependency-aware TDD project plan. Generate a complete list of development tasks with proper dependencies, categories, and detailed implementation guidance following Test-Driven Development principles.

CRITICAL REQUIREMENTS:
1. Each task MUST have a unique ID (format: category-number, e.g., "setup-1", "core-1")
2. Tasks MUST be categorized: setup, core, feature, testing, deployment
3. Dependencies MUST reference existing task IDs (dependsOn array)
4. NO circular dependencies allowed
5. Tasks must reference actual files from the file structure
6. Implementation steps must follow TDD: Red → Green → Refactor

TDD DEPENDENCY RULES:
- setup tasks: project setup, testing environment configuration, pre-commit hooks
- testing tasks: write tests BEFORE implementing features
- core tasks: implement core functionality to make tests pass
- feature tasks: implement features to make tests pass
- deployment tasks: final deployment steps

For each feature/core task, ensure the corresponding test task is listed as a dependency.

PROJECT DETAILS:
PRD: ${input.prd}

Architecture: ${input.architecture}

Specifications: ${input.specifications}

File Structure: ${input.fileStructure}

Generate the complete TDD task list with proper dependencies, ensuring tests are written before implementation.`;
}

function validateProject(tasks: UnifiedTask[], fileStructure: string, dependencyGraph: TaskDependencyGraph): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Validate dependency graph
  const graphIssues = dependencyGraph.validate();
  issues.push(...graphIssues);

  // Validate file references
  const fileLines = fileStructure.split('\n').filter(line => line.trim() && !line.includes('/'));
  const referencedFiles = new Set<string>();
  
  tasks.forEach(task => {
    task.fileReferences.forEach(fileRef => {
      referencedFiles.add(fileRef);
      if (!fileLines.some(line => line.includes(fileRef))) {
        issues.push({
          type: 'warning',
          message: `Task "${task.title}" references file "${fileRef}" that doesn't exist in the file structure`,
          category: 'fileReferences',
          affectedTasks: [task.id],
        });
      }
    });
  });

  // Validate logical task order
  const tasksByCategory = {
    setup: tasks.filter(t => t.dependencies.category === 'setup'),
    core: tasks.filter(t => t.dependencies.category === 'core'),
    feature: tasks.filter(t => t.dependencies.category === 'feature'),
    testing: tasks.filter(t => t.dependencies.category === 'testing'),
    deployment: tasks.filter(t => t.dependencies.category === 'deployment'),
  };

  // Check if core tasks depend on setup
  tasksByCategory.core.forEach(task => {
    const hasSetupDep = task.dependencies.dependsOn.some(depId =>
      tasksByCategory.setup.some(setupTask => setupTask.id === depId)
    );
    if (!hasSetupDep && tasksByCategory.setup.length > 0) {
      issues.push({
        type: 'warning',
        message: `Core task "${task.title}" should depend on at least one setup task`,
        category: 'logical-order',
        affectedTasks: [task.id],
      });
    }
  });

  // Check if features depend on core
  tasksByCategory.feature.forEach(task => {
    const hasCoreDep = task.dependencies.dependsOn.some(depId =>
      tasksByCategory.core.some(coreTask => coreTask.id === depId)
    );
    if (!hasCoreDep && tasksByCategory.core.length > 0) {
      issues.push({
        type: 'warning',
        message: `Feature task "${task.title}" should depend on at least one core task`,
        category: 'logical-order',
        affectedTasks: [task.id],
      });
    }
  });

  return issues;
}

function extractDependencyEdges(tasks: UnifiedTask[]) {
  const edges: Array<{ from: string; to: string; type: 'blocking' | 'sequential' | 'optional' }> = [];
  
  tasks.forEach(task => {
    task.dependencies.dependsOn.forEach(depId => {
      edges.push({
        from: depId,
        to: task.id,
        type: 'blocking',
      });
    });
  });

  return edges;
}