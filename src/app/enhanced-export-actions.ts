

'use server';

/**
 * Enhanced Export Actions with Documentation Integration
 *
 * This module provides export functionality that includes:
 * 1. Standard project documentation (PRD, Architecture, etc.)
 * 2. Library documentation fetched from multiple sources
 * 3. Task-specific reference materials  
 * 4. Enhanced AGENTS.md with contextual documentation links
 */

import {
  LibraryIdentifier,
  DocumentationFetcher,
  type FetchedDocumentation,
  type LibraryIdentification,
  type LibraryDocumentation
} from '@/ai/services/documentation-fetcher';


// Enhanced export input with documentation settings
export interface ExportWithDocumentationOptions {
  includeLibraryDocs: boolean;
  maxLibrariesPerTask?: number;
  documentationSettings?: {
    sources: 'github-only' | 'multi-source';
    includeStackOverflow: boolean;
    maxDocumentationSizeKB?: number;
  };
}

/**
 * Service for enhanced export with documentation integration
 */
export class EnhancedExportService {
  
  private readonly fetcher: DocumentationFetcher;

  constructor() {
    this.fetcher = new DocumentationFetcher();
  }

  /**
   * Generate enhanced export with documentation
   */
  async generateEnhancedExport(
    prd: string,
    architecture: string, 
    specifications: string,
    fileStructure: string,
    tasks: Array<{ title: string; details: string }>,
    options?: ExportWithDocumentationOptions
  ): Promise<{
    zipBlob: Blob;
    documentationSummary: {
      totalLibrariesIdentified: number;
      successfulFetches: number; 
      failedFetches: number;
    };
  }> {
    
    const finalOptions = options || { includeLibraryDocs: true };

    try {
      // Step 1: Identify all libraries across project context
      const combinedContext = `${prd} ${architecture} ${specifications}`;
      const allIdentifiedLibraries = LibraryIdentifier.identifyLibraries(combinedContext);
      
      console.log(`Identified ${allIdentifiedLibraries.length} libraries:`, 
        allIdentifiedLibraries.map(lib => lib.name).join(', '));

      let libraryDocumentation: LibraryDocumentation[] = [];
      
      if (finalOptions.includeLibraryDocs && allIdentifiedLibraries.length > 0) {
        // Step 2: Fetch documentation for identified libraries
        libraryDocumentation = await this.fetcher.fetchMultipleLibrariesDocumentation(
          allIdentifiedLibraries.map(lib => lib.name),
          finalOptions.documentationSettings
        );
      }

      // Step 3: Create enhanced export with documentation folder structure
      const zip = await this.createEnhancedExportZip(
        prd,
        architecture, 
        specifications,
        fileStructure,
        tasks,
        libraryDocumentation
      );

      const documentationSummary = {
        totalLibrariesIdentified: allIdentifiedLibraries.length,
        successfulFetches: libraryDocumentation.filter(lib => lib.documentationSources.length > 0).length,
        failedFetches: libraryDocumentation.filter(lib => lib.documentationSources.length === 0).length
      };

      return {
        zipBlob: await zip.generateAsync({ type: 'blob' }),
        documentationSummary
      };

    } catch (error) {
      console.error('Enhanced export failed:', error);
      
      // Fallback to basic export if documentation fails
      console.log('Falling back to basic export...');
      
      const { zipBlob } = await this.createBasicExportZip(
        prd,
        architecture, 
        specifications,
        fileStructure,
        tasks
      );
      
      return {
        zipBlob,
        documentationSummary: { totalLibrariesIdentified: 0, successfulFetches: 0, failedFetches: 0 }
      };
    }
  }

  /**
   * Create enhanced export ZIP with documentation folder structure
   */
  private async createEnhancedExportZip(
    prd: string,
    architecture: string, 
    specifications: string,
    fileStructure: string,
    tasks: Array<{ title: string; details: string }>,
    libraryDocumentation: LibraryDocumentation[]
  ): Promise<any> { // JSZip type

    const JSZip = (await import('jszip')).default;
    
    // Initialize ZIP structure
    const zip = new JSZip();
    
    // Create main documentation folder (existing functionality)
    const docsFolder = zip.folder('docs');
    if (!docsFolder) throw new Error('Could not create docs folder in zip file.');

    // Add main project documentation
    docsFolder.file('PRD.md', prd);
    docsFolder.file('ARCHITECTURE.md', architecture);
    docsFolder.file('SPECIFICATION.md', specifications);  
    docsFolder.file('FILE_STRUCTURE.md', fileStructure);

    // Create enhanced tasks folder with documentation references
    const tasksFolder = zip.folder('tasks');
    if (!tasksFolder) throw new Error('Could not create tasks folder in zip file.');

    // Create individual task files
    this.createTaskFiles(tasksFolder, tasks);

    // Add library documentation reference folder (NEW)
    if (libraryDocumentation.length > 0) {
      await this.addLibraryDocumentationFolder(zip, libraryDocumentation);
    }

    // Add enhanced AGENTS.md with contextual documentation links
    this.addEnhancedAgentsMd(zip, prd, architecture, specifications, fileStructure, tasks);

    return zip;
  }

