import type { 
  LibraryDocumentation, 
  IdentifiedLibrary, 
  DocumentationSettings,
  DocumentationFetchResult,
  DocumentationSource,
  LibrarySearchResult
} from '@/types/documentation';
import { Octokit } from '@octokit/rest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as cheerio from 'cheerio';

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

        // First, search and verify the library exists
        const verifiedLibrary = await this.searchAndVerifyLibrary(library.name);
        if (!verifiedLibrary) {
          errors.push(`Library "${library.name}" not found or not verified`);
          skippedCount++;
          continue;
        }

        // Fetch from enabled sources
        const docs = await this.fetchFromSources(verifiedLibrary, library);
        
        if (docs.length === 0) {
          errors.push(`No documentation found for ${library.name}`);
          skippedCount++;
          continue;
        }

        const libraryDoc: LibraryDocumentation = {
          libraryName: library.name,
          category: library.category,
          sources: docs,
          sizeKB: docs.reduce((sum, doc) => sum + doc.sizeKB, 0),
          fetchedAt: new Date(),
          cacheExpiry: new Date(Date.now() + this.settings.cacheDocumentationDays * 24 * 60 * 60 * 1000),
        };

        // Check size limit
        if (libraryDoc.sizeKB > this.settings.maxDocumentationSizeKB) {
          // Trim sources to fit within limit
          libraryDoc.sources = this.trimDocumentationSources(libraryDoc.sources, this.settings.maxDocumentationSizeKB);
          libraryDoc.sizeKB = libraryDoc.sources.reduce((sum, doc) => sum + doc.sizeKB, 0);
        }

        results.push(libraryDoc);
        totalSizeKB += libraryDoc.sizeKB;

        // Cache the result
        await this.cacheDocumentation(libraryDoc);

      } catch (error) {
        console.error(`Error fetching documentation for ${library.name}:`, error);
        errors.push(`Failed to fetch ${library.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        skippedCount++;
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
   * Search and verify that a library actually exists
   */
  private async searchAndVerifyLibrary(libraryName: string): Promise<LibrarySearchResult | null> {
    try {
      // Try GitHub search first
      if (this.octokit) {
        const searchResult = await this.octokit.search.repos({
          q: `${libraryName} in:name`,
          sort: 'stars',
          order: 'desc',
          per_page: 5,
        });

        for (const repo of searchResult.data.items) {
          if (repo.name.toLowerCase() === libraryName.toLowerCase() || 
              repo.full_name.toLowerCase().includes(libraryName.toLowerCase())) {
            return {
              name: libraryName,
              fullName: repo.full_name,
              description: repo.description || '',
              url: repo.html_url,
              stars: repo.stargazers_count,
              language: repo.language || '',
              isVerified: repo.stargazers_count > 100, // Basic verification
            };
          }
        }
      }

      // Try NPM registry
      const npmResult = await this.searchNPMRegistry(libraryName);
      if (npmResult) {
        return npmResult;
      }

      return null;
    } catch (error) {
      console.warn(`Failed to verify library ${libraryName}:`, error);
      return null;
    }
  }

  /**
   * Search NPM registry for the library
   */
  private async searchNPMRegistry(libraryName: string): Promise<LibrarySearchResult | null> {
    try {
      const response = await fetch(`https://registry.npmjs.org/${libraryName}`);
      if (response.ok) {
        const data = await response.json();
        return {
          name: libraryName,
          fullName: data.name,
          description: data.description || '',
          url: `https://www.npmjs.com/package/${libraryName}`,
          isVerified: data['dist-tags']?.latest ? true : false,
        };
      }
    } catch (error) {
      // Ignore NPM registry errors
    }
    return null;
  }

  /**
   * Fetch documentation from multiple sources
   */
  private async fetchFromSources(verifiedLibrary: LibrarySearchResult, library: IdentifiedLibrary): Promise<DocumentationSource[]> {
    const sources: DocumentationSource[] = [];

    for (const sourceType of this.settings.sources) {
      try {
        switch (sourceType) {
          case 'github':
            if (verifiedLibrary.fullName) {
              const githubSources = await this.fetchFromGitHub(verifiedLibrary.fullName);
              sources.push(...githubSources);
            }
            break;
          
          case 'official':
            const officialSources = await this.fetchFromOfficialSite(library.name);
            sources.push(...officialSources);
            break;
          
          case 'mdn':
            if (this.isWebTechnology(library.name)) {
              const mdnSources = await this.fetchFromMDN(library.name);
              sources.push(...mdnSources);
            }
            break;
          
          case 'npm':
            const npmSources = await this.fetchFromNPM(library.name);
            sources.push(...npmSources);
            break;
        }
      } catch (error) {
        console.warn(`Failed to fetch from ${sourceType} for ${library.name}:`, error);
      }
    }

    return sources;
  }

  /**
   * Fetch documentation from GitHub
   */
  private async fetchFromGitHub(fullName: string): Promise<DocumentationSource[]> {
    if (!this.octokit) return [];

    const sources: DocumentationSource[] = [];
    const [owner, repo] = fullName.split('/');

    try {
      // Fetch README
      try {
        const readme = await this.octokit.repos.getReadme({ owner, repo });
        const content = Buffer.from(readme.data.content, 'base64').toString('utf-8');
        sources.push({
          type: 'github-readme',
          url: readme.data.html_url || `https://github.com/${owner}/${repo}`,
          title: `${repo} README`,
          content,
          sizeKB: Math.round(content.length / 1024),
        });
      } catch (error) {
        // README not found, continue
      }

      // Fetch docs folder if it exists
      try {
        const docsContents = await this.octokit.repos.getContent({
          owner,
          repo,
          path: 'docs',
        });

        if (Array.isArray(docsContents.data)) {
          for (const item of docsContents.data.slice(0, 5)) { // Limit to first 5 docs
            if (item.type === 'file' && item.name.endsWith('.md')) {
              try {
                const docFile = await this.octokit.repos.getContent({
                  owner,
                  repo,
                  path: item.path,
                });

                if ('content' in docFile.data) {
                  const content = Buffer.from(docFile.data.content, 'base64').toString('utf-8');
                  sources.push({
                    type: 'github-docs',
                    url: docFile.data.html_url || `https://github.com/${owner}/${repo}/blob/main/${item.path}`,
                    title: `${repo} - ${item.name}`,
                    content,
                    sizeKB: Math.round(content.length / 1024),
                  });
                }
              } catch (error) {
                // Skip this doc file
              }
            }
          }
        }
      } catch (error) {
        // Docs folder not found, continue
      }

      // Fetch wiki if it exists
      try {
        const wikiResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/wiki`);
        if (wikiResponse.ok) {
          // Wiki exists, but GitHub doesn't provide direct API access to wiki content
          // We'll add a placeholder for now
          sources.push({
            type: 'github-wiki',
            url: `https://github.com/${owner}/${repo}/wiki`,
            title: `${repo} Wiki`,
            content: `This library has a GitHub wiki available at: https://github.com/${owner}/${repo}/wiki`,
            sizeKB: 1,
          });
        }
      } catch (error) {
        // Wiki not found or not accessible
      }

    } catch (error) {
      console.warn(`Failed to fetch GitHub documentation for ${fullName}:`, error);
    }

    return sources;
  }

  /**
   * Fetch documentation from official websites
   */
  private async fetchFromOfficialSite(libraryName: string): Promise<DocumentationSource[]> {
    const sources: DocumentationSource[] = [];
    
    // Common official documentation URL patterns
    const officialUrls = [
      `https://${libraryName}.org/docs`,
      `https://docs.${libraryName}.org`,
      `https://www.${libraryName}.org/documentation`,
      `https://${libraryName}.dev/docs`,
      `https://docs.${libraryName}.dev`,
      `https://${libraryName}.readthedocs.io/en/latest/`,
    ];

    for (const url of officialUrls) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'GitAutomate Documentation Fetcher',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          const html = await response.text();
          const $ = cheerio.load(html);
          
          // Extract main content
          const content = this.extractMainContent($);
          
          if (content && content.length > 100) { // Ensure we got meaningful content
            sources.push({
              type: 'official-site',
              url,
              title: $('title').text() || `${libraryName} Documentation`,
              content,
              sizeKB: Math.round(content.length / 1024),
            });
            break; // Found official docs, no need to try other URLs
          }
        }
      } catch (error) {
        // Continue to next URL
      }
    }

    return sources;
  }

  /**
   * Extract main content from HTML using common patterns
   */
  private extractMainContent($: any): string {
    // Try common content selectors
    const contentSelectors = [
      'main',
      '.main-content',
      '.content',
      '.documentation',
      '.docs',
      'article',
      '.article',
      '#content',
      '.markdown-body',
    ];

    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        // Remove navigation, sidebars, headers, footers
        element.find('nav, .nav, .navigation, .sidebar, header, footer, .header, .footer').remove();
        
        const text = element.text().trim();
        if (text.length > 100) {
          return text;
        }
      }
    }

    // Fallback: get body content and clean it
    $('script, style, nav, header, footer, .nav, .navigation, .sidebar').remove();
    return $('body').text().trim().slice(0, 5000); // Limit to reasonable size
  }

  /**
   * Fetch documentation from MDN Web Docs
   */
  private async fetchFromMDN(libraryName: string): Promise<DocumentationSource[]> {
    const sources: DocumentationSource[] = [];
    
    // MDN is primarily for web APIs and JavaScript
    const mdnUrl = `https://developer.mozilla.org/en-US/docs/Web/API/${libraryName}`;
    
    try {
      const response = await fetch(mdnUrl);
      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);
        
        const content = $('.main-page-content').text().trim();
        if (content && content.length > 100) {
          sources.push({
            type: 'mdn',
            url: mdnUrl,
            title: $('title').text() || `${libraryName} - MDN`,
            content,
            sizeKB: Math.round(content.length / 1024),
          });
        }
      }
    } catch (error) {
      // MDN doesn't have this API
    }

    return sources;
  }

  /**
   * Fetch documentation from NPM registry
   */
  private async fetchFromNPM(libraryName: string): Promise<DocumentationSource[]> {
    const sources: DocumentationSource[] = [];
    
    try {
      const response = await fetch(`https://registry.npmjs.org/${libraryName}`);
      if (response.ok) {
        const data = await response.json();
        
        let content = `# ${data.name}\n\n`;
        if (data.description) content += `${data.description}\n\n`;
        if (data.readme) content += data.readme;
        
        sources.push({
          type: 'npm',
          url: `https://www.npmjs.com/package/${libraryName}`,
          title: `${libraryName} - NPM`,
          content,
          sizeKB: Math.round(content.length / 1024),
        });
      }
    } catch (error) {
      // NPM package not found
    }

    return sources;
  }

  /**
   * Check if a library is web technology that might be on MDN
   */
  private isWebTechnology(libraryName: string): boolean {
    const webTechnologies = [
      'fetch', 'websocket', 'webgl', 'canvas', 'geolocation', 'notification',
      'serviceworker', 'indexeddb', 'localstorage', 'sessionStorage',
    ];
    return webTechnologies.includes(libraryName.toLowerCase());
  }

  /**
   * Trim documentation sources to fit within size limit
   */
  private trimDocumentationSources(sources: DocumentationSource[], maxSizeKB: number): DocumentationSource[] {
    const trimmed: DocumentationSource[] = [];
    let currentSizeKB = 0;

    // Sort by importance (README first, then official, then others)
    const sortedSources = sources.sort((a, b) => {
      const priority: Record<string, number> = { 
        'github-readme': 0, 
        'official-site': 1, 
        'github-docs': 2, 
        'npm': 3, 
        'mdn': 4, 
        'github-wiki': 5,
        'stackoverflow': 6 
      };
      return (priority[a.type] || 99) - (priority[b.type] || 99);
    });

    for (const source of sortedSources) {
      if (currentSizeKB + source.sizeKB <= maxSizeKB) {
        trimmed.push(source);
        currentSizeKB += source.sizeKB;
      } else {
        // Trim this source to fit
        const remainingKB = maxSizeKB - currentSizeKB;
        if (remainingKB > 1) {
          const trimmedContent = source.content.slice(0, remainingKB * 1024);
          trimmed.push({
            ...source,
            content: trimmedContent + '\n\n[Content truncated due to size limits]',
            sizeKB: remainingKB,
          });
        }
        break;
      }
    }

    return trimmed;
  }

  /**
   * Cache management
   */
  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private async getCachedDocumentation(libraryName: string): Promise<LibraryDocumentation | null> {
    try {
      const cacheFile = path.join(this.cacheDir, `${libraryName}.json`);
      const cached = await fs.readFile(cacheFile, 'utf-8');
      const doc: LibraryDocumentation = JSON.parse(cached);
      
      // Check if cache is still valid
      if (new Date(doc.cacheExpiry) > new Date()) {
        return doc;
      }
    } catch (error) {
      // Cache miss or invalid
    }
    return null;
  }

  private async cacheDocumentation(doc: LibraryDocumentation): Promise<void> {
    try {
      const cacheFile = path.join(this.cacheDir, `${doc.libraryName}.json`);
      await fs.writeFile(cacheFile, JSON.stringify(doc, null, 2));
    } catch (error) {
      console.warn(`Failed to cache documentation for ${doc.libraryName}:`, error);
    }
  }
}