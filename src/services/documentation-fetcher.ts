import type { 
  LibraryDocumentation, 
  IdentifiedLibrary, 
  DocumentationSettings,
  DocumentationFetchResult 
} from '@/types/documentation';
import { Octokit } from '@octokit/rest';
import * as fs from 'fs/promises';
import * as path from 'path';

export class DocumentationFetcher {
  private octokit: Octokit | null = null;
  private cacheDir: string;
  private settings: DocumentationSettings;

  constructor(settings: DocumentationSettings, githubToken?: string) {
    this.settings = settings;
    this.cacheDir = path.join(process.cwd(), '.doc-cache');
    
    if (githubToken) {
      this.octokit = new Octokit({ auth: githubToken });
    }
  }

  /**
   * Fetch documentation for multiple libraries
   */
  async fetchLibraryDocumentation(libraries: IdentifiedLibrary[]): Promise<DocumentationFetchResult> {
    const results: LibraryDocumentation[] = [];
    const errors: string[] = [];
    let totalSizeKB = 0;
    let skippedCount = 0;

    // Ensure cache directory exists
    await this.ensureCacheDir();

    for (const library of libraries) {
      try {
        // Check cache first
        const cached = await this.getCachedDocumentation(library.name);
        if (cached) {
          results.push(cached);
          totalSizeKB += cached.sizeKB;
          continue;
        }

        // Fetch from enabled sources
        const docs = await this.fetchFromSources(library);
        
        if (docs.length === 0) {
          skippedCount++;
          continue;
        }

        // Take the best documentation (prioritize by source)
        const bestDoc = this.selectBestDocumentation(docs);
        
        // Check size limit
        if (bestDoc.sizeKB > this.settings.maxDocumentationSizeKB) {
          // Truncate content
          const maxBytes = this.settings.maxDocumentationSizeKB * 1024;
          const truncatedContent = bestDoc.content.substring(0, maxBytes);
          bestDoc.content = truncatedContent + '\n\n... (content truncated due to size limit)';
          bestDoc.sizeKB = this.settings.maxDocumentationSizeKB;
        }

        results.push(bestDoc);
        totalSizeKB += bestDoc.sizeKB;

        // Cache the result
        await this.cacheDocumentation(library.name, bestDoc);

        // Rate limiting - small delay between requests
        await this.delay(500);

      } catch (error) {
        const errorMsg = `Failed to fetch documentation for ${library.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.warn(errorMsg);
      }
    }

    return {
      libraries: results,
      totalSizeKB,
      fetchedCount: results.length,
      skippedCount,
      errorCount: errors.length,
      errors,
    };
  }

  /**
   * Fetch documentation from all enabled sources
   */
  private async fetchFromSources(library: IdentifiedLibrary): Promise<LibraryDocumentation[]> {
    const docs: LibraryDocumentation[] = [];

    for (const source of this.settings.sources) {
      try {
        switch (source) {
          case 'github': {
            if (this.octokit) {
              const githubDoc = await this.fetchFromGitHub(library);
              if (githubDoc) docs.push(githubDoc);
            }
            break;
          }
          case 'official': {
            const officialDoc = await this.fetchFromOfficialSite(library);
            if (officialDoc) docs.push(officialDoc);
            break;
          }
          case 'mdn': {
            if (this.isWebTechnology(library.name)) {
              const mdnDoc = await this.fetchFromMDN(library);
              if (mdnDoc) docs.push(mdnDoc);
            }
            break;
          }
          case 'npm': {
            if (library.category === 'frontend' || library.category === 'backend') {
              const npmDoc = await this.fetchFromNPM(library);
              if (npmDoc) docs.push(npmDoc);
            }
            break;
          }
        }
      } catch (error) {
        console.warn(`Error fetching from ${source} for ${library.name}:`, error);
      }
    }

    return docs;
  }

  /**
   * Fetch documentation from GitHub repository
   */
  private async fetchFromGitHub(library: IdentifiedLibrary): Promise<LibraryDocumentation | null> {
    if (!this.octokit) return null;

    try {
      // Search for the repository
      const searchResult = await this.octokit.search.repos({
        q: `${library.name} language:${this.getLanguageForCategory(library.category)}`,
        sort: 'stars',
        order: 'desc',
        per_page: 1,
      });

      if (searchResult.data.items.length === 0) {
        return null;
      }

      const repo = searchResult.data.items[0];
      
      // Try to get README
      try {
        const readmeResult = await this.octokit.repos.getReadme({
          owner: repo.owner?.login || '',
          repo: repo.name,
        });

        const content = Buffer.from(readmeResult.data.content, 'base64').toString('utf-8');
        
        return {
          name: library.name,
          source: 'github',
          url: repo.html_url,
          content,
          contentType: 'markdown',
          lastFetched: new Date().toISOString(),
          sizeKB: Math.ceil(content.length / 1024),
        };
      } catch {
        // Try to get repository description as fallback
        return {
          name: library.name,
          source: 'github',
          url: repo.html_url,
          content: `# ${repo.name}\n\n${repo.description || 'No description available'}\n\n[View on GitHub](${repo.html_url})`,
          contentType: 'markdown',
          lastFetched: new Date().toISOString(),
          sizeKB: 1,
        };
      }
    } catch (error) {
      console.warn(`GitHub API error for ${library.name}:`, error);
      return null;
    }
  }

  /**
   * Fetch documentation from official websites
   */
  private async fetchFromOfficialSite(library: IdentifiedLibrary): Promise<LibraryDocumentation | null> {
    const officialUrls = this.getOfficialDocumentationUrls(library.name);
    
    for (const url of officialUrls) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'GitAutomate Documentation Fetcher 1.0',
          },
        });

        if (!response.ok) continue;

        const content = await response.text();
        const cleanContent = this.cleanHtmlContent(content);

        if (cleanContent.length < 100) continue; // Skip if too short

        return {
          name: library.name,
          source: 'official',
          url,
          content: cleanContent,
          contentType: 'markdown',
          lastFetched: new Date().toISOString(),
          sizeKB: Math.ceil(cleanContent.length / 1024),
        };
      } catch (error) {
        console.warn(`Error fetching from ${url}:`, error);
        continue;
      }
    }

    return null;
  }

  /**
   * Fetch documentation from MDN for web technologies
   */
  private async fetchFromMDN(library: IdentifiedLibrary): Promise<LibraryDocumentation | null> {
    const mdnUrl = `https://developer.mozilla.org/en-US/docs/Web/API/${library.name}`;
    
    try {
      const response = await fetch(mdnUrl);
      if (!response.ok) return null;

      const content = await response.text();
      const cleanContent = this.cleanHtmlContent(content);

      return {
        name: library.name,
        source: 'mdn',
        url: mdnUrl,
        content: cleanContent,
        contentType: 'markdown',
        lastFetched: new Date().toISOString(),
        sizeKB: Math.ceil(cleanContent.length / 1024),
      };
    } catch {
      return null;
    }
  }

  /**
   * Fetch documentation from NPM registry
   */
  private async fetchFromNPM(library: IdentifiedLibrary): Promise<LibraryDocumentation | null> {
    try {
      const response = await fetch(`https://registry.npmjs.org/${library.name}`);
      if (!response.ok) return null;

      const packageData = await response.json();
      const latestVersion = packageData['dist-tags']?.latest;
      const versionData = packageData.versions?.[latestVersion];

      if (!versionData) return null;

      const readme = versionData.readme || packageData.readme || '';
      const description = versionData.description || '';
      const homepage = versionData.homepage || '';

      const content = `# ${library.name}\n\n${description}\n\n${readme}\n\n${homepage ? `[Homepage](${homepage})` : ''}`;

      return {
        name: library.name,
        source: 'npm',
        url: `https://www.npmjs.com/package/${library.name}`,
        content,
        contentType: 'markdown',
        lastFetched: new Date().toISOString(),
        sizeKB: Math.ceil(content.length / 1024),
      };
    } catch {
      return null;
    }
  }

  /**
   * Select the best documentation from multiple sources
   */
  private selectBestDocumentation(docs: LibraryDocumentation[]): LibraryDocumentation {
    // Priority order: github > official > mdn > npm
    const priority: Record<string, number> = { github: 4, official: 3, mdn: 2, npm: 1, pypi: 1, maven: 1 };
    
    return docs.sort((a, b) => {
      const aPriority = priority[a.source] || 0;
      const bPriority = priority[b.source] || 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      // If same priority, prefer larger content (up to a point)
      return Math.min(b.sizeKB, 200) - Math.min(a.sizeKB, 200);
    })[0];
  }

  /**
   * Cache management
   */
  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch {
      // Directory might already exist
    }
  }

  private async getCachedDocumentation(libraryName: string): Promise<LibraryDocumentation | null> {
    try {
      const cacheFile = path.join(this.cacheDir, `${libraryName}.json`);
      const content = await fs.readFile(cacheFile, 'utf-8');
      const cached = JSON.parse(content) as LibraryDocumentation;
      
      // Check if cache is still valid
      const cacheAge = Date.now() - new Date(cached.lastFetched).getTime();
      const maxAge = this.settings.cacheDocumentationDays * 24 * 60 * 60 * 1000;
      
      if (cacheAge < maxAge) {
        return cached;
      }
    } catch {
      // Cache miss or error - return null
    }
    
    return null;
  }

  private async cacheDocumentation(libraryName: string, doc: LibraryDocumentation): Promise<void> {
    try {
      const cacheFile = path.join(this.cacheDir, `${libraryName}.json`);
      await fs.writeFile(cacheFile, JSON.stringify(doc, null, 2));
    } catch (error) {
      console.warn(`Failed to cache documentation for ${libraryName}:`, error);
    }
  }

  /**
   * Utility methods
   */
  private getOfficialDocumentationUrls(libraryName: string): string[] {
    const urls: string[] = [];
    
    // Common official documentation patterns
    const patterns = [
      `https://${libraryName}.org/docs`,
      `https://${libraryName}.dev/docs`,
      `https://docs.${libraryName}.org`,
      `https://www.${libraryName}.org/documentation`,
      `https://${libraryName}.readthedocs.io/en/latest/`,
    ];

    // Special cases for popular libraries
    const specialCases: Record<string, string[]> = {
      react: ['https://react.dev/learn'],
      vue: ['https://vuejs.org/guide/'],
      angular: ['https://angular.io/docs'],
      nextjs: ['https://nextjs.org/docs'],
      express: ['https://expressjs.com/en/guide/'],
      django: ['https://docs.djangoproject.com/en/stable/'],
      flask: ['https://flask.palletsprojects.com/en/latest/'],
      'spring-boot': ['https://spring.io/projects/spring-boot'],
    };

    if (specialCases[libraryName]) {
      urls.push(...specialCases[libraryName]);
    } else {
      urls.push(...patterns);
    }

    return urls;
  }

  private isWebTechnology(libraryName: string): boolean {
    const webTechs = ['fetch', 'websocket', 'indexeddb', 'serviceworker', 'webrtc', 'geolocation'];
    return webTechs.includes(libraryName.toLowerCase());
  }

  private getLanguageForCategory(category: IdentifiedLibrary['category']): string {
    switch (category) {
      case 'frontend': return 'javascript';
      case 'backend': return 'javascript';
      case 'database': return 'sql';
      case 'testing': return 'javascript';
      default: return 'javascript';
    }
  }

  private cleanHtmlContent(html: string): string {
    // Basic HTML to Markdown conversion
    let content = html;
    
    // Remove script and style tags
    content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    // Convert headers
    content = content.replace(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi, (_, level, text) => {
      const hashes = '#'.repeat(parseInt(level));
      return `${hashes} ${text.replace(/<[^>]+>/g, '')}\n\n`;
    });
    
    // Convert paragraphs
    content = content.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
    
    // Convert code blocks
    content = content.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n');
    content = content.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
    
    // Convert links
    content = content.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
    
    // Remove remaining HTML tags
    content = content.replace(/<[^>]+>/g, '');
    
    // Clean up whitespace
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    content = content.trim();
    
    return content;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}