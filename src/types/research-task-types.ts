import { z } from 'zod'

export const ResearchTaskInputSchema = z.object({
  title: z.string().describe('The task title to research.'),
  architecture: z
    .string()
    .describe('The proposed software architecture for the project.'),
  fileStructure: z
    .string()
    .describe('The proposed file/folder structure for the project.'),
  specifications: z
    .string()
    .describe('The detailed specifications for the project.'),
})

export const ResearchTaskOutputSchema = z.object({
  context: z
    .string()
    .describe(
      'Briefly explain how this task fits into the overall architecture.'
    ),
  implementationSteps: z
    .string()
    .describe(
      'Provide detailed step-by-step implementation guidance. Do NOT include actual code snippets, but explain what needs to be implemented and why.'
    ),
  acceptanceCriteria: z
    .string()
    .describe(
      'Define clear acceptance criteria for when this task is considered complete.'
    ),
})

export type ResearchTaskOutput = z.infer<typeof ResearchTaskOutputSchema>

export interface ResearchTaskInput {
  title: string
  architecture: string
  specifications: string
  fileStructure: string
}
