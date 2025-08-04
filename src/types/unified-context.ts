import { z } from 'zod';

export const TaskDependencySchema = z.object({
  id: z.string(),
  dependsOn: z.array(z.string()).default([]),
  category: z.enum(['setup', 'core', 'feature', 'testing', 'deployment']),
  priority: z.number().min(1).max(5).default(3),
});

export const UnifiedTaskSchema = z.object({
  id: z.string(),
  title: z.string().describe('A concise title for the development task.'),
  details: z
    .string()
    .describe('Detailed implementation guidance, not actual code snippets. This field should contain step-by-step instructions for what needs to be implemented.')
    .default(''),
  dependencies: TaskDependencySchema,
  context: z.string().default(''),
  implementationSteps: z.string().default(''),
  acceptanceCriteria: z.string().default(''),
  fileReferences: z.array(z.string()).default([]),
});

export const ProjectContextSchema = z.object({
  prd: z.string(),
  architecture: z.string(),
  specifications: z.string(),
  fileStructure: z.string(),
  tasks: z.array(UnifiedTaskSchema),
  dependencies: z.array(z.object({
    from: z.string(),
    to: z.string(),
    type: z.enum(['blocking', 'sequential', 'optional']).default('blocking'),
  })),
  validationResults: z.object({
    architectureFileConsistency: z.boolean().default(true),
    taskFileReferences: z.boolean().default(true),
    dependencyOrder: z.boolean().default(true),
    circularDependencies: z.boolean().default(false),
    issues: z.array(z.string()).default([]),
    warnings: z.array(z.string()).default([]),
  }),
  version: z.number().default(1),
  lastUpdated: z.string().default(''),
});

export type TaskDependency = z.infer<typeof TaskDependencySchema>;
export type UnifiedTask = z.infer<typeof UnifiedTaskSchema>;
export type ProjectContext = z.infer<typeof ProjectContextSchema>;

export interface DependencyGraphNode {
  id: string;
  task: UnifiedTask;
  dependencies: string[];
  dependents: string[];
  level: number;
}

export interface ValidationIssue {
  type: 'error' | 'warning';
  message: string;
  category: string;
  affectedTasks?: string[];
}