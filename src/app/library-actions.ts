/**
 * @fileOverview Server-side library identification action
 */

'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { Task } from '@/types';

export interface IdentifiedLibrary {
  name: string;
  category: LibraryCategory;
  confidence: number;
  context: string;
  taskReferences: string[];
}

export type LibraryCategory = 
  | 'frontend'
  | 'backend' 
  | 'database'
  | 'testing'
  | 'auth'
  | 'build-tools'
  | 'ui'
  | 'api'
  | 'deployment'
  | 'monitoring'
  | 'other';

export interface LibraryIdentificationOptions {
  apiKey?: string;
  model?: string;
  minConfidence?: number;
}

export async function runIdentifyLibraries(
  tasks: Task[],
  options: LibraryIdentificationOptions = {}
): Promise<IdentifiedLibrary[]> {
  
  if (tasks.length === 0) {
    return [];
  }

  const { apiKey, model, minConfidence = 0.6 } = options;

  // Combine all task content for analysis
  const taskContent = tasks.map((task, index) => 
    `### Task ${index + 1}: ${task.title}\n${task.details}`
  ).join('\n\n');

  try {
    // Validate and fallback model if needed
    let validModel = model || 'gemini-1.5-flash-latest';
    
    // Filter out deprecated models
    const deprecatedModels = [
      'gemini-2.5-flash-lite-preview-06-17',
      'gemini-2.0-flash-lite-preview'
    ];
    
    if (deprecatedModels.some(deprecated => validModel.includes(deprecated))) {
      console.warn(`Deprecated model "${validModel}" detected, falling back to gemini-1.5-flash-latest`);
      validModel = 'gemini-1.5-flash-latest';
    }

    // Use LLM to identify libraries with advanced pattern matching
    const identificationFlow = ai.defineFlow(
      {
        name: 'identifyLibraries',
        inputSchema: z.object({
          taskContent: z.string(),
        }),
        outputSchema: z.object({
          libraries: z.array(z.object({
            name: z.string(),
            category: z.enum(['frontend', 'backend', 'database', 'testing', 'auth', 'build-tools', 'ui', 'api', 'deployment', 'monitoring', 'other']),
            confidence: z.number().min(0).max(1),
            context: z.string(),
            taskReferences: z.array(z.string())
          }))
        })
      },
      async (input) => {
        const prompt = `Analyze the following development tasks and identify all libraries, frameworks, and tools mentioned. For each library found, provide:

1. **Exact library name** (e.g., "React", "Express.js", "PostgreSQL", "Jest")
2. **Category** (frontend/backend/database/testing/auth/build-tools/ui/api/deployment/monitoring/other)
3. **Confidence score** (0.0-1.0) based on how explicitly mentioned and relevant it is
4. **Context** where it was mentioned
5. **Task references** (task titles that mention this library)

Look for:
- Direct mentions: "using React", "install Express", "configure PostgreSQL"
- Implied technologies: "component state" (React/Vue), "middleware" (Express), "tables" (database)
- Package names: "@types/node", "eslint", "webpack"
- Framework patterns: "hooks", "controllers", "models", "routes"
- Testing frameworks: "unit tests", "integration tests", "e2e tests"
- Authentication: "JWT", "OAuth", "sessions"
- Build tools: "bundling", "transpiling", "compilation"

Only include libraries with confidence >= 0.5. Focus on widely-used, well-documented libraries.

Task content to analyze:
${input.taskContent}

Return as JSON with libraries array.`;

        try {
          const result = await ai.generate({
            model: `googleai/${validModel}`,
            prompt,
            config: apiKey ? { apiKey } : undefined,
            output: {
              schema: z.object({
                libraries: z.array(z.object({
                  name: z.string(),
                  category: z.enum(['frontend', 'backend', 'database', 'testing', 'auth', 'build-tools', 'ui', 'api', 'deployment', 'monitoring', 'other']),
                  confidence: z.number().min(0).max(1),
                  context: z.string(),
                  taskReferences: z.array(z.string())
                }))
              })
            }
          });

          if (!result.output) {
            throw new Error('No output received from AI model');
          }

          return result.output;
          
        } catch (modelError) {
          // If the model fails, try with a guaranteed working fallback
          console.warn(`Model ${validModel} failed, trying with gemini-1.5-pro-latest:`, modelError);
          
          const fallbackResult = await ai.generate({
            model: 'googleai/gemini-1.5-pro-latest',
            prompt,
            config: apiKey ? { apiKey } : undefined,
            output: {
              schema: z.object({
                libraries: z.array(z.object({
                  name: z.string(),
                  category: z.enum(['frontend', 'backend', 'database', 'testing', 'auth', 'build-tools', 'ui', 'api', 'deployment', 'monitoring', 'other']),
                  confidence: z.number().min(0).max(1),
                  context: z.string(),
                  taskReferences: z.array(z.string())
                }))
              })
            }
          });

          if (!fallbackResult.output) {
            throw new Error('No output received from fallback AI model');
          }

          return fallbackResult.output;
        }
      }
    );

    const result = await identificationFlow({ taskContent });
    
    // Filter by minimum confidence and validate
    const filteredLibraries = result.libraries
      .filter((lib) => lib.confidence >= minConfidence)
      .map((lib) => ({
        name: lib.name,
        category: lib.category as LibraryCategory,
        confidence: Math.min(Math.max(lib.confidence, 0), 1), // Clamp 0-1
        context: lib.context || '',
        taskReferences: Array.isArray(lib.taskReferences) ? lib.taskReferences : []
      }));

    // Remove duplicates and merge similar entries
    return deduplicateLibraries(filteredLibraries);

  } catch (error) {
    console.error('Failed to identify libraries from tasks:', error);
    
    // Fallback to pattern matching if LLM fails
    return fallbackPatternMatching(tasks, minConfidence);
  }
}

