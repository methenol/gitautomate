'use server';

/**
 * @fileOverview AI-powered library extraction from task content
 * 
 * This flow uses LLM to intelligently identify libraries, frameworks, and tools
 * mentioned in task titles and details, providing better extraction than pattern matching alone.
 */

import { ai } from '@/ai/litellm';
import { z } from 'zod';

const ExtractLibrariesInputSchema = z.object({
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    details: z.string(),
  })).describe('Array of tasks to analyze for library usage'),
});
export type ExtractLibrariesInput = z.infer<typeof ExtractLibrariesInputSchema>;

const ExtractedLibrarySchema = z.object({
  name: z.string().describe('The exact name of the library/framework/tool'),
  category: z.enum(['frontend', 'backend', 'database', 'testing', 'utility', 'devops', 'mobile', 'ml', 'unknown']).describe('Category of the library'),
  confidence: z.number().min(0).max(1).describe('Confidence score (0-1) that this library is actually used'),
  taskIds: z.array(z.string()).describe('IDs of tasks where this library was mentioned'),
  context: z.string().describe('Brief context of how the library is being used'),
});

const ExtractLibrariesOutputSchema = z.object({
  libraries: z.array(ExtractedLibrarySchema).describe('List of identified libraries with metadata'),
});
export type ExtractLibrariesOutput = z.infer<typeof ExtractLibrariesOutputSchema>;

const extractLibrariesPrompt = `You are an expert software engineer and technology analyst. Your task is to carefully analyze development tasks and identify ALL libraries, frameworks, tools, and technologies mentioned or implied.

Analyze the provided tasks and extract:
1. **Explicitly mentioned** libraries (e.g., "setup React", "use Express.js")
2. **Implied libraries** based on context (e.g., "JWT authentication" implies jsonwebtoken library)
3. **Framework ecosystems** (e.g., React implies react-dom, potentially Next.js if mentioned)
4. **Development tools** (e.g., "configure ESLint", "setup Docker")

IMPORTANT GUIDELINES:
- Use EXACT library names as they appear in package managers (npm, pip, maven, etc.)
- For well-known libraries, use the primary package name (e.g., "react" not "react.js")
- Include both explicit mentions and reasonable implications
- Set confidence scores based on clarity of usage:
  - 0.9-1.0: Explicitly mentioned with clear usage
  - 0.7-0.8: Strongly implied by context
  - 0.5-0.6: Possibly needed based on task requirements
  - Below 0.5: Uncertain or speculative
- Categories should be:
  - frontend: UI frameworks, CSS libraries, build tools for frontend
  - backend: Server frameworks, APIs, middleware
  - database: Databases, ORMs, query builders
  - testing: Testing frameworks, assertion libraries, test runners
  - utility: General-purpose libraries, helpers, formatters
  - devops: Deployment, CI/CD, containerization, monitoring
  - mobile: Mobile app frameworks and tools
  - ml: Machine learning, AI libraries
  - unknown: When category is unclear

Tasks to analyze:
{{{tasks}}}

Respond with ONLY a valid JSON object that conforms to the output schema.`;

export async function extractLibraries(
  input: ExtractLibrariesInput, 
  apiKey?: string, 
  model?: string, 
  apiBase?: string
): Promise<ExtractLibrariesOutput> {
  if (!model) {
    throw new Error('Model is required. Please provide a model in "provider/model" format in settings.');
  }

  const tasksText = input.tasks.map(task => 
    `Task ID: ${task.id}\nTitle: ${task.title}\nDetails: ${task.details}`
  ).join('\n\n---\n\n');

  const prompt = extractLibrariesPrompt.replace('{{{tasks}}}', tasksText);

  const { output } = await ai.generate({
    model: model,
    prompt: prompt,
    output: {
      schema: ExtractLibrariesOutputSchema
    },
    config: (apiKey || apiBase) ? {
      ...(apiKey && { apiKey }),
      ...(apiBase && { apiBase })
    } : undefined,
  });

  return output as ExtractLibrariesOutput;
}