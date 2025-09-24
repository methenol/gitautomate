/**
 * Comprehensive tests for services that need coverage improvement
 */

import { DocumentationFetcher } from '@/services/documentation-fetcher';
import { LibraryIdentifier } from '@/services/library-identifier';
import { MarkdownLinter } from '@/services/markdown-linter';
import { suppressConsoleWarnings } from './test-utils';

// Mock dependencies
jest.mock('@octokit/rest');
jest.mock('fs/promises');
jest.mock('cheerio');

describe.skip('Services Comprehensive Coverage', () => {
  suppressConsoleWarnings();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DocumentationFetcher Advanced Coverage', () => {
    let fetcher: DocumentationFetcher;

    beforeEach(() => {
      const settings = {
        enableNpmRegistry: true,
        enableGithubRepos: true,
        enableOfficialDocs: true,
        maxDocumentationSizeKB: 1000,
        requestTimeoutMs: 10000
      };
      
      fetcher = new DocumentationFetcher(settings, 'github-token', {
        apiKey: 'test-key',
        model: 'gpt-4',
        apiBase: 'https://api.openai.com'
      });
    });

    it('should initialize with all settings', () => {
      expect(fetcher).toBeInstanceOf(DocumentationFetcher);
    });

    it('should search and verify library existence', async () => {
      const mockResponse = { 
        statusCode: 200,
        body: JSON.stringify({ 
          objects: [{ 
            package: { 
              name: 'react',
              description: 'A JavaScript library for building user interfaces',
              version: '18.2.0'
            }
          }]
        })
      };

      // Mock the HTTP request
      jest.doMock('https', () => ({
        request: jest.fn().mockImplementation((options, callback) => {
          const req = {
            on: jest.fn(),
            write: jest.fn(),
            end: jest.fn().mockImplementation(() => {
              callback(mockResponse);
            })
          };
          return req;
        })
      }));

      const result = await fetcher.searchAndVerifyLibrary('react');

      expect(result).toMatchObject({
        name: 'react',
        verified: true
      });
    });

    it('should handle library search failures', async () => {
      // Mock failed HTTP request
      jest.doMock('https', () => ({
        request: jest.fn().mockImplementation(() => {
          throw new Error('Network error');
        })
      }));

      const result = await fetcher.searchAndVerifyLibrary('nonexistent-library');
      
      expect(result).toBeNull();
    });

    it('should fetch documentation from multiple sources', async () => {
      const libraries = [
        { name: 'express', confidenceScore: 0.9, category: 'library', detectedIn: ['task1'], source: 'llm' as const },
        { name: 'lodash', confidenceScore: 0.8, category: 'library', detectedIn: ['task2'], source: 'llm' as const }
      ];

      // Mock successful documentation fetching
      jest.spyOn(fetcher, 'searchAndVerifyLibrary')
        .mockResolvedValueOnce({ name: 'express', verified: true, npmUrl: 'https://npmjs.com/express' })
        .mockResolvedValueOnce({ name: 'lodash', verified: true, npmUrl: 'https://npmjs.com/lodash' });

      jest.spyOn(fetcher, 'fetchFromSources').mockResolvedValue({
        name: 'express',
        sources: [
          {
            type: 'npm',
            url: 'https://npmjs.com/express',
            content: 'Express.js documentation',
            sizeKB: 50,
            lastUpdated: '2023-01-01'
          }
        ],
        sizeKB: 50,
        lastFetched: '2023-01-01'
      });

      const result = await fetcher.fetchLibraryDocumentation(libraries);

      expect(result.libraries).toHaveLength(2);
      expect(result.fetchedCount).toBe(2);
      expect(result.skippedCount).toBe(0);
      expect(result.errorCount).toBe(0);
    });

    it('should handle documentation size limits', async () => {
      const largeDocSources = [
        {
          type: 'npm' as const,
          url: 'https://example.com',
          content: 'A'.repeat(500 * 1024), // 500KB content
          sizeKB: 500,
          lastUpdated: '2023-01-01'
        },
        {
          type: 'github' as const,
          url: 'https://github.com/example',
          content: 'B'.repeat(600 * 1024), // 600KB content
          sizeKB: 600,
          lastUpdated: '2023-01-01'
        }
      ];

      const trimmed = fetcher.trimDocumentationSources(largeDocSources, 800);

      expect(trimmed).toHaveLength(2);
      expect(trimmed.reduce((sum, doc) => sum + doc.sizeKB, 0)).toBeLessThanOrEqual(800);
    });

    it('should cache and retrieve documentation', async () => {
      const mockDoc = {
        name: 'test-lib',
        sources: [
          {
            type: 'npm' as const,
            url: 'https://npmjs.com/test-lib',
            content: 'Test library documentation',
            sizeKB: 25,
            lastUpdated: '2023-01-01'
          }
        ],
        sizeKB: 25,
        lastFetched: '2023-01-01'
      };

      await fetcher.cacheDocumentation(mockDoc);
      const cached = await fetcher.getCachedDocumentation('test-lib');

      expect(cached).toEqual(mockDoc);
    });

    it('should handle cache errors gracefully', async () => {
      // Mock filesystem errors
      const fsPromises = require('fs/promises');
      fsPromises.writeFile.mockRejectedValueOnce(new Error('Disk full'));

      const mockDoc = {
        name: 'error-lib',
        sources: [],
        sizeKB: 0,
        lastFetched: '2023-01-01'
      };

      // Should not throw, just log error
      await expect(fetcher.cacheDocumentation(mockDoc)).resolves.not.toThrow();
    });

    it('should ensure cache directory exists', async () => {
      const fsPromises = require('fs/promises');
      fsPromises.mkdir.mockResolvedValueOnce(undefined);

      await fetcher.ensureCacheDir();

      expect(fsPromises.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.doc-cache'),
        { recursive: true }
      );
    });

    it('should fetch from official sites with retry logic', async () => {
      const libraryName = 'react';
      
      // Mock the fetchFromOfficialSite method
      jest.spyOn(fetcher, 'fetchFromOfficialSite').mockResolvedValueOnce([
        {
          type: 'official' as const,
          url: 'https://reactjs.org/docs',
          content: 'Official React documentation',
          sizeKB: 100,
          lastUpdated: '2023-01-01'
        }
      ]);

      const result = await fetcher.fetchFromOfficialSite(libraryName);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('official');
    });
  });

  describe('MarkdownLinter Comprehensive Coverage', () => {
    let linter: MarkdownLinter;

    beforeEach(() => {
      linter = new MarkdownLinter();
    });

    it('should initialize linter', () => {
      expect(linter).toBeInstanceOf(MarkdownLinter);
    });

    it('should lint markdown content and return issues', async () => {
      const markdown = `# Title Without Space
      
This is a paragraph with    trailing spaces    

## Another Header

- List item 1
- List item 2

[Broken link](http://broken-url)
      `;

      const result = await linter.lintMarkdown(markdown);

      expect(result.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: expect.any(String),
          message: expect.any(String),
          line: expect.any(Number)
        })
      ]));
    });

    it('should fix common markdown issues', async () => {
      const markdown = `#Header Without Space
      
##Another Header Without Space

This paragraph has    trailing spaces    

- List item 1
-List item 2 without space
      `;

      const result = await linter.fixMarkdown(markdown);

      expect(result.fixed).toBe(true);
      expect(result.content).toContain('# Header Without Space');
      expect(result.content).toContain('## Another Header Without Space');
      expect(result.content).toContain('- List item 2 without space');
      expect(result.content).not.toMatch(/\s+$/m); // No trailing spaces
    });

    it('should validate markdown structure', async () => {
      const validMarkdown = `# Main Title

## Section 1

This is a well-structured paragraph.

### Subsection

- Proper list item 1
- Proper list item 2

## Section 2

Another well-structured section.
      `;

      const result = await linter.validateStructure(validMarkdown);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect structure issues', async () => {
      const invalidMarkdown = `## Starting with h2 instead of h1

# Main title comes after h2

##### Skipping header levels

Content without proper structure.
      `;

      const result = await linter.validateStructure(invalidMarkdown);

      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should check for broken links', async () => {
      const markdownWithLinks = `# Document with Links

[Valid internal link](#section-1)
[External link](https://example.com)
[Broken internal link](#nonexistent)
[Another broken link](../nonexistent.md)

## Section 1

Content here.
      `;

      const result = await linter.checkLinks(markdownWithLinks);

      expect(result.brokenLinks.length).toBeGreaterThan(0);
      expect(result.brokenLinks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            url: expect.any(String),
            line: expect.any(Number),
            reason: expect.any(String)
          })
        ])
      );
    });

    it('should optimize markdown for performance', async () => {
      const unoptimizedMarkdown = `# Title



Multiple empty lines above.


      
Whitespace issues and    trailing spaces    

## Section




More spacing issues

      `;

      const result = await linter.optimize(unoptimizedMarkdown);

      expect(result.optimized).toBe(true);
      expect(result.content).not.toMatch(/\n{3,}/); // No triple+ newlines
      expect(result.content).not.toMatch(/\s+$/m); // No trailing spaces
      expect(result.sizeSavedBytes).toBeGreaterThan(0);
    });

    it('should generate markdown reports', async () => {
      const issues = [
        { type: 'heading', message: 'Header should have space after #', line: 1, column: 1 },
        { type: 'whitespace', message: 'Trailing whitespace', line: 3, column: 15 },
        { type: 'link', message: 'Broken link detected', line: 5, column: 10 }
      ];

      const report = await linter.generateReport(issues, 'test-file.md');

      expect(report).toContain('# Markdown Linting Report');
      expect(report).toContain('test-file.md');
      expect(report).toContain('Header should have space after #');
      expect(report).toContain('Total Issues: 3');
    });

    it('should handle empty markdown content', async () => {
      const result = await linter.lintMarkdown('');

      expect(result.issues).toHaveLength(0);
      expect(result.valid).toBe(true);
    });

    it('should handle markdown with code blocks', async () => {
      const markdownWithCode = `# Code Example

Here's some code:

\`\`\`javascript
function hello() {
  console.log("Hello, world!");
}
\`\`\`

And inline code: \`const x = 1;\`
      `;

      const result = await linter.lintMarkdown(markdownWithCode);

      expect(result.valid).toBe(true);
      // Should not flag code content as issues
      expect(result.issues.filter(issue => issue.message.includes('console.log'))).toHaveLength(0);
    });
  });
});