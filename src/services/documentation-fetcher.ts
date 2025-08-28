/**
 * @fileOverview Documentation Fetcher Service - Orchestrates library resolution and doc fetching
 * 
 * This service:
 * - Sequential processing with respect delays to avoid MCP server overload
 * - Graceful handling of resolution failures and unknown libraries
 * - Only includes successfully fetched documentation in exports
 * - Progress tracking for user feedback
 */

import { resolveLibraryToContextId, fetchContextDocumentation, LibraryResolution, DocumentationResult } from '@/app/context7-actions';
import { IdentifiedLibrary } from './library-identifier';

export interface DocumentationFile {
  filename: string;
  content: string;
  libraryName: string;
  metadata?: {
    source?: string;
    lastUpdated?: string;
    version?: string;
  };
}

export interface FetchProgress {
  current: number;
  total: number;
  currentLibrary: string;
  status: 'resolving' | 'fetching' | 'complete' | 'error';
}

export interface DocumentationFetchResult {
  documentationFiles: DocumentationFile[];
  successCount: number;
  failureCount: number;
  errors: string[];
}

export interface DocumentationFetchOptions {
  respectDelay?: number; // Delay between requests in ms (default 500)
  maxRetries?: number; // Max retry attempts per library (default 2)
  onProgress?: (progress: FetchProgress) => void; // Progress callback
}

export class DocumentationFetcherService {
  
  /**
   * Fetch documentation for all identified libraries
   */
  async fetchDocumentationForLibraries(
    libraries: IdentifiedLibrary[],
    options: DocumentationFetchOptions = {}
  ): Promise<DocumentationFetchResult> {
    
    const {
      respectDelay = 500,
      maxRetries = 2,
      onProgress
    } = options;

    const documentationFiles: DocumentationFile[] = [];
    const errors: string[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < libraries.length; i++) {
      const library = libraries[i];
      
      // Report progress
      onProgress?.({
        current: i + 1,
        total: libraries.length,
        currentLibrary: library.name,
        status: 'resolving'
      });

      try {
        // Step 1: Resolve library to Context7 ID
        const resolutions = await this.resolveLibraryWithRetry(
          library.name, 
          maxRetries
        );

        if (resolutions.length === 0) {
          errors.push(`No Context7 resolution found for: ${library.name}`);
          failureCount++;
          continue;
        }

        // Use the highest trust score resolution
        const bestResolution = resolutions.reduce((best, current) => 
          current.trustScore > best.trustScore ? current : best
        );

        // Report fetching progress
        onProgress?.({
          current: i + 1,
          total: libraries.length,
          currentLibrary: library.name,
          status: 'fetching'
        });

        // Step 2: Fetch documentation
        const documentation = await this.fetchDocumentationWithRetry(
          bestResolution.libraryId,
          maxRetries
        );

        if (documentation) {
          const filename = this.generateDocumentationFilename(library.name);
          documentationFiles.push({
            filename,
            content: documentation.content,
            libraryName: library.name,
            metadata: documentation.metadata
          });
          successCount++;
        } else {
          errors.push(`Failed to fetch documentation for: ${library.name} (ID: ${bestResolution.libraryId})`);
          failureCount++;
        }

      } catch (error) {
        const errorMessage = `Error processing ${library.name}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMessage);
        failureCount++;
        console.error(errorMessage);
      }

      // Respect delay between requests (except for last item)
      if (i < libraries.length - 1) {
        await this.delay(respectDelay);
      }
    }

    // Report completion
    onProgress?.({
      current: libraries.length,
      total: libraries.length,
      currentLibrary: '',
      status: 'complete'
    });

    return {
      documentationFiles,
      successCount,
      failureCount,
      errors
    };
  }

  /**
   * Resolve library with retry logic
   */
  private async resolveLibraryWithRetry(
    libraryName: string,
    maxRetries: number
  ): Promise<LibraryResolution[]> {
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const resolutions = await resolveLibraryToContextId(libraryName);
        if (resolutions.length > 0) {
          return resolutions;
        }
        
        // Try alternative naming patterns on subsequent attempts
        if (attempt < maxRetries) {
          const alternativeName = this.generateAlternativeName(libraryName, attempt);
          if (alternativeName !== libraryName) {
            const altResolutions = await resolveLibraryToContextId(alternativeName);
            if (altResolutions.length > 0) {
              return altResolutions;
            }
          }
        }
        
      } catch (error) {
        console.error(`Attempt ${attempt} failed for ${libraryName}:`, error);
        if (attempt === maxRetries) {
          throw error;
        }
        // Wait before retry
        await this.delay(1000 * attempt);
      }
    }
    
    return [];
  }

  /**
   * Fetch documentation with retry logic
   */
  private async fetchDocumentationWithRetry(
    contextId: string,
    maxRetries: number
  ): Promise<DocumentationResult | null> {
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const documentation = await fetchContextDocumentation(contextId);
        if (documentation && documentation.content) {
          return documentation;
        }
      } catch (error) {
        console.error(`Attempt ${attempt} failed for context ${contextId}:`, error);
        if (attempt === maxRetries) {
          throw error;
        }
        // Wait before retry
        await this.delay(1000 * attempt);
      }
    }
    
    return null;
  }

  /**
   * Generate alternative library names for resolution
   */
  private generateAlternativeName(libraryName: string, attempt: number): string {
    switch (attempt) {
      case 2:
        // Try with .js suffix
        if (!libraryName.endsWith('.js')) {
          return `${libraryName}.js`;
        }
        // Try without version numbers
        return libraryName.replace(/\d+/g, '').replace(/[-.]/g, '');
      
      case 3:
        // Try lowercase
        return libraryName.toLowerCase();
      
      default:
        return libraryName;
    }
  }

  /**
   * Generate safe filename for documentation
   */
  private generateDocumentationFilename(libraryName: string): string {
    const safeName = libraryName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    return `${safeName}.md`;
  }

  /**
   * Create delay promise
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Format documentation content with metadata header
   */
  formatDocumentationContent(docFile: DocumentationFile): string {
    const header = `# ${docFile.libraryName} Documentation

> **Source**: ${docFile.metadata?.source || 'Context7'}  
> **Last Updated**: ${docFile.metadata?.lastUpdated || 'Unknown'}  
> **Version**: ${docFile.metadata?.version || 'Latest'}

---

`;

    return header + docFile.content;
  }
}

// Singleton instance
let documentationFetcher: DocumentationFetcherService | null = null;

/**
 * Get the global documentation fetcher service instance
 */
export function getDocumentationFetcherService(): DocumentationFetcherService {
  if (!documentationFetcher) {
    documentationFetcher = new DocumentationFetcherService();
  }
  return documentationFetcher;
}