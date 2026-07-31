import { z } from 'zod';

export const TaskSchema = z.object({
  title: z.string().describe('A concise title for the development task.'),
  details: z
    .string()
    .describe('Detailed implementation guidance, not actual code snippets. This field should contain step-by-step instructions for what needs to be implemented.')
    .default(''),
  /**
   * Planning metadata. Optional so existing callers and stored plans keep working;
   * populated by the planner and used for ordering, dependency preconditions and
   * task-file frontmatter.
   */
  id: z.string().describe('Stable task id such as T-001.').optional(),
  dependsOn: z
    .array(z.string())
    .describe('Ids of tasks that must be completed before this one.')
    .optional(),
  files: z
    .array(z.string())
    .describe('Primary repository paths this task creates or modifies.')
    .optional(),
  outcome: z
    .string()
    .describe('The observable result that proves this task is complete.')
    .optional(),
});
export type Task = z.infer<typeof TaskSchema>;
export type { ResearchTaskInput } from '@/ai/flows/research-task';
