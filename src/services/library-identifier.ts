/**
 * @fileOverview Library Identifier Service - Client-side wrapper for library identification
 * 
 * This service:
 * - Provides client-side interface for library identification
 * - Delegates AI analysis to server actions
 * - Includes fallback pattern matching
 */

import type { Task } from '@/types';
import { runIdentifyLibraries, type IdentifiedLibrary, type LibraryIdentificationOptions } from '@/app/library-actions';

export type { IdentifiedLibrary, LibraryCategory } from '@/app/library-actions';

export class LibraryIdentifierService {
  
  /**
   * Analyze all tasks to identify mentioned libraries and frameworks
   */
  async identifyLibrariesFromTasks(
    tasks: Task[], 
    options: LibraryIdentificationOptions = {}
  ): Promise<IdentifiedLibrary[]> {
    
    if (tasks.length === 0) {
      return [];
    }

    try {
      // Delegate to server action for AI analysis
      return await runIdentifyLibraries(tasks, options);
    } catch (error) {
      console.error('Failed to identify libraries from tasks:', error);
      return [];
    }
  }
}

// Singleton instance
let libraryIdentifier: LibraryIdentifierService | null = null;

/**
 * Get the global library identifier service instance
 */
export function getLibraryIdentifierService(): LibraryIdentifierService {
  if (!libraryIdentifier) {
    libraryIdentifier = new LibraryIdentifierService();
  }
  return libraryIdentifier;
}