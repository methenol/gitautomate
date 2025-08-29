/**
 * @fileOverview End-to-End Context7 Integration Test
 * This test validates the complete export workflow with Context7 documentation fetching
 */

import { resolveLibraryToContextId, fetchContextDocumentation } from '@/app/context7-actions';

import { LibraryResolution, DocumentationResult } from '@/app/context7-actions';

describe('Context7 MCP Integration - End-to-End Export Workflow', () => {
  
  it('should successfully resolve and fetch React documentation for export', async () => {
    console.log('[E2E] Testing React resolution and documentation fetch...');
    
    // Step 1: Resolve React library
    const resolutions = await resolveLibraryToContextId('React');
    console.log('[E2E] React resolutions:', resolutions);
    
    expect(resolutions).toBeInstanceOf(Array);
    expect(resolutions.length).toBeGreaterThan(0);
    
    const resolution = resolutions[0];
    expect(resolution).toHaveProperty('libraryId');
    expect(resolution.libraryId).toContain('react');
    expect(resolution.trustScore).toBeGreaterThan(0.5);
    
    console.log('[E2E] ✅ React resolved to:', resolution.libraryId);
    
    // Step 2: Fetch documentation
    const documentation = await fetchContextDocumentation(resolution.libraryId);
    console.log('[E2E] Documentation result:', {
      hasContent: !!documentation?.content,
      contentLength: documentation?.content?.length || 0,
      hasMetadata: !!documentation?.metadata
    });
    
    expect(documentation).not.toBeNull();
    expect(documentation).toHaveProperty('content');
    expect(documentation!.content).not.toContain('Failed to fetch');
    expect(documentation!.content).not.toContain('Error code');
    
    // Should have either real documentation or rate limit message
    const isValidContent = documentation!.content.length > 100 || 
                          documentation!.content.includes('Rate limited');
    expect(isValidContent).toBe(true);
    
    if (documentation!.content.includes('Rate limited')) {
      console.log('[E2E] ✅ Rate limiting detected - integration working correctly');
    } else {
      console.log('[E2E] ✅ Full documentation retrieved successfully');
      console.log('[E2E] Content preview:', documentation!.content.substring(0, 200) + '...');
    }
    
    // Check metadata
    expect(documentation!.metadata).toHaveProperty('source', 'Context7');
    expect(documentation!.metadata).toHaveProperty('lastUpdated');
    
  }, 30000);

  it('should handle multiple library resolutions in export workflow', async () => {
    console.log('[E2E] Testing multiple library export workflow...');
    
    const libraries = ['React', 'TypeScript', 'Vue'];
    const results: Array<{ library: string; resolution: LibraryResolution; documentation: DocumentationResult | null }> = [];
    
    for (const library of libraries) {
      console.log(`[E2E] Processing ${library}...`);
      
      try {
        // Resolve library
        const resolutions = await resolveLibraryToContextId(library);
        expect(resolutions.length).toBeGreaterThan(0);
        
        const resolution = resolutions[0];
        
        // Fetch documentation
        const documentation = await fetchContextDocumentation(resolution.libraryId);
        
        results.push({
          library,
          resolution,
          documentation
        });
        
        console.log(`[E2E] ✅ ${library} processed: ${resolution.libraryId}`);
        
      } catch (error) {
        console.error(`[E2E] ❌ ${library} failed:`, error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    }
    
    // All libraries should be processed successfully
    expect(results).toHaveLength(3);
    
    // Each should have valid resolutions and documentation (or rate limit)
    for (const result of results) {
      expect(result.resolution).toHaveProperty('libraryId');
      expect(result.documentation).not.toBeNull();
      
      if (result.documentation) {
        expect(result.documentation.content).toBeDefined();
        
        // Should not have hard errors
        expect(result.documentation.content).not.toContain('Failed to fetch');
        expect(result.documentation.content).not.toContain('Error code');
      }
    }
    
    console.log('[E2E] ✅ Multiple library export workflow completed successfully');
  }, 60000);

  it('should handle unknown libraries gracefully in export', async () => {
    console.log('[E2E] Testing unknown library handling in export...');
    
    const unknownLibrary = 'NonExistentLibraryXYZ123';
    
    // Should resolve to fallback
    const resolutions = await resolveLibraryToContextId(unknownLibrary);
    expect(resolutions).toBeInstanceOf(Array);
    expect(resolutions.length).toBeGreaterThan(0);
    
    const resolution = resolutions[0];
    expect(resolution.trustScore).toBeLessThan(0.6); // Low trust for unknown
    
    // Documentation fetch should handle gracefully
    const documentation = await fetchContextDocumentation(resolution.libraryId);
    
    // Should either return null or a valid result (depending on what Context7 returns)
    if (documentation) {
      expect(documentation).toHaveProperty('content');
      expect(documentation.content).not.toContain('Failed to fetch');
    }
    
    console.log('[E2E] ✅ Unknown library handled gracefully');
  }, 30000);

  it('should handle Context7 rate limiting in export workflow', async () => {
    console.log('[E2E] Testing rate limiting handling in export...');
    
    // Make multiple rapid requests to trigger rate limiting
    const libraries = ['react1', 'react2', 'react3', 'react4', 'react5'];
    const promises = libraries.map(async (lib) => {
      try {
        const resolutions = await resolveLibraryToContextId(lib);
        const documentation = await fetchContextDocumentation(resolutions[0].libraryId);
        return { library: lib, success: true, documentation };
      } catch (error) {
        return { 
          library: lib, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    const results = await Promise.all(promises);
    console.log('[E2E] Rate limiting test results:', results);
    
    // Should handle all requests without crashing
    expect(results).toHaveLength(5);
    
    // At least some should succeed (or be rate limited gracefully)
    const successCount = results.filter(r => r.success).length;
    const rateLimitCount = results.filter(r => 
      !r.success && r.error && r.error.includes('Rate limit')
    ).length;
    
    // Should either succeed or be rate limited gracefully
    expect(successCount + rateLimitCount).toBeGreaterThanOrEqual(4);
    
    console.log('[E2E] ✅ Rate limiting handled gracefully in export workflow');
  }, 45000);

});