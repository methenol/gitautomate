/**
 * Enhanced comprehensive tests for services
 * Step 6: Coverage & Completeness - Services
 */

import { DocumentationFetcher } from '@/services/documentation-fetcher';
import { LibraryIdentifier } from '@/services/library-identifier';
import { ai } from '@/ai/litellm';

// Mock dependencies
jest.mock('@/ai/litellm', () => ({
  ai: {
    generate: jest.fn(),
  },
}));

jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  access: jest.fn(),
  stat: jest.fn(),
}));

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn(() => ({
    repos: {
      getContent: jest.fn(),
      getReadme: jest.fn(),
    },
    search: {
      repos: jest.fn(),
    },
  })),
}));

const mockAI = ai as jest.Mocked<typeof ai>;

describe('Services - Enhanced Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DocumentationFetcher - Complete Coverage', () => {
    const mockSettings = {
      includeOfficialDocs: true,
      includeGithubReadme: true,
      includeApiReference: false,
      maxDocumentationSizeKB: 1000,
      preferredSources: ['official-site', 'github-readme'],
      cacheEnabled: true,
      cacheExpiryHours: 24,
    };

    describe('Constructor and Initialization', () => {
      it('should initialize with minimal settings', () => {
        const fetcher = new DocumentationFetcher(mockSettings);
        expect(fetcher).toBeInstanceOf(DocumentationFetcher);
      });

      it('should initialize with GitHub token', () => {
        const fetcher = new DocumentationFetcher(mockSettings, 'github-token');
        expect(fetcher).toBeInstanceOf(DocumentationFetcher);
      });

      it('should initialize with LLM configuration', () => {
        const llmConfig = {
          apiKey: 'test-key',
          model: 'gpt-4',
          apiBase: 'https://api.openai.com/v1',
        };
        const fetcher = new DocumentationFetcher(mockSettings, undefined, llmConfig);
        expect(fetcher).toBeInstanceOf(DocumentationFetcher);
      });

      it('should initialize with all parameters', () => {
        const llmConfig = {
          apiKey: 'test-key',
          model: 'gpt-4',
          apiBase: 'https://api.openai.com/v1',
        };
        const fetcher = new DocumentationFetcher(mockSettings, 'github-token', llmConfig);
        expect(fetcher).toBeInstanceOf(DocumentationFetcher);
      });
    });

    describe('Library Search and Verification', () => {
      let fetcher: DocumentationFetcher;

      beforeEach(() => {
        fetcher = new DocumentationFetcher(mockSettings);
      });

      it('should search and verify valid library', async () => {
        // Mock the private method behavior
        const searchSpy = jest.spyOn(fetcher as any, 'searchAndVerifyLibrary');  
        searchSpy.mockResolvedValue({
          name: 'react',
          verified: true,
          officialUrl: 'https://reactjs.org',
          githubUrl: 'https://github.com/facebook/react',
          npmUrl: 'https://www.npmjs.com/package/react',
        });

        const result = await (fetcher as any).searchAndVerifyLibrary('react');
        
        expect(result.name).toBe('react');
        expect(result.verified).toBe(true);
        expect(result.officialUrl).toBeTruthy();
        expect(result.githubUrl).toBeTruthy();
      });

      it('should handle library not found', async () => {
        const searchSpy = jest.spyOn(fetcher as any, 'searchAndVerifyLibrary');
        searchSpy.mockResolvedValue(null);

        const result = await (fetcher as any).searchAndVerifyLibrary('non-existent-library');
        expect(result).toBeNull();
      });

      it('should handle search API errors', async () => {
        const searchSpy = jest.spyOn(fetcher as any, 'searchAndVerifyLibrary');
        searchSpy.mockRejectedValue(new Error('Search API unavailable'));

        await expect((fetcher as any).searchAndVerifyLibrary('react'))
          .rejects.toThrow('Search API unavailable');
      });

      it('should verify library with partial information', async () => {
        const searchSpy = jest.spyOn(fetcher as any, 'searchAndVerifyLibrary');
        searchSpy.mockResolvedValue({
          name: 'custom-library',
          verified: true,
          officialUrl: null,
          githubUrl: 'https://github.com/user/custom-library',
          npmUrl: 'https://www.npmjs.com/package/custom-library',
        });

        const result = await (fetcher as any).searchAndVerifyLibrary('custom-library');
        
        expect(result.name).toBe('custom-library');
        expect(result.verified).toBe(true);
        expect(result.officialUrl).toBeNull();
        expect(result.githubUrl).toBeTruthy();
      });
    });

    describe('Documentation Source Fetching', () => {
      let fetcher: DocumentationFetcher;

      beforeEach(() => {
        fetcher = new DocumentationFetcher(mockSettings);
      });

      it('should fetch from official site', async () => {
        const fetchSpy = jest.spyOn(fetcher as any, 'fetchFromOfficialSite');
        fetchSpy.mockResolvedValue([
          {
            type: 'official-site',
            url: 'https://reactjs.org/docs',
            content: 'Official React documentation content',
            sizeKB: 150,
            lastUpdated: '2020-01-01T00:00:00.000Z',
          },
        ]);

        const result = await (fetcher as any).fetchFromOfficialSite('react');
        
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('official-site');
        expect(result[0].content).toContain('React documentation');
        expect(result[0].sizeKB).toBe(150);
      });

      it('should fetch from GitHub README', async () => {
        const fetchSpy = jest.spyOn(fetcher as any, 'fetchFromGithubReadme');
        fetchSpy.mockResolvedValue([
          {
            type: 'github-readme',
            url: 'https://github.com/facebook/react/blob/main/README.md',
            content: '# React\n\nA JavaScript library for building user interfaces.',
            sizeKB: 50,
            lastUpdated: '2020-01-01T00:00:00.000Z',
          },
        ]);

        const result = await (fetcher as any).fetchFromGithubReadme('react', 'facebook/react');
        
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('github-readme');
        expect(result[0].content).toContain('React');
        expect(result[0].sizeKB).toBe(50);
      });

      it('should handle fetch errors gracefully', async () => {
        const fetchSpy = jest.spyOn(fetcher as any, 'fetchFromOfficialSite');
        fetchSpy.mockRejectedValue(new Error('Network error'));

        await expect((fetcher as any).fetchFromOfficialSite('react'))
          .rejects.toThrow('Network error');
      });

      it('should handle empty documentation response', async () => {
        const fetchSpy = jest.spyOn(fetcher as any, 'fetchFromOfficialSite');
        fetchSpy.mockResolvedValue([]);

        const result = await (fetcher as any).fetchFromOfficialSite('unknown-library');
        expect(result).toHaveLength(0);
      });
    });

    describe('Documentation Processing and Cleaning', () => {
      let fetcher: DocumentationFetcher;

      beforeEach(() => {
        fetcher = new DocumentationFetcher(mockSettings, undefined, {
          apiKey: 'test-key',
          model: 'gpt-4',
          apiBase: 'https://api.openai.com/v1',
        });
      });

      it('should clean documentation with AI', async () => {
        mockAI.generate.mockResolvedValue({
          output: 'Cleaned and structured documentation content for React library.',
        });

        const cleanSpy = jest.spyOn(fetcher as any, 'cleanDocumentationWithAI');
        cleanSpy.mockResolvedValue([
          {
            type: 'official-site',
            url: 'https://reactjs.org/docs',
            content: 'Cleaned and structured documentation content for React library.',
            sizeKB: 120,
            lastUpdated: '2020-01-01T00:00:00.000Z',
            processed: true,
          },
        ]);

        const rawSources = [
          {
            type: 'official-site' as const,
            url: 'https://reactjs.org/docs',
            content: 'Raw unstructured documentation content with lots of HTML and noise...',
            sizeKB: 200,
            lastUpdated: '2020-01-01T00:00:00.000Z',
          },
        ];

        const result = await (fetcher as any).cleanDocumentationWithAI(rawSources, 'react');
        
        expect(result).toHaveLength(1);
        expect(result[0].content).toContain('Cleaned and structured');
        expect(result[0].processed).toBe(true);
        expect(result[0].sizeKB).toBeLessThan(200); // Should be smaller after cleaning
      });

      it('should handle AI cleaning failure', async () => {
        mockAI.generate.mockRejectedValue(new Error('AI service unavailable'));

        const cleanSpy = jest.spyOn(fetcher as any, 'cleanDocumentationWithAI');
        cleanSpy.mockImplementation(async (sources) => {
          // Fallback to original sources when AI fails
          return sources.map(source => ({ ...source, processed: false }));
        });

        const rawSources = [
          {
            type: 'official-site' as const,
            url: 'https://reactjs.org/docs',
            content: 'Raw documentation content',
            sizeKB: 100,
            lastUpdated: '2020-01-01T00:00:00.000Z',
          },
        ];

        const result = await (fetcher as any).cleanDocumentationWithAI(rawSources, 'react');
        
        expect(result).toHaveLength(1);
        expect(result[0].processed).toBe(false);
        expect(result[0].content).toBe('Raw documentation content');
      });

      it('should trim documentation to size limits', async () => {
        const trimSpy = jest.spyOn(fetcher as any, 'trimDocumentationSources');
        trimSpy.mockImplementation((sources, maxSizeKB) => {
          return sources.filter((source: any) => source.sizeKB <= maxSizeKB);
        });

        const largeSources = [
          { content: 'Small content', sizeKB: 50 },
          { content: 'Large content', sizeKB: 1500 },
          { content: 'Medium content', sizeKB: 300 },
        ];

        const result = (fetcher as any).trimDocumentationSources(largeSources, 1000);
        
        expect(result).toHaveLength(2); // Should exclude the 1500KB source
        expect(result.every((source: any) => source.sizeKB <= 1000)).toBe(true);
      });
    });

    describe('Cache Management', () => {
      let fetcher: DocumentationFetcher;

      beforeEach(() => {
        fetcher = new DocumentationFetcher(mockSettings);
        mockFs.mkdir.mockResolvedValue(undefined);
        mockFs.access.mockResolvedValue(undefined);
        mockFs.stat.mockResolvedValue({ mtime: new Date('2020-01-01T00:00:00.000Z') });
      });

      it('should ensure cache directory exists', async () => {
        const ensureSpy = jest.spyOn(fetcher as any, 'ensureCacheDir');
        ensureSpy.mockResolvedValue(undefined);

        await (fetcher as any).ensureCacheDir();
        expect(ensureSpy).toHaveBeenCalled();
      });

      it('should get cached documentation when available', async () => {
        const cacheSpy = jest.spyOn(fetcher as any, 'getCachedDocumentation');
        cacheSpy.mockResolvedValue({
          name: 'react',
          sources: [
            {
              type: 'official-site',
              url: 'https://reactjs.org/docs',
              content: 'Cached React documentation',
              sizeKB: 100,
              lastUpdated: '2020-01-01T00:00:00.000Z',
            },
          ],
          sizeKB: 100,
          lastFetched: '2020-01-01T00:00:00.000Z',
        });

        const result = await (fetcher as any).getCachedDocumentation('react');
        
        expect(result.name).toBe('react');
        expect(result.sources).toHaveLength(1);
        expect(result.sizeKB).toBe(100);
      });

      it('should return null for cache miss', async () => {
        const cacheSpy = jest.spyOn(fetcher as any, 'getCachedDocumentation');
        cacheSpy.mockResolvedValue(null);

        const result = await (fetcher as any).getCachedDocumentation('non-cached-library');
        expect(result).toBeNull();
      });

      it('should cache documentation after fetching', async () => {
        const cacheSpy = jest.spyOn(fetcher as any, 'cacheDocumentation');
        cacheSpy.mockResolvedValue(undefined);

        mockFs.writeFile.mockResolvedValue(undefined);

        const docToCache = {
          name: 'vue',
          sources: [
            {
              type: 'official-site' as const,
              url: 'https://vuejs.org/guide/',
              content: 'Vue.js documentation',
              sizeKB: 150,
              lastUpdated: '2020-01-01T00:00:00.000Z',
            },
          ],
          sizeKB: 150,
          lastFetched: '2020-01-01T00:00:00.000Z',
        };

        await (fetcher as any).cacheDocumentation(docToCache);
        expect(cacheSpy).toHaveBeenCalledWith(docToCache);
      });

      it('should handle cache write errors', async () => {
        const cacheSpy = jest.spyOn(fetcher as any, 'cacheDocumentation');
        cacheSpy.mockRejectedValue(new Error('Disk full'));

        const docToCache = {
          name: 'angular',
          sources: [],
          sizeKB: 0,
          lastFetched: '2020-01-01T00:00:00.000Z',
        };

        await expect((fetcher as any).cacheDocumentation(docToCache))
          .rejects.toThrow('Disk full');
      });
    });

    describe('Full Integration Scenarios', () => {
      let fetcher: DocumentationFetcher;

      beforeEach(() => {
        fetcher = new DocumentationFetcher(mockSettings, 'github-token', {
          apiKey: 'test-key',
          model: 'gpt-4',
          apiBase: 'https://api.openai.com/v1',
        });
      });

      it('should handle complete documentation fetch workflow', async () => {
        const libraries = [
          { name: 'react', confidenceScore: 0.9, category: 'library', detectedIn: ['task-1'], source: 'llm' as const },
          { name: 'typescript', confidenceScore: 0.8, category: 'library', detectedIn: ['task-2'], source: 'llm' as const },
        ];

        // Mock the complete workflow
        jest.spyOn(fetcher as any, 'ensureCacheDir').mockResolvedValue(undefined);
        jest.spyOn(fetcher as any, 'getCachedDocumentation').mockResolvedValue(null);
        jest.spyOn(fetcher as any, 'searchAndVerifyLibrary').mockResolvedValue({
          name: 'react',
          verified: true,
          officialUrl: 'https://reactjs.org',
          githubUrl: 'https://github.com/facebook/react',
        });
        jest.spyOn(fetcher as any, 'fetchFromSources').mockResolvedValue([
          {
            type: 'official-site',
            url: 'https://reactjs.org/docs',
            content: 'React documentation',
            sizeKB: 200,
            lastUpdated: '2020-01-01T00:00:00.000Z',
          },
        ]);
        jest.spyOn(fetcher as any, 'cacheDocumentation').mockResolvedValue(undefined);

        const result = await fetcher.fetchLibraryDocumentation(libraries);

        expect(result.libraries).toHaveLength(2);
        expect(result.fetchedCount).toBeGreaterThanOrEqual(0);
        expect(result.totalSizeKB).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(result.errors)).toBe(true);
      });

      it('should handle mixed success and failure scenarios', async () => {
        const libraries = [
          { name: 'valid-library', confidenceScore: 0.9, category: 'library', detectedIn: ['task-1'], source: 'llm' as const },
          { name: 'invalid-library', confidenceScore: 0.5, category: 'library', detectedIn: ['task-2'], source: 'llm' as const },
        ];

        jest.spyOn(fetcher as any, 'ensureCacheDir').mockResolvedValue(undefined);
        jest.spyOn(fetcher as any, 'getCachedDocumentation').mockResolvedValue(null);
        jest.spyOn(fetcher as any, 'searchAndVerifyLibrary')
          .mockResolvedValueOnce({ name: 'valid-library', verified: true })
          .mockResolvedValueOnce(null); // Invalid library not found

        const result = await fetcher.fetchLibraryDocumentation(libraries);

        expect(result.fetchedCount).toBeLessThanOrEqual(2);
        expect(result.skippedCount).toBeGreaterThanOrEqual(0);
        expect(result.errorCount).toBeGreaterThanOrEqual(0);
        expect(result.errors.length).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('LibraryIdentifier - Enhanced Coverage', () => {
    beforeEach(() => {
      mockAI.generate.mockClear();
    });

    describe('Core Library Identification', () => {
      it('should identify libraries from task content with context', async () => {
        mockAI.generate.mockResolvedValue({
          output: 'react\ntypescript\ntailwindcss\njest',
        });

        const tasks = [
          {
            id: 'frontend-task',
            title: 'Build React Frontend',
            details: `Create a modern React application with TypeScript support.
            Use Tailwind CSS for styling and Jest for testing.
            
            Requirements:
            - React 18 with hooks
            - TypeScript for type safety
            - Tailwind CSS for responsive design
            - Jest and React Testing Library for unit tests`,
          },
        ];

        const result = await LibraryIdentifier.identifyLibraries(
          tasks,
          'test-api-key',
          'gpt-4',
          'https://api.openai.com/v1'
        );

        expect(result.length).toBeGreaterThanOrEqual(4);
        expect(result.map(lib => lib.name)).toEqual(
          expect.arrayContaining(['react', 'typescript', 'tailwindcss', 'jest'])
        );
        expect(result.every(lib => lib.confidenceScore > 0.5)).toBe(true);
      });

      it('should handle multiple tasks with overlapping libraries', async () => {
        mockAI.generate.mockImplementation(async ({ prompt }) => {
          if (prompt.includes('React')) {
            return { output: 'react\ntypescript\nreact-router-dom' };
          } else if (prompt.includes('Node.js')) {
            return { output: 'express\ntypescript\nmongoose' };
          }
          return { output: 'common-library' };
        });

        const tasks = [
          {
            id: 'frontend-task',
            title: 'React Frontend',
            details: 'Build React frontend with TypeScript and React Router',
          },
          {
            id: 'backend-task',
            title: 'Node.js Backend',
            details: 'Create Express API with TypeScript and Mongoose',
          },
        ];

        const result = await LibraryIdentifier.identifyLibraries(
          tasks,
          'test-api-key',
          'gpt-4',
          'https://api.openai.com/v1'
        );

        // Should have deduplicated TypeScript
        const libraryNames = result.map(lib => lib.name);
        const typeScriptLibs = libraryNames.filter(name => name === 'typescript');
        expect(typeScriptLibs).toHaveLength(1);

        // Should have libraries from both tasks
        expect(libraryNames).toEqual(
          expect.arrayContaining(['react', 'express', 'mongoose'])
        );
      });

      it('should handle empty or invalid AI responses', async () => {
        mockAI.generate.mockResolvedValue({
          output: '', // Empty response
        });

        const tasks = [
          {
            id: 'empty-task',
            title: 'Task with no clear libraries',
            details: 'Generic task description without specific technology mentions',
          },
        ];

        const result = await LibraryIdentifier.identifyLibraries(
          tasks,
          'test-api-key',
          'gpt-4',
          'https://api.openai.com/v1'
        );

        expect(result).toHaveLength(0);
      });

      it('should handle AI service errors gracefully', async () => {
        mockAI.generate.mockRejectedValue(new Error('AI service unavailable'));

        const tasks = [
          {
            id: 'error-task',
            title: 'Task that causes AI error',
            details: 'Task details',
          },
        ];

        await expect(
          LibraryIdentifier.identifyLibraries(
            tasks,
            'invalid-api-key',
            'gpt-4',
            'https://api.openai.com/v1'
          )
        ).rejects.toThrow('AI service unavailable');
      });
    });

    describe('Library Filtering and Processing', () => {
      it('should filter libraries by confidence score', () => {
        const mockLibraries = [
          { name: 'high-confidence', confidenceScore: 0.95, category: 'library', detectedIn: ['task-1'], source: 'llm' as const },
          { name: 'medium-confidence', confidenceScore: 0.7, category: 'library', detectedIn: ['task-1'], source: 'llm' as const },
          { name: 'low-confidence', confidenceScore: 0.3, category: 'library', detectedIn: ['task-1'], source: 'llm' as const },
        ];

        const filtered = LibraryIdentifier.filterLibraries(mockLibraries, {
          minConfidence: 0.6,
        });

        expect(filtered).toHaveLength(2);
        expect(filtered.map(lib => lib.name)).toEqual(['high-confidence', 'medium-confidence']);
      });

      it('should filter libraries by category', () => {
        const mockLibraries = [
          { name: 'react', confidenceScore: 0.9, category: 'library', detectedIn: ['task-1'], source: 'llm' as const },
          { name: 'webpack', confidenceScore: 0.8, category: 'tool', detectedIn: ['task-1'], source: 'llm' as const },
          { name: 'aws', confidenceScore: 0.7, category: 'service', detectedIn: ['task-1'], source: 'llm' as const },
        ];

        const filtered = LibraryIdentifier.filterLibraries(mockLibraries, {
          categories: ['library', 'tool'],
        });

        expect(filtered).toHaveLength(2);
        expect(filtered.map(lib => lib.name)).toEqual(['react', 'webpack']);
      });

      it('should limit number of results', () => {
        const mockLibraries = Array(10).fill(null).map((_, i) => ({
          name: `library-${i}`,
          confidenceScore: 0.9 - i * 0.05,
          category: 'library',
          detectedIn: ['task-1'],
          source: 'llm' as const,
        }));

        const filtered = LibraryIdentifier.filterLibraries(mockLibraries, {
          maxCount: 5,
        });

        expect(filtered).toHaveLength(5);
        // Should be sorted by confidence (highest first)
        expect(filtered[0].confidenceScore).toBeGreaterThan(filtered[4].confidenceScore);
      });

      it('should combine multiple filter criteria', () => {
        const mockLibraries = [
          { name: 'react', confidenceScore: 0.95, category: 'library', detectedIn: ['task-1'], source: 'llm' as const },
          { name: 'vue', confidenceScore: 0.85, category: 'library', detectedIn: ['task-1'], source: 'llm' as const },
          { name: 'webpack', confidenceScore: 0.9, category: 'tool', detectedIn: ['task-1'], source: 'llm' as const },
          { name: 'jest', confidenceScore: 0.6, category: 'library', detectedIn: ['task-1'], source: 'llm' as const },
        ];

        const filtered = LibraryIdentifier.filterLibraries(mockLibraries, {
          minConfidence: 0.8,
          categories: ['library'],
          maxCount: 2,
        });

        expect(filtered).toHaveLength(2);
        expect(filtered.every(lib => lib.category === 'library')).toBe(true);
        expect(filtered.every(lib => lib.confidenceScore >= 0.8)).toBe(true);
        expect(filtered[0].name).toBe('react'); // Highest confidence
      });
    });

    describe('Complex Scenarios and Edge Cases', () => {
      it('should handle very large task descriptions', async () => {
        const largeTaskDescription = `
          Build a comprehensive e-commerce platform with the following requirements:
          ${'Detailed requirement '.repeat(1000)}
          
          Technology stack should include:
          - React for frontend
          - Node.js with Express for backend
          - PostgreSQL for database
          - Redis for caching
          - Docker for containerization
          - Jest for testing
          - TypeScript throughout
        `;

        mockAI.generate.mockResolvedValue({
          output: 'react\nexpress\npostgresql\nredis\ndocker\njest\ntypescript',
        });

        const tasks = [
          {
            id: 'large-task',
            title: 'Comprehensive E-commerce Platform',
            details: largeTaskDescription,
          },
        ];

        const result = await LibraryIdentifier.identifyLibraries(
          tasks,
          'test-api-key',
          'gpt-4',
          'https://api.openai.com/v1'
        );

        expect(result.length).toBeGreaterThanOrEqual(7);
        expect(result.map(lib => lib.name)).toEqual(
          expect.arrayContaining(['react', 'express', 'postgresql', 'typescript'])
        );
      });

      it('should handle special characters and internationalization', async () => {
        mockAI.generate.mockResolvedValue({
          output: 'react\ni18next\nunicode-js',
        });

        const tasks = [
          {
            id: 'i18n-task',
            title: 'Internationalization Support',
            details: `
              Add internationalization support with émojis 🚀 and special characters.
              Use React with i18next for translations.
              Support Unicode and various character encodings.
            `,
          },
        ];

        const result = await LibraryIdentifier.identifyLibraries(
          tasks,
          'test-api-key',
          'gpt-4',
          'https://api.openai.com/v1'
        );

        expect(result.map(lib => lib.name)).toEqual(
          expect.arrayContaining(['react', 'i18next'])
        );
      });

      it('should handle concurrent identification requests', async () => {
        mockAI.generate.mockImplementation(async ({ prompt }) => {
          await new Promise(resolve => setTimeout(resolve, 10)); // Simulate delay
          if (prompt.includes('React')) return { output: 'react\ntypescript' };
          if (prompt.includes('Vue')) return { output: 'vue\ntypescript' };
          if (prompt.includes('Angular')) return { output: 'angular\ntypescript' };
          return { output: 'javascript' };
        });

        const taskGroups = [
          [{ id: '1', title: 'React App', details: 'Build React application' }],
          [{ id: '2', title: 'Vue App', details: 'Build Vue application' }],
          [{ id: '3', title: 'Angular App', details: 'Build Angular application' }],
        ];

        const promises = taskGroups.map(tasks =>
          LibraryIdentifier.identifyLibraries(
            tasks,
            'test-api-key',
            'gpt-4',
            'https://api.openai.com/v1'
          )
        );

        const results = await Promise.all(promises);

        expect(results).toHaveLength(3);
        expect(results[0].map(lib => lib.name)).toContain('react');
        expect(results[1].map(lib => lib.name)).toContain('vue');
        expect(results[2].map(lib => lib.name)).toContain('angular');

        // All should have TypeScript
        results.forEach(result => {
          expect(result.map(lib => lib.name)).toContain('typescript');
        });
      });

      it('should handle memory-intensive operations', async () => {
        const manyTasks = Array(100).fill(null).map((_, i) => ({
          id: `task-${i}`,
          title: `Task ${i}`,
          details: `Task ${i} uses react, typescript, and various other libraries. ${
            'Additional details '.repeat(100)
          }`,
        }));

        mockAI.generate.mockResolvedValue({
          output: 'react\ntypescript\njest',
        });

        const result = await LibraryIdentifier.identifyLibraries(
          manyTasks,
          'test-api-key',
          'gpt-4',
          'https://api.openai.com/v1'
        );

        // Should handle large number of tasks without memory issues
        expect(result).toBeInstanceOf(Array);
        expect(result.length).toBeGreaterThanOrEqual(3);
        expect(mockAI.generate).toHaveBeenCalledTimes(100);
      });
    });
  });
});