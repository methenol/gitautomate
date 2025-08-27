

import { Context7MCPClient } from './context7-mcp-client';


export interface DocumentationFetchProgress {
  totalLibraries: number;
  completedLibraries: number;
  currentLibrary?: string;
  successCount: number;
  errorCount: number;
}

export interface DocumentationResult {
  libraryDocs: Array<{
    libraryName: string;
    filename: string;
    content: string;
  }>;
  progress: DocumentationFetchProgress;
}

export class DocumentationFetcher {
  
  private mcpClient: Context7MCPClient;

  constructor(mcpClient: Context7MCPClient) {
    this.mcpClient = mcpClient;
  }

  async fetchAllDocumentation(
    libraries: Array<{ name: string; category?: string }>,
    onProgressUpdate?: (progress: DocumentationFetchProgress) => void
  ): Promise<DocumentationResult> {
    const libraryDocs = [];
    let completedLibraries = 0;
    let successCount = 0;
    const errorCount = 0;

    const progress: DocumentationFetchProgress = {
      totalLibraries: libraries.length,
      completedLibraries: 0,
      successCount: 0,
      errorCount: 0
    };

    // Sequential processing with respect delays to avoid MCP server overload
    for (const library of libraries) {
      if (!library.name || library.name.trim().length === 0) {
        continue;
      }

      progress.currentLibrary = library.name;
      
      try {
        console.log(`[Documentation Fetcher] Processing: ${library.name}`);
        
        // Step 1: Resolve library to Context7 ID
        const contextMatches = await this.mcpClient.resolveLibraryToContextId(library.name);
        
        if (!contextMatches || contextMatches.length === 0) {
          console.warn(`[Documentation Fetcher] No Context7 matches found for: ${library.name}`);
          
          // Try variations of the library name
          const variations = this.generateLibraryVariations(library.name);
          
          for (const variation of variations) {
            const varMatches = await this.mcpClient.resolveLibraryToContextId(variation);
            
            if (varMatches && varMatches.length > 0) {
              // Use the first match from a successful variation
              const contextId = (varMatches[0] as any).library_id || (varMatches[0] as any).id;
              
              if (contextId) {
                // Step 2: Fetch documentation using the resolved ID
                const docContent = await this.mcpClient.fetchContextDocumentation(contextId);
                
                if (docContent) {
                  libraryDocs.push({
                    libraryName: library.name,
                    filename: this.generateSafeFilename(library.name),
                    content: docContent
                  });
                  
                  successCount++;
                  console.log(`[Documentation Fetcher] Successfully fetched documentation for: ${library.name}`);
                  
                  break; // Success, move to next library
                }
              }
            }
          }

        } else {
          // Use the best match (highest trust score or first one)
          const bestMatch = this.selectBestContext7Match(contextMatches);
          
          if (bestMatch) {
            const contextId = bestMatch.library_id || bestMatch.id;
            
            if (contextId) {
              // Step 2: Fetch documentation using the resolved ID
              const docContent = await this.mcpClient.fetchContextDocumentation(contextId);
              
              if (docContent) {
                libraryDocs.push({
                  libraryName: library.name,
                  filename: this.generateSafeFilename(library.name),
                  content: docContent
                });
                
                successCount++;
                console.log(`[Documentation Fetcher] Successfully fetched documentation for: ${library.name}`);
              } else {
                console.warn(`[Documentation Fetcher] No documentation content received for: ${library.name}`);
              }
            } else {
              console.warn(`[Documentation Fetcher] No valid context ID in match for: ${library.name}`);
            }
          } else {
            console.warn(`[Documentation Fetcher] No valid match found for: ${library.name}`);
          }
        }

      } catch (error) {
        console.error(`[Documentation Fetcher] Error processing ${library.name}:`, error);
        
        // Handle MCP server unavailability gracefully
        if (error instanceof Error && 
            error.message.includes('Context7 MCP server unavailable')) {
          console.error('[Documentation Fetcher] Context7 MCP server is not available. Stopping fetch process.');
          break;
        }
        
      } finally {
        completedLibraries++;
        progress.completedLibraries = completedLibraries;
        progress.successCount = successCount; 
        progress.errorCount = errorCount + (libraryDocs.length === libraryDocs.filter(d => d.libraryName !== library.name).length ? 1 : 0);
        
        // Notify progress update
        if (onProgressUpdate) {
          onProgressUpdate({ ...progress });
        }

        // Add delay between requests to respect MCP server limits
        if (completedLibraries < libraries.length) {
          console.log(`[Documentation Fetcher] Waiting before next request...`);
          
          // Wait longer if we had errors to avoid overwhelming the server
          const delay = errorCount > 2 ? 2000 : Math.max(500, completedLibraries * 100);
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // Update progress for this specific library completion
      if (onProgressUpdate) {
        onProgressUpdate({ ...progress });
      }
    }

    return {
      libraryDocs,
      progress: { 
        totalLibraries: libraries.length, 
        completedLibraries,
        successCount,
        errorCount
      }
    };
  }

  private generateLibraryVariations(libraryName: string): string[] {
    const variations = [libraryName];
    
    // Remove common prefixes/suffixes
    if (libraryName.startsWith('@')) {
      variations.push(libraryName.substring(1));
    }
    
    // Handle hyphenated vs camelCase
    if (libraryName.includes('-')) {
      variations.push(libraryName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()));
    } else if (libraryName.match(/[A-Z]/)) {
      variations.push(libraryName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase());
    }
    
    // Handle common abbreviations
    const abbreviationMap: Record<string, string[]> = {
      'reactjs': ['react'],
      'nextjs': ['next'],
      'typescript': ['ts', '@types/ts'],
    };
    
    const key = libraryName.toLowerCase();
    if (abbreviationMap[key]) {
      variations.push(...abbreviationMap[key]);
    }
    
    return [...new Set(variations.filter(v => v && v.trim().length > 0))];
  }

  private selectBestContext7Match(matches: any[]): any | null {
    if (!matches || matches.length === 0) return null;
    
    // Sort by trust score (higher is better), then CodeSnippets count
    const sorted = matches.sort((a, b) => {
      if (b.trustScore !== a.trustScore) return b.trustScore - a.trustScore;
      if (b.codeSnippets && a.codeSnippets) return b.codeSnippets - a.codeSnippets;
      return 0;
    });
    
    // Return the match with highest trust score (minimum 7)
    const bestMatch = sorted.find(match => 
      match.trustScore >= (match.library_id ? 7 : 5) // Lower threshold if we have library_id
    );
    
    return bestMatch || sorted[0]; // Fallback to first match if none meet threshold
  }

  private generateSafeFilename(libraryName: string): string {
    // Remove special characters and spaces, replace with underscores
    return libraryName
      .replace(/[^a-zA-Z0-9\-_]/g, '-')
      .replace(/-{2,}/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, '')  // Remove leading/trailing hyphens
      .toLowerCase() + '.md';
  }

  async cleanup(): Promise<void> {
    // Clean up MCP client resources
    await this.mcpClient.close();
  }
}