  /**
   * Create basic export ZIP (fallback when documentation fails)
 */
  private async createBasicExportZip(
    prd: string,
    architecture: string, 
    specifications: string,
    fileStructure: string,
    tasks: Array<{ title: string; details: string }>
  ): Promise<any> { // JSZip type

    const JSZip = (await import('jszip')).default;
    
    // Initialize ZIP structure
    const zip = new JSZip();
    
    // Create main documentation folder (existing functionality)
    const docsFolder = zip.folder('docs');
    if (!docsFolder) throw new Error('Could not create docs folder in zip file.');

    // Add main project documentation
    docsFolder.file('PRD.md', prd);
    docsFolder.file('ARCHITECTURE.md', architecture);
    docsFolder.file('SPECIFICATION.md', specifications);  
    docsFolder.file('FILE_STRUCTURE.md', fileStructure);

    // Create tasks folder
    const tasksFolder = zip.folder('tasks');
    if (!tasksFolder) throw new Error('Could not create tasks folder in zip file.');

    // Create individual task files
    this.createTaskFiles(tasksFolder, tasks);

    return zip;
  }

  /**
   * Create task files in the export ZIP
   */
  private createTaskFiles(tasksFolder: any, tasks: Array<{ title: string; details: string }>): void {
    // Create main task list file
    const taskListContent = this.generateTaskList(tasks);
    tasksFolder.file('tasks.md', `# Task List\n\n${taskListContent}`);

    // Create individual task files
    tasks.forEach((task, index) => {
      const taskNumber = (index + 1).toString().padStart(3, '0');
      tasksFolder.file(`task-${taskNumber}.md`, `# ${task.title}\n\n${task.details}`);
    });
  }

  /**
   * Generate task list content
   */
  private generateTaskList(tasks: Array<{ title: string; details: string }>): string {
    return tasks.map((task, index) => 
      `- [ ] task-${(index + 1).toString().padStart(3, '0')}: ${task.title}`
    ).join('\n');
  }

  /**
   * Add library documentation reference folder to ZIP
   */
  private async addLibraryDocumentationFolder(zip: any, libraryDocs: LibraryDocumentation[]): Promise<void> {
    const referenceFolder = zip.folder('reference');
    
    if (!referenceFolder) throw new Error('Could not create reference folder in zip file.');

    // Create summary of library documentation
    const summaryContent = this.generateLibraryDocumentationSummary(libraryDocs);
    
    // Add README for reference folder
    referenceFolder.file('README.md', summaryContent);

    // Create category-based subfolders for better organization
    const categories = ['frontend', 'backend', 'database', 'testing', 'utility'];
    
    for (const category of categories) {
      const categoryDocs = libraryDocs.filter(lib => lib.category === category);
      
      if (categoryDocs.length > 0) {
        const catFolder = referenceFolder.folder(category);
        
        if (catFolder) {
          // Add category summary
          const catSummary = this.generateCategoryDocumentationSummary(category, categoryDocs);
          
          // Add individual library documentation files
          for (const libDoc of categoryDocs) {
            this.addLibraryDocumentationFiles(catFolder, libDoc);
          }
        }
      }
    }

    // Create a flat structure for easy access
    const libFolder = referenceFolder.folder('libraries');
    
    if (libFolder) {
      for (const libDoc of libraryDocs) {
        this.addLibraryDocumentationFiles(libFolder, libDoc);
      }
    }

    // Add metadata about the documentation fetch
    const metadataContent = this.generateDocumentationMetadata(libraryDocs);
    referenceFolder.file('documentation-metadata.json', JSON.stringify(metadataContent, null, 2));
    
    // Add usage instructions
 const instructions = `# Documentation Reference Usage

This folder contains documentation for libraries identified in your project.

## Folder Structure
- reference/ - Main reference folder with categorized documentation  
  - frontend, backend, etc. - Documentation by category
- README.md - Overview of available documentation

## How to Use During Development
1. Before implementing each task, review the relevant library documentation in this folder.

## Notes
- Documentation was automatically fetched from multiple sources (GitHub, official sites)
- Some libraries may not have complete documentation if fetch operations failed
`;

    referenceFolder.file('USAGE_INSTRUCTIONS.md', instructions);
  }

