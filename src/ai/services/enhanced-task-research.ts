

'use server';

/**
 * Enhanced Task Research with Documentation Integration
 *
 * This service extends the existing task research functionality by:
 * 1. Identifying libraries mentioned in tasks
 * 2. Fetching relevant documentation before task research  
 * 3. Enriching task descriptions with contextual references
 */

import { ai } from '@/ai/genkit';
import { TaskSchema, type Task } from '@/types';
import { z } from 'genkit';

// Import documentation services
import {
  LibraryIdentifier,
  DocumentationFetcher, 
  type FetchedDocumentation,
  type LibraryIdentification
} from './documentation-fetcher';

// Enhanced task research input with documentation settings
const _EnhancedTaskResearchInputSchema = z.object({
  title: z.string().describe('The task research input.'),
  architecture: z.string().describe('The project architecture.'),
  specifications: z.string().describe('The project specifications.'),
  fileStructure: z.string().describe('The project file structure.'),
  documentationSettings: z.object({
    sources: z.enum(['github-only', 'multi-source']).default('multi-source'),
    includeStackOverflow: z.boolean().default(true),
    maxDocumentationSizeKB: z.number().min(100).max(1024).default(512),
    cacheDocumentationDays: z.number().min(1).max(30).default(7),
  }).optional(),
});

export type EnhancedTaskResearchInput = z.infer<typeof _EnhancedTaskResearchInputSchema>;

// Output schema with enriched task details
const EnhancedTaskOutputSchema = z.object({
  title: z.string().describe('The task title.'),
  details: z.string().describe('Detailed implementation guidance with documentation references.'),
  identifiedLibraries: z.array(z.object({
    name: z.string(),
    category: z.enum(['frontend', 'backend', 'database', 'testing', 'utility']),
  })).describe('Libraries identified in this task.'),
});

export type EnhancedTaskOutput = z.infer<typeof EnhancedTaskOutputSchema>;

/**
 * Service for enhanced task research with documentation integration
 */
export class EnhancedTaskResearchService {
  
  private readonly fetcher: DocumentationFetcher;
  private readonly maxLibrariesPerTask = 5; // Limit libraries per task to avoid overwhelming

  constructor(settings?: any) {
    this.fetcher = new DocumentationFetcher();
  }

  /**
   * Research a single task with documentation enrichment
   */
  async researchTaskWithDocumentation(
    input: EnhancedTaskResearchInput,
    apiKey?: string, 
    model?: string
  ): Promise<EnhancedTaskOutput> {
    
    // Step 1: Identify libraries in the task context
    const combinedContext = `${input.title} ${input.architecture} ${input.specifications}`;
    const identifiedLibraries = LibraryIdentifier.identifyLibraries(combinedContext);
    
    // Limit to most relevant libraries per task
    const targetLibraries = identifiedLibraries.slice(0, this.maxLibrariesPerTask);
    
    if (targetLibraries.length === 0) {
      // No libraries identified, use standard task research
      return await this.standardTaskResearch(input, apiKey, model);
    }

    // Step 2: Fetch documentation for identified libraries
    const libraryNames = targetLibraries.map(lib => lib.name);
    
    console.log(`Fetching documentation for libraries: ${libraryNames.join(', ')}`);
    const libraryDocumentation = await this.fetcher.fetchMultipleLibrariesDocumentation(
      libraryNames,
      input.documentationSettings
    );

    // Create documentation mapping for enrichment
    const docMapping: { [libraryName: string]: FetchedDocumentation[] } = {};
    libraryDocumentation.forEach(libDoc => {
      docMapping[libDoc.libraryName] = libDoc.documentationSources;
    });

    // Step 3: Enhance task research prompt with documentation context
    const enhancedPrompt = this.createEnhancedTaskResearchPrompt(input, targetLibraries);
    
    // Step 4: Generate task with documentation-aware guidance
    const enhancedTask = await this.generateEnhancedTask(
      enhancedPrompt, 
      docMapping,
      apiKey, 
      model
    );

    return {
      ...enhancedTask,
      identifiedLibraries: targetLibraries.map(lib => ({
        name: lib.name,
        category: lib.category
      }))
    };
  }

  /**
   * Standard task research fallback when no libraries are identified
   */
  private async standardTaskResearch(
    input: EnhancedTaskResearchInput,
    apiKey?: string, 
    model?: string
  ): Promise<EnhancedTaskOutput> {
    
    const prompt = this.createStandardTaskResearchPrompt(input);
    
    return await generateEnhancedTaskWithDocumentation(
      prompt,
      {}, // Empty documentation mapping
      apiKey, 
      model
    );
  }

