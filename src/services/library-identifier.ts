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
            category: this.guessCategory(libraryInfo.name, libraryInfo.context),
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
    
    // Pattern 1: Import/require statements (highest confidence)
    const importPatterns = [
      /import\s+.*?from\s+['"`]([^'"`@/]+)['"`]/gi,
      /import\s+['"`]([^'"`@/]+)['"`]/gi,
      /require\s*\(\s*['"`]([^'"`@/]+)['"`]\s*\)/gi,
      /from\s+['"`]([^'"`@/]+)['"`]/gi,
    ];
    
    for (const pattern of importPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const libName = this.normalizeLibraryName(match[1]);
        if (libName && this.isKnownLibraryPattern(libName)) {
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
      /npm\s+install\s+([a-zA-Z][\w\-@/]+)/gi,
      /yarn\s+add\s+([a-zA-Z][\w\-@/]+)/gi,
      /pip\s+install\s+([a-zA-Z][\w\-@/]+)/gi,
      /composer\s+require\s+([\w\-]+\/[\w\-]+)/gi,
    ];

    for (const pattern of packagePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const libName = this.normalizeLibraryName(match[1]);
        if (libName && this.isKnownLibraryPattern(libName)) {
          libraries.push({
            name: libName,
            confidence: 0.9,
            context: `Package manager: ${match[0]}`
          });
        }
      }
    }

    // Pattern 3: Well-known framework/library mentions (medium confidence)
    const wellKnownLibraries = [
      // Frontend
      'react', 'vue', 'angular', 'svelte', 'nextjs', 'next.js', 'nuxtjs', 'nuxt.js', 'gatsby',
      'jquery', 'lodash', 'moment', 'axios', 'typescript', 'webpack', 'styled-components',
      'material-ui', 'ant-design', 'react-router-dom', 'react-router',
      // Backend
      'express', 'expressjs', 'express.js', 'fastify', 'koa', 'nestjs', 'django', 'flask', 'fastapi',
      'spring', 'laravel', 'rails', 'asp.net', 'nodejs', 'node.js', 'graphql', 'apollo',
      'jsonwebtoken', 'passport', 'bcrypt', 'joi', 'express-rate-limit', 'cors',
      // Database
      'mysql', 'postgresql', 'postgres', 'mongodb', 'mongo', 'redis', 'elasticsearch', 'sqlite',
      'sequelize', 'mongoose', 'prisma', 'typeorm', 'knex',
      // Testing
      'jest', 'mocha', 'cypress', 'playwright', 'selenium', 'puppeteer', 'supertest',
      'chai', 'sinon', 'karma', 'jasmine', 'testing-library',
      // DevOps
      'docker', 'kubernetes', 'k8s', 'terraform', 'ansible', 'jenkins', 'nginx',
      'prometheus', 'grafana', 'github-actions',
      // Mobile
      'react-native', 'flutter', 'ionic', 'xamarin', '@react-navigation/native', 'redux-toolkit',
      // ML/Data
      'tensorflow', 'tensorflow.js', 'pytorch', 'pandas', 'numpy', 'scikit-learn',
      // Utility
      'lodash', 'moment', 'date-fns', 'axios', 'fetch',
    ];

    for (const lib of wellKnownLibraries) {
      // Handle hyphenated libraries specially
      if (lib.includes('-') || lib.includes('.')) {
        const exactRegex = new RegExp(`\\b${lib.replace(/[-\.]/g, '[-\\.]?')}\\b`, 'gi');
        let match;
        while ((match = exactRegex.exec(text)) !== null) {
          libraries.push({
            name: lib,
            confidence: 0.85, // Higher confidence for exact matches
            context: `Framework mention: ${match[0]}`
          });
        }
      } else {
        // Regular single-word libraries
        const regex = new RegExp(`\\b${lib}\\b`, 'gi');
        let match;
        while ((match = regex.exec(text)) !== null) {
          libraries.push({
            name: lib,
            confidence: 0.8,
            context: `Framework mention: ${match[0]}`
          });
        }
      }
    }

    // Pattern 4: Technology context mentions (lower confidence)
    const contextPatterns = [
      /(?:using|with|setup|configure|implement)\s+([a-zA-Z][\w\-\.]{3,15})\s+(?:framework|library|package)/gi,
      /([a-zA-Z][\w\-\.]{3,15})\s+(?:authentication|database|server|client|api)/gi,
      /(?:install|add|use)\s+([\w\-\.@/]+)/gi, // More general installation pattern
      /([a-zA-Z][\w\-\.]{2,20})(?:\.js|\.ts)?\s+(?:for|with)/gi, // Library mentions with "for/with"
    ];

    for (const pattern of contextPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const libName = this.normalizeLibraryName(match[1]);
        if (libName && this.isKnownLibraryPattern(libName)) {
          libraries.push({
            name: libName,
            confidence: 0.7,
            context: `Context mention: ${match[0]}`
          });
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
    let normalized = name.toLowerCase()
      .replace(/^@.*?\//, '') // Remove npm scope (@babel/core -> core)
      .replace(/['"]/g, '') // Remove quotes
      .replace(/\.js$/, '') // Remove .js extension  
      .replace(/\.ts$/, '') // Remove .ts extension
      .trim();
    
    // Handle common variations
    const variations: Record<string, string> = {
      'next.js': 'nextjs',
      'next': 'nextjs',
      'nuxt.js': 'nuxtjs',
      'node.js': 'nodejs',
      'express.js': 'express',
      'tensorflow.js': 'tensorflow'
    };
    
    return variations[normalized] || normalized;
  }

  /**
   * Check if a name matches known library patterns
   */
  private static isKnownLibraryPattern(name: string): boolean {
    // Must be reasonable length and format
    if (!/^[a-zA-Z][\w\-]{1,30}$/.test(name)) return false;
    
    // Exclude common words that aren't libraries
    const excludeWords = [
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
      'request', 'ui'
    ];
    
    return !excludeWords.includes(name.toLowerCase());
  }

  /**
   * Check if a string is a valid library name
   */
  private static isValidLibraryName(name: string): boolean {
    return /^[a-zA-Z][\w\-]{1,30}$/.test(name) && 
           !['the', 'and', 'for', 'with', 'from', 'this', 'that', 'using', 'build', 'app'].includes(name.toLowerCase());
  }

  /**
   * Guess category based on library name and context
   */
  private static guessCategory(name: string, context?: string): IdentifiedLibrary['category'] {
    const lowerName = name.toLowerCase();
    const lowerContext = context?.toLowerCase() || '';
    
    // Frontend frameworks/libraries
    if (['react', 'vue', 'angular', 'svelte', 'nextjs', 'next.js', 'nuxtjs', 'nuxt.js', 'jquery', 'typescript', 'styled-components'].includes(lowerName) ||
        lowerName.includes('next') || // Handle variations like "next", "next.js"
        lowerContext.includes('frontend') || lowerContext.includes('ui')) {
      return 'frontend';
    }
    
    // Backend frameworks and auth libraries
    if (['express', 'expressjs', 'express.js', 'fastify', 'django', 'flask', 'spring', 'laravel', 'rails', 'nodejs', 'node.js', 'graphql', 
         'jsonwebtoken', 'passport', 'bcrypt', 'joi'].includes(lowerName) ||
        lowerName.includes('auth') || lowerName.includes('jwt') || // Auth-related libraries
        lowerContext.includes('backend') || lowerContext.includes('server') || lowerContext.includes('api') || lowerContext.includes('auth')) {
      return 'backend';
    }
    
    // Databases
    if (['mysql', 'postgresql', 'postgres', 'mongodb', 'mongo', 'redis', 'sqlite', 'sequelize', 'mongoose', 'prisma'].includes(lowerName) ||
        lowerContext.includes('database') || lowerContext.includes('db')) {
      return 'database';
    }
    
    // Testing frameworks
    if (['jest', 'mocha', 'cypress', 'playwright', 'selenium', 'chai', 'supertest'].includes(lowerName) ||
        lowerContext.includes('test') || lowerContext.includes('spec')) {
      return 'testing';
    }
    
    // DevOps tools
    if (['docker', 'kubernetes', 'k8s', 'terraform', 'ansible', 'jenkins', 'nginx', 'prometheus', 'grafana'].includes(lowerName) ||
        lowerContext.includes('deploy') || lowerContext.includes('infrastructure')) {
      return 'devops';
    }
    
    // Mobile frameworks
    if (['react-native', 'flutter', 'ionic', 'xamarin'].includes(lowerName) ||
        lowerContext.includes('mobile') || lowerContext.includes('android') || lowerContext.includes('ios')) {
      return 'mobile';
    }
    
    // ML/Data science
    if (['tensorflow', 'tensorflow.js', 'pytorch', 'pandas', 'numpy', 'scikit-learn'].includes(lowerName) ||
        lowerContext.includes('machine learning') || lowerContext.includes('data science')) {
      return 'ml';
    }
    
    return 'utility';
  }

  /**
   * Filter libraries by minimum confidence and category
   */
  static filterLibraries(
    libraries: IdentifiedLibrary[], 
    options: {
      minConfidence?: number;
      categories?: IdentifiedLibrary['category'][];
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