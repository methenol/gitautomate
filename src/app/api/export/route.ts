

import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

// Types
type Task = {
  title: string;
  details: string;
};

export async function POST(request: NextRequest) {
  try {
    const { prd, architecture, specifications, fileStructure, tasks, fetchDocumentation } = await request.json();
    
    // Import services where needed
    const LibraryIdentifierModule = await import('@/services/library-identifier');
    
    // Import DocumentationFetcher  
    const DocumentationFetcherModule = await import('@/services/documentation-fetcher');
    
    // Import Context7MCPClient
    const Context7MCPModule = await import('@/services/context7-mcp-client');

    if (!tasks || !Array.isArray(tasks)) {
      return NextResponse.json({ error: 'Invalid tasks data' }, { status: 400 });
    }

    const zip = new JSZip();
    
    // Add docs folder
    let referenceFolder: JSZip.JSZipObject | null = null;
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

        const librariesResult = await LibraryIdentifierModule.default.identifyLibraries(
          architecture || '',
          specifications || '', 
          fileStructure || '',
          libTasks
        );

        console.log('[Export] Identified', librariesResult.libraries.length, 'libraries:', 
          (librariesResult.libraries as any[]).map((lib: { name?: string }) => lib?.name || 'Unknown').join(', '));

        if (librariesResult.libraries.length === 0) {
          console.log('[Export] No libraries identified, proceeding without documentation');
        } else {
          // Step 2: Fetch real documentation using Context7 MCP client
          
          const mcpClient = new (Context7MCPModule.default)();
          await mcpClient.initialize();

          // Filter out empty library names
          const librariesToFetch = (librariesResult.libraries as any[]).filter(lib => lib?.name && lib.name.trim().length > 0);
          
          console.log(`[Export] Fetching documentation for ${librariesToFetch.length} libraries using Context7 MCP`);
          
          const docFetcher = new (DocumentationFetcherModule.default)(mcpClient);
          
          // Fetch all documentation with progress tracking
          const result = await docFetcher.fetchAllDocumentation(
            librariesToFetch,
            (progress: any) => {
              console.log('[Export] Progress:', progress.completedLibraries, '/', 
                progress.totalLibraries, 'libraries processed');
              console.log('Success:', progress.successCount, ', Errors:', progress.errorCount);
            }
          );

          console.log('[Export] Successfully fetched documentation for', result.libraryDocs.length, 'libraries');

          // Add the real, contextually relevant documentation to ZIP
          result.libraryDocs.forEach((doc: any) => {
            if (doc.content && doc.filename) {
              referenceFolder.file(doc.filename, doc.content);
              
              // Log the actual fetched content
              console.log('[Export] Added real Context7 documentation for:', doc.libraryName, '->', 
                doc.filename);
              console.log('[Export] Content preview:', Math.min(100, (doc.content as string).length), 
                'chars');
            }
          });

        }

      } catch (error) {
        console.error('[Export] Documentation fetching failed:', error);
        
        // Create reference folder with error message
        const readmeContent = '# Documentation Fetching Error\n\n' +
          'The system encountered an error while fetching library documentation using Context7 MCP integration.\n\n' +
          'Error details: ' + (error instanceof Error ? error.message : String(error)) + '\n\n' +
          'This might be due to:\n' +
          '- Context7 MCP server not being available\n' +
          '- Network connectivity issues  \n' +
          '- Missing or invalid API configuration\n\n' +
          'Please check your setup and try again.\n';
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
      const agentsContent = '# Development Agents\n\n' +
        '## Task Distribution System\nThis project uses a task-based development system with AI agents to handle different aspects of implementation.\n\n' +
        '## Available Agents\n- **Research Agent**: Researches tasks and provides detailed notes, best practices, and implementation approaches.\n' +
        '- **Implementation Agent** Writes code based on the research findings.\n\n' +
        '## Development Workflow\n1. Generate tasks with AI planning\n2. Each task gets researched by the Research Agent  \n3. Implementation follows based on research findings\n\n' +
        '## Best Practices\n- Review each task\'s detailed notes before implementation\nUse the provided research as a foundation for development  \nUpdate AGENTS.md if you add new agents or modify existing ones\n';

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
