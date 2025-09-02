
/**
 * Documentation Fetching Service
 * 
 * This service fetches library documentation from multiple sources:
 * - GitHub API (primary source)
 * - Official websites 
 * - MDN Web Docs
 * - Stack Overflow
 */

export interface LibraryDocumentation {
  name: string;
  source: 'github' | 'official-site' | 'mdn' | 'stackoverflow';
  content: string;
  url?: string;
  fetchedAt: Date;
}

export interface IdentifiedLibrary {
  name: string;
  confidenceScore: number; // 0-1, higher means more likely to be relevant
  category: 'frontend' | 'backend' | 'database' | 'testing' | 'utility';
  detectedIn: string[]; // which tasks this library was found in
}

export class DocumentationFetcher {
  private githubRateLimitRemaining = 5000; // Start with a reasonable assumption
  private lastResetTime: Date;
  
  constructor() {
    this.lastResetTime = new Date();
    
    // Reset rate limit counter every hour (GitHub resets hourly)
    setInterval(() => {
      this.githubRateLimitRemaining = 5000;
      this.lastResetTime = new Date();
    }, 60 * 60 * 1000);
  }

  /**
   * Identify libraries mentioned in tasks or project context
   */
  async identifyLibraries(
    architecture: string, 
    specifications: string,
    fileStructure: string
  ): Promise<IdentifiedLibrary[]> {
    
    const textToAnalyze = `${architecture} ${specifications} ${fileStructure}`.toLowerCase();
    const identifiedLibraries: IdentifiedLibrary[] = [];

    // Common library patterns by category
    const LIBRARY_PATTERNS: Record<string, string[]> = {
      frontend: ['react', 'vue', 'angular', 'svelte', 'nextjs', 'nuxt'],
      backend: ['express', 'fastify', 'koa', 'django', 'flask', 'spring boot', 'nestjs'],
      database: ['postgresql', 'mysql', 'mongodb', 'redis', 'sqlite', 'dynamodb'],
      testing: ['jest', 'cypress', 'playwright', 'testing library', 'vitest'],
      utility: ['webpack', 'vite', 'babel', 'typescript', 'eslint', 'prettier']
    };

    for (const [category, libraries] of Object.entries(LIBRARY_PATTERNS)) {
      for (const libraryName of libraries) {
        const regex = new RegExp(`\\b${libraryName}\\b`, 'gi');
        
        if (regex.test(textToAnalyze)) {
          const matches = textToAnalyze.match(regex);
          
          // Only include if confidence is high enough
          const confidenceScore = Math.min(0.9, (matches?.length || 1) * 0.3);
          
          if (confidenceScore > 0.5) {
            const existingIndex = identifiedLibraries.findIndex(
              lib => lib.name.toLowerCase() === libraryName
            );
            
            if (existingIndex >= 0) {
              // Update existing entry with higher confidence
              identifiedLibraries[existingIndex].confidenceScore = Math.max(
                identifiedLibraries[existingIndex].confidenceScore,
                confidenceScore
              );
            } else {
              identifiedLibraries.push({
                name: libraryName,
                confidenceScore,
                category: category as IdentifiedLibrary['category'],
                detectedIn: [] // Will be populated later
              });
            }
          }
        }
      }
    }

    return identifiedLibraries.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  /**
   * Fetch documentation for multiple libraries from GitHub
   */
  async fetchGitHubDocumentation(libraries: string[]): Promise<LibraryDocumentation[]> {
    const results: LibraryDocumentation[] = [];
    
    for (const libraryName of libraries) {
      try {
        // Check rate limit
        if (this.githubRateLimitRemaining <= 10) {
          console.warn(`GitHub rate limit low (${this.githubRateLimitRemaining} remaining). Skipping ${libraryName}`);
          continue;
        }

        // Try common GitHub organization patterns
        const possibleRepos = [
          `${libraryName}/${libraryName}`,
          `facebook/${libraryName}`,
          `vuejs/${libraryName}`, 
          `angular/${libraryName}`,
        ];

        for (const repo of possibleRepos) {
          const documentation = await this.fetchRepositoryReadme(repo);
          
          if (documentation.content.trim()) {
            results.push(documentation);
            
            // Update rate limit counter
            this.githubRateLimitRemaining -= 1;
            break; // Success, move to next library
          }
        }

      } catch (error) {
        console.warn(`Failed to fetch GitHub documentation for ${libraryName}:`, error);
      }
    }

    return results;
  }

  /**
   * Fetch README.md content from a GitHub repository
   */
  private async fetchRepositoryReadme(repo: string): Promise<LibraryDocumentation> {
    try {
      const response = await fetch(`https://api.github.com/repos/${repo}/readme`, {
        headers: {
          'Accept': 'application/vnd.github.v3.raw',
          // Use authentication if available to increase rate limits
        }
      });

      if (!response.ok) {
        // Try different README file names as fallback
        const readmeFiles = ['README.md', 'readme.md', 'Readme.md'];
        
        for (const readmeFile of readmeFiles) {
          const fallbackResponse = await fetch(`https://raw.githubusercontent.com/${repo}/main/${readmeFile}`, {
            headers: { 'Accept': 'application/vnd.github.v3.raw' }
          });
          
          if (fallbackResponse.ok) {
            const content = await fallbackResponse.text();
            
            return {
              name: repo.split('/')[1],
              source: 'github',
              content,
              url: `https://github.com/${repo}`,
              fetchedAt: new Date()
            };
          }
        }

        throw new Error(`README not found for ${repo}`);
      }

      const content = await response.text();
      
      return {
        name: repo.split('/')[1],
        source: 'github', 
        content,
        url: `https://github.com/${repo}`,
        fetchedAt: new Date()
      };
    } catch (error) {
      return {
        name: repo.split('/')[1],
        source: 'github',
        content: `# Documentation for ${repo}\n\nUnable to fetch documentation from GitHub. Please visit the repository directly: https://github.com/${repo}`,
        url: `https://github.com/${repo}`,
        fetchedAt: new Date()
      };
    }
  }

  /**
   * Fetch documentation from official websites
   */
  async fetchOfficialDocumentation(libraryName: string): Promise<LibraryDocumentation[]> {
    const results: LibraryDocumentation[] = [];
    
    try {
      // Try official website patterns
      const urlPatterns: Record<string, string> = {
        react: `https://react.dev`,
        vue: 'https://vuejs.org',
        angular: 'https://angular.io', 
        express: 'https://expressjs.com',
        django: 'https://docs.djangoproject.com'
      };

      const baseUrl = urlPatterns[libraryName.toLowerCase()];
      
      if (baseUrl) {
        try {
          const response = await fetch(`${baseUrl}/`);
          
          if (response.ok) {
            // Convert HTML to readable markdown
            const html = await response.text();
            
            return [{
              name: libraryName,
              source: 'official-site',
              content: this.convertHtmlToMarkdown(html),
              url: baseUrl,
              fetchedAt: new Date()
            }];
          }
        } catch (error) {
          console.warn(`Failed to fetch from ${baseUrl}:`, error);
        }
      }

    } catch (error) {
      console.warn(`Failed to fetch official documentation for ${libraryName}:`, error);
    }

    return results;
  }

  /**
   * Simple HTML to Markdown converter for documentation
   */
  private convertHtmlToMarkdown(html: string): string {
    // Basic HTML to Markdown conversion
    return html
      .replace(/<h1[^>]*>/gi, '# ')
      .replace(/<h2[^>]*>/gi, '## ')
      .replace(/<h3[^>]*>/gi, '### ')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<code[^>]*>(.*?)<\/code>/gis, '`$1`')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gis, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gis, '*$1*')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<[^>]*>/g, '') // Remove all other HTML tags
      .trim();
  }

  /**
   * Main method to fetch documentation for libraries from multiple sources
   */
  async fetchLibraryDocumentation(
    libraryNames: string[],
    options?: {
      includeGitHub?: boolean;
      includeOfficialSites?: boolean; 
      includeMDN?: boolean;
    }
  ): Promise<LibraryDocumentation[]> {
    
    const results: LibraryDocumentation[] = [];
    options = { includeGitHub: true, includeOfficialSites: true, ...options };

    // Fetch from GitHub (primary source)
    if (options.includeGitHub) {
      const githubDocs = await this.fetchGitHubDocumentation(libraryNames);
      results.push(...githubDocs);
    }

    // Fetch from official websites (fallback)
    if (options.includeOfficialSites) {
      for (const libraryName of libraryNames) {
        const officialDocs = await this.fetchOfficialDocumentation(libraryName);
        results.push(...officialDocs);
      }
    }

    return deduplicateResults(results, libraryNames.length * 2); // Allow some duplicates
  }

  /**
   * Get current GitHub API rate limit status (estimated)
   */
  getRateLimitStatus(): { remaining: number; resetTime: Date } {
    return {
      remaining: this.githubRateLimitRemaining,
      resetTime: new Date(this.lastResetTime.getTime() + 60 * 60 * 1000) // Next reset
    };
  }
}

/**
 * Helper to deduplicate documentation results while preserving the best sources
 */
function deduplicateResults(results: LibraryDocumentation[], maxExpectedPerLibrary: number): LibraryDocumentation[] {
  const deduplicated = new Map<string, LibraryDocumentation>();
  
  // Define source priority order
  const sourcePriority: Record<LibraryDocumentation['source'], number> = {
    'github': 3,
    'official-site': 2, 
    'mdn': 1
  };

  for (const doc of results) {
    const key = doc.name.toLowerCase();
    
    if (!deduplicated.has(key)) {
      deduplicated.set(key, doc);
    } else {
      // Replace if current source has higher priority
      const existing = deduplicated.get(key)!;
      
      if (sourcePriority[doc.source] > sourcePriority[existing.source]) {
        deduplicated.set(key, doc);
      }
    }
  }

  return Array.from(deduplicated.values());
}

/**
 * Factory function to create DocumentationFetcher instance
 */
export const documentationFetcher = new DocumentationFetcher();

