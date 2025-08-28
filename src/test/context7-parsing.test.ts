/**
 * @fileOverview Mock test for Context7 response parsing
 */

import { Context7MCPClient } from '@/services/context7-mcp-client-server';

describe('Context7 Response Parsing', () => {
  let client: Context7MCPClient;

  beforeEach(() => {
    client = new (Context7MCPClient as any)(); // Create instance directly
  });

  it('should parse successful library search results', () => {
    const mockResponseText = `Available Libraries (top matches):

Each result includes:
- Library ID: Context7-compatible identifier (format: /org/project)
- Name: Library or package name
- Description: Short summary
- Code Snippets: Number of available code examples
- Trust Score: Authority indicator
- Versions: List of versions if available. Use one of those versions if and only if the user explicitly provides a version in their query.

For best results, select libraries based on name match, trust score, snippet coverage, and relevance to your use case.

----------

1. Library ID: /facebook/react
   Name: React
   Description: A JavaScript library for building user interfaces
   Code Snippets: 150
   Trust Score: 9.8
   Versions: v18.3.1, v18.2.0, v17.0.2

2. Library ID: /reactjs/react-router
   Name: React Router
   Description: Declarative routing for React
   Code Snippets: 85
   Trust Score: 9.2
   Versions: v6.26.1, v6.25.1, v5.3.4`;

    const libraries = (client as any).parseLibrarySearchResults(mockResponseText, 'React');
    
    console.log('Parsed libraries:', JSON.stringify(libraries, null, 2));
    
    expect(libraries).toBeInstanceOf(Array);
    expect(libraries.length).toBeGreaterThan(0);
    
    const firstLib = libraries[0];
    expect(firstLib.libraryId).toBe('/facebook/react');
    expect(firstLib.trustScore).toBeCloseTo(0.98); // 9.8/10
    expect(firstLib.codeSnippetsCount).toBe(150);
    expect(firstLib.description).toContain('JavaScript library');
  });

  it('should handle malformed response text gracefully', () => {
    const mockMalformedText = `Some random text without proper format
Library ID: /some/lib
Not properly formatted response`;

    const libraries = (client as any).parseLibrarySearchResults(mockMalformedText, 'TestLib');
    
    expect(libraries).toBeInstanceOf(Array);
    expect(libraries.length).toBeGreaterThan(0);
    
    // Should extract at least the library ID pattern
    const foundLib = libraries.find(lib => lib.libraryId === '/some/lib');
    expect(foundLib).toBeDefined();
  });

  it('should provide fallback when no patterns found', () => {
    const mockEmptyText = `No libraries found for your query.
Please try different search terms.`;

    const libraries = (client as any).parseLibrarySearchResults(mockEmptyText, 'UnknownLib');
    
    expect(libraries).toBeInstanceOf(Array);
    expect(libraries.length).toBe(1);
    expect(libraries[0].libraryId).toBe('unknownlib');
    expect(libraries[0].description).toContain('UnknownLib');
  });
});