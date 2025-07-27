import { z } from 'zod'

export const TaskSchema = z.object({
  title: z.string().describe('A concise title for the development task.'),
  details: z
    .string()
    .describe(
      'Detailed implementation guidance, not actual code snippets. This field should contain step-by-step instructions for what needs to be implemented.'
    )
    .default(''),
})
export type Task = z.infer<typeof TaskSchema>
export type { ResearchTaskInput } from '@/types/research-task-types'