  /**
   * Generate library documentation summary
   */
  private generateLibraryDocumentationSummary(libraryDocs: LibraryDocumentation[]): string {
    const totalLibraries = libraryDocs.length;
    const successfulFetches = libraryDocs.filter(lib => lib.documentationSources.length > 0).length;
    const totalSizeKB = libraryDocs.reduce((total, lib) => total + lib.totalSizeKB, 0);

    return `# Library Documentation Summary

${totalLibraries} libraries were identified in your project.

## Fetch Results
- **Successful Documentation**: ${successfulFetches} libraries  
- **Missing Documentation**: ${totalLibraries - successfulFetches} libraries
- **Total Size**: ${Math.round(totalSizeKB)} KB

## Available Documentation Sources per Library
${libraryDocs.map(lib => 
  `- **${lib.libraryName}** (${lib.category}): ${lib.documentationSources.length > 0 ? lib.documentationSources.map(src => src.sourceType).join(', ') : 'No documentation available'}`
).join('\n')}

## Quick Reference
${libraryDocs.slice(0, 10).map(lib => 
  `- ${lib.libraryName} (${lib.category}) - Size: ~${Math.round(lib.totalSizeKB)} KB`
).join('\n')}

> **Note**: Review the \`documentation-metadata.json\` file for detailed information about each fetch operation.`;
  }

  /**
   * Generate category documentation summary
   */
  private generateCategoryDocumentationSummary(category: string, libraryDocs: LibraryDocumentation[]): string {
    return `# ${category.charAt(0).toUpperCase() + category.slice(1)} Libraries

${libraryDocs.map(lib => 
  `- **${lib.libraryName}** - Documentation size: ~${Math.round(lib.totalSizeKB)} KB`
).join('\n')}

## Documentation Sources
${libraryDocs.flatMap(lib => 
  lib.documentationSources.map(doc => `### ${lib.libraryName}\n**${doc.title}** (${doc.sourceType})\n\n> ${doc.content.substring(0, 200)}...`)
).join('\n---\n')}`;
  }

  /**
   * Add library documentation files to ZIP folder
   */
  private addLibraryDocumentationFiles(folder: any, libDoc: LibraryDocumentation): void {
    // Add a consolidated documentation file for each library
    const consolidatedContent = this.generateConsolidatedLibraryDocumentation(libDoc);
    
    // Create filename with source type suffix
    const safeName = libDoc.libraryName.replace(/[^a-zA-Z0-9.-]/g, '-');
    folder.file(`${safeName}-README.md`, consolidatedContent);

    // Add individual source files if they're substantial
    libDoc.documentationSources.forEach((doc, index) => {
      if (doc.content.length > 1000) { // Only add substantial docs as separate files
        const sourceName = `${safeName}-${doc.sourceType}.md`;
        
        // Add header with metadata
        const sourceContent = `# ${doc.title || doc.libraryName}

**Source**: ${doc.sourceType}  
**Fetched At**: ${doc.fetchedAt.toISOString()}  
**Size**: ~${Math.round(doc.sizeKB)} KB  

---

## Documentation Content

${doc.content}
`;
        
        folder.file(sourceName, sourceContent);
      }
    });
  }

  /**
   * Generate consolidated documentation file for a library
   */
  private generateConsolidatedLibraryDocumentation(libDoc: LibraryDocumentation): string {
    const timestamp = new Date().toISOString();
    
 let content = `# ${libDoc.libraryName} Documentation

**Category**: ${libDoc.category}  
**Last Updated**: ${timestamp}

## Available Documentation Sources

${libDoc.documentationSources.map((doc, index) => 
  `${index + 1}. **${doc.title || doc.libraryName}** (${doc.sourceType})\n   Size: ~${Math.round(doc.sizeKB)} KB\n`
).join('\n')}

## Quick Links

`;
    
    libDoc.documentationSources.forEach((doc, index) => {
      if (doc.url) {
        content += `- [${doc.title || doc.libraryName}](${doc.url})\n`;
      }
    });

 content += `\n---

## Detailed Documentation

