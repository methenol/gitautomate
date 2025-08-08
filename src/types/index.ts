import { z } from 'zod';

export const TaskSchema = z.object({
  title: z.string().describe('A concise title for the development task.'),
  details: z
    .string()
    .describe('Detailed implementation guidance, not actual code snippets. This field should contain step-by-step instructions for what needs to be implemented.')
    .default(''),
  dependencies: z
    .array(z.string())
    .describe('List of task titles that must be completed before this task')
    .default([]),
  priority: z
    .number()
    .describe('Task priority for ordering (lower numbers = higher priority)')
    .default(0),
});
export type Task = z.infer<typeof TaskSchema>;

export const DependencyGraphSchema = z.object({
  tasks: z.array(TaskSchema),
  dependencies: z.record(z.string(), z.array(z.string())),
});
export type DependencyGraph = z.infer<typeof DependencyGraphSchema>;

export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  timestamp: z.string(),
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

export const UnifiedProjectContextSchema = z.object({
  prd: z.string().describe('Product Requirements Document'),
  architecture: z.string().describe('Generated architecture specification'),
  fileStructure: z.string().describe('Generated file structure'),
  specifications: z.string().describe('Generated project specifications'),
  dependencyGraph: DependencyGraphSchema.optional(),
  validationHistory: z.array(ValidationResultSchema).default([]),
  metadata: z.object({
    useTDD: z.boolean().default(false),
    model: z.string().optional(),
    apiKey: z.string().optional(),
    timestamp: z.string().default(() => new Date().toISOString()),
  }).default({}),
});
export type UnifiedProjectContext = z.infer<typeof UnifiedProjectContextSchema>;

export const ProjectPlanSchema = z.object({
  context: UnifiedProjectContextSchema,
  tasks: z.array(TaskSchema),
  executionOrder: z.array(z.string()).describe('Ordered list of task titles for execution'),
  validation: ValidationResultSchema,
});
export type ProjectPlan = z.infer<typeof ProjectPlanSchema>;

export type UnifiedProjectOrchestrationInput = {
  prd: string;
  useTDD?: boolean;
  apiKey?: string;
  model?: string;
};

export type { ResearchTaskInput } from '@/ai/flows/research-task';
