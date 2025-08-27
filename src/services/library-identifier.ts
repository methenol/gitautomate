

interface LibraryMatch {
  name: string;
  category: 'frontend' | 'backend' | 'database' | 'testing' | 'auth' | 'build-tools' | 'other';
  confidence: number;
}

export interface LibraryIdentificationResult {
  libraries: Array<{
    name: string;
    category: LibraryMatch['category'];
    context7Matches?: any[];
  }>;
}

const LIBRARY_PATTERNS = {
  frontend: [
    'react', 'vue', 'angular', 'svelte', 'nextjs', 'nuxt',
    'tailwindcss', 'bootstrap', 'material-ui', 'chakraui', 'ant design',
    'typescript', 'javascript', 'es6+', 'webpack', 'vite', 'rollup',
    'html5', 'css3', 'sass', 'less'
  ],
  backend: [
    'nodejs', 'express', 'fastify', 'koa',
    'python', 'django', 'flask', 'fastapi',
    'java', 'spring boot', 'quarkus',
    'go', 'gin', 'echo', 'fiber'
  ],
  database: [
    'postgresql', 'mysql', 'mariadb',
    'mongodb', 'redis', 'elasticsearch',
    'sqlite', 'dynamodb', 'firebase firestore'
  ],
  testing: [
    'jest', 'vitest', 'cypress', 'playwright',
    'testing library', '@react-testing-library',
    'mocha', 'chai', 'sinon'
  ],
  auth: [
    'firebase authentication',
    'next-auth',
    'auth0', 
    'passportjs',
    'keycloak'
  ],
  buildTools: [
    'npm', 'yarn', 'pnpm',
    'docker', 'kubernetes',
    'github actions', 'gitlab ci',
    'webpack', 'vite', 'rollup'
  ]
};

const COMMON_LIBRARY_VARIATIONS = {
  'react': ['React', '@react'],
  'vue': ['Vue.js', 'Vite + Vue'], 
  'angular': ['AngularJS'],
  'nextjs': ['Next.js', '@next/next'],
  'typescript': ['TSX'],
  'nodejs': ['Node.js', '@types/node'],
  'postgresql': ['Postgres', 'postgres'],
  'mongodb': ['mongoDB'],
  'mysql': ['mySQL']
};

export class LibraryIdentifier {
  
  async identifyLibraries(
    architecture: string,
    specifications: string, 
    fileStructure: string,
    tasks: Array<{ title: string; details: string }>
  ): Promise<LibraryIdentificationResult> {
    const allContent = [
      architecture,
      specifications, 
      fileStructure,
      ...tasks.map(task => `${task.title}\n${task.details}`)
    ].join('\n');

    const libraryMentions: Array<{name: string, category: LibraryMatch['category'], confidence: number}> = [];
    
    // Pattern-based identification
    for (const [category, patterns] of Object.entries(LIBRARY_PATTERNS)) {
      for (const pattern of patterns) {
        const regex = new RegExp(`\b${pattern}\b`, 'gi');
        const matches = allContent.match(regex);
        
        if (matches) {
          libraryMentions.push({
            name: pattern.toLowerCase(),
            category: category as LibraryMatch['category'],
            confidence: Math.min(matches.length * 0.3, 1) // More mentions = higher confidence
          });
        }
      }
    }

    // Extract potential library names using AI-style analysis (simplified)
    const extractedLibraries = this.extractPotentialLibraryNames(allContent);
    
    for (const libName of extractedLibraries) {
      if (!libraryMentions.some(mention => mention.name.toLowerCase() === libName.toLowerCase())) {
        // Categorize the extracted library
        const category = this.categorizeLibrary(libName);
        
        if (category !== 'other') {
          libraryMentions.push({
            name: libName,
            category,
            confidence: 0.7 // Default moderate confidence for extracted libraries
          });
        }
      }
    }

    // Remove duplicates and sort by confidence (highest first)
    const uniqueLibraries = this.deduplicateLibraryMentions(libraryMentions);
    
    return {
      libraries: uniqueLibraries
        .filter(lib => lib.confidence > 0.3) // Only include confident matches
        .sort((a, b) => b.confidence - a.confidence)
    };
  }

  private extractPotentialLibraryNames(content: string): string[] {
    const potentialLibraries: string[] = [];
    

    
    // Pattern 1: Package.json style names (package-name)
    const packagePattern = /@?[\w-]+\/[a-z][\w-]*(?:\.js)?/gi;
    potentialLibraries.push(...content.match(packagePattern) || []);
    
    // Pattern 2: Capitalized words that could be library names (3+ chars)
    const capitalizedPattern = /\b[A-Z][a-z]{2,}(?:\s+[A-Za-z]+)*\b/g;
    const matches = content.match(capitalizedPattern) || [];
    
    for (const match of matches) {
      // Filter out common words that aren't libraries
      const excludeWords = ['The', 'And', 'For', 'With', 'Using', 'Based', 
                           'This', 'That', 'These', 'Those', 'From', 'Into'];
      
      if (!excludeWords.includes(match) && match.length > 3) {
        potentialLibraries.push(match.trim());
      }
    }

    // Pattern 3: Handlebars-like templates ({{library-name}})
    const templatePattern = /\{\{([^}]+)\}\}/g;
    let match;
    while ((match = templatePattern.exec(content)) !== null) {
      potentialLibraries.push(match[1].trim());
    }

    return [...new Set(potentialLibraries)];
  }

  private categorizeLibrary(libraryName: string): LibraryMatch['category'] {
    const nameLower = libraryName.toLowerCase();
    
    for (const [category, patterns] of Object.entries(LIBRARY_PATTERNS)) {
      if (patterns.some(pattern => nameLower.includes(pattern.toLowerCase()))) {
        return category as LibraryMatch['category'];
      }
    }

    // Handle common variations
    for (const [baseName, variations] of Object.entries(COMMON_LIBRARY_VARIATIONS)) {
      if (variations.some(variation => nameLower.includes(variation.toLowerCase()))) {
        return this.categorizeLibrary(baseName);
      }
    }

    // Default categorization based on name patterns
    if (nameLower.includes('test') || nameLower.includes('spec')) return 'testing';
    if (nameLower.includes('auth') || nameLower.includes('login')) return 'auth'; 
    if (nameLower.includes('build') || nameLower.includes('deploy')) return 'build-tools';
    if (nameLower.includes('db') || nameLower.includes('sql')) return 'database';

    return 'other';
  }

  private deduplicateLibraryMentions(mentions: Array<{name: string, category: LibraryMatch['category'], confidence: number}>): 
    Array<{name: string, category: LibraryMatch['category'], confidence: number}> {
    
    const uniqueMap = new Map<string, typeof mentions[0]>();
    
    for (const mention of mentions) {
      const key = `${mention.name.toLowerCase()}-${mention.category}`;
      
      if (uniqueMap.has(key)) {
        // Merge by taking the higher confidence
        const existing = uniqueMap.get(key)!;
        if (mention.confidence > existing.confidence) {
          uniqueMap.set(key, mention);
        }
      } else {
        uniqueMap.set(key, mention);
      }
    }

    return Array.from(uniqueMap.values());
  }
}