`;

 libDoc.documentationSources.forEach((doc, index) => {
      content += `### ${index + 1}. ${doc.title || doc.libraryName} (${doc.sourceType})\n\n`;
      content += `${doc.content}\n---\n\n`;
    });

 return content;
  }

  /**
   * Generate documentation metadata
   */
  private generateDocumentationMetadata(libraryDocs: LibraryDocumentation[]): any {
    const totalLibraries = libraryDocs.length;
    const successfulFetches = libraryDocs.filter(lib => lib.documentationSources.length > 0).length;
    const totalSizeKB = libraryDocs.reduce((total, lib) => total + lib.totalSizeKB, 0);

    return {
      exportTimestamp: new Date().toISOString(),
      documentationStats: {
        totalLibrariesIdentified: totalLibraries,
        successfulDocumentationFetches: successfulFetches, 
        failedDocumentationFetches: totalLibraries - successfulFetches,
        totalSizeKB: Math.round(totalSizeKB),
      },
      libraries: libraryDocs.map(lib => ({
        name: lib.libraryName,
        category: lib.category, 
        documentationSourcesCount: lib.documentationSources.length,
        totalSizeKB: Math.round(lib.totalSizeKB),
        sources: lib.documentationSources.map(doc => ({
          type: doc.sourceType,
          sizeKB: Math.round(doc.sizeKB),
          url: doc.url
        }))
      })),
      notes: [
        'Documentation was fetched from multiple sources including GitHub, official websites, and MDN.',
        'Some fetch operations may have failed due to rate limits or network issues.', 
        'Library identification was based on patterns in project architecture and specifications.'
      ]
    };
  }

  /**
   * Add enhanced AGENTS.md with contextual documentation links
   */
  private addEnhancedAgentsMd(
    zip: any,
    prd: string, 
    architecture: string,
    specifications: string,
    fileStructure: string,
    tasks: Array<{ title: string; details: string }>
  ): void {
    
    // Generate enhanced AGENTS.md with documentation context
 const agentsMdContent = `# AI Developer Agents - Enhanced Project Context

## Project Overview  
${prd}

---

## Architecture & Specifications
### Proposed Architecture
${architecture}

### Technical Specifications  
${specifications}

### File Structure Plan
${fileStructure}

---

## Enhanced Development Context

**IMPORTANT**: This project includes comprehensive library documentation in the \`reference/\` folder. 

### Library Documentation Context
The following libraries have been identified and documented:

${tasks.map((task, index) => {
      const taskNumber = (index + 1).toString().padStart(3, '0');
      return `#### Task ${taskNumber}: ${task.title}`;
    }).join('\n\n')}

### Development Instructions
1. **Before implementing each task, review the relevant library documentation** in \`reference/\` folder
2. **Pay attention to specific patterns and best practices** mentioned for each library  
3. **Follow the documented integration approaches** when combining multiple libraries
4. **Use provided examples and API references** to ensure correct implementation

### Task Implementation Notes
${tasks.map((task, index) => {
      const taskNumber = (index + 1).toString().padStart(3, '0');
      return `- Task ${taskNumber}: ${task.title}`;
    }).join('\n')}

---

## AGENT INSTRUCTIONS

You are an AI developer working on ${tasks.length} tasks. 

**CRITICAL**: Before implementing any task, first check the \`reference/\` folder for relevant library documentation. Use this context to ensure accurate and efficient implementation.

**Key Context Points:**
- Library-specific APIs, patterns, and best practices are documented
- Integration examples for common library combinations  
- Performance considerations and optimization tips from official sources

**Implementation Workflow:**
1. Identify relevant libraries for the current task
2. Review library documentation in \`reference/\` folder  
3. Apply patterns and best practices from official sources
4. Ensure proper integration with existing project components

---

## Task List Implementation Order`;

    // Add AGENTS.md at root level (existing functionality)
 zip.file('AGENTS.md', agentsMdContent);
    
    // Add additional copies for different AI agent systems
 zip.file('.openhands/microagents/repo.md', agentsMdContent);
    zip.file('.github/copilot-instructions.md', agentsMdContent); 
  }
}

/**
 * Main export function for enhanced exports with documentation
 */
export async function handleExportWithDocumentation(
  prd: string,
  architecture: string, 
  specifications: string,
  fileStructure: string,
  tasks: Array<{ title: string; details: string }>,
  options?: ExportWithDocumentationOptions
): Promise<{
  blob: Blob;
  documentationSummary: {
    totalLibrariesIdentified: number;
    successfulFetches: number; 
    failedFetches: number;
  };
}> {
  
 const service = new EnhancedExportService();
  return await service.generateEnhancedExport(
    prd,
    architecture, 
    specifications,
    fileStructure,  
    tasks,
    options
  );
}


