/**
 * @fileOverview Test for Context7 MCP Integration
 */

import { getLibraryIdentifierService } from '@/services/library-identifier';
import { getContext7MCPClient } from '@/services/context7-mcp-client';
import { getDocumentationFetcherService } from '@/services/documentation-fetcher';
import type { Task } from '@/types';

describe('Context7 MCP Integration', () => {
  const mockTasks: Task[] = [
    {
      title: 'Setup React Frontend',
      details: 'Create a React application with TypeScript. Use functional components with hooks for state management.',
      status: 'pending'
    },
    {
      title: 'Configure Tailwind CSS',
      details: 'Install and configure Tailwind CSS for styling. Set up custom theme configuration.',
      status: 'pending'
    },
    {
      title: 'Setup PostgreSQL Database',
      details: 'Configure PostgreSQL database with proper schema. Set up connection pooling.',
      status: 'pending'
    },
    {
      title: 'Implement Jest Testing',
      details: 'Set up Jest for unit testing. Create test utilities and mock configurations.',
      status: 'pending'
    }
  ];

  describe('Library Identification Service', () => {
    it('should identify libraries from task content', async () => {
      const service = getLibraryIdentifierService();
      
      // This would use the server action for real AI analysis
      // For now, we test with mock tasks that should trigger pattern matching
      const libraries = await service.identifyLibrariesFromTasks(mockTasks, {
        minConfidence: 0.5
      });

      expect(libraries).toBeInstanceOf(Array);
      expect(libraries.length).toBeGreaterThan(0);
      
      // Should identify common libraries from the mock tasks
      const libraryNames = libraries.map(lib => lib.name.toLowerCase());
      expect(libraryNames.some(name => name.includes('react'))).toBe(true);
    }, 10000);
  });

  describe('Context7 MCP Client', () => {
    it('should resolve library names to Context7 IDs', async () => {
      const client = getContext7MCPClient();
      
      // Test with a known library
      const resolutions = await client.resolveLibraryToContextId('react');
      
      expect(resolutions).toBeInstanceOf(Array);
      if (resolutions.length > 0) {
        expect(resolutions[0]).toHaveProperty('libraryId');
        expect(resolutions[0]).toHaveProperty('trustScore');
        expect(resolutions[0]).toHaveProperty('codeSnippetsCount');
      }
    });

    it('should fetch documentation for library IDs', async () => {
      const client = getContext7MCPClient();
      
      // Test with mock data
      const documentation = await client.fetchContextDocumentation('react-main');
      
      if (documentation) {
        expect(documentation).toHaveProperty('content');
        expect(typeof documentation.content).toBe('string');
        expect(documentation.content.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Documentation Fetcher Service', () => {
    it('should fetch documentation for identified libraries', async () => {
      const service = getDocumentationFetcherService();
      
      const mockLibraries = [
        {
          name: 'React',
          category: 'frontend' as const,
          confidence: 0.9,
          context: 'Frontend framework',
          taskReferences: ['Setup React Frontend']
        },
        {
          name: 'Tailwind CSS',
          category: 'ui' as const,
          confidence: 0.8,
          context: 'CSS framework',
          taskReferences: ['Configure Tailwind CSS']
        }
      ];

      const result = await service.fetchDocumentationForLibraries(mockLibraries, {
        respectDelay: 100, // Faster for testing
        maxRetries: 1
      });

      expect(result).toHaveProperty('documentationFiles');
      expect(result).toHaveProperty('successCount');
      expect(result).toHaveProperty('failureCount');
      expect(result).toHaveProperty('errors');
      
      expect(result.documentationFiles).toBeInstanceOf(Array);
      expect(typeof result.successCount).toBe('number');
      expect(typeof result.failureCount).toBe('number');
    }, 15000);

    it('should generate proper documentation filenames', () => {
      const service = getDocumentationFetcherService();
      
      const mockDoc = {
        filename: 'react.md',
        content: '# React Documentation\n\nContent here...',
        libraryName: 'React',
        metadata: {
          source: 'Context7',
          lastUpdated: '2024-01-01',
          version: '18.x'
        }
      };

      const formatted = service.formatDocumentationContent(mockDoc);
      
      expect(formatted).toContain('# React Documentation');
      expect(formatted).toContain('**Source**: Context7');
      expect(formatted).toContain('**Last Updated**: 2024-01-01');
      expect(formatted).toContain('**Version**: 18.x');
    });
  });

  describe('Integration Workflow', () => {
    it('should complete end-to-end documentation fetching workflow', async () => {
      // Step 1: Identify libraries
      const libraryService = getLibraryIdentifierService();
      const libraries = await libraryService.identifyLibrariesFromTasks(mockTasks);
      
      expect(libraries).toBeInstanceOf(Array);
      
      if (libraries.length > 0) {
        // Step 2: Fetch documentation
        const fetcherService = getDocumentationFetcherService();
        const result = await fetcherService.fetchDocumentationForLibraries(libraries, {
          respectDelay: 100,
          maxRetries: 1
        });
        
        expect(result.successCount + result.failureCount).toBe(libraries.length);
        expect(result.documentationFiles.length).toBeLessThanOrEqual(libraries.length);
      }
    }, 20000);
  });
});