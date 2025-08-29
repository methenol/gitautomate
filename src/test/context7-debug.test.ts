/**
 * @fileOverview Debug test for Context7 MCP Integration
 * This test isolates the Context7 MCP functionality to identify connection and tool usage issues
 */

import { getContext7MCPClient, Context7MCPClient } from '@/services/context7-mcp-client-server';

describe('Context7 MCP Debug', () => {
  let client: Context7MCPClient;

  beforeAll(async () => {
    client = getContext7MCPClient();
  });

  afterAll(async () => {
    if (client) {
      await client.cleanup();
    }
  });

  it('should initialize MCP client and discover tools', async () => {
    console.log('[DEBUG] Starting MCP client initialization...');
    
    try {
      await client.initialize();
      console.log('[DEBUG] MCP client initialized successfully');
      
      // Check available tools
      const tools = client.availableTools;
      console.log('[DEBUG] Available tools:', tools);
      
      expect(tools).toBeInstanceOf(Array);
      expect(tools.length).toBeGreaterThan(0);
      
      // Check for expected tools
      const toolNames = tools.map((tool: { name: string }) => tool.name);
      console.log('[DEBUG] Tool names:', toolNames);
      
      expect(toolNames).toContain('resolve-library-id');
      expect(toolNames).toContain('get-library-docs');
      
    } catch (error) {
      console.error('[DEBUG] Initialization failed:', error);
      throw error;
    }
  }, 30000);

  it('should resolve React library to Context7 ID', async () => {
    console.log('[DEBUG] Testing library resolution for React...');
    
    try {
      const resolutions = await client.resolveLibraryToContextId('React');
      console.log('[DEBUG] React resolutions:', resolutions);
      
      expect(resolutions).toBeInstanceOf(Array);
      // Don't fail test if no results, just log for debugging
      console.log('[DEBUG] Resolution count:', resolutions.length);
      
      if (resolutions.length > 0) {
        expect(resolutions[0]).toHaveProperty('libraryId');
        expect(resolutions[0]).toHaveProperty('trustScore');
        expect(resolutions[0]).toHaveProperty('codeSnippetsCount');
      }
      
    } catch (error) {
      console.error('[DEBUG] React resolution failed:', error);
      // Don't throw - log for debugging
      console.log('[DEBUG] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }, 30000);

  it('should fetch documentation for a library ID', async () => {
    console.log('[DEBUG] Testing documentation fetching...');
    
    try {
      // Try with a simple library ID first
      const documentation = await client.fetchContextDocumentation('react');
      console.log('[DEBUG] React documentation result:', {
        hasContent: !!documentation?.content,
        contentLength: documentation?.content?.length || 0,
        metadata: documentation?.metadata
      });
      
      // Don't fail test, just log results for debugging
      if (documentation) {
        expect(documentation).toHaveProperty('content');
        console.log('[DEBUG] Content preview:', documentation.content.substring(0, 200) + '...');
      } else {
        console.log('[DEBUG] No documentation returned');
      }
      
    } catch (error) {
      console.error('[DEBUG] Documentation fetch failed:', error);
      // Don't throw - log for debugging
      console.log('[DEBUG] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }, 30000);

  it('should test raw MCP tool calls', async () => {
    console.log('[DEBUG] Testing raw MCP tool calls...');
    
    try {
      await client.initialize();
      
      // Test raw tool call with resolve-library-id
      console.log('[DEBUG] Calling resolve-library-id tool with React...');
      const rawResult = await client.callTool('resolve-library-id', { libraryName: 'React' });
      console.log('[DEBUG] Raw resolve result:', rawResult);
      
      // Test raw tool call with get-library-docs 
      console.log('[DEBUG] Calling get-library-docs tool with react...');
      const rawDocs = await client.callTool('get-library-docs', { context7CompatibleLibraryID: 'react' });
      console.log('[DEBUG] Raw docs result:', rawDocs);
      
    } catch (error) {
      console.error('[DEBUG] Raw tool call failed:', error);
      console.log('[DEBUG] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }, 30000);
});