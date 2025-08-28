

import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

// Import the actual documentation services
const { LibraryIdentifier } = await import('@/services/library-identifier');
const { DocumentationFetcher, Context7MCPClient } = await import('@/services/documentation-fetcher');

// Types
type Task = {
  title: string;
  details: string;
};

export async function POST(request: NextRequest) {
  try {
    const { prd, architecture, specifications, fileStructure, tasks, fetchDocumentation } = await request.json();

    if (!tasks || !Array.isArray(tasks)) {
      return NextResponse.json({ error: 'Invalid tasks data' }, { status: 400 });
    }

    const zip = new JSZip();
    
    // Add docs folder
    let referenceFolder: any;
    if (fetchDocumentation) {
      console.log('[Export] Documentation fetching enabled - using Context7 MCP integration');
      
      // Create reference folder for documentation
      referenceFolder = zip.folder('reference');
      
      if (!referenceFolder) {
        throw new Error('Could not create reference folder in zip file.');
      }

      try {
        // Step 1: Identify libraries from the project content
        const libraryIdentifier = new LibraryIdentifier();
        
        // Convert tasks to format expected by LibraryIdentifier
        const libTasks = (tasks as Task[]).map(task => ({
          title: task.title,
          details: task.details
        }));

        const librariesResult = await libraryIdentifier.identifyLibraries(
          architecture || '',
          specifications || '', 
          fileStructure || '',
          libTasks
        );

        console.log(`[Export] Identified ${librariesResult.libraries.length} libraries:`, 
          librariesResult.libraries.map(lib => lib.name).join(', '));

        if (librariesResult.libraries.length === 0) {
          console.log('[Export] No libraries identified, proceeding without documentation');
        } else {
          // Step 2: Fetch real documentation using Context7 MCP client
          
          const mcpClient = new Context7MCPClient();
          await mcpClient.initialize();

          // Filter out empty library names
          const librariesToFetch = librariesResult.libraries.filter(lib => lib.name && lib.name.trim().length > 0);
          
          console.log(`[Export] Fetching documentation for ${librariesToFetch.length} libraries using Context7 MCP`);
          
          const docFetcher = new DocumentationFetcher(mcpClient);
          
          // Fetch all documentation with progress tracking
          const result = await docFetcher.fetchAllDocumentation(
            librariesToFetch,
            (progress) => {
              console.log(`[Export] Progress: ${progress.completedLibraries}/${progress.total Libraries} libraries processed, 
                Success: ${progress.successCount}, Errors: ${progress.errorCount}`);
            }
          );

          console.log(`[Export] Successfully fetched documentation for ${result.libraryDocs.length} libraries`);

          // Add the real, contextually relevant documentation to ZIP
          result.libraryDocs.forEach(doc => {
            if (doc.content && doc.filename) {
              referenceFolder.file(doc.filename, doc.content);
              
              // Log the actual fetched content
              console.log(`[Export] Added real Context7 documentation for: ${doc.libraryName} -> ${doc.filename}`);
              console.log(`[Export] Content preview (${Math.min(100, doc.content.length)} chars): ${doc.content.substring(0, 100)}`);
            }
          });

        }

      } catch (error) {
        console.error('[Export] Documentation fetching failed:', error);
        
        // Create reference folder with error message
        const readmeContent = `# Documentation Fetching Error

The system encountered an error while fetching library documentation using Context7 MCP integration.

Error details: ${error instanceof Error ? error.message : String(error)}

This might be due to:
- Context7 MCP server not being available
- Network connectivity issues  
- Missing or invalid API configuration

Please check your setup and try again.

`;
        referenceFolder.file('README.md', readmeContent);
      }
    } else {
      // Create empty reference folder when fetchDocumentation is disabled
      zip.folder('reference');
    }

    const docsFolder = zip.folder('docs');
    const tasksFolder = zip.folder('tasks');

    if (!docsFolder || !tasksFolder) {
      throw new Error('Could not create folders in zip file.');
    }

    // Add docs
    if (prd) docsFolder.file('PRD.md', prd);
    if (architecture) docsFolder.file('ARCHITECTURE.md', architecture);
    if (specifications) docsFolder.file('SPECIFICATION.md', specifications); 
    if (fileStructure) docsFolder.file('FILE_STRUCTURE.md', fileStructure);

    // Create main tasks file
    const mainTasksContent = (tasks as Task[]).map((task, index) => 
      `- [ ] task-${(index + 1).toString().padStart(3, '0')}: ${task.title}`
    ).join('\n');
    
    tasksFolder.file('tasks.md', `# Task List\n\n${mainTasksContent}`);

    // Create individual task files
    (tasks as Task[]).forEach((task, index) => {
      const taskNumber = (index + 1).toString().padStart(3, '0');
      let taskContent = `# ${task.title}\n\n${task.details}`;
      
      // Add documentation reference if enabled
      if (fetchDocumentation) {
        const documentationReference = `IMPORTANT: Read all relevant library documentation in the reference/ folder before implementing this task. The available libraries have comprehensive documentation that includes code examples, API references, and best practices.\n\n`;
        taskContent = `${documentationReference}${taskContent}`;
      }
      
      tasksFolder.file(`task-${taskNumber}.md`, taskContent);
    });

    // Generate AGENTS.md
    const agentsMdResult = {
      content: `# Development Agents

## Task Distribution System
This project uses a task-based development system with AI agents to handle different aspects of implementation.

## Available Agents
- **Research Agent**: Researches tasks and provides detailed notes, best practices, and implementation approaches.
- **Implementation Agent**: Writes code based on the research findings.

## Development Workflow
1. Generate tasks with AI planning
2. Each task gets researched by the Research Agent  
3. Implementation follows based on research findings

## Best Practices
- Review each task's detailed notes before implementation
- Use the provided research as a foundation for development  
- Update AGENTS.md if you add new agents or modify existing ones
`,
      success: true,
    };

    // Add AGENTS.md file at the root of zip
    if (agentsMdResult.success) {
      const agentsContent = `# Development Agents

## Task Distribution System
This project uses a task-based development system with AI agents to handle different aspects of implementation.

## Available Agents
- **Research Agent**: Researches tasks and provides detailed notes, best practices, and implementation approaches.
- **Implementation Agent** Writes code based on the research findings.

## Development Workflow
1. Generate tasks with AI planning
2. Each task gets researched by the Research Agent  
3. Implementation follows based on research findings

## Best Practices
- Review each task's detailed notes before implementation
- Use the provided research as a foundation for development  
- Update AGENTS.md if you add new agents or modify existing ones

`;

      zip.file('AGENTS.md', agentsContent);
    }

    // Generate the ZIP file
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Return the ZIP file as a response
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="gitautomate-export.zip"`,
      },
    });

  } catch (error) {
    console.error('Export error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        message: 'Failed to generate export data',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
