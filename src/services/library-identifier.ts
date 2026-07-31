import type { IdentifiedLibrary } from '@/types/documentation';
import { extractLibraries } from '@/ai/flows/extract-libraries';

export class LibraryIdentifier {
  /**
   * Identifies libraries mentioned in task details using LLM extraction
   * Uses LLM analysis to extract actual library names from task content
   */
  static async identifyLibraries(
    tasks: Array<{ id: string; title: string; details: string }>,
    apiKey?: string,
    model?: string,
    apiBase?: string
  ): Promise<IdentifiedLibrary[]> {
    const identified = new Map<string, IdentifiedLibrary>();

    // A missing model is a configuration error, not a per-task failure. Without this
    // check every task fails identically and the caller gets a silent empty list —
    // which looked like "no libraries in this project" rather than "not configured".
    if (!model) {
      throw new Error(
        'Model is required to identify libraries. Provide a model in "provider/model" format in settings.'
      );
    }

    for (const task of tasks) {
      const text = `${task.title} ${task.details}`;
      
      try {
        // Use LLM to extract libraries from task content
        const extractionResult = await extractLibraries(
          { taskDetails: text },
          apiKey,
          model,
          apiBase
        );
        
        for (const libraryName of extractionResult.libraries) {
          const key = libraryName.toLowerCase();
          
          if (identified.has(key)) {
            const existing = identified.get(key)!;
            existing.confidenceScore = Math.max(existing.confidenceScore, 0.9);
            existing.detectedIn.push(task.id);
          } else {
            identified.set(key, {
              name: libraryName,
              confidenceScore: 0.9, // High confidence since LLM extracted
              category: 'library',
              detectedIn: [task.id],
              source: 'llm' as const,
              context: `Extracted from task: ${task.title}`,
            });
          }
        }
      } catch (error) {
        console.warn(`Failed to extract libraries from task ${task.id}:`, error);
        // Continue with other tasks if one fails
      }
    }

    // Sort by confidence score descending
    return Array.from(identified.values())
      .sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  /**
   * Filter libraries by minimum confidence and category
   */
  static filterLibraries(
    libraries: IdentifiedLibrary[], 
    options: {
      minConfidence?: number;
      categories?: string[];
      maxCount?: number;
    } = {}
  ): IdentifiedLibrary[] {
    const { minConfidence = 0.6, categories, maxCount = 15 } = options;
    
    let filtered = libraries.filter(lib => lib.confidenceScore >= minConfidence);
    
    if (categories && categories.length > 0) {
      filtered = filtered.filter(lib => categories.includes(lib.category));
    }
    
    return filtered.slice(0, maxCount);
  }
}