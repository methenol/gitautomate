'use server';

/**
 * @fileOverview Server actions for Context7 MCP operations
 * These actions run on the server side and handle MCP functionality
 */

export interface LibraryResolution {
  libraryId: string;
  trustScore: number;
  codeSnippetsCount: number;
  description?: string;
}

export interface DocumentationResult {
  content: string;
  metadata?: {
    source?: string;
    lastUpdated?: string;
    version?: string;
  };
}

/**
 * Server action to resolve library names to Context7 IDs
 */
export async function resolveLibraryToContextId(libraryName: string): Promise<LibraryResolution[]> {
  try {
    // Dynamic import for server-side only module
    const { getContext7MCPClient } = await import('@/services/context7-mcp-client-server');
    const client = getContext7MCPClient();
    return await client.resolveLibraryToContextId(libraryName);
  } catch (error) {
    console.error('Error resolving library:', error);
    return [];
  }
}

/**
 * Server action to fetch documentation for a library ID
 */
export async function fetchContextDocumentation(libraryId: string): Promise<DocumentationResult | null> {
  try {
    // Dynamic import for server-side only module
    const { getContext7MCPClient } = await import('@/services/context7-mcp-client-server');
    const client = getContext7MCPClient();
    return await client.fetchContextDocumentation(libraryId);
  } catch (error) {
    console.error('Error fetching documentation:', error);
    return null;
  }
}

/**
 * Server action to cleanup MCP server resources
 */
export async function cleanupMCPServer(): Promise<void> {
  try {
    // Dynamic import for server-side only module
    const { cleanupContext7MCPServer } = await import('@/lib/mcp-server-manager');
    await cleanupContext7MCPServer();
  } catch (error) {
    console.error('Error cleaning up MCP server:', error);
  }
}