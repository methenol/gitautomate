

import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

// Types
type Task = {
  title: string;
  details: string;
};

// Mock implementation for now - in a real scenario, this would import the actual services
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
      console.log('[Export] Documentation fetching enabled - creating mock documentation');
      
      // Create reference folder for documentation
      referenceFolder = zip.folder('reference');
      
      if (!referenceFolder) {
        throw new Error('Could not create reference folder in zip file.');
      }

      // Mock documentation for testing
      const mockDocs = [
        {
          libraryName: 'react',
          filename: 'React.md', 
          content: `# React Documentation

## Introduction
React is a JavaScript library for building user interfaces.

## Key Concepts
- Components: Reusable UI pieces
- JSX: Syntax extension for JavaScript  
- Hooks: Functions that let you "hook into" React state
- Virtual DOM: Efficient updates to the UI

## Best Practices
1. Use functional components with hooks
2. Keep component focused and single-purpose  
3. Properly manage state with useState/useEffect

## Code Examples
\`\`\`jsx
import React, { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}

export default Counter;
\`\`
        `
        },
        {
          libraryName: 'typescript',
          filename: 'TypeScript.md',
          content: `# TypeScript Documentation

## Introduction
TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.

## Key Features  
- Static typing
- Interface definitions
- Generics
- Advanced type inference

## Best Practices
1. Use \`interface\` for object shapes
2. Leverage type inference when possible  
3. Create reusable utility types

## Code Examples
\`\`typescript
interface User {
  id: number;
  name: string; 
  email?: string;
}

function getUser(id: number): Promise<User> {
  return fetch(\`/users/\${id}\`).then(res => res.json());
}

// Generic utility type
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
\`\`
        `
        }
      ];

      // Add mock documentation
      for (const doc of mockDocs) {
        if (doc.content && doc.filename) {
          referenceFolder.file(doc.filename, doc.content);
          console.log(`[Export] Added documentation: ${doc.libraryName} -> ${doc.filename}`);
        }
      }

      console.log(`[Export] Successfully added mock documentation`);
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
- **Implementation Agent**: Writes code based on the research findings.

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