  /**
   * Create enhanced task research prompt with documentation context
   */
  private createEnhancedTaskResearchPrompt(
    input: EnhancedTaskResearchInput,
    identifiedLibraries: LibraryIdentification[]
  ): string {
    
 const documentationReference = `IMPORTANT CONTEXT FOR TASK RESEARCH:
The task involves the following libraries that have been identified from project context:

${identifiedLibraries.map(lib => 
  `- ${lib.name} (${lib.category}) - Confidence: ${lib.confidenceScore}%`
).join('\n')}

RESEARCH INSTRUCTIONS:
1. Provide detailed implementation guidance that leverages the identified libraries
2. Include specific references to library documentation where applicable  
3. Ensure task guidance is compatible with the identified technology stack
4. Consider integration patterns between libraries if multiple are involved

Standard task research instructions follow below.`;

    const standardPrompt = this.createStandardTaskResearchPrompt(input);
    
    return `${documentationReference}\n\n${standardPrompt}`;
  }

  /**
   * Create standard task research prompt (existing functionality)
   */
  private createStandardTaskResearchPrompt(input: EnhancedTaskResearchInput): string {
    return `You are an expert software researcher providing detailed implementation guidance for a development task.

Task Title: ${input.title}

Project Context:
Architecture Overview:
${input.architecture}

Technical Specifications:
${input.specifications}

File Structure Information:  
${input.fileStructure}

Research Requirements:
1. Provide comprehensive implementation guidance for this specific task
2. Include relevant technical details, patterns, and best practices
3. Consider the existing project architecture and file structure  
4. Provide clear step-by-step implementation approach
5. Include any necessary setup, configuration, or integration details

Generate detailed research guidance for implementing this task within the specified project context.`;
  }

  /**
   * Generate enhanced task with documentation-aware AI model
   */
  private async generateEnhancedTask(
    prompt: string,
    documentationMapping: { [libraryName: string]: FetchedDocumentation[] },
    apiKey?: string,
    model?: string
  ): Promise<EnhancedTaskOutput> {
    
    const modelName = model ? `googleai/${model}` : 'googleai/gemini-1.5-flash-latest';
    const options = apiKey ? {apiKey} : {};
    
    // Note: This would use the GenKit AI framework like existing task research
    const {output} = await ai.generate({
      model: modelName,
      prompt: prompt,
      output: {
        schema: EnhancedTaskOutputSchema
      }
    });

    return output!;
  }

  /**
   * Research multiple tasks with documentation integration
   */
  async researchMultipleTasksWithDocumentation(
    inputs: EnhancedTaskResearchInput[],
    apiKey?: string,
    model?: string
  ): Promise<EnhancedTaskOutput[]> {
    
    const results: EnhancedTaskOutput[] = [];
    
    // Process tasks in batches to respect rate limits
    const batchSize = 3;
    for (let i = 0; i < inputs.length; i += batchSize) {
      const batch = inputs.slice(i, i + batchSize);
      
      try {
        await Promise.allSettled(
          batch.map(input => 
            this.researchTaskWithDocumentation(input, apiKey, model)
              .then(result => results.push(result))
          )
        );
        
        // Small delay between batches
        if (i + batchSize < inputs.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.warn(`Error processing batch ${i}-${i + batchSize}:`, error);
      }
    }

    return results;
  }
}

/**
 * Standalone function for backward compatibility
 */
export async function researchTaskWithDocumentation(
  input: EnhancedTaskResearchInput,
  apiKey?: string, 
  model?: string
): Promise<EnhancedTaskOutput> {
  
  const service = new EnhancedTaskResearchService();
  return await service.researchTaskWithDocumentation(input, apiKey, model);
}

/**
 * Generate enhanced task with documentation (for GenKit compatibility)
 */
async function generateEnhancedTaskWithDocumentation(
  prompt: string,
  documentationMapping: { [libraryName: string]: FetchedDocumentation[] },
  apiKey?: string, 
  model?: string
): Promise<EnhancedTaskOutput> {
  
  const modelName = model ? `googleai/${model}` : 'googleai/gemini-1.5-flash-latest';
  const options = apiKey ? {apiKey} : {};
  
  // Note: This would use the GenKit AI framework like existing task research
  const {output} = await ai.generate({
    model: modelName,
    prompt: prompt,
    output: {
      schema: EnhancedTaskOutputSchema
    }
  });

  return output!;
}

