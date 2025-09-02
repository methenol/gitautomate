/**
 * Task Documentation Integration Service
 * 
 * This service integrates documentation fetching with the existing task generation workflow,
 * enhancing tasks with relevant library references and context.
 */

import { documentationFetcher, type IdentifiedLibrary, type LibraryDocumentation } from './documentation-fetcher';
import { defaultDocumentationSettings, documentationSettingsSchema, type DocumentationSettings } from './documentation-settings';

export interface EnhancedTask {
  title: string;
  details: string;
  relevantLibraries?: IdentifiedLibrary[];
  documentationReferences?: LibraryDocumentation[];
}

export interface TaskEnhancementResult {
  enhancedTasks: EnhancedTask[];
  identifiedLibraries: IdentifiedLibrary[];
  fetchedDocumentation: LibraryDocumentation[];
}

export class TaskDocumentationIntegration {
  
  private settings: DocumentationSettings;

  constructor(settings?: Partial<DocumentationSettings>) {
    this.settings = documentationSettingsSchema.parse({ ...defaultDocumentationSettings, ...settings });
  }

  /**
   * Enhance tasks with library documentation references
   */
  async enhanceTasksWithDocumentation(
    architecture: string,
    specifications: string, 
    fileStructure: string,
    tasks: { title: string; details: string }[]
  ): Promise<TaskEnhancementResult> {
    
    console.log('Starting task documentation enhancement...');
    
    // Step 1: Identify libraries in project context
    console.log('Identifying relevant libraries...');
    const identifiedLibraries = await documentationFetcher.identifyLibraries(
      architecture,
      specifications, 
      fileStructure
    );
    
    console.log(`Found ${identifiedLibraries.length} potential libraries:`, 
      identifiedLibraries.map(lib => lib.name).join(', '));
    
    // Step 2: Filter libraries based on confidence score
    const highConfidenceLibraries = identifiedLibraries.filter(
      lib => lib.confidenceScore >= this.settings.minimumConfidenceScore
    );
    
    console.log(`Filtered to ${highConfidenceLibraries.length} high-confidence libraries`);
    
    // Step 3: Limit number of libraries to process
    const limitedLibraries = highConfidenceLibraries.slice(0, this.settings.maxLibrariesPerExport);
    
    // Step 4: Fetch documentation for selected libraries
    console.log('Fetching library documentation...');
    const fetchedDocumentation = await this.fetchLimitedDocumentation(limitedLibraries);
    
    console.log(`Fetched documentation for ${fetchedDocumentation.length} libraries`);
    
    // Step 5: Enhance individual tasks with relevant library references
    const enhancedTasks = this.enhanceTasksWithLibraryReferences(
      tasks, 
      limitedLibraries,
      fetchedDocumentation
    );

    return {
      enhancedTasks,
      identifiedLibraries: limitedLibraries,
      fetchedDocumentation
    };
  }

  /**
   * Fetch documentation with size and rate limiting
   */
  private async fetchLimitedDocumentation(libraries: IdentifiedLibrary[]): Promise<LibraryDocumentation[]> {
    if (libraries.length === 0) return [];

    try {
      const documentation = await documentationFetcher.fetchLibraryDocumentation(
        libraries.map(lib => lib.name),
        {
          includeGitHub: this.settings.documentationSources !== 'github-only',
          includeOfficialSites: true
        }
      );

      // Apply size limits to prevent overly large exports
      const limitedDocumentation = this.applySizeLimits(documentation);
      
      return limitedDocumentation;
    } catch (error) {
      console.error('Error fetching documentation:', error);
      
      // Return fallback content for each library
      return libraries.map(lib => ({
        name: lib.name,
        source: 'github' as const,
        content: `# ${lib.name} Documentation\n\nUnable to fetch documentation for ${lib.name}. Please check the official repository or website: https://github.com/${lib.name}/${lib.name}\n\nThis library was identified in your project with ${Math.round(lib.confidenceScore * 100)}% confidence.`,
        url: `https://github.com/${lib.name}`,
        fetchedAt: new Date()
      }));
    }
  }