/**
 * Fallback pattern matching for common libraries when LLM analysis fails
 */
function fallbackPatternMatching(tasks: Task[], minConfidence: number): IdentifiedLibrary[] {
  const commonLibraries = [
    // Frontend
    { patterns: ['react', 'jsx', 'component', 'hook'], name: 'React', category: 'frontend' as LibraryCategory },
    { patterns: ['vue', 'vuejs', 'vue.js'], name: 'Vue.js', category: 'frontend' as LibraryCategory },
    { patterns: ['angular', 'typescript', 'ng-'], name: 'Angular', category: 'frontend' as LibraryCategory },
    { patterns: ['svelte', 'sveltekit'], name: 'Svelte', category: 'frontend' as LibraryCategory },
    
    // Backend
    { patterns: ['express', 'middleware', 'router'], name: 'Express.js', category: 'backend' as LibraryCategory },
    { patterns: ['fastify'], name: 'Fastify', category: 'backend' as LibraryCategory },
    { patterns: ['nextjs', 'next.js', 'next'], name: 'Next.js', category: 'backend' as LibraryCategory },
    { patterns: ['nestjs', 'nest.js'], name: 'NestJS', category: 'backend' as LibraryCategory },
    
    // Database
    { patterns: ['postgresql', 'postgres', 'pg'], name: 'PostgreSQL', category: 'database' as LibraryCategory },
    { patterns: ['mysql'], name: 'MySQL', category: 'database' as LibraryCategory },
    { patterns: ['mongodb', 'mongo'], name: 'MongoDB', category: 'database' as LibraryCategory },
    { patterns: ['prisma'], name: 'Prisma', category: 'database' as LibraryCategory },
    
    // Testing
    { patterns: ['jest', 'test'], name: 'Jest', category: 'testing' as LibraryCategory },
    { patterns: ['vitest'], name: 'Vitest', category: 'testing' as LibraryCategory },
    { patterns: ['cypress', 'e2e'], name: 'Cypress', category: 'testing' as LibraryCategory },
    { patterns: ['playwright'], name: 'Playwright', category: 'testing' as LibraryCategory },
    
    // UI Libraries
    { patterns: ['tailwind', 'tailwindcss'], name: 'Tailwind CSS', category: 'ui' as LibraryCategory },
    { patterns: ['material-ui', 'mui'], name: 'Material-UI', category: 'ui' as LibraryCategory },
    { patterns: ['chakra'], name: 'Chakra UI', category: 'ui' as LibraryCategory },
    
    // Auth
    { patterns: ['jwt', 'jsonwebtoken'], name: 'JWT', category: 'auth' as LibraryCategory },
    { patterns: ['passport'], name: 'Passport.js', category: 'auth' as LibraryCategory },
    { patterns: ['auth0'], name: 'Auth0', category: 'auth' as LibraryCategory },
  ];

  const identified: IdentifiedLibrary[] = [];
  const allText = tasks.map(t => `${t.title} ${t.details}`).join(' ').toLowerCase();

  for (const lib of commonLibraries) {
    const matches = lib.patterns.filter(pattern => allText.includes(pattern.toLowerCase()));
    if (matches.length > 0) {
      const confidence = Math.min(matches.length * 0.3 + 0.4, 1.0);
      if (confidence >= minConfidence) {
        identified.push({
          name: lib.name,
          category: lib.category,
          confidence,
          context: `Pattern matching: ${matches.join(', ')}`,
          taskReferences: tasks
            .filter(t => matches.some(m => `${t.title} ${t.details}`.toLowerCase().includes(m)))
            .map(t => t.title)
        });
      }
    }
  }

  return identified;
}

/**
 * Remove duplicate libraries and merge similar entries
 */
function deduplicateLibraries(libraries: IdentifiedLibrary[]): IdentifiedLibrary[] {
  const libraryMap = new Map<string, IdentifiedLibrary>();

  for (const lib of libraries) {
    const key = lib.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (libraryMap.has(key)) {
      const existing = libraryMap.get(key)!;
      // Merge with higher confidence and combined task references
      libraryMap.set(key, {
        ...existing,
        confidence: Math.max(existing.confidence, lib.confidence),
        context: `${existing.context}; ${lib.context}`,
        taskReferences: [...new Set([...existing.taskReferences, ...lib.taskReferences])]
      });
    } else {
      libraryMap.set(key, lib);
    }
  }

  // Sort by confidence (highest first)
  return Array.from(libraryMap.values()).sort((a, b) => b.confidence - a.confidence);
}