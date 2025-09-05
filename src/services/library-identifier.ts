import type { IdentifiedLibrary } from '@/types/documentation';
import { extractLibraries, type ExtractLibrariesInput } from '@/ai/flows/extract-libraries';

export class LibraryIdentifier {
  /**
   * Identifies libraries mentioned in task details and titles using AI-powered analysis
   * Falls back to pattern extraction if AI analysis fails
   */
  static async identifyLibraries(
    tasks: Array<{ id: string; title: string; details: string }>,
    options: {
      useAI?: boolean;
      apiKey?: string;
      model?: string;
      apiBase?: string;
      fallbackToPatterns?: boolean;
    } = {}
  ): Promise<IdentifiedLibrary[]> {
    const { 
      useAI = true, 
      apiKey, 
      model, 
      apiBase, 
      fallbackToPatterns = true 
    } = options;

    let aiResults: IdentifiedLibrary[] = [];
    let patternResults: IdentifiedLibrary[] = [];

    // Try AI-based extraction first if enabled
    if (useAI && model) {
      try {
        console.log('🤖 Using AI-powered library extraction...');
        const aiOutput = await extractLibraries({ tasks }, apiKey, model, apiBase);
        
        aiResults = aiOutput.libraries.map(lib => ({
          name: lib.name,
          confidenceScore: lib.confidence,
          category: lib.category as IdentifiedLibrary['category'],
          detectedIn: lib.taskIds,
          source: 'ai' as const,
          context: lib.context,
        }));

        console.log(`✅ AI extracted ${aiResults.length} libraries`);
      } catch (error) {
        console.warn('❌ AI library extraction failed:', error);
        if (!fallbackToPatterns) {
          throw error;
        }
      }
    }

    // Use pattern extraction if AI failed or as fallback/supplement
    if (aiResults.length === 0 || fallbackToPatterns) {
      console.log('🔍 Using pattern-based library extraction...');
      patternResults = this.extractLibrariesByPattern(tasks);
      console.log(`✅ Pattern extraction found ${patternResults.length} libraries`);
    }

    // Merge results, prioritizing AI results but supplementing with patterns
    const mergedResults = this.mergeLibraryResults(aiResults, patternResults);
    
    console.log(`📚 Total libraries identified: ${mergedResults.length}`);
    return mergedResults;
  }