  /**
   * Apply size limits to documentation content
   */
  private applySizeLimits(documentation: LibraryDocumentation[]): LibraryDocumentation[] {
    const maxSizeBytes = this.settings.maxDocumentationSizeKB * 1024;
    
    return documentation
      .map(doc => {
        // Truncate if too large, but preserve key sections
        const content = doc.content;
        
        if (content.length <= maxSizeBytes) {
          return doc; // Within limit, no changes needed
        }
        
        const truncatedContent = this.truncateDocumentation(content, maxSizeBytes);
        
        return {
          ...doc,
          content: truncatedContent
        };
      })
      .filter(doc => doc.content.trim().length > 0 || !this.settings.skipLibrariesWithNoDocumentation);
  }

  /**
   * Intelligently truncate documentation to stay within size limits
   */
  private truncateDocumentation(content: string, maxSizeBytes: number): string {
    // Try to preserve key sections by looking at markdown structure
    const lines = content.split('\n');
    
    // Look for key sections to preserve first
    let importantContent: string[] = [];
    const importantPatterns = [
      /^# /, // Main title
      /^## Getting Started/,
      /^## Installation/, 
      /^## Usage/,
      /^## API Reference/
    ];
    
    let foundImportantSection = false;
    
    for (const line of lines) {
      const contentSoFar = [...importantContent, line].join('\n');
      
      if (contentSoFar.length > maxSizeBytes) {
        break; // Would exceed limit
      }
      
      const isImportant = importantPatterns.some(pattern => pattern.test(line));
      
      if (isImportant && !foundImportantSection) {
        foundImportantSection = true;
      }
      
      if ((isImportant || foundImportantSection) && line.trim()) {
        importantContent.push(line);
        
        // Stop adding if we hit the limit
        const currentSize = importantContent.join('\n').length;
        
        if (currentSize >= maxSizeBytes * 0.9) { // Leave some buffer
          break;
        }
      }
    }

    const truncated = importantContent.join('\n').trim();
    
    // Add truncation notice if we actually cut something
    const originalSize = content.length;
    
    if (originalSize > maxSizeBytes && truncated.split('\n').length < lines.length) {
      const finalContent = `${truncated}\n\n---\n*Note: Documentation was truncated to stay within export size limits (${Math.round(maxSizeBytes / 1024)}KB). The full documentation may be available at: https://github.com*`;
      
      return finalContent;
    }
    
    return truncated || content.substring(0, maxSizeBytes);
  }

  /**
   * Enhance individual tasks with relevant library references
   */
  private enhanceTasksWithLibraryReferences(
    originalTasks: { title: string; details: string }[],
    libraries: IdentifiedLibrary[], 
    documentation: LibraryDocumentation[]
  ): EnhancedTask[] {
    
    // Create a map for easy lookup
    const documentationMap = new Map<string, LibraryDocumentation[]>();
    
    libraries.forEach(lib => {
      const docsForLib = documentation.filter(doc => 
        doc.name.toLowerCase() === lib.name.toLowerCase()
      );
      
      if (docsForLib.length > 0) {
        documentationMap.set(lib.name.toLowerCase(), docsForLib);
      }
    });

    return originalTasks.map(task => {
      const enhancedTask: EnhancedTask = { ...task };
      
      // Find relevant libraries for this task
      const taskTextLower = `${task.title} ${task.details}`.toLowerCase();
      
      // Find libraries mentioned in this task
      const relevantLibraries = libraries.filter(lib => {
        return lib.name.toLowerCase().split(' ').some(word =>
          taskTextLower.includes(word)
        );
      });

      // Find documentation for relevant libraries
      const docReferences: LibraryDocumentation[] = [];
      
      relevantLibraries.forEach(lib => {
        const docs = documentationMap.get(lib.name.toLowerCase());
        
        if (docs && docs.length > 0) {
          // Take the first documentation entry per library
          docReferences.push(docs[0]);
        }
      });

      // Enhance task details with documentation references
      if (docReferences.length > 0) {
        enhancedTask.relevantLibraries = relevantLibraries;
        
        // Create documentation reference section
        const referencesSection = this.createDocumentationReferences(docReferences);
        
        enhancedTask.details = `${task.details}\n\n${referencesSection}`;
      }

      return enhancedTask;
    });
  }

