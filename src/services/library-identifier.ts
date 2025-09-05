import type { IdentifiedLibrary } from '@/types/documentation';

export class LibraryIdentifier {
  // Library patterns categorized by type
  private static readonly LIBRARY_PATTERNS = {
    frontend: [
      // React ecosystem
      'react', 'next', 'nextjs', 'gatsby', 'remix', 'redux', 'mobx', 'zustand',
      'react-router', 'react-query', 'tanstack', 'chakra-ui', 'material-ui', 'mui',
      'tailwind', 'tailwindcss', 'styled-components', 'emotion',
      
      // Vue ecosystem  
      'vue', 'vuejs', 'nuxt', 'vuex', 'pinia', 'vue-router', 'quasar', 'vuetify',
      
      // Angular ecosystem
      'angular', '@angular', 'rxjs', 'ngrx', 'angular-material',
      
      // Other frontend frameworks
      'svelte', 'sveltekit', 'solid', 'solidjs', 'lit', 'stencil',
      
      // Build tools and bundlers
      'webpack', 'vite', 'rollup', 'parcel', 'esbuild', 'turbopack',
      
      // CSS frameworks
      'bootstrap', 'bulma', 'foundation', 'semantic-ui',
    ],
    backend: [
      // Node.js
      'express', 'fastify', 'koa', 'hapi', 'nestjs', 'adonis',
      'socket.io', 'ws', 'graphql', 'apollo-server', 'prisma', 'typeorm', 'sequelize',
      
      // Python
      'django', 'flask', 'fastapi', 'tornado', 'pyramid', 'celery', 'gunicorn',
      'sqlalchemy', 'django-rest-framework', 'drf',
      
      // Java
      'spring', 'spring-boot', 'hibernate', 'struts', 'jersey', 'micronaut',
      
      // .NET
      'dotnet', '.net', 'asp.net', 'entity-framework',
      
      // Go
      'gin', 'echo', 'fiber', 'gorilla', 'beego',
      
      // Rust
      'actix', 'rocket', 'warp', 'axum',
      
      // PHP
      'laravel', 'symfony', 'codeigniter', 'zend', 'yii',
    ],
    database: [
      'postgresql', 'postgres', 'mysql', 'sqlite', 'mongodb', 'redis',
      'elasticsearch', 'cassandra', 'dynamodb', 'firestore', 'supabase',
      'planetscale', 'neon', 'cockroachdb', 'neo4j',
    ],
    testing: [
      'jest', 'mocha', 'chai', 'jasmine', 'vitest', 'cypress', 'playwright',
      'selenium', 'puppeteer', 'testing-library', 'enzyme', 'supertest',
      'pytest', 'unittest', 'nose', 'junit', 'testng', 'mockito',
    ],
    utility: [
      'lodash', 'underscore', 'ramda', 'moment', 'dayjs', 'date-fns',
      'axios', 'fetch', 'got', 'ky', 'superagent',
      'joi', 'yup', 'zod', 'ajv', 'validator',
      'uuid', 'nanoid', 'bcrypt', 'jsonwebtoken', 'jwt',
    ],
  };

  /**
   * Identifies libraries mentioned in task details and titles
   */
  static identifyLibraries(tasks: Array<{ id: string; title: string; details: string }>): IdentifiedLibrary[] {
    const identified = new Map<string, IdentifiedLibrary>();

    for (const task of tasks) {
      const text = `${task.title} ${task.details}`.toLowerCase();
      
      // Check each category
      for (const [category, libraries] of Object.entries(this.LIBRARY_PATTERNS)) {
        for (const library of libraries) {
          const confidence = this.calculateConfidence(text, library);
          
          if (confidence > 0.3) { // Minimum confidence threshold
            const key = library;
            
            if (identified.has(key)) {
              const existing = identified.get(key)!;
              existing.confidenceScore = Math.max(existing.confidenceScore, confidence);
              existing.detectedIn.push(task.id);
            } else {
              identified.set(key, {
                name: library,
                confidenceScore: confidence,
                category: category as IdentifiedLibrary['category'],
                detectedIn: [task.id],
              });
            }
          }
        }
      }
    }

    // Sort by confidence score descending
    return Array.from(identified.values())
      .sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  /**
   * Calculate confidence score for library detection
   */
  private static calculateConfidence(text: string, library: string): number {
    let confidence = 0;
    
    // Exact word match
    const wordBoundaryRegex = new RegExp(`\\b${library.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const exactMatches = (text.match(wordBoundaryRegex) || []).length;
    confidence += exactMatches * 0.4;
    
    // Package/import patterns
    const importPatterns = [
      `import.*${library}`,
      `from.*${library}`,
      `require.*${library}`,
      `@${library}`,
      `npm.*${library}`,
      `yarn.*${library}`,
      `pip.*${library}`,
      `dependency.*${library}`,
    ];
    
    for (const pattern of importPatterns) {
      if (new RegExp(pattern, 'i').test(text)) {
        confidence += 0.3;
      }
    }
    
    // Context patterns
    const contextPatterns = [
      `setup.*${library}`,
      `configure.*${library}`,
      `implement.*${library}`,
      `install.*${library}`,
      `using.*${library}`,
      `with.*${library}`,
    ];
    
    for (const pattern of contextPatterns) {
      if (new RegExp(pattern, 'i').test(text)) {
        confidence += 0.2;
      }
    }
    
    // Cap at 1.0
    return Math.min(confidence, 1.0);
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
    const { minConfidence = 0.5, categories, maxCount = 20 } = options;
    
    let filtered = libraries.filter(lib => lib.confidenceScore >= minConfidence);
    
    if (categories && categories.length > 0) {
      filtered = filtered.filter(lib => categories.includes(lib.category));
    }
    
    return filtered.slice(0, maxCount);
  }
}