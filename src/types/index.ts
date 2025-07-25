import { z } from 'zod';

export const TaskSchema = z.object({
  title: z.string().describe('A concise title for the development task.'),
  details: z
    .string()
    .describe('This field is populated by a separate research flow.')
    .default(''),
});
export type Task = z.infer<typeof TaskSchema>;
export type { ResearchTaskInput } from '@/ai/flows/research-task';
