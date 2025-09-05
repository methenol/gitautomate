import { DocumentationFetcher } from '@/services/documentation-fetcher';
import type { DocumentationSettings, IdentifiedLibrary } from '@/types/documentation';

// Mock dependencies
const mockSearch = jest.fn();
const mockGetReadme = jest.fn();

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    search: {
      repos: mockSearch
    },
    repos: {
      getReadme: mockGetReadme
    }
  }))
}));

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn(),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

global.fetch = jest.fn();

describe('DocumentationFetcher - Multi-Source Testing', () => {
  let mockFetch: jest.MockedFunction<typeof fetch>;

  const defaultSettings: DocumentationSettings = {
    sources: ['github', 'official', 'mdn', 'npm'],
    includeStackOverflow: false,
    maxDocumentationSizeKB: 512,
    cacheDocumentationDays: 7,
    enabled: true,
  };

  beforeEach(() => {
    mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    
    // Reset all mocks
    mockSearch.mockClear();
    mockGetReadme.mockClear();
    mockFetch.mockClear();
  });

  describe('GitHub source testing', () => {
    test('fetches documentation from GitHub successfully', async () => {
      // Mock GitHub API responses
      mockSearch.mockResolvedValue({
        data: {
          items: [{
            name: 'react',
            owner: { login: 'facebook' },
            html_url: 'https://github.com/facebook/react',
            description: 'A JavaScript library for building user interfaces',
          }]
        }
      });

      mockGetReadme.mockResolvedValue({
        data: {
          content: Buffer.from('# React\n\nA JavaScript library for building user interfaces.').toString('base64')
        }
      });

      const fetcher = new DocumentationFetcher(defaultSettings, 'mock-token');
      const mockLibrary: IdentifiedLibrary = {
        name: 'react',
        category: 'frontend',
        confidenceScore: 0.9,
        detectedIn: ['task-001'],
      };

      const result = await fetcher.fetchLibraryDocumentation([mockLibrary]);

      expect(result.libraries).toHaveLength(1);
      expect(result.libraries[0].source).toBe('github');
      expect(result.libraries[0].name).toBe('react');
      expect(result.libraries[0].content).toContain('React');
      expect(result.errorCount).toBe(0);

      console.log('✅ GitHub source test passed');
    });

    test('handles GitHub API errors gracefully', async () => {
      mockSearch.mockRejectedValue(new Error('GitHub API rate limit'));

      const fetcher = new DocumentationFetcher(defaultSettings, 'mock-token');
      const mockLibrary: IdentifiedLibrary = {
        name: 'unknown-lib',
        category: 'frontend',
        confidenceScore: 0.8,
        detectedIn: ['task-001'],
      };

      const result = await fetcher.fetchLibraryDocumentation([mockLibrary]);

      expect(result.libraries).toHaveLength(0);
      expect(result.errorCount).toBe(1);
      expect(result.errors[0]).toContain('unknown-lib');

      console.log('✅ GitHub error handling test passed');
    });

    test('falls back to repository description when README unavailable', async () => {
      mockSearch.mockResolvedValue({
        data: {
          items: [{
            name: 'test-lib',
            owner: { login: 'testuser' },
            html_url: 'https://github.com/testuser/test-lib',
            description: 'A test library for testing',
          }]
        }
      });

      mockGetReadme.mockRejectedValue(new Error('README not found'));

      const fetcher = new DocumentationFetcher(defaultSettings, 'mock-token');
      const mockLibrary: IdentifiedLibrary = {
        name: 'test-lib',
        category: 'utility',
        confidenceScore: 0.7,
        detectedIn: ['task-001'],
      };

      const result = await fetcher.fetchLibraryDocumentation([mockLibrary]);

      expect(result.libraries).toHaveLength(1);
      expect(result.libraries[0].content).toContain('test-lib');
      expect(result.libraries[0].content).toContain('A test library for testing');

      console.log('✅ GitHub fallback test passed');
    });
  });

  describe('Official website source testing', () => {
    test('fetches from official React documentation', async () => {
      const mockHtmlContent = `
        <html>
          <head><title>React - A JavaScript library</title></head>
          <body>
            <h1>Getting Started with React</h1>
            <p>React is a JavaScript library for building user interfaces.</p>
            <h2>Installation</h2>
            <pre><code>npm install react</code></pre>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockHtmlContent),
      } as Response);

      const fetcher = new DocumentationFetcher({
        ...defaultSettings,
        sources: ['official']
      });

      const mockLibrary: IdentifiedLibrary = {
        name: 'react',
        category: 'frontend',
        confidenceScore: 0.9,
        detectedIn: ['task-001'],
      };

      const result = await fetcher.fetchLibraryDocumentation([mockLibrary]);

      expect(result.libraries).toHaveLength(1);
      expect(result.libraries[0].source).toBe('official');
      expect(result.libraries[0].content).toContain('Getting Started with React');
      expect(result.libraries[0].content).toContain('npm install react');
      expect(result.libraries[0].contentType).toBe('markdown');

      console.log('✅ Official website test passed');
    });

    test('tries multiple official URLs until one succeeds', async () => {
      // First URL fails
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        } as Response)
        // Second URL succeeds
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('<h1>Vue.js Documentation</h1><p>The Progressive JavaScript Framework</p>'),
        } as Response);

      const fetcher = new DocumentationFetcher({
        ...defaultSettings,
        sources: ['official']
      });

      const mockLibrary: IdentifiedLibrary = {
        name: 'vue',
        category: 'frontend',
        confidenceScore: 0.9,
        detectedIn: ['task-001'],
      };

      const result = await fetcher.fetchLibraryDocumentation([mockLibrary]);

      expect(result.libraries).toHaveLength(1);
      expect(result.libraries[0].content).toContain('Vue.js Documentation');
      expect(mockFetch).toHaveBeenCalledTimes(2);

      console.log('✅ Multiple URL fallback test passed');
    });

    test('skips content that is too short', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<p>Short</p>'), // Too short content
      } as Response);

      const fetcher = new DocumentationFetcher({
        ...defaultSettings,
        sources: ['official']
      });

      const mockLibrary: IdentifiedLibrary = {
        name: 'unknown-lib',
        category: 'utility',
        confidenceScore: 0.7,
        detectedIn: ['task-001'],
      };

      const result = await fetcher.fetchLibraryDocumentation([mockLibrary]);

      expect(result.libraries).toHaveLength(0);
      expect(result.skippedCount).toBe(1);

      console.log('✅ Short content filtering test passed');
    });
  });

  describe('MDN source testing', () => {
    test('fetches MDN documentation for web technologies', async () => {
      const mockMdnContent = `
        <html>
          <body>
            <h1>Fetch API</h1>
            <p>The Fetch API provides an interface for fetching resources.</p>
            <h2>Syntax</h2>
            <code>fetch(resource, options)</code>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockMdnContent),
      } as Response);

      const fetcher = new DocumentationFetcher({
        ...defaultSettings,
        sources: ['mdn']
      });

      const mockLibrary: IdentifiedLibrary = {
        name: 'fetch',
        category: 'utility',
        confidenceScore: 0.8,
        detectedIn: ['task-001'],
      };

      const result = await fetcher.fetchLibraryDocumentation([mockLibrary]);

      expect(result.libraries).toHaveLength(1);
      expect(result.libraries[0].source).toBe('mdn');
      expect(result.libraries[0].content).toContain('Fetch API');
      expect(result.libraries[0].url).toContain('developer.mozilla.org');

      console.log('✅ MDN source test passed');
    });

    test('skips MDN for non-web technologies', async () => {
      const fetcher = new DocumentationFetcher({
        ...defaultSettings,
        sources: ['mdn']
      });

      const mockLibrary: IdentifiedLibrary = {
        name: 'django', // Not a web technology in MDN sense
        category: 'backend',
        confidenceScore: 0.9,
        detectedIn: ['task-001'],
      };

      const result = await fetcher.fetchLibraryDocumentation([mockLibrary]);

      expect(result.libraries).toHaveLength(0);
      expect(mockFetch).not.toHaveBeenCalled();

      console.log('✅ MDN filtering test passed');
    });
  });

  describe('NPM source testing', () => {
    test('fetches package information from NPM registry', async () => {
      const mockNpmResponse = {
        name: 'lodash',
        description: 'A modern JavaScript utility library delivering modularity, performance, & extras.',
        'dist-tags': { latest: '4.17.21' },
        versions: {
          '4.17.21': {
            description: 'A modern JavaScript utility library',
            homepage: 'https://lodash.com/',
            readme: '# Lodash\n\nA modern JavaScript utility library'
          }
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockNpmResponse),
      } as Response);

      const fetcher = new DocumentationFetcher({
        ...defaultSettings,
        sources: ['npm']
      });

      const mockLibrary: IdentifiedLibrary = {
        name: 'lodash',
        category: 'utility',
        confidenceScore: 0.9,
        detectedIn: ['task-001'],
      };

      const result = await fetcher.fetchLibraryDocumentation([mockLibrary]);

      expect(result.libraries).toHaveLength(1);
      expect(result.libraries[0].source).toBe('npm');
      expect(result.libraries[0].content).toContain('Lodash');
      expect(result.libraries[0].content).toContain('modern JavaScript utility library');
      expect(result.libraries[0].url).toContain('npmjs.com');

      console.log('✅ NPM source test passed');
    });

    test('skips NPM for non-JavaScript libraries', async () => {
      const fetcher = new DocumentationFetcher({
        ...defaultSettings,
        sources: ['npm']
      });

      const mockLibrary: IdentifiedLibrary = {
        name: 'postgresql',
        category: 'database',
        confidenceScore: 0.9,
        detectedIn: ['task-001'],
      };

      const result = await fetcher.fetchLibraryDocumentation([mockLibrary]);

      expect(result.libraries).toHaveLength(0);
      expect(mockFetch).not.toHaveBeenCalled();

      console.log('✅ NPM filtering test passed');
    });

    test('handles missing NPM package gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const fetcher = new DocumentationFetcher({
        ...defaultSettings,
        sources: ['npm']
      });

      const mockLibrary: IdentifiedLibrary = {
        name: 'nonexistent-package',
        category: 'frontend',
        confidenceScore: 0.7,
        detectedIn: ['task-001'],
      };

      const result = await fetcher.fetchLibraryDocumentation([mockLibrary]);

      expect(result.libraries).toHaveLength(0);
      expect(result.skippedCount).toBe(1);

      console.log('✅ NPM error handling test passed');
    });
  });

  describe('Multi-source prioritization', () => {
    test('prioritizes sources in correct order', async () => {
      // Mock successful responses from all sources
      mockSearch.mockResolvedValue({
        data: {
          items: [{
            name: 'test-lib',
            owner: { login: 'test' },
            html_url: 'https://github.com/test/test-lib',
            description: 'Test library',
          }]
        }
      });

      mockGetReadme.mockResolvedValue({
        data: { content: Buffer.from('# GitHub README').toString('base64') }
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('<h1>Official Documentation</h1><p>Official docs content</p>'),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('<h1>MDN Documentation</h1><p>MDN content</p>'),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            name: 'test-lib',
            description: 'NPM package description',
            'dist-tags': { latest: '1.0.0' },
            versions: { '1.0.0': { readme: '# NPM README' } }
          }),
        } as Response);

      const fetcher = new DocumentationFetcher(defaultSettings, 'token');
      const mockLibrary: IdentifiedLibrary = {
        name: 'fetch', // Web technology to enable all sources
        category: 'frontend',
        confidenceScore: 0.9,
        detectedIn: ['task-001'],
      };

      const result = await fetcher.fetchLibraryDocumentation([mockLibrary]);

      expect(result.libraries).toHaveLength(1);
      // Should prioritize GitHub over others
      expect(result.libraries[0].source).toBe('github');
      expect(result.libraries[0].content).toContain('GitHub README');

      console.log('✅ Source prioritization test passed');
    });

    test('falls back to lower priority sources when higher ones fail', async () => {
      // GitHub fails
      mockSearch.mockRejectedValue(new Error('GitHub error'));

      // Official site fails  
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        } as Response)
        // MDN succeeds
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('<h1>MDN Fallback</h1><p>MDN documentation content</p>'),
        } as Response);

      const fetcher = new DocumentationFetcher({
        ...defaultSettings,
        sources: ['github', 'official', 'mdn']
      }, 'token');

      const mockLibrary: IdentifiedLibrary = {
        name: 'websocket',
        category: 'frontend',
        confidenceScore: 0.8,
        detectedIn: ['task-001'],
      };

      const result = await fetcher.fetchLibraryDocumentation([mockLibrary]);

      expect(result.libraries).toHaveLength(1);
      expect(result.libraries[0].source).toBe('mdn');
      expect(result.libraries[0].content).toContain('MDN Fallback');

      console.log('✅ Source fallback test passed');
    });
  });

  describe('Size limits and caching', () => {
    test('truncates content exceeding size limit', async () => {
      const largeContent = 'x'.repeat(1024 * 600); // 600KB content
      
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(`<h1>Large Doc</h1><p>${largeContent}</p>`),
      } as Response);

      const fetcher = new DocumentationFetcher({
        ...defaultSettings,
        sources: ['official'],
        maxDocumentationSizeKB: 100, // Small limit
      });

      const mockLibrary: IdentifiedLibrary = {
        name: 'large-lib',
        category: 'frontend',
        confidenceScore: 0.9,
        detectedIn: ['task-001'],
      };

      const result = await fetcher.fetchLibraryDocumentation([mockLibrary]);

      expect(result.libraries).toHaveLength(1);
      expect(result.libraries[0].sizeKB).toBe(100);
      expect(result.libraries[0].content).toContain('content truncated due to size limit');

      console.log('✅ Size limit test passed');
    });

    test('respects rate limiting with delays', async () => {
      jest.useFakeTimers();
      
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<h1>Test</h1><p>Content</p>'),
      } as Response);

      const fetcher = new DocumentationFetcher({
        ...defaultSettings,
        sources: ['official']
      });

      const mockLibraries: IdentifiedLibrary[] = [
        { name: 'lib1', category: 'frontend', confidenceScore: 0.9, detectedIn: ['task-001'] },
        { name: 'lib2', category: 'frontend', confidenceScore: 0.9, detectedIn: ['task-001'] },
      ];

      const fetchPromise = fetcher.fetchLibraryDocumentation(mockLibraries);
      
      // Fast-forward time to complete delays
      jest.advanceTimersByTime(2000);
      
      const result = await fetchPromise;
      
      expect(result.libraries).toHaveLength(2);
      
      jest.useRealTimers();
      console.log('✅ Rate limiting test passed');
    });
  });

  describe('Error aggregation and reporting', () => {
    test('aggregates errors from multiple sources', async () => {
      // All sources fail
      mockSearch.mockRejectedValue(new Error('GitHub API error'));
      mockFetch.mockRejectedValue(new Error('Network error'));

      const fetcher = new DocumentationFetcher(defaultSettings, 'token');
      const mockLibraries: IdentifiedLibrary[] = [
        { name: 'lib1', category: 'frontend', confidenceScore: 0.9, detectedIn: ['task-001'] },
        { name: 'lib2', category: 'backend', confidenceScore: 0.8, detectedIn: ['task-002'] },
      ];

      const result = await fetcher.fetchLibraryDocumentation(mockLibraries);

      expect(result.libraries).toHaveLength(0);
      expect(result.errorCount).toBe(2);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('lib1');
      expect(result.errors[1]).toContain('lib2');

      console.log('✅ Error aggregation test passed');
    });

    test('provides detailed fetch statistics', async () => {
      // Mixed success/failure scenario
      mockSearch
        .mockResolvedValueOnce({
          data: {
            items: [{
              name: 'success-lib',
              owner: { login: 'test' },
              html_url: 'https://github.com/test/success-lib',
              description: 'Successful library',
            }]
          }
        })
        .mockRejectedValueOnce(new Error('Failed library'));

      mockGetReadme.mockResolvedValue({
        data: { content: Buffer.from('# Success').toString('base64') }
      });

      const fetcher = new DocumentationFetcher({
        ...defaultSettings,
        sources: ['github']
      }, 'token');

      const mockLibraries: IdentifiedLibrary[] = [
        { name: 'success-lib', category: 'frontend', confidenceScore: 0.9, detectedIn: ['task-001'] },
        { name: 'fail-lib', category: 'backend', confidenceScore: 0.8, detectedIn: ['task-002'] },
      ];

      const result = await fetcher.fetchLibraryDocumentation(mockLibraries);

      expect(result.fetchedCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.skippedCount).toBe(0);
      expect(result.totalSizeKB).toBeGreaterThan(0);
      expect(result.libraries).toHaveLength(1);

      console.log('✅ Fetch statistics test passed');
    });
  });
});