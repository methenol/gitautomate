import { z } from 'zod';

export const TaskSchema = z.object({
  title: z.string().describe('A concise title for the development task.'),
  details: z
    .string()
    .describe('Detailed implementation guidance, not actual code snippets. This field should contain step-by-step instructions for what needs to be implemented.')
    .default(''),
});
export type Task = z.infer<typeof TaskSchema>;

export const ValidationResultSchema = z.object({
  isValid: z.boolean().describe('Whether the validation passed or failed.'),
  errors: z.array(z.string()).describe('List of error messages if validation failed.'),
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

export type { ResearchTaskInput } from '@/ai/flows/research-task';
