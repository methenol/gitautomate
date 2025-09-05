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
import { ai } from '@/ai/litellm';

export class DocumentationFetcher {
  private octokit: Octokit | null = null;
  private cacheDir: string;
  private settings: DocumentationSettings;
  private llmConfig?: {
    apiKey: string;
    model: string;
    apiBase: string;
  };

  constructor(
    settings: DocumentationSettings, 
    githubToken?: string,
    llmConfig?: {
      apiKey: string;
      model: string;
      apiBase: string;
    }
  ) {
    this.settings = settings;
    this.llmConfig = llmConfig;
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

        // Clean and enhance documentation using AI
        const cleanedDocs = await this.cleanDocumentationWithAI(docs, library.name);

        const libraryDoc: LibraryDocumentation = {
          libraryName: library.name,
          category: library.category,
          sources: cleanedDocs,
          sizeKB: cleanedDocs.reduce((sum, doc) => sum + doc.sizeKB, 0),
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

      } catch (_error) {
        console.error(`Error fetching documentation for ${library.name}:`, _error);
        errors.push(`Failed to fetch ${library.name}: ${_error instanceof Error ? _error.message : 'Unknown error'}`);
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
    } catch (_error) {
      console.warn(`Failed operation`, _error);
      return null;
    }
  }

  /**
   * Search NPM registry for the library
   */
  private async searchNPMRegistry(libraryName: string): Promise<LibrarySearchResult | null> {
    try {
      // Validate library name to prevent injection attacks
      if (!this.isValidLibraryName(libraryName)) {
        return null;
      }
      
      // URL encode the library name to prevent URL injection
      const encodedName = encodeURIComponent(libraryName);
      const response = await fetch(`https://registry.npmjs.org/${encodedName}`, {
        signal: AbortSignal.timeout(10000),
        headers: {
          'User-Agent': 'GitAutomate/1.0 (+https://github.com/methenol/gitautomate)',
        },
      });
      if (response.ok) {
        const data = await response.json() as any;
        return {
          name: libraryName,
          fullName: data.name,
          description: data.description || '',
          url: `https://www.npmjs.com/package/${encodedName}`,
          isVerified: data['dist-tags']?.latest ? true : false,
        };
      }
    } catch (error) {
      console.warn(`NPM registry search failed for ${libraryName}:`, error instanceof Error ? error.message : 'Unknown error');
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
          
          case 'official': {
            const officialSources = await this.fetchFromOfficialSite(library.name);
            sources.push(...officialSources);
            break;
          }
          
          case 'mdn': {
            if (this.isWebTechnology(library.name)) {
              const mdnSources = await this.fetchFromMDN(library.name);
              sources.push(...mdnSources);
            }
            break;
          }
          
          case 'npm': {
            const npmSources = await this.fetchFromNPM(library.name);
            sources.push(...npmSources);
            break;
          }
        }
      } catch (_error) {
        console.warn(`Failed operation`, _error);
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
      } catch (_error) {
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
              } catch (_error) {
                // Skip this doc file
              }
            }
          }
        }
      } catch (_error) {
        // Docs folder not found, continue
      }

      // Fetch wiki if it exists
      try {
        const wikiResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/wiki`, {
          signal: AbortSignal.timeout(10000),
          headers: {
            'User-Agent': 'GitAutomate/1.0 (+https://github.com/methenol/gitautomate)',
          },
        });
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
        console.warn(`Wiki fetch failed for ${owner}/${repo}:`, error instanceof Error ? error.message : 'Unknown error');
      }

    } catch (_error) {
      console.warn(`Failed operation`, _error);
    }

    return sources;
  }

  /**
   * Fetch documentation from official websites
   */
  private async fetchFromOfficialSite(libraryName: string): Promise<DocumentationSource[]> {
    const sources: DocumentationSource[] = [];
    
    // Validate library name to prevent injection attacks
    if (!this.isValidLibraryName(libraryName)) {
      return sources;
    }
    
    // URL encode the library name to prevent URL injection
    const encodedName = encodeURIComponent(libraryName);
    
    // Common official documentation URL patterns
    const officialUrls = [
      `https://${encodedName}.org/docs`,
      `https://docs.${encodedName}.org`,
      `https://www.${encodedName}.org/documentation`,
      `https://${encodedName}.dev/docs`,
      `https://docs.${encodedName}.dev`,
      `https://${encodedName}.readthedocs.io/en/latest/`,
    ];

    for (const url of officialUrls) {
      try {
        // Validate URL before making request
        if (!this.isValidURL(url)) {
          continue;
        }
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'GitAutomate/1.0 (+https://github.com/methenol/gitautomate)',
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
        console.warn(`Failed to fetch from ${url}:`, error instanceof Error ? error.message : 'Unknown error');
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
    
    // Validate library name to prevent injection attacks
    if (!this.isValidLibraryName(libraryName)) {
      return sources;
    }
    
    // URL encode the library name to prevent URL injection
    const encodedName = encodeURIComponent(libraryName);
    
    // MDN is primarily for web APIs and JavaScript
    const mdnUrl = `https://developer.mozilla.org/en-US/docs/Web/API/${encodedName}`;
    
    try {
      // Validate URL before making request
      if (!this.isValidURL(mdnUrl)) {
        return sources;
      }
      
      const response = await fetch(mdnUrl, {
        signal: AbortSignal.timeout(10000),
        headers: {
          'User-Agent': 'GitAutomate/1.0 (+https://github.com/methenol/gitautomate)',
        },
      });
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
      console.warn(`MDN fetch failed for ${libraryName}:`, error instanceof Error ? error.message : 'Unknown error');
    }

    return sources;
  }

  /**
   * Fetch documentation from NPM registry
   */
  private async fetchFromNPM(libraryName: string): Promise<DocumentationSource[]> {
    const sources: DocumentationSource[] = [];
    
    try {
      // Validate library name to prevent injection attacks
      if (!this.isValidLibraryName(libraryName)) {
        return sources;
      }
      
      // URL encode the library name to prevent URL injection
      const encodedName = encodeURIComponent(libraryName);
      const response = await fetch(`https://registry.npmjs.org/${encodedName}`, {
        signal: AbortSignal.timeout(10000),
        headers: {
          'User-Agent': 'GitAutomate/1.0 (+https://github.com/methenol/gitautomate)',
        },
      });
      if (response.ok) {
        const data = await response.json() as any;
        
        let content = `# ${data.name}\n\n`;
        if (data.description) content += `${data.description}\n\n`;
        if (data.readme) content += data.readme;
        
        sources.push({
          type: 'npm',
          url: `https://www.npmjs.com/package/${encodedName}`,
          title: `${libraryName} - NPM`,
          content,
          sizeKB: Math.round(content.length / 1024),
        });
      }
    } catch (error) {
      console.warn(`NPM fetch failed for ${libraryName}:`, error instanceof Error ? error.message : 'Unknown error');
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
    } catch (_error) {
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
    } catch (_error) {
      // Cache miss or invalid
    }
    return null;
  }

  private async cacheDocumentation(doc: LibraryDocumentation): Promise<void> {
    try {
      const cacheFile = path.join(this.cacheDir, `${doc.libraryName}.json`);
      await fs.writeFile(cacheFile, JSON.stringify(doc, null, 2));
    } catch (_error) {
      console.warn(`Failed operation`, _error);
    }
  }

  /**
   * Clean and enhance documentation using AI to make it more useful for developers
   */
  private async cleanDocumentationWithAI(sources: DocumentationSource[], libraryName: string): Promise<DocumentationSource[]> {
    const cleanedSources: DocumentationSource[] = [];

    for (const source of sources) {
      try {
        // Only clean if the content is substantial but not too large for AI processing
        if (source.content.length > 500 && source.content.length < 10000) {
          const cleanedContent = await this.cleanDocumentationContent(source.content, libraryName, source.type);
          
          cleanedSources.push({
            ...source,
            content: cleanedContent,
            title: `${source.title} (AI Enhanced)`,
            sizeKB: Math.round(cleanedContent.length / 1024),
          });
        } else {
          // Keep original content for very short or very long documents
          cleanedSources.push(source);
        }
      } catch (_error) {
        console.warn(`Failed operation`, _error);
        // Fallback to original content if AI cleaning fails
        cleanedSources.push(source);
      }
    }

    return cleanedSources;
  }

  /**
   * Use AI to clean and enhance raw scraped documentation
   */
  private async cleanDocumentationContent(rawContent: string, libraryName: string, sourceType: string): Promise<string> {
    try {
      // Only use AI cleaning if LLM config is provided
      if (!this.llmConfig?.model) {
        console.warn('No LLM configuration provided for documentation cleaning, returning original content');
        return rawContent;
      }

      const prompt = `You are a technical documentation editor. Your task is to clean up and enhance the following raw documentation content for the library "${libraryName}" from source "${sourceType}".

Transform the raw content into clear, concise, and useful developer documentation by:

1. **Removing noise**: Strip out navigation elements, ads, footers, unrelated content, and HTML artifacts
2. **Organizing structure**: Create clear sections with proper markdown headers
3. **Adding clarity**: Rewrite confusing sentences to be clearer and more developer-friendly
4. **Highlighting key info**: Emphasize installation instructions, quick start guides, API basics, and common use cases
5. **Preserving examples**: Keep all code examples and technical details intact
6. **Adding sections**: If missing, add sections for Installation, Quick Start, Key Features, and Basic Usage

Output clean, well-structured markdown documentation that a developer would find immediately useful.

Raw content to clean:
---
${rawContent}
---

Return only the cleaned documentation content in markdown format.`;

      const { output } = await ai.generate({
        model: this.llmConfig.model,
        prompt,
        config: {
          apiKey: this.llmConfig.apiKey,
          apiBase: this.llmConfig.apiBase,
        },
      });

      return output as string;
    } catch (error) {
      console.warn(`AI documentation cleaning failed for ${libraryName}:`, error instanceof Error ? error.message : 'Unknown error');
      // Return original content if AI fails
      return rawContent;
    }
  }

  /**
   * Validates library names to prevent injection attacks
   */
  private isValidLibraryName(name: string): boolean {
    // Must match standard library naming conventions
    return /^[a-zA-Z][a-zA-Z0-9._-]{0,63}$/.test(name) && !name.includes('..');
  }

  /**
   * Validates URLs to prevent SSRF attacks
   */
  private isValidURL(url: string): boolean {
    try {
      const parsed = new URL(url);
      // Only allow HTTPS for external requests
      if (parsed.protocol !== 'https:') return false;
      // Block private IP ranges and localhost
      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        hostname.match(/^172\.(1[6-9]|2\d|3[01])\./) ||
        hostname.startsWith('169.254.') ||
        hostname.startsWith('fc00:') ||
        hostname.startsWith('fe80:')
      ) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }
}