  /**
   * Extract libraries from text using pattern matching (without hardcoded library lists)
   * This method looks for patterns that indicate library usage and extracts the library names
   */
  private static extractLibrariesByPattern(tasks: Array<{ id: string; title: string; details: string }>): IdentifiedLibrary[] {
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

    // Sort by confidence score descending
    return Array.from(identified.values())
      .sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  /**
   * Extract library names from text using various patterns
   */
  private static extractLibraryNamesFromText(text: string): Array<{ name: string; confidence: number; context: string }> {
    const libraries: Array<{ name: string; confidence: number; context: string }> = [];
    
    // Pattern 1: Import/require statements
    const importPatterns = [
      /import\s+.*?from\s+['"`]([^'"`]+)['"`]/gi,
      /import\s+['"`]([^'"`]+)['"`]/gi,
      /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gi,
      /from\s+['"`]([^'"`]+)['"`]/gi,
    ];
    
    for (const pattern of importPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const libName = this.cleanLibraryName(match[1]);
        if (libName && this.isValidLibraryName(libName)) {
          libraries.push({
            name: libName,
            confidence: 0.8,
            context: `Import statement: ${match[0]}`
          });
        }
      }
    }

    // Pattern 2: Package manager commands
    const packagePatterns = [
      /npm\s+install\s+([a-zA-Z0-9@\-_./]+)/gi,
      /yarn\s+add\s+([a-zA-Z0-9@\-_./]+)/gi,
      /pip\s+install\s+([a-zA-Z0-9@\-_.]+)/gi,
      /composer\s+require\s+([a-zA-Z0-9@\-_./]+)/gi,
      /dotnet\s+add\s+package\s+([a-zA-Z0-9@\-_.]+)/gi,
    ];

    for (const pattern of packagePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const libName = this.cleanLibraryName(match[1]);
        if (libName && this.isValidLibraryName(libName)) {
          libraries.push({
            name: libName,
            confidence: 0.9,
            context: `Package manager: ${match[0]}`
          });
        }
      }
    }

    // Pattern 3: Framework/library mentions in context
    const contextPatterns = [
      /(?:use|using|with|setup|configure|implement|install)\s+([a-zA-Z][a-zA-Z0-9\-_.]{2,})/gi,
      /(?:based on|built with|powered by)\s+([a-zA-Z][a-zA-Z0-9\-_.]{2,})/gi,
      /([a-zA-Z][a-zA-Z0-9\-_.]{2,})\s+(?:framework|library|package|module)/gi,
    ];

    for (const pattern of contextPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const libName = this.cleanLibraryName(match[1]);
        if (libName && this.isValidLibraryName(libName)) {
          libraries.push({
            name: libName,
            confidence: 0.6,
            context: `Context mention: ${match[0]}`
          });
        }
      }
    }

    // Pattern 4: Common technology keywords
    const techKeywords = [
      /\b(react|vue|angular|svelte|next\.?js|nuxt\.?js|gatsby|remix)\b/gi,
      /\b(express|fastapi|django|flask|spring|laravel|rails)\b/gi,
      /\b(postgresql|mysql|mongodb|redis|elasticsearch)\b/gi,
      /\b(jest|cypress|playwright|selenium|mocha|chai)\b/gi,
      /\b(docker|kubernetes|terraform|ansible)\b/gi,
      /\b(typescript|javascript|python|java|rust|go)\b/gi,
    ];

    for (const pattern of techKeywords) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const libName = this.cleanLibraryName(match[1]);
        if (libName && this.isValidLibraryName(libName)) {
          libraries.push({
            name: libName,
            confidence: 0.7,
            context: `Technology keyword: ${match[0]}`
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
   * Clean and normalize library names
   */
  private static cleanLibraryName(name: string): string {
    // Remove quotes, whitespace, and normalize
    return name.replace(/['"`]/g, '').trim().toLowerCase();
  }

  /**
   * Check if a string looks like a valid library name
   */
  private static isValidLibraryName(name: string): boolean {
    // Basic validation: should be alphanumeric with allowed special chars, reasonable length
    return /^[a-zA-Z][a-zA-Z0-9@\-_.]{1,50}$/.test(name) && 
           !['the', 'and', 'for', 'with', 'from', 'this', 'that', 'will', 'can', 'should'].includes(name);
  }

  /**
   * Guess category based on library name and context
   */
  private static guessCategory(name: string, context?: string): IdentifiedLibrary['category'] {
    const lowerName = name.toLowerCase();
    const lowerContext = context?.toLowerCase() || '';
    
    // Frontend indicators
    if (lowerName.includes('react') || lowerName.includes('vue') || lowerName.includes('angular') ||
        lowerName.includes('svelte') || lowerName.includes('next') || lowerName.includes('nuxt') ||
        lowerContext.includes('frontend') || lowerContext.includes('ui') || lowerContext.includes('component')) {
      return 'frontend';
    }
    
    // Backend indicators
    if (lowerName.includes('express') || lowerName.includes('fastapi') || lowerName.includes('django') ||
        lowerName.includes('spring') || lowerName.includes('server') ||
        lowerContext.includes('backend') || lowerContext.includes('api') || lowerContext.includes('server')) {
      return 'backend';
    }
    
    // Database indicators
    if (lowerName.includes('sql') || lowerName.includes('mongo') || lowerName.includes('redis') ||
        lowerName.includes('db') || lowerContext.includes('database') || lowerContext.includes('storage')) {
      return 'database';
    }
    
    // Testing indicators
    if (lowerName.includes('test') || lowerName.includes('jest') || lowerName.includes('cypress') ||
        lowerName.includes('playwright') || lowerContext.includes('test') || lowerContext.includes('spec')) {
      return 'testing';
    }
    
    // DevOps indicators
    if (lowerName.includes('docker') || lowerName.includes('kubernetes') || lowerName.includes('terraform') ||
        lowerContext.includes('deploy') || lowerContext.includes('infrastructure') || lowerContext.includes('ci')) {
      return 'devops';
    }
    
    // Mobile indicators
    if (lowerName.includes('react-native') || lowerName.includes('flutter') || lowerName.includes('ionic') ||
        lowerContext.includes('mobile') || lowerContext.includes('android') || lowerContext.includes('ios')) {
      return 'mobile';
    }
    
    // ML indicators
    if (lowerName.includes('tensorflow') || lowerName.includes('pytorch') || lowerName.includes('sklearn') ||
        lowerContext.includes('machine learning') || lowerContext.includes('ai') || lowerContext.includes('ml')) {
      return 'ml';
    }
    
    // Default to utility
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
    const { minConfidence = 0.5, categories, maxCount = 20 } = options;
    
    let filtered = libraries.filter(lib => lib.confidenceScore >= minConfidence);
    
    if (categories && categories.length > 0) {
      filtered = filtered.filter(lib => categories.includes(lib.category));
    }
    
    return filtered.slice(0, maxCount);
  }

  /**
   * Merge AI and pattern-based results, removing duplicates and combining confidence scores
   */
  private static mergeLibraryResults(
    aiResults: IdentifiedLibrary[],
    patternResults: IdentifiedLibrary[]
  ): IdentifiedLibrary[] {
    const merged = new Map<string, IdentifiedLibrary>();

    // Add AI results first (higher priority)
    for (const library of aiResults) {
      merged.set(library.name.toLowerCase(), {
        ...library,
        source: 'ai' as const,
      });
    }

    // Add pattern results, merging with AI results where they exist
    for (const library of patternResults) {
      const key = library.name.toLowerCase();
      
      if (merged.has(key)) {
        const existing = merged.get(key)!;
        // Combine confidence scores (weighted average)
        existing.confidenceScore = (existing.confidenceScore * 0.7) + (library.confidenceScore * 0.3);
        // Merge detected tasks
        existing.detectedIn = [...new Set([...existing.detectedIn, ...library.detectedIn])];
        existing.source = 'combined' as const;
      } else {
        merged.set(key, {
          ...library,
          source: 'pattern' as const,
        });
      }
    }

    // Sort by confidence score descending
    return Array.from(merged.values())
      .sort((a, b) => b.confidenceScore - a.confidenceScore);
  }
}