import type { IdentifiedLibrary } from '@/types/documentation';

export class LibraryIdentifier {
  /**
   * Identifies libraries mentioned in task details and titles
   * Uses intelligent pattern matching to extract actual library names
   */
  static async identifyLibraries(
    tasks: Array<{ id: string; title: string; details: string }>
  ): Promise<IdentifiedLibrary[]> {
    const identified = new Map<string, IdentifiedLibrary>();

    for (const task of tasks) {
      const text = `${task.title} ${task.details}`;
      const extractedLibraries = this.extractLibraryNamesFromText(text);
      
      for (const libraryInfo of extractedLibraries) {
        const key = libraryInfo.name.toLowerCase();
        
        if (identified.has(key)) {
          const existing = identified.get(key)!;
          existing.confidenceScore = Math.max(existing.confidenceScore, libraryInfo.confidence);
          existing.detectedIn.push(task.id);
        } else {
          identified.set(key, {
            name: libraryInfo.name,
            confidenceScore: libraryInfo.confidence,
            category: 'library', // Simple generic category since no hardcoding allowed
            detectedIn: [task.id],
            source: 'pattern' as const,
            context: libraryInfo.context,
          });
        }
      }
    }

    // Sort by confidence score descending and filter valid libraries
    return Array.from(identified.values())
      .filter(lib => lib.confidenceScore >= 0.6 && this.isValidLibraryName(lib.name))
      .sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  /**
   * Extract library names from text using precise patterns
   */
  private static extractLibraryNamesFromText(text: string): Array<{ name: string; confidence: number; context: string }> {
    const libraries: Array<{ name: string; confidence: number; context: string }> = [];
    
    // Pattern 0: REQUIRED LIBRARIES sections (highest confidence - this is our new explicit format)
    const requiredLibrariesPattern = /REQUIRED LIBRARIES:\s*([^\n\r.]+)/gi;
    let match;
    while ((match = requiredLibrariesPattern.exec(text)) !== null) {
      const libraryList = match[1].trim();
      // Split by comma and extract individual libraries
      const libs = libraryList.split(/[,\s]+/).filter(lib => lib.trim().length > 0);
      for (const lib of libs) {
        const libName = this.normalizeLibraryName(lib.trim());
        if (libName && this.isValidLibraryName(libName)) {
          libraries.push({
            name: libName,
            confidence: 0.98,
            context: `Required libraries section: ${match[0]}`
          });
        }
      }
    }
    
    // Pattern 1: Import/require statements (high confidence)
    const importPatterns = [
      /import\s+.*?from\s+['"`]([a-zA-Z][\w\-@/]*?)['"`]/gi,
      /import\s+['"`]([a-zA-Z][\w\-@/]*?)['"`]/gi,
      /require\s*\(\s*['"`]([a-zA-Z][\w\-@/]*?)['"`]\s*\)/gi,
      /from\s+['"`]([a-zA-Z][\w\-@/]*?)['"`]/gi,
    ];
    
    for (const pattern of importPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const libName = this.normalizeLibraryName(match[1]);
        if (libName && this.isValidLibraryName(libName)) {
          libraries.push({
            name: libName,
            confidence: 0.95,
            context: `Import statement: ${match[0]}`
          });
        }
      }
    }

    // Pattern 2: Package manager commands (high confidence)
    const packagePatterns = [
      /npm\s+install\s+((?:[a-zA-Z][\w-@/]+\s*)+)/gi,
      /yarn\s+add\s+((?:[a-zA-Z][\w-@/]+\s*)+)/gi,
      /pip\s+install\s+((?:[a-zA-Z][\w-]+\s*)+)/gi,
      /composer\s+require\s+([\w-]+\/[\w-]+)/gi,
    ];

    for (const pattern of packagePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        // Split by whitespace to handle multiple packages in one command
        const packages = match[1].trim().split(/\s+/);
        for (const pkg of packages) {
          const libName = this.normalizeLibraryName(pkg);
          if (libName && this.isValidLibraryName(libName)) {
            libraries.push({
              name: libName,
              confidence: 0.9,
              context: `Package manager: npm install ${pkg}`
            });
          }
        }
      }
    }

    // Pattern 3: Common technology keywords (medium confidence) - only very well-known ones
    const keywordPatterns = [
      // Category colon patterns: "Frontend: React, Vue" etc. - more restrictive to avoid noise
      /(?:frontend|ui|frontend\s*technologies?):\s*([a-zA-Z][a-zA-Z0-9-]*(?:\s*,\s*[a-zA-Z][a-zA-Z0-9-]*)*)/gi,
      /(?:backend|server|api|backend\s*technologies?):\s*([a-zA-Z][a-zA-Z0-9-]*(?:\s*,\s*[a-zA-Z][a-zA-Z0-9-]*)*)/gi,
      /(?:database|db|databases?):\s*([a-zA-Z][a-zA-Z0-9-]*(?:\s*,\s*[a-zA-Z][a-zA-Z0-9-]*)*)/gi,
      /(?:testing|tests?):\s*([a-zA-Z][a-zA-Z0-9-]*(?:\s*,\s*[a-zA-Z][a-zA-Z0-9-]*)*)/gi,
      /(?:devops|deployment|infrastructure):\s*([a-zA-Z][a-zA-Z0-9-]*(?:\s*,\s*[a-zA-Z][a-zA-Z0-9-]*)*)/gi,
      
      // Database patterns
      /\b(?:setup|configure|use|using|with)\s+(mysql|postgresql|postgres|mongodb|redis|sqlite)\b/gi,
      /\b(mysql|postgresql|postgres|mongodb|redis|sqlite)\s+(?:database|db|server)\b/gi,
      
      // Frontend framework patterns
      /\b(?:build|create|use|using|with|setup)\s+(react|vue|angular|svelte)\s*(?:app|application|frontend|component)?\b/gi,
      /\b(react|vue|angular|svelte)\s+(?:frontend|app|application|component|hooks)\b/gi,
      
      // Backend framework patterns  
      /\b(?:build|create|use|using|with|setup)\s+(express|django|flask|fastapi|spring|laravel)\s*(?:app|application|api|server)?\b/gi,
      /\b(express|django|flask|fastapi|spring|laravel)\s+(?:server|api|backend|app)\b/gi,
      
      // Game development patterns
      /\b(?:setup|use|using|with)\s+(pygame|unity|godot)\s*(?:for|game)?\b/gi,
      /\b(pygame|unity|godot)\s+(?:game|development|for)\b/gi,
      
      // Testing patterns
      /\b(?:test|testing|using|with|add)\s+(jest|mocha|cypress|playwright)\b/gi,
      /\b(jest|mocha|cypress|playwright)\s+(?:test|testing|for)\b/gi,
      
      // DevOps patterns
      /\b(?:deploy|using|with|setup)\s+(docker|kubernetes|nginx)\b/gi,
      /\b(docker|kubernetes|nginx)\s+(?:container|deployment|server)\b/gi,
      
      // Language patterns
      /\b(?:using|with)\s+(typescript|javascript|python)\b/gi,
      /\b(typescript|javascript|python)\s+(?:language|for)\b/gi,
    ];

    for (const pattern of keywordPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const matchedText = match[1];
        
        // Handle comma-separated lists from category colon patterns
        if (matchedText.includes(',')) {
          const libNames = matchedText.split(',').map(lib => lib.trim());
          for (const libName of libNames) {
            const normalizedName = this.normalizeLibraryName(libName);
            if (normalizedName && this.isValidLibraryName(normalizedName)) {
              libraries.push({
                name: normalizedName,
                confidence: 0.8,
                context: `Keyword mention: ${match[0]}`
              });
            }
          }
        } else {
          const libName = this.normalizeLibraryName(matchedText);
          if (libName && this.isValidLibraryName(libName)) {
            libraries.push({
              name: libName,
              confidence: 0.8,
              context: `Keyword mention: ${match[0]}`
            });
          }
        }
      }
    }

    // Deduplicate and return highest confidence for each library
    const deduped = new Map<string, { name: string; confidence: number; context: string }>();
    for (const lib of libraries) {
      const key = lib.name.toLowerCase();
      if (!deduped.has(key) || deduped.get(key)!.confidence < lib.confidence) {
        deduped.set(key, lib);
      }
    }

    return Array.from(deduped.values());
  }

  /**
   * Normalize library names to standard format
   */
  private static normalizeLibraryName(name: string): string {
    const normalized = name.toLowerCase()
      .replace(/^@.*?\//, '') // Remove npm scope (@babel/core -> core)
      .replace(/['"]/g, '') // Remove quotes
      .replace(/\.js$/, '') // Remove .js extension  
      .replace(/\.ts$/, '') // Remove .ts extension
      .trim();
    
    // Handle common variations
    const variations: Record<string, string> = {
      'nextjs': 'nextjs',
      'next.js': 'nextjs',
      'next': 'nextjs',
      'nuxtjs': 'nuxtjs', 
      'nuxt.js': 'nuxtjs',
      'nodejs': 'nodejs',
      'node.js': 'nodejs',
      'expressjs': 'express',
      'express.js': 'express',
      'tensorflow.js': 'tensorflow'
    };
    
    return variations[normalized] || normalized;
  }

  /**
   * Check if a string is a valid library name
   */
  private static isValidLibraryName(name: string): boolean {
    // Must be reasonable length and format
    if (!/^[a-zA-Z][\w-]{1,30}$/.test(name)) return false;
    
    // Must be at least 2 characters
    if (name.length < 2) return false;
    
    // Reject names that contain dots (these are usually property paths, not library names)
    if (name.includes('.')) return false;
    
    // Reject names with multiple consecutive hyphens or underscores
    if (name.includes('--') || name.includes('__')) return false;
    
    // Exclude common words that aren't libraries
    const excludeWords = [
      // Common directory/file words
      'config', 'utils', 'helper', 'common', 'shared', 'base', 'core',
      'main', 'index', 'app', 'src', 'lib', 'dist', 'build', 'test',
      'spec', 'mock', 'fixture', 'data', 'assets', 'public', 'static',
      'component', 'service', 'controller', 'model', 'view', 'route',
      'middleware', 'plugin', 'extension', 'addon', 'theme', 'template',
      // Common action words that aren't libraries
      'setup', 'configure', 'install', 'create', 'build', 'deploy',
      'authentication', 'authorization', 'validation', 'monitoring',
      // Additional noise words
      'dependencies', 'frontend', 'backend', 'testing', 'project', 'application',
      'routing', 'components', 'server', 'connection', 'limiting', 'pipeline',
      'proxy', 'navigation', 'push', 'management', 'notifications', 'analytics',
      'request', 'ui', 'api', 'client', 'database', 'db', 'framework',
      // Common English words
      'the', 'and', 'for', 'with', 'from', 'this', 'that', 'using',
      'file', 'path', 'font', 'sprite', 'base', 'name', 'hooks', 'state',
      'props', 'context', 'custom', 'utils', 'invalid-name',
      // Programming keywords that shouldn't be libraries
      'import', 'export', 'require', 'module', 'package', 'include'
    ];
    
    return !excludeWords.includes(name.toLowerCase());
  }

  /**
   * Filter libraries by minimum confidence and category
   */
  static filterLibraries(
    libraries: IdentifiedLibrary[], 
    options: {
      minConfidence?: number;
      categories?: string[];
      maxCount?: number;
    } = {}
  ): IdentifiedLibrary[] {
    const { minConfidence = 0.6, categories, maxCount = 15 } = options;
    
    let filtered = libraries.filter(lib => lib.confidenceScore >= minConfidence);
    
    if (categories && categories.length > 0) {
      filtered = filtered.filter(lib => categories.includes(lib.category));
    }
    
    return filtered.slice(0, maxCount);
  }
}