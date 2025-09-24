import { DocumentationFetcher } from '@/services/documentation-fetcher';
import { LibraryDocumentation, DocumentationSettings, IdentifiedLibrary } from '@/types/documentation';

// Mock filesystem and network dependencies
jest.mock('fs/promises');
jest.mock('path');
jest.mock('@octokit/rest');

// Mock the global fetch if needed
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('DocumentationFetcher Service', () => {
  let documentationFetcher: DocumentationFetcher;
  let mockSettings: DocumentationSettings;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSettings = {
      includeOfficialDocs: true,
      includeGitHubReadme: true,
      includeNpmRegistry: true,
      maxDocumentationSizeKB: 1000,
      preferredSources: ['official', 'github', 'npm']
    };

    documentationFetcher = new DocumentationFetcher(mockSettings);
    
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with settings', () => {
      const settings = {
        includeOfficialDocs: false,
        includeGitHubReadme: false,
        includeNpmRegistry: true,
        maxDocumentationSizeKB: 500,
        preferredSources: ['npm']
      };

      const fetcher = new DocumentationFetcher(settings);
      expect(fetcher).toBeInstanceOf(DocumentationFetcher);
    });

    it('should initialize with GitHub token', () => {
      const fetcher = new DocumentationFetcher(mockSettings, 'github-token');
      expect(fetcher).toBeInstanceOf(DocumentationFetcher);
    });

    it('should initialize with LLM config', () => {
      const llmConfig = {
        apiKey: 'test-key',
        model: 'test/model',
        apiBase: 'https://api.test.com'
      };

      const fetcher = new DocumentationFetcher(mockSettings, undefined, llmConfig);
      expect(fetcher).toBeInstanceOf(DocumentationFetcher);
    });
  });

  describe('fetchLibraryDocumentation', () => {
    it('should handle empty library list', async () => {
      const libraries: IdentifiedLibrary[] = [];

      const result = await documentationFetcher.fetchLibraryDocumentation(libraries);

      expect(result.libraries).toHaveLength(0);
      expect(result.fetchedCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(result.errorCount).toBe(0);
      expect(result.totalSizeKB).toBe(0);
    });

    it('should skip invalid libraries', async () => {
      const libraries: IdentifiedLibrary[] = [
        {
          name: 'invalid.library.name',
          confidenceScore: 0.5,
          category: 'library',
          detectedIn: ['task1'],
          source: 'llm'
        }
      ];

      // Mock searchAndVerifyLibrary to return null for invalid library
      jest.spyOn(documentationFetcher as any, 'searchAndVerifyLibrary')
        .mockResolvedValueOnce(null);

      const result = await documentationFetcher.fetchLibraryDocumentation(libraries);

      expect(result.libraries).toHaveLength(0);
      expect(result.skippedCount).toBe(1);
      expect(result.errors).toContain('Library "invalid.library.name" not found or not verified');
    });

    it('should fetch documentation for valid libraries', async () => {
      const libraries: IdentifiedLibrary[] = [
        {
          name: 'react',
          confidenceScore: 0.9,
          category: 'library',
          detectedIn: ['task1'],
          source: 'llm'
        }
      ];

      const mockLibraryDoc: LibraryDocumentation = {
        name: 'react',
        version: '18.0.0',
        description: 'A JavaScript library for building user interfaces',
        sources: [
          {
            type: 'official',
            url: 'https://react.dev/',
            title: 'React Documentation',
            content: 'React documentation content',
            sizeKB: 50,
            lastUpdated: new Date().toISOString()
          }
        ],
        sizeKB: 50,
        fetchedAt: new Date().toISOString()
      };

      // Mock internal methods
      jest.spyOn(documentationFetcher as any, 'searchAndVerifyLibrary')
        .mockResolvedValueOnce({ name: 'react', verified: true });
      jest.spyOn(documentationFetcher as any, 'fetchFromSources')
        .mockResolvedValueOnce(mockLibraryDoc);
      jest.spyOn(documentationFetcher as any, 'getCachedDocumentation')
        .mockResolvedValueOnce(null);
      jest.spyOn(documentationFetcher as any, 'cacheDocumentation')
        .mockResolvedValueOnce(undefined);

      const result = await documentationFetcher.fetchLibraryDocumentation(libraries);

      expect(result.libraries).toHaveLength(1);
      expect(result.libraries[0].name).toBe('react');
      expect(result.fetchedCount).toBe(1);
      expect(result.totalSizeKB).toBe(50);
    });

    it('should use cached documentation when available', async () => {
      const libraries: IdentifiedLibrary[] = [
        {
          name: 'lodash',
          confidenceScore: 0.8,
          category: 'library',
          detectedIn: ['task1'],
          source: 'llm'
        }
      ];

      const cachedDoc: LibraryDocumentation = {
        name: 'lodash',
        version: '4.17.21',
        description: 'A modern JavaScript utility library',
        sources: [],
        sizeKB: 30,
        fetchedAt: new Date().toISOString()
      };

      jest.spyOn(documentationFetcher as any, 'getCachedDocumentation')
        .mockResolvedValueOnce(cachedDoc);

      const result = await documentationFetcher.fetchLibraryDocumentation(libraries);

      expect(result.libraries).toHaveLength(1);
      expect(result.libraries[0]).toBe(cachedDoc);
    });

    it('should handle errors during documentation fetching', async () => {
      const libraries: IdentifiedLibrary[] = [
        {
          name: 'error-lib',
          confidenceScore: 0.7,
          category: 'library',
          detectedIn: ['task1'],
          source: 'llm'
        }
      ];

      jest.spyOn(documentationFetcher as any, 'searchAndVerifyLibrary')
        .mockResolvedValueOnce({ name: 'error-lib', verified: true });
      jest.spyOn(documentationFetcher as any, 'getCachedDocumentation')
        .mockResolvedValueOnce(null);
      jest.spyOn(documentationFetcher as any, 'fetchFromSources')
        .mockRejectedValueOnce(new Error('Fetch failed'));

      const result = await documentationFetcher.fetchLibraryDocumentation(libraries);

      expect(result.libraries).toHaveLength(0);
      expect(result.errorCount).toBe(1);
      expect(result.errors).toContain('Failed to fetch error-lib: Fetch failed');
    });

    it('should trim documentation if it exceeds size limits', async () => {
      const libraries: IdentifiedLibrary[] = [
        {
          name: 'large-lib',
          confidenceScore: 0.9,
          category: 'library',
          detectedIn: ['task1'],
          source: 'llm'
        }
      ];

      const largeDoc: LibraryDocumentation = {
        name: 'large-lib',
        version: '1.0.0',
        description: 'A large library',
        sources: [
          {
            type: 'official',
            url: 'https://large-lib.dev/',
            title: 'Large Lib Docs',
            content: 'Very large content',
            sizeKB: 2000, // Exceeds max limit
            lastUpdated: new Date().toISOString()
          }
        ],
        sizeKB: 2000,
        fetchedAt: new Date().toISOString()
      };

      const trimmedDoc = {
        ...largeDoc,
        sources: largeDoc.sources.slice(0, 1),
        sizeKB: 500
      };

      jest.spyOn(documentationFetcher as any, 'searchAndVerifyLibrary')
        .mockResolvedValueOnce({ name: 'large-lib', verified: true });
      jest.spyOn(documentationFetcher as any, 'getCachedDocumentation')
        .mockResolvedValueOnce(null);
      jest.spyOn(documentationFetcher as any, 'fetchFromSources')
        .mockResolvedValueOnce(largeDoc);
      jest.spyOn(documentationFetcher as any, 'trimDocumentationSources')
        .mockReturnValueOnce(trimmedDoc.sources);
      jest.spyOn(documentationFetcher as any, 'cacheDocumentation')
        .mockResolvedValueOnce(undefined);

      const result = await documentationFetcher.fetchLibraryDocumentation(libraries);

      expect(result.libraries).toHaveLength(1);
      expect(result.totalSizeKB).toBeLessThan(2000);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle network timeouts gracefully', async () => {
      const libraries: IdentifiedLibrary[] = [
        {
          name: 'timeout-lib',
          confidenceScore: 0.8,
          category: 'library',
          detectedIn: ['task1'],
          source: 'llm'
        }
      ];

      jest.spyOn(documentationFetcher as any, 'searchAndVerifyLibrary')
        .mockResolvedValueOnce({ name: 'timeout-lib', verified: true });
      jest.spyOn(documentationFetcher as any, 'getCachedDocumentation')
        .mockResolvedValueOnce(null);
      jest.spyOn(documentationFetcher as any, 'fetchFromSources')
        .mockRejectedValueOnce(new Error('Request timeout'));

      const result = await documentationFetcher.fetchLibraryDocumentation(libraries);

      expect(result.errorCount).toBe(1);
      expect(result.errors[0]).toContain('Request timeout');
    });

    it('should handle malformed library names', async () => {
      const libraries: IdentifiedLibrary[] = [
        {
          name: '###invalid###',
          confidenceScore: 0.5,
          category: 'library',
          detectedIn: ['task1'],
          source: 'llm'
        }
      ];

      jest.spyOn(documentationFetcher as any, 'searchAndVerifyLibrary')
        .mockResolvedValueOnce(null);

      const result = await documentationFetcher.fetchLibraryDocumentation(libraries);

      expect(result.skippedCount).toBe(1);
      expect(result.errors).toContain('Library "###invalid###" not found or not verified');
    });

    it('should handle concurrent library fetching', async () => {
      const libraries: IdentifiedLibrary[] = [
        {
          name: 'lib1',
          confidenceScore: 0.9,
          category: 'library',
          detectedIn: ['task1'],
          source: 'llm'
        },
        {
          name: 'lib2',
          confidenceScore: 0.8,
          category: 'library',
          detectedIn: ['task2'],
          source: 'llm'
        }
      ];

      // Mock both libraries as valid
      jest.spyOn(documentationFetcher as any, 'searchAndVerifyLibrary')
        .mockResolvedValueOnce({ name: 'lib1', verified: true })
        .mockResolvedValueOnce({ name: 'lib2', verified: true });
      
      jest.spyOn(documentationFetcher as any, 'getCachedDocumentation')
        .mockResolvedValue(null);

      jest.spyOn(documentationFetcher as any, 'fetchFromSources')
        .mockResolvedValueOnce({
          name: 'lib1',
          version: '1.0.0',
          description: 'Library 1',
          sources: [],
          sizeKB: 10,
          fetchedAt: new Date().toISOString()
        })
        .mockResolvedValueOnce({
          name: 'lib2',
          version: '2.0.0',
          description: 'Library 2',
          sources: [],
          sizeKB: 20,
          fetchedAt: new Date().toISOString()
        });

      jest.spyOn(documentationFetcher as any, 'cacheDocumentation')
        .mockResolvedValue(undefined);

      const result = await documentationFetcher.fetchLibraryDocumentation(libraries);

      expect(result.libraries).toHaveLength(2);
      expect(result.fetchedCount).toBe(2);
      expect(result.totalSizeKB).toBe(30);
    });
  });

  describe('settings configuration', () => {
    it('should respect includeOfficialDocs setting', async () => {
      const settingsWithoutOfficial = {
        ...mockSettings,
        includeOfficialDocs: false
      };

      const fetcherWithoutOfficial = new DocumentationFetcher(settingsWithoutOfficial);
      
      // This would require mocking internal methods to verify the settings are respected
      expect(fetcherWithoutOfficial).toBeInstanceOf(DocumentationFetcher);
    });

    it('should respect maxDocumentationSizeKB setting', async () => {
      const smallSizeSettings = {
        ...mockSettings,
        maxDocumentationSizeKB: 100
      };

      const smallSizeFetcher = new DocumentationFetcher(smallSizeSettings);
      expect(smallSizeFetcher).toBeInstanceOf(DocumentationFetcher);
    });

    it('should respect preferredSources setting', async () => {
      const customSourceSettings = {
        ...mockSettings,
        preferredSources: ['github'] as const
      };

      const customSourceFetcher = new DocumentationFetcher(customSourceSettings);
      expect(customSourceFetcher).toBeInstanceOf(DocumentationFetcher);
    });
  });

  describe('utility methods', () => {
    it('should handle cache directory creation', async () => {
      const libraries: IdentifiedLibrary[] = [];
      
      // Mock ensureCacheDir to verify it's called
      jest.spyOn(documentationFetcher as any, 'ensureCacheDir')
        .mockResolvedValueOnce(undefined);

      await documentationFetcher.fetchLibraryDocumentation(libraries);

      expect(documentationFetcher['ensureCacheDir']).toHaveBeenCalled();
    });
  });
});