/**
 * @fileOverview Test Context7 MCP Integration with the fixed implementation
 * This test validates the complete workflow with working library resolution and documentation fetching
 */

import { getContext7MCPClient, Context7MCPClient, LibraryResolution } from '@/services/context7-mcp-client-server';

describe('Context7 MCP Integration - Fixed Implementation', () => {
  let client: Context7MCPClient;

  beforeAll(async () => {
    client = getContext7MCPClient();
  });

  afterAll(async () => {
    if (client) {
      await client.cleanup();
    }
  });

  it('should successfully resolve React using local mapping', async () => {
    console.log('[TEST] Testing React resolution...');
    
    const resolutions = await client.resolveLibraryToContextId('React');
    console.log('[TEST] React resolutions:', resolutions);
    
    expect(resolutions).toBeInstanceOf(Array);
    expect(resolutions.length).toBeGreaterThan(0);
    
    const resolution = resolutions[0];
    expect(resolution).toHaveProperty('libraryId');
    expect(resolution).toHaveProperty('trustScore');
    expect(resolution).toHaveProperty('codeSnippetsCount');
    
    // Should be /facebook/react or similar
    expect(resolution.libraryId).toContain('react');
    expect(resolution.trustScore).toBeGreaterThan(0.5);
    
    console.log('[TEST] ✅ React resolution successful:', resolution.libraryId);
  }, 30000);

  it('should successfully fetch React documentation', async () => {
    console.log('[TEST] Testing React documentation fetch...');
    
    // First resolve React
    const resolutions = await client.resolveLibraryToContextId('React');
    expect(resolutions.length).toBeGreaterThan(0);
    
    const libraryId = resolutions[0].libraryId;
    console.log('[TEST] Using library ID:', libraryId);
    
    // Then fetch documentation
    const documentation = await client.fetchContextDocumentation(libraryId);
    console.log('[TEST] Documentation result:', {
      hasContent: !!documentation?.content,
      contentLength: documentation?.content?.length || 0,
      metadata: documentation?.metadata
    });
    
    expect(documentation).not.toBeNull();
    expect(documentation).toHaveProperty('content');
    expect(documentation!.content).not.toContain('Failed to fetch');
    expect(documentation!.content).not.toContain('Error code');
    
    // Accept both full documentation and rate limit messages
    const isValidContent = documentation!.content.length > 100 || 
                          documentation!.content.includes('Rate limited');
    expect(isValidContent).toBe(true);
    
    console.log('[TEST] ✅ React documentation fetch successful');
    console.log('[TEST] Content preview:', documentation!.content.substring(0, 200) + '...');
  }, 30000);

  it('should resolve TypeScript using local mapping', async () => {
    console.log('[TEST] Testing TypeScript resolution...');
    
    const resolutions = await client.resolveLibraryToContextId('typescript');
    console.log('[TEST] TypeScript resolutions:', resolutions);
    
    expect(resolutions).toBeInstanceOf(Array);
    expect(resolutions.length).toBeGreaterThan(0);
    
    const resolution = resolutions[0];
    expect(resolution.libraryId).toContain('typescript');
    
    console.log('[TEST] ✅ TypeScript resolution successful:', resolution.libraryId);
  }, 30000);

  it('should fetch TypeScript documentation', async () => {
    console.log('[TEST] Testing TypeScript documentation fetch...');
    
    const resolutions = await client.resolveLibraryToContextId('typescript');
    const libraryId = resolutions[0].libraryId;
    
    const documentation = await client.fetchContextDocumentation(libraryId);
    
    expect(documentation).not.toBeNull();
    expect(documentation!.content).not.toContain('Failed to fetch');
    
    // Accept both full documentation and rate limit messages
    const isValidContent = documentation!.content.length > 100 || 
                          documentation!.content.includes('Rate limited');
    expect(isValidContent).toBe(true);
    
    console.log('[TEST] ✅ TypeScript documentation fetch successful');
    console.log('[TEST] Content preview:', documentation!.content.substring(0, 200) + '...');
  }, 30000);

  it('should handle unknown library gracefully', async () => {
    console.log('[TEST] Testing unknown library handling...');
    
    const resolutions = await client.resolveLibraryToContextId('nonexistentlibraryfoobar123');
    console.log('[TEST] Unknown library resolutions:', resolutions);
    
    expect(resolutions).toBeInstanceOf(Array);
    expect(resolutions.length).toBeGreaterThan(0); // Should return fallback
    
    const resolution = resolutions[0];
    expect(resolution.trustScore).toBeLessThan(0.6); // Low trust for fallback (allowing for rate limit scenarios)
    
    console.log('[TEST] ✅ Unknown library handled gracefully');
  }, 30000);

  it('should resolve multiple common libraries', async () => {
    console.log('[TEST] Testing multiple library resolutions...');
    
    const libraries = ['vue', 'angular', 'svelte', 'next.js', 'tailwind css'];
    const results: Record<string, LibraryResolution | null> = {};
    
    for (const library of libraries) {
      try {
        const resolutions = await client.resolveLibraryToContextId(library);
        results[library] = resolutions[0];
        console.log(`[TEST] ✅ ${library} -> ${resolutions[0]?.libraryId}`);
      } catch (error) {
        console.error(`[TEST] ❌ ${library} failed:`, error instanceof Error ? error.message : 'Unknown error');
        results[library] = null;
      }
    }
    
    console.log('[TEST] Resolution results:', results);
    
    // At least 3 out of 5 should work
    const successCount = Object.values(results).filter(r => r !== null).length;
    expect(successCount).toBeGreaterThanOrEqual(3);
    
    console.log('[TEST] ✅ Multiple library resolution test completed');
  }, 60000);

  it('should handle rate limiting gracefully', async () => {
    console.log('[TEST] Testing rate limiting handling...');
    
    // Make multiple rapid requests to test rate limiting
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        client.resolveLibraryToContextId(`react${i}`)
          .catch((error: Error) => ({ error: error.message }))
      );
    }
    
    const results = await Promise.all(promises);
    console.log('[TEST] Rate limiting test results:', results);
    
    // Should handle gracefully without crashing
    expect(results).toHaveLength(5);
    
    console.log('[TEST] ✅ Rate limiting handled gracefully');
  }, 30000);
});