  /**
   * Create documentation reference section for tasks
   */
  private createDocumentationReferences(references: LibraryDocumentation[]): string {
    const referenceLines = references.map(doc => {
      let sourceDescription;
      
      switch (doc.source) {
        case 'github':
          sourceDescription = `GitHub Repository`;
          break;
        case 'official-site':
          sourceDescription = `Official Documentation`; 
          break;
        default:
          sourceDescription = doc.source.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
      
      return `**${doc.name} (${sourceDescription}):** ${doc.url ? `[View Online](${doc.url})` : ''}`;
    });

    const referenceContent = `## Relevant Library Documentation\n\n${referenceLines.join('\n')}\n\n**IMPORTANT:** Before implementing this task, review the relevant library documentation above to ensure context-aware implementation.`;

    return referenceContent;
  }

  /**
   * Create structured documentation export for the zip file
   */
  createDocumentationExportStructure(
    libraries: IdentifiedLibrary[],
    documentation: LibraryDocumentation[]
  ): { contentByCategory: Record<string, string[]>; flatReferences: string[] } {
    
    const contentByCategory = {} as Record<string, string[]>;
    const flatReferences: string[] = [];

    // Group documentation by library category
    libraries.forEach(lib => {
      const docsForLib = documentation.filter(doc =>
        doc.name.toLowerCase() === lib.name.toLowerCase()
      );
      
      if (docsForLib.length > 0) {
        // Initialize category array
        contentByCategory[lib.category] = contentByCategory[lib.category] || [];
        
        // Create a properly named file for each documentation source
        docsForLib.forEach((doc, index) => {
          const fileName = `${lib.name}-${doc.source}${docsForLib.length > 1 ? `-${index + 1}` : ''}.md`;
          const content = this.createFormattedDocumentationFile(lib, doc);
          
          if (this.settings.createReferenceFolderStructure === 'by-category') {
            contentByCategory[lib.category].push(`${fileName}\n${content}`);
          } else {
            flatReferences.push(`reference/${fileName}: ${lib.name} (${doc.source})`);
          }
        });
      } else {
        // Create placeholder documentation for libraries without docs
        const fileName = `${lib.name}-placeholder.md`;
        const content = `# ${lib.name} Documentation\n\nDocumentation not available for this library. Please check the official repository: https://github.com/${lib.name}/${lib.name}`;
        
        if (this.settings.createReferenceFolderStructure === 'by-category') {
          contentByCategory[lib.category] = contentByCategory[lib.category] || [];
          contentByCategory[lib.category].push(`${fileName}\n${content}`);
        } else {
          flatReferences.push(`reference/${fileName}: ${lib.name} (placeholder)`);
        }
      }
    });

    return { contentByCategory, flatReferences };
  }

  /**
   * Create properly formatted documentation file for export
   */
  private createFormattedDocumentationFile(
    library: IdentifiedLibrary, 
    documentation: LibraryDocumentation
  ): string {
    
    const formattedContent = `# ${library.name} Documentation

**Source:** ${documentation.source}
**Confidence Score:** ${(library.confidenceScore * 100).toFixed(0)}%
**Category:** ${library.category}
${documentation.url ? `**Repository/Website:** [Link](${documentation.url})` : ''}

---

${documentation.content}
`;

    return formattedContent;
  }

  /**
   * Update settings dynamically
   */
  updateSettings(settings: Partial<DocumentationSettings>): void {
    const newSettings = { ...this.settings, ...settings };
    
    // Validate and update
    this.settings = documentationSettingsSchema.parse(newSettings);
  }

  /**
   * Get current settings
   */
  getSettings(): DocumentationSettings {
    return { ...this.settings };
  }
}

/**
 * Factory function for TaskDocumentationIntegration
 */
export const taskDocumentationIntegration = new TaskDocumentationIntegration();

// Export types for external use
export type { IdentifiedLibrary, LibraryDocumentation };
