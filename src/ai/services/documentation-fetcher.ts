

/**
 * Multi-Source Documentation Fetching System for AI Development Tasks
 *
 * This service provides comprehensive library documentation fetching from multiple sources:
 * - GitHub API (primary source for README.md files)
 * - Official websites (secondary fallback)  
 * - MDN Web Docs (for JavaScript/TypeScript web APIs)
 * - Stack Overflow (community Q&A and examples)
 */

import { z } from 'zod';

// Types for documentation sources
export type DocumentationSource = 'github' | 'official-site' | 'mdn' | 'stackoverflow';
export type LibraryCategory = 'frontend' | 'backend' | 'database' | 'testing' | 'utility';

export interface LibraryIdentification {
  name: string;
  confidenceScore: number; // 0-100
  category: LibraryCategory;
  detectedPatterns: string[];
}

export interface FetchedDocumentation {
  libraryName: string;
  sourceType: DocumentationSource;
  content: string;
  title?: string;
  url?: string;
  fetchedAt: Date;
  sizeKB: number;
}

export interface LibraryDocumentation {
  libraryName: string;
  category: LibraryCategory;
  documentationSources: FetchedDocumentation[];
  totalSizeKB: number;
}

// Settings schema for documentation fetching
export const DocumentationSettingsSchema = z.object({
  sources: z.enum(['github-only', 'multi-source']).default('multi-source'),
  includeStackOverflow: z.boolean().default(true),
  maxDocumentationSizeKB: z.number().min(100).max(1024).default(512),
  cacheDocumentationDays: z.number().min(1).max(30).default(7),
});
export type DocumentationSettings = z.infer<typeof DocumentationSettingsSchema>;

// Library patterns for identification
const LIBRARY_PATTERNS = {
  frontend: ['react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt'],
  backend: ['express', 'fastify', 'koa', 'django', 'flask', 'spring', 'laravel'],
  database: ['postgresql', 'mysql', 'mongodb', 'redis', 'sqlite', 'dynamodb'],
  testing: ['jest', 'cypress', 'playwright', 'vitest', 'mocha', 'puppeteer'],
  utility: ['lodash', 'axios', 'moment', 'date-fns', 'chalk', 'commander'],
};

/**
 * Identifies libraries mentioned in text content (tasks, architecture specs, etc.)
 */
export class LibraryIdentifier {
  private static LIBRARY_REGEX = /\b([a-zA-Z][\w.-]*)(?:\.js|\.ts)?\b/g;
  private static COMMON_WORDS = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);

  static identifyLibraries(content: string): LibraryIdentification[] {
    const matches = content.match(this.LIBRARY_REGEX) || [];
    const libraryCounts: { [key: string]: number } = {};
    
    // Count occurrences of each potential library
    matches.forEach(match => {
      const normalized = match.toLowerCase().replace(/\.(js|ts)$/, '');
      if (!this.COMMON_WORDS.has(normalized) && normalized.length > 2) {
        libraryCounts[normalized] = (libraryCounts[normalized] || 0) + 1;
      }
    });

    // Convert to LibraryIdentification with scoring
    const identified: LibraryIdentification[] = Object.entries(libraryCounts)
      .map(([name, count]) => {
        const category = this.categorizeLibrary(name);
        return {
          name,
          confidenceScore: Math.min(100, count * 20 + (category !== 'utility' ? 30 : 0)),
          category,
          detectedPatterns: [name],
        };
      })
      .filter(lib => lib.confidenceScore > 20) // Filter out low-confidence matches
      .sort((a, b) => b.confidenceScore - a.confidenceScore);

    return identified;
  }

  private static categorizeLibrary(name: string): LibraryCategory {
    const lowerName = name.toLowerCase();
    
    for (const [category, patterns] of Object.entries(LIBRARY_PATTERNS)) {
      if (patterns.some(pattern => lowerName.includes(pattern.toLowerCase()))) {
        return category as LibraryCategory;
      }
    }

    // Heuristic categorization based on name patterns
    if (lowerName.includes('test') || lowerName.includes('spec')) return 'testing';
    if (/^(postgre|mysql|mongo|redis)/.test(lowerName)) return 'database';
    if (/^(express|fastify|koa|django|flask)/.test(lowerName)) return 'backend';
    if (/^(react|vue|angular|svelte)/.test(lowerName)) return 'frontend';
    
    return 'utility';
  }
}

/**
 * Main documentation fetching service with multi-source support
 */
export class DocumentationFetcher {
  private githubApiRateLimitRemaining = 5000; // Conservative estimate
  private lastGithubReset: Date | null = null;
  
