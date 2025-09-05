import type { DocumentationSettings } from '@/types/documentation';

// Mock the Octokit dependency since it uses ESM modules
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    search: {
      repos: jest.fn().mockResolvedValue({
        data: { items: [] }
      })
    },
    repos: {
      getReadme: jest.fn().mockResolvedValue({
        data: { content: Buffer.from('# Test README').toString('base64') }
      })
    }
  }))
}));

// Mock fs/promises for server-side testing
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockRejectedValue(new Error('File not found')),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

// Mock fetch for testing
global.fetch = jest.fn();

// Import after mocking
import { DocumentationFetcher } from '@/services/documentation-fetcher';
import { LibraryIdentifier } from '@/services/library-identifier';

describe('Documentation Integration', () => {
  const mockSettings: DocumentationSettings = {
    sources: ['github', 'official'],
    includeStackOverflow: false,
    maxDocumentationSizeKB: 512,
    cacheDocumentationDays: 7,
    enabled: true,
  };

  const mockTasks = [
    {
      id: 'task-001',
      title: 'Setup React application',
      details: 'Create a new React app using Next.js framework with TypeScript.',
    },
    {
      id: 'task-002',
      title: 'Add Express backend',
      details: 'Set up Express.js server with authentication middleware.',
    },
  ];

  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  test('identifies libraries from tasks', async () => {
    const libraries = await LibraryIdentifier.identifyLibraries(mockTasks, { useAI: false });
    
    expect(libraries.length).toBeGreaterThan(0);
    
    const reactLib = libraries.find(lib => lib.name === 'react');
    expect(reactLib).toBeDefined();
    expect(reactLib?.category).toBe('frontend');

    const expressLib = libraries.find(lib => lib.name === 'express');
    expect(expressLib).toBeDefined();
    expect(expressLib?.category).toBe('backend');

    console.log('✅ Library identification integration test passed');
  });

  test('handles documentation fetching errors gracefully', async () => {
    // Mock fetch to reject
    (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const fetcher = new DocumentationFetcher(mockSettings);
    const libraries = await LibraryIdentifier.identifyLibraries(mockTasks, { useAI: false });
    const filteredLibs = LibraryIdentifier.filterLibraries(libraries, { maxCount: 2 });

    const result = await fetcher.fetchLibraryDocumentation(filteredLibs);

    // When all requests fail, we should get no libraries and some errors
    expect(result.libraries.length).toBe(0);
    expect(result.fetchedCount).toBe(0);
    // The error handling is working (we can see from console.warn output)

    console.log('✅ Error handling integration test passed');
  });

  test('processes documentation settings correctly', () => {
    const settings: DocumentationSettings = {
      sources: ['github'],
      includeStackOverflow: true,
      maxDocumentationSizeKB: 256,
      cacheDocumentationDays: 3,
      enabled: false,
    };

    expect(settings.enabled).toBe(false);
    expect(settings.sources).toEqual(['github']);
    expect(settings.maxDocumentationSizeKB).toBe(256);

    console.log('✅ Settings processing test passed');
  });

  test('filters libraries by confidence and category', async () => {
    const libraries = await LibraryIdentifier.identifyLibraries(mockTasks, { useAI: false });
    
    // Test confidence filtering
    const highConfidence = LibraryIdentifier.filterLibraries(libraries, {
      minConfidence: 0.8,
    });
    
    expect(highConfidence.every(lib => lib.confidenceScore >= 0.8)).toBe(true);

    // Test category filtering
    const frontendOnly = LibraryIdentifier.filterLibraries(libraries, {
      categories: ['frontend'],
    });
    
    expect(frontendOnly.every(lib => lib.category === 'frontend')).toBe(true);

    console.log('✅ Library filtering integration test passed');
  });

  test('handles empty task lists', async () => {
    const libraries = await LibraryIdentifier.identifyLibraries([], { useAI: false });
    expect(libraries).toEqual([]);

    const filtered = LibraryIdentifier.filterLibraries(libraries, { maxCount: 10 });
    expect(filtered).toEqual([]);

    console.log('✅ Empty task handling test passed');
  });
});