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

  // Parse the output as a simple list of library names
  const outputText = output as string;
  const rawLibraries = outputText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#') && !line.startsWith('//')); // Filter out comments and empty lines

  // Clean and normalize library names
  const libraries = rawLibraries
    .map(lib => normalizeLibraryName(lib))
    .filter(lib => lib && isValidLibraryName(lib));

  return {
    libraries: [...new Set(libraries)] // Remove duplicates
  };
}

/**
 * Normalize library names to standard format
 */
function normalizeLibraryName(name: string): string {
  const normalized = name.toLowerCase()
    .replace(/^@.*?\//, '') // Remove npm scope (@babel/core -> core)
    .replace(/['"]/g, '') // Remove quotes
    .replace(/\.js$/, '') // Remove .js extension  
    .replace(/\.ts$/, '') // Remove .ts extension
    .replace(/[-_\s]+/g, '-') // Normalize separators to hyphens
    .trim();
  
  // Handle common variations
  const variations: Record<string, string> = {
    'nextjs': 'nextjs',
    'next.js': 'nextjs',
    'next': 'nextjs',
    'nuxtjs': 'nuxtjs', 
    'nuxt.js': 'nuxtjs',
    'nodejs': 'nodejs',
    'node.js': 'nodejs',
    'expressjs': 'express',
    'express.js': 'express',
    'tensorflow.js': 'tensorflow'
  };
  
  return variations[normalized] || normalized;
}

/**
 * Check if a string is a valid library name
 */
function isValidLibraryName(name: string): boolean {
  // Must be reasonable length and format
  if (!/^[a-zA-Z][\w-]{1,30}$/.test(name)) return false;
  
  // Must be at least 2 characters
  if (name.length < 2) return false;
  
  // Reject names that contain dots (these are usually property paths, not library names)
  if (name.includes('.')) return false;
  
  // Reject names with multiple consecutive hyphens or underscores
  if (name.includes('--') || name.includes('__')) return false;
  
  return true;
}