  constructor(
    private settings?: DocumentationSettings
  ) {}

  /**
   * Fetch documentation for a single library from all available sources
   */
  async fetchLibraryDocumentation(
    libName: string, 
    settings?: DocumentationSettings
  ): Promise<LibraryDocumentation> {
    const finalSettings = { ...this.settings, ...(settings || {}) };
    
    try {
      // Primary: GitHub API
      const githubDocs = await this.githubApiFetchRepositoryReadme(libName);
      
      // Secondary: Web scraping for official sites
      const webDocs = await this.webScraperFetchOfficialDocumentation(libName);
      
      // Specialized: MDN for web APIs
      const mdnDocs = await this.mdnApiFetchWebAPIDocumentation(libName);
      
      // Community: Stack Overflow (optional)
      const stackOverflowDocs = finalSettings.includeStackOverflow 
        ? await this.stackScraperFetchCommunityContent(libName)
        : [];

      // Combine all sources and filter by size limits
      const allDocs = [...githubDocs, ...webDocs, ...mdnDocs, ...stackOverflowDocs]
        .filter(doc => doc.sizeKB <= finalSettings.maxDocumentationSizeKB);

      return {
        libraryName: libName,
        category: LibraryIdentifier.categorizeLibrary(libName),
        documentationSources: allDocs.slice(0, 5), // Limit to top 5 sources
        totalSizeKB: allDocs.reduce((total, doc) => total + doc.sizeKB, 0),
      };
    } catch (error) {
      console.warn(`Failed to fetch documentation for ${libName}:`, error);
      
      // Return basic library info even if fetching fails
      return {
        libraryName: libName,
        category: LibraryIdentifier.categorizeLibrary(libName),
        documentationSources: [],
        totalSizeKB: 0,
      };
    }
  }

  /**
   * Fetch documentation for multiple libraries in parallel with rate limiting
 */
  async fetchMultipleLibrariesDocumentation(
    libraryNames: string[],
    settings?: DocumentationSettings
  ): Promise<LibraryDocumentation[]> {
    const finalSettings = { ...this.settings, ...(settings || {}) };
    
    // Limit concurrent requests to avoid overwhelming APIs
    const concurrencyLimit = 3;
    const results: LibraryDocumentation[] = [];

    for (let i = 0; i < libraryNames.length; i += concurrencyLimit) {
      const batch = libraryNames.slice(i, i + concurrencyLimit);
      
      try {
        await Promise.allSettled(
          batch.map(libName => 
            this.fetchLibraryDocumentation(libName, finalSettings)
              .then(result => results.push(result))
          )
        );
        
        // Small delay between batches to respect rate limits
        if (i + concurrencyLimit < libraryNames.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.warn(`Error processing batch ${i}-${i + concurrencyLimit}:`, error);
      }
    }

    return results;
  }

  /**
   * Fetch GitHub repository README.md file
   */
  private async githubApiFetchRepositoryReadme(libName: string): Promise<FetchedDocumentation[]> {
    // Check rate limit
    if (this.githubApiRateLimitRemaining < 10) {
      console.warn('GitHub API rate limit approaching, skipping GitHub fetch');
      return [];
    }

    try {
      // Try common repository patterns
      const repoPatterns = [
        `${libName}/${libName}`,
        `facebook/${libName}`, // React, Jest
        `vuejs/${libName}`     // Vue ecosystem projects
      ];

      for (const repoPattern of repoPatterns) {
        try {
          const response = await fetch(`https://api.github.com/repos/${repoPattern}/readme`, {
            headers: { Accept: 'application/vnd.github.v3.raw' }
          });

          if (response.ok) {
            const content = await response.text();
            
            this.githubApiRateLimitRemaining--;
            if (response.headers.get('X-RateLimit-Remaining')) {
              this.githubApiRateLimitRemaining = parseInt(response.headers.get('X-RateLimit-Remaining')!);
            }

            return [{
              libraryName: libName,
              sourceType: 'github',
              content,
              title: `${libName} README`,
              url: `https://api.github.com/repos/${repoPattern}/readme`,
              fetchedAt: new Date(),
              sizeKB: content.length / 1024,
            }];
          }
        } catch (error) {
          // Continue to next pattern
        }
      }

    } catch (error) {
      console.warn(`GitHub API fetch failed for ${libName}:`, error);
    }

    return [];
  }

  /**
   * Fetch official documentation from library websites
   */
  private async webScraperFetchOfficialDocumentation(libName: string): Promise<FetchedDocumentation[]> {
    try {
      // Common official documentation URLs
      const urlPatterns = [
        `https://${libName}.com/docs`,
        `https://docs.${libName}.js.org`, // JS libraries
        `https://${libName}.io/docs`,
      ];

      for (const url of urlPatterns) {
        try {
          const response = await fetch(url);
          
          if (response.ok && this.isTextContentType(response.headers.get('content-type'))) {
            const content = await response.text();
            
            return [{
              libraryName: libName,
              sourceType: 'official-site',
              content,
              title: `${libName} Official Documentation`,
              url,
              fetchedAt: new Date(),
              sizeKB: content.length / 1024,
            }];
          }
        } catch (error) {
          // Continue to next URL
        }
      }

    } catch (error) {
      console.warn(`Web scraping failed for ${libName}:`, error);
    }

    return [];
  }

  /**
   * Fetch MDN Web Docs for web APIs
   */
  private async mdnApiFetchWebAPIDocumentation(libName: string): Promise<FetchedDocumentation[]> {
    try {
      const mdnUrl = `https://developer.mozilla.org/en-US/docs/Web/API/${libName}`;
      const response = await fetch(mdnUrl);
      
      if (response.ok) {
        // Note: In a real implementation, you'd want to parse the HTML
        const content = await response.text();
        
        return [{
          libraryName: libName,
          sourceType: 'mdn',
          content, // Would need HTML parsing for clean extraction
          title: `${libName} - MDN Web Docs`,
          url: mdnUrl,
          fetchedAt: new Date(),
          sizeKB: content.length / 1024,
        }];
      }
    } catch (error) {
      console.warn(`MDN fetch failed for ${libName}:`, error);
    }

    return [];
  }

  /**
   * Fetch Stack Overflow content for a library
   */
  private async stackScraperFetchCommunityContent(libName: string): Promise<FetchedDocumentation[]> {
    try {
      const searchUrl = `https://stackoverflow.com/search?q=${encodeURIComponent(libName)}+documentation`;
      
      // Note: This would require proper HTML parsing in a real implementation
      const response = await fetch(searchUrl);
      
      if (response.ok) {
        return [{
          libraryName: libName,
          sourceType: 'stackoverflow',
          content: `Stack Overflow search results for ${libName}: See ${searchUrl}`,
          title: `${libName} - Stack Overflow Community Q&A`,
          url: searchUrl,
          fetchedAt: new Date(),
          sizeKB: 1, // Small placeholder
        }];
      }
    } catch (error) {
      console.warn(`Stack Overflow fetch failed for ${libName}:`, error);
    }

    return [];
  }

  /**
   * Helper method to check if content type is text-based
   */
  private isTextContentType(contentType?: string | null): boolean {
    if (!contentType) return false;
    
    const textTypes = ['text/html', 'text/plain', 'application/json'];
    return textTypes.some(type => contentType.includes(type));
  }
}

/**
 * Enhanced task research with documentation integration
 */
export class TaskResearchWithDocumentation {
  
