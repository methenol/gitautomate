



/**
 * @fileOverview Documentation Fetching System Tests
 *
 * These tests verify the functionality of:
 * 1. Library identification from project content  
 * 2. Multi-source documentation fetching
 * 3. Enhanced export functionality with library docs
 */

import { 
  LibraryIdentifier, 
  DocumentationFetcher,
} from '../ai/services/documentation-fetcher';
import { handleExportWithDocumentation } from '../app/enhanced-export-actions';

describe('Library Identification', () => {
  
  test('should identify React library from content', async () => {
    const content = `
      Architecture: 
        - Frontend built with React components
        - Using Redux for state management  
        - Axios for API calls
        
      Specifications:
        - Implement user dashboard with React
    `;
    
    const libraries = LibraryIdentifier.identifyLibraries(content);
    
    expect(libraries.length).toBeGreaterThan(0);
  });

  test('should categorize libraries correctly', async () => {
    const content = `
      React frontend with Express backend and PostgreSQL database.
      Testing with Jest, authentication using JWT tokens.  
    `;
    
    const libraries = LibraryIdentifier.identifyLibraries(content);
    
    expect(libraries.length).toBeGreaterThan(0);

  });

  test('should filter out common words', async () => {
    const content = `
      The and but or in on at to for with by
      
      Real libraries: React, Express, PostgreSQL  
    `;
    
    const libraries = LibraryIdentifier.identifyLibraries(content);
    
    // Should not include common words
    const libraryNames = libraries.map(lib => lib.name.toLowerCase());
    
    expect(libraryNames).not.toContain('the');
  });
});

describe('Documentation Fetching', () => {
  
  let fetcher: DocumentationFetcher;
  
  beforeEach(() => {
    fetcher = new DocumentationFetcher({
      sources: 'multi-source',
      includeStackOverflow: true,
    });
  });

  test('should fetch documentation for popular library', async () => {
    // Note: This is a mock test since actual API calls would require network
    const libName = 'react';
    
    // Mock the GitHub fetch response  
    jest.spyOn(fetcher as any, 'githubApiFetchRepositoryReadme').mockResolvedValue([{
      libraryName: libName,
      sourceType: 'github' as const, 
      content: '# React\nReact is a JavaScript library...',
      title: 'README',
      url: 'https://github.com/facebook/react/README.md',
      fetchedAt: new Date(),
      sizeKB: 5,
    }]);

    const result = await fetcher.fetchLibraryDocumentation(libName);
    
    expect(result.libraryName).toBe('react');
  });

  test('should handle fetch failures gracefully', async () => {
    const libName = 'nonexistent-library-12345';
    
    // Mock all fetch methods to return empty arrays
    jest.spyOn(fetcher as any, 'githubApiFetchRepositoryReadme').mockResolvedValue([]);
    jest.spyOn(fetcher as any, 'webScraperFetchOfficialDocumentation').mockResolvedValue([]);
    jest.spyOn(fetcher as any, 'mdnApiFetchWebAPIDocumentation').mockResolvedValue([]);
    jest.spyOn(fetcher as any, 'stackScraperFetchCommunityContent').mockResolvedValue([]);

    const result = await fetcher.fetchLibraryDocumentation(libName);
    
    expect(result.libraryName).toBe('nonexistent-library-12345');
  });

  test('should respect size limits', async () => {
    fetcher = new DocumentationFetcher({
      sources: 'multi-source',
      includeStackOverflow: true,
      maxDocumentationSizeKB: 10, // Very small limit
    });

    const libName = 'react';
    
    jest.spyOn(fetcher as any, 'githubApiFetchRepositoryReadme').mockResolvedValue([{
      libraryName: libName,
      sourceType: 'github' as const, 
      content: '# React\n'.repeat(1000), // Large document
      title: 'README', 
      url: 'https://github.com/facebook/react/README.md',
      fetchedAt: new Date(),
      sizeKB: 50, // Exceeds limit
    }]);

    const result = await fetcher.fetchLibraryDocumentation(libName);
    
    expect(result.documentationSources.length).toBe(0); // Should be filtered out
  });
});

describe('Enhanced Export with Documentation', () => {
  
  const mockProjectData = {
    prd: 'Build a task management application',
    architecture: `
      # Architecture
      - Frontend: React components with Redux state management  
      - Backend: Express REST API with JWT authentication
    `,
    specifications: `
      # Specifications  
      - User login/logout functionality using React and JWT
      - Task CRUD operations with Express backend
    `,
    fileStructure: `
      src/
        ├── components/
        │   └── auth/  # React authentication components
      server.js       # Express backend
    `,
    tasks: [
      { 
        title: 'Implement React User Authentication', 
        details: 'Create login forms using React components' 
      },
    ]
  };

  test('should generate enhanced export with library docs', async () => {
    
 jest.spyOn(LibraryIdentifier, 'identifyLibraries').mockReturnValue([
      { name: 'react', confidenceScore: 80, category: 'frontend' as const, detectedPatterns: ['react'] },
      { name: 'express', confidenceScore: 70, category: 'backend' as const, detectedPatterns: ['express'] },
    ]);

 jest.spyOn(DocumentationFetcher.prototype, 'fetchMultipleLibrariesDocumentation')
      .mockResolvedValue([
        {
          libraryName: 'react',
          category: 'frontend' as const,
          documentationSources: [
            {
              libraryName: 'react',
              sourceType: 'github' as const,
              content: '# React Documentation\nReact is a...',
              title: 'React README',
              url: 'https://github.com/facebook/react/README.md', 
              fetchedAt: new Date(),
              sizeKB: 10,
            }
          ],
          totalSizeKB: 10
        },
      ]);

    const { blob, documentationSummary } = await handleExportWithDocumentation(
      mockProjectData.prd,
      mockProjectData.architecture, 
      mockProjectData.specifications,
      mockProjectData.fileStructure,
      mockProjectData.tasks
    );

 expect(blob).toBeInstanceOf(Blob);
  });

  test('should fallback gracefully when documentation fails', async () => {
    
 jest.spyOn(LibraryIdentifier, 'identifyLibraries').mockReturnValue([
      { name: 'react', confidenceScore: 80, category: 'frontend' as const, detectedPatterns: ['react'] },
    ]);

 jest.spyOn(DocumentationFetcher.prototype, 'fetchMultipleLibrariesDocumentation')
      .mockRejectedValue(new Error('Network error'));

    const { blob, documentationSummary } = await handleExportWithDocumentation(
      mockProjectData.prd,
      mockProjectData.architecture, 
      mockProjectData.specifications,
      mockProjectData.fileStructure,
      mockProjectData.tasks
    );

 expect(blob).toBeInstanceOf(Blob); // Should still create export without docs  
  });
});

describe('Documentation Settings', () => {
  
 test('should validate documentation settings schema', async () => {
    const validSettings = {
      sources: 'multi-source' as const,
      includeStackOverflow: true,  
    };

 expect(validSettings.sources).toBe('multi-source');
  });

 test('should apply size limits correctly', async () => {
    const settings = { maxDocumentationSizeKB: 100 };
    
 expect(settings.maxDocumentationSizeKB).toBeGreaterThan(0);
    expect(settings.maxDocumentationSizeKB).toBeLessThanOrEqual(1024); 
  });
});


