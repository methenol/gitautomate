'use server';

/**
 * @fileOverview Extracts required libraries from task details using LLM analysis.
 *
 * - extractLibraries - A function that extracts libraries from task details text using LLM analysis.
 * - ExtractLibrariesInput - The input type for the extractLibraries function.
 * - ExtractLibrariesOutput - The return type for the extractLibraries function.
 */

import {ai} from '@/ai/litellm';
import {z} from 'zod';
import { parseLibraryList } from '@/lib/library-names';

const ExtractLibrariesInputSchema = z.object({
  taskDetails: z.string().describe('The task details text containing library information.'),
});
export type ExtractLibrariesInput = z.infer<typeof ExtractLibrariesInputSchema>;

const ExtractLibrariesOutputSchema = z.object({
  libraries: z.array(z.string()).describe('A list of extracted library names.'),
});
export type ExtractLibrariesOutput = z.infer<typeof ExtractLibrariesOutputSchema>;

const extractionPrompt = `You are a software development expert tasked with extracting required libraries, packages, frameworks, and tools from development task details.

**CRITICAL: You MUST output ONLY a simple list of library names separated by newlines. DO NOT output JSON format. DO NOT output markdown formatting. DO NOT include explanations or additional text.**

Your task is to identify and extract ALL libraries, packages, frameworks, tools, and dependencies mentioned in the task details. This includes:
- NPM packages (e.g., react, express, lodash)
- Python packages (e.g., django, flask, numpy)
- Frameworks (e.g., nextjs, angular, vue)
- Databases (e.g., mongodb, postgresql, redis)
- Tools (e.g., webpack, babel, typescript)
- Testing libraries (e.g., jest, mocha, cypress)
- Any other dependencies or technologies

Extract the base library name without versions, scopes, or additional qualifiers. For example:
- "@types/node" should be extracted as "node"
- "react@18.0.0" should be extracted as "react"
- "@babel/core" should be extracted as "babel"

Output format: One library name per line, no additional formatting, no explanations.

Task Details:
{{{taskDetails}}}

Extract the library names now:`;

export async function extractLibraries(
  input: ExtractLibrariesInput,
  apiKey?: string,
  model?: string,
  apiBase?: string
): Promise<ExtractLibrariesOutput> {
  if (!model) {
    throw new Error('Model is required. Please provide a model in "provider/model" format in settings.');
  }
  
  const prompt = extractionPrompt.replace('{{{taskDetails}}}', input.taskDetails);

  const {output} = await ai.generate({
    model: model,
    prompt: prompt,
    config: (apiKey || apiBase) ? {
      ...(apiKey && {apiKey}),
      ...(apiBase && {apiBase})
    } : undefined,
  });

  if (!output) {
    throw new Error('An unexpected response was received from the server.');
  }

  return { libraries: parseLibraryList(output as string) };
}