  async enrichTaskDetails(
    taskTitle: string,
    taskDescription: string,
    documentationLibraryMap: { [libraryName: string]: FetchedDocumentation[] }
  ): Promise<string> {
    
    // Identify libraries in the task
    const identifiedLibraries = LibraryIdentifier.identifyLibraries(taskTitle + ' ' + taskDescription);
    
    if (identifiedLibraries.length === 0) {
      return taskDescription;
    }

    // Add documentation reference section
    let enrichedDetails = taskDescription + '\n\n';
    
    if (identifiedLibraries.length > 0) {
      enrichedDetails += '## Documentation Reference\n';
      
      for (const library of identifiedLibraries.slice(0, 3)) { // Top 3 libraries
        const docs = documentationLibraryMap[library.name] || [];
        
        if (docs.length > 0) {
          enrichedDetails += `\n### ${library.name}\n`;
          
          // Add brief description of each documentation source
          docs.forEach((doc, index) => {
            const docType = this.getDocumentationSourceTypeLabel(doc.sourceType);
            enrichedDetails += `${index + 1}. **${doc.title || doc.libraryName}** (${docType}) - `;
            enrichedDetails += `[View Documentation](${doc.url || '#'})\n`;
          });
        }
      }

      // Add instructions for developers
      enrichedDetails += '\n> **IMPORTANT**: Read all relevant library documentation in the reference/ folder before implementing this task.';
    }

    return enrichedDetails;
  }

  private getDocumentationSourceTypeLabel(sourceType: DocumentationSource): string {
    const labels = {
      'github': 'GitHub README',
      'official-site': 'Official Documentation', 
      'mdn': 'MDN Web Docs',
      'stackoverflow': 'Stack Overflow'
    };
    
    return labels[sourceType] || sourceType;
  }
}

