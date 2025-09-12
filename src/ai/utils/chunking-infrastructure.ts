/**
 * @fileOverview Advanced chunking infrastructure with semantic awareness
 * Part of Sprint 2: Context Management Foundation
 */

import { UnifiedProjectContext } from '@/types/unified-context';

export interface ChunkingOptions {
  maxChunkSize: number;
  overlapPercentage: number; // 0.1 = 10% overlap
  chunkingStrategy: 'semantic' | 'sliding-window' | 'dependency-aware' | 'hybrid';
  preserveBoundaries: boolean;
  semanticSeparators: string[];
}

export interface ProjectChunk {
  id: string;
  content: string;
  type: 'prd' | 'architecture' | 'tasks' | 'dependencies' | 'specifications' | 'mixed';
  metadata: {
    originalSection: string;
    chunkIndex: number;
    totalChunks: number;
    dependencies: string[];
    keywords: string[];
    importance: number;
  };
  overlapWith: string[]; // IDs of overlapping chunks
}

export interface ChunkingResult {
  chunks: ProjectChunk[];
  chunkingMetadata: {
    strategy: string;
    totalChunks: number;
    averageChunkSize: number;
    overlapRatio: number;
    processingOrder: string[];
  };
}

/**
 * Semantic chunking with sliding windows, dependency-aware grouping, and 10-20% overlap
 */
export class ChunkingInfrastructure {
  private static readonly DEFAULT_OPTIONS: ChunkingOptions = {
    maxChunkSize: 3000,
    overlapPercentage: 0.15, // 15% overlap
    chunkingStrategy: 'hybrid',
    preserveBoundaries: true,
    semanticSeparators: ['\n\n', '\n---\n', '\n###', '\n##', '\n#'],
  };

  /**
   * Chunk project context with intelligent semantic awareness
   */
  static chunkProjectContext(context: UnifiedProjectContext, options: Partial<ChunkingOptions> = {}): ChunkingResult {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const chunks: ProjectChunk[] = [];

    // Chunk each major section
    const prdChunks = this.chunkPRD(context.prd, opts);
    const archChunks = this.chunkArchitecture(context.architecture, opts);
    const specChunks = this.chunkSpecifications(context.specifications, opts);
    const taskChunks = this.chunkTasks(context.tasks, opts);

    // Combine all chunks
    chunks.push(...prdChunks, ...archChunks, ...specChunks, ...taskChunks);

    // Add dependency-aware grouping if requested
    if (opts.chunkingStrategy === 'dependency-aware' || opts.chunkingStrategy === 'hybrid') {
      this.addDependencyAwareGrouping(chunks, context.dependencyGraph);
    }

    // Calculate overlap relationships
    this.calculateOverlapRelationships(chunks, opts);

    // Determine processing order
    const processingOrder = this.determineProcessingOrder(chunks);

    return {
      chunks,
      chunkingMetadata: {
        strategy: opts.chunkingStrategy,
        totalChunks: chunks.length,
        averageChunkSize: chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length,
        overlapRatio: this.calculateOverallOverlapRatio(chunks),
        processingOrder,
      },
    };
  }

  /**
   * Chunk PRD with semantic awareness for requirements and features
   */
  private static chunkPRD(prd: string, options: ChunkingOptions): ProjectChunk[] {
    if (!prd || prd.length === 0) return [];

    const chunks: ProjectChunk[] = [];
    const sections = this.splitBySemanticBoundaries(prd, options.semanticSeparators);

    let chunkIndex = 0;
    let currentChunk = '';
    let currentKeywords: string[] = [];

    for (const section of sections) {
      const sectionKeywords = this.extractKeywords(section, 'prd');
      
      // Check if adding this section would exceed chunk size
      if (currentChunk.length + section.length > options.maxChunkSize && currentChunk.length > 0) {
        // Create chunk from current content
        chunks.push(this.createChunk(
          `prd-${chunkIndex}`,
          currentChunk,
          'prd',
          'PRD Section',
          chunkIndex,
          sections.length,
          [],
          currentKeywords
        ));
        
        // Start new chunk with overlap
        const overlapContent = this.createOverlapContent(currentChunk, options.overlapPercentage);
        currentChunk = overlapContent + '\n\n' + section;
        currentKeywords = [...sectionKeywords];
        chunkIndex++;
      } else {
        // Add to current chunk
        currentChunk += (currentChunk ? '\n\n' : '') + section;
        currentKeywords.push(...sectionKeywords);
      }
    }

    // Add final chunk if there's remaining content
    if (currentChunk.length > 0) {
      chunks.push(this.createChunk(
        `prd-${chunkIndex}`,
        currentChunk,
        'prd',
        'PRD Section',
        chunkIndex,
        chunkIndex + 1,
        [],
        currentKeywords
      ));
    }

    return chunks;
  }

  /**
   * Chunk architecture with focus on technical decisions and interfaces
   */
  private static chunkArchitecture(architecture: string, options: ChunkingOptions): ProjectChunk[] {
    if (!architecture || architecture.length === 0) return [];

    const chunks: ProjectChunk[] = [];
    const sections = this.splitBySemanticBoundaries(architecture, options.semanticSeparators);

    let chunkIndex = 0;
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const keywords = this.extractKeywords(section, 'architecture');
      
      // For architecture, we want to preserve complete technical decisions
      let chunkContent = section;
      
      // Add context from adjacent sections if they fit
      const prevSection = i > 0 ? sections[i - 1] : '';
      const nextSection = i < sections.length - 1 ? sections[i + 1] : '';
      
      const overlapPrev = this.createOverlapContent(prevSection, options.overlapPercentage / 2);
      const overlapNext = this.createOverlapContent(nextSection, options.overlapPercentage / 2);
      
      if (overlapPrev && (chunkContent.length + overlapPrev.length) <= options.maxChunkSize) {
        chunkContent = overlapPrev + '\n\n---\n\n' + chunkContent;
      }
      
      if (overlapNext && (chunkContent.length + overlapNext.length) <= options.maxChunkSize) {
        chunkContent = chunkContent + '\n\n---\n\n' + overlapNext;
      }

      chunks.push(this.createChunk(
        `arch-${chunkIndex}`,
        chunkContent,
        'architecture',
        'Architecture Section',
        chunkIndex,
        sections.length,
        [],
        keywords
      ));
      
      chunkIndex++;
    }

    return chunks;
  }

  /**
   * Chunk specifications with technical detail preservation
   */
  private static chunkSpecifications(specifications: string, options: ChunkingOptions): ProjectChunk[] {
    if (!specifications || specifications.length === 0) return [];

    const chunks: ProjectChunk[] = [];
    
    // Split specifications by technical boundaries (APIs, models, etc.)
    const techBoundaries = [
      /(?=\n## API)/gi,
      /(?=\n## Model)/gi,
      /(?=\n## Interface)/gi,
      /(?=\n## Component)/gi,
      /(?=\n## Service)/gi,
    ];

    let sections = [specifications];
    for (const boundary of techBoundaries) {
      const newSections: string[] = [];
      for (const section of sections) {
        newSections.push(...section.split(boundary));
      }
      sections = newSections.filter(s => s.trim().length > 0);
    }

    let chunkIndex = 0;
    for (const section of sections) {
      if (section.length <= options.maxChunkSize) {
        const keywords = this.extractKeywords(section, 'specifications');
        chunks.push(this.createChunk(
          `spec-${chunkIndex}`,
          section,
          'specifications',
          'Specifications Section',
          chunkIndex,
          sections.length,
          [],
          keywords
        ));
        chunkIndex++;
      } else {
        // Large section needs further chunking
        const subChunks = this.chunkLargeSection(section, options, `spec-${chunkIndex}`, 'specifications');
        chunks.push(...subChunks);
        chunkIndex += subChunks.length;
      }
    }

    return chunks;
  }

  /**
   * Chunk tasks with dependency awareness
   */
  private static chunkTasks(tasks: any[], options: ChunkingOptions): ProjectChunk[] {
    if (!tasks || tasks.length === 0) return [];

    const chunks: ProjectChunk[] = [];
    
    // Group tasks by dependencies and related functionality
    const taskGroups = this.groupTasksByDependencies(tasks);
    
    let chunkIndex = 0;
    for (const group of taskGroups) {
      const groupContent = JSON.stringify(group.tasks, null, 2);
      const keywords = group.tasks.flatMap(task => this.extractKeywords(task.title + ' ' + (task.description || ''), 'tasks'));
      
      if (groupContent.length <= options.maxChunkSize) {
        chunks.push(this.createChunk(
          `tasks-${chunkIndex}`,
          groupContent,
          'tasks',
          'Task Group',
          chunkIndex,
          taskGroups.length,
          group.dependencies,
          keywords
        ));
        chunkIndex++;
      } else {
        // Split large task group
        const subGroups = this.splitTaskGroup(group.tasks, options.maxChunkSize);
        for (const subGroup of subGroups) {
          const subContent = JSON.stringify(subGroup, null, 2);
          const subKeywords = subGroup.flatMap(task => this.extractKeywords(task.title + ' ' + (task.description || ''), 'tasks'));
          
          chunks.push(this.createChunk(
            `tasks-${chunkIndex}`,
            subContent,
            'tasks',
            'Task Subgroup',
            chunkIndex,
            taskGroups.length + subGroups.length,
            group.dependencies,
            subKeywords
          ));
          chunkIndex++;
        }
      }
    }

    return chunks;
  }

  /**
   * Split content by semantic boundaries
   */
  private static splitBySemanticBoundaries(content: string, separators: string[]): string[] {
    let sections = [content];
    
    for (const separator of separators) {
      const newSections: string[] = [];
      for (const section of sections) {
        newSections.push(...section.split(separator));
      }
      sections = newSections.filter(s => s.trim().length > 0);
    }

    return sections;
  }

  /**
   * Extract keywords based on content type
   */
  private static extractKeywords(content: string, type: string): string[] {
    const keywords: string[] = [];
    const lower = content.toLowerCase();

    // Common technical keywords
    const techKeywords = ['api', 'interface', 'component', 'service', 'model', 'database', 'endpoint'];
    const reqKeywords = ['must', 'shall', 'required', 'should', 'may', 'optional'];
    const archKeywords = ['pattern', 'architecture', 'design', 'framework', 'library', 'technology'];

    const allKeywords = [...techKeywords, ...reqKeywords, ...archKeywords];
    
    for (const keyword of allKeywords) {
      if (lower.includes(keyword)) {
        keywords.push(keyword);
      }
    }

    // Extract custom keywords (capitalized words, technical terms)
    const customMatches = content.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)*\b/g) || [];
    keywords.push(...customMatches.slice(0, 10)); // Limit to 10 custom keywords

    return [...new Set(keywords)]; // Remove duplicates
  }

  /**
   * Create overlap content from existing content
   */
  private static createOverlapContent(content: string, overlapRatio: number): string {
    if (!content || overlapRatio <= 0) return '';

    const targetLength = Math.floor(content.length * overlapRatio);
    if (targetLength <= 0) return '';

    // Try to break at sentence boundaries for better context
    const sentences = content.split(/[.!?]+/);
    let overlap = '';
    
    for (let i = Math.max(0, sentences.length - 3); i < sentences.length && overlap.length < targetLength; i++) {
      const sentence = sentences[i]?.trim();
      if (sentence && overlap.length + sentence.length <= targetLength * 1.2) {
        overlap += (overlap ? '. ' : '') + sentence;
      }
    }

    return overlap + (overlap && !overlap.endsWith('.') ? '.' : '');
  }

  /**
   * Group tasks by dependencies
   */
  private static groupTasksByDependencies(tasks: any[]): Array<{ tasks: any[]; dependencies: string[] }> {
    const groups: Array<{ tasks: any[]; dependencies: string[] }> = [];
    const processed = new Set<string>();

    for (const task of tasks) {
      if (processed.has(task.id)) continue;

      const group = { tasks: [task], dependencies: task.dependencies || [] };
      processed.add(task.id);

      // Find related tasks
      for (const otherTask of tasks) {
        if (processed.has(otherTask.id)) continue;

        const isRelated = this.areTasksRelated(task, otherTask);
        if (isRelated) {
          group.tasks.push(otherTask);
          group.dependencies.push(...(otherTask.dependencies || []));
          processed.add(otherTask.id);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  /**
   * Check if tasks are related by dependencies or similar functionality
   */
  private static areTasksRelated(task1: any, task2: any): boolean {
    // Check direct dependencies
    if (task1.dependencies?.includes(task2.id) || task2.dependencies?.includes(task1.id)) {
      return true;
    }

    // Check similar keywords or categories
    const title1 = (task1.title || '').toLowerCase();
    const title2 = (task2.title || '').toLowerCase();
    
    const keywords1 = title1.split(/\W+/);
    const keywords2 = title2.split(/\W+/);
    
    const commonKeywords = keywords1.filter(k => keywords2.includes(k) && k.length > 3);
    return commonKeywords.length >= 2; // At least 2 common significant keywords
  }

  /**
   * Split large task group into smaller chunks
   */
  private static splitTaskGroup(tasks: any[], maxSize: number): any[][] {
    const subGroups: any[][] = [];
    let currentGroup: any[] = [];
    let currentSize = 0;

    for (const task of tasks) {
      const taskSize = JSON.stringify(task).length;
      
      if (currentSize + taskSize > maxSize && currentGroup.length > 0) {
        subGroups.push(currentGroup);
        currentGroup = [task];
        currentSize = taskSize;
      } else {
        currentGroup.push(task);
        currentSize += taskSize;
      }
    }

    if (currentGroup.length > 0) {
      subGroups.push(currentGroup);
    }

    return subGroups;
  }

  /**
   * Chunk large section that exceeds max size
   */
  private static chunkLargeSection(section: string, options: ChunkingOptions, baseId: string, type: string): ProjectChunk[] {
    const chunks: ProjectChunk[] = [];
    const sentences = section.split(/[.!?]+/);
    
    let chunkIndex = 0;
    let currentChunk = '';
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i]?.trim();
      if (!sentence) continue;
      
      if (currentChunk.length + sentence.length > options.maxChunkSize && currentChunk.length > 0) {
        // Create chunk
        const keywords = this.extractKeywords(currentChunk, type);
        chunks.push(this.createChunk(
          `${baseId}-sub-${chunkIndex}`,
          currentChunk,
          type as any,
          'Large Section Chunk',
          chunkIndex,
          Math.ceil(sentences.length / 10), // Estimate
          [],
          keywords
        ));

        // Start new chunk with overlap
        const overlapContent = this.createOverlapContent(currentChunk, options.overlapPercentage);
        currentChunk = overlapContent + (overlapContent ? '. ' : '') + sentence;
        chunkIndex++;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence;
      }
    }

    // Add final chunk
    if (currentChunk.length > 0) {
      const keywords = this.extractKeywords(currentChunk, type);
      chunks.push(this.createChunk(
        `${baseId}-sub-${chunkIndex}`,
        currentChunk,
        type as any,
        'Large Section Chunk',
        chunkIndex,
        chunkIndex + 1,
        [],
        keywords
      ));
    }

    return chunks;
  }

  /**
   * Create a project chunk with metadata
   */
  private static createChunk(
    id: string,
    content: string,
    type: ProjectChunk['type'],
    originalSection: string,
    chunkIndex: number,
    totalChunks: number,
    dependencies: string[],
    keywords: string[]
  ): ProjectChunk {
    return {
      id,
      content: content.trim(),
      type,
      metadata: {
        originalSection,
        chunkIndex,
        totalChunks,
        dependencies: [...new Set(dependencies)],
        keywords: [...new Set(keywords)],
        importance: this.calculateChunkImportance(content, keywords, dependencies),
      },
      overlapWith: [], // Will be calculated later
    };
  }

  /**
   * Calculate importance score for a chunk
   */
  private static calculateChunkImportance(content: string, keywords: string[], dependencies: string[]): number {
    let score = 0;
    const lower = content.toLowerCase();

    // Keyword importance
    score += keywords.length * 0.5;

    // Dependency importance
    score += dependencies.length * 1.0;

    // Content indicators
    if (lower.includes('must') || lower.includes('required')) score += 3;
    if (lower.includes('critical') || lower.includes('important')) score += 2;
    if (lower.includes('api') || lower.includes('interface')) score += 2;
    if (lower.includes('architecture') || lower.includes('design')) score += 1.5;

    return Math.min(10, score); // Cap at 10
  }

  /**
   * Add dependency-aware grouping information to chunks
   */
  private static addDependencyAwareGrouping(chunks: ProjectChunk[], dependencyGraph: any[]): void {
    // Add cross-chunk dependency relationships
    for (const chunk of chunks) {
      for (const dep of chunk.metadata.dependencies) {
        const relatedChunks = chunks.filter(c => 
          c.id !== chunk.id && 
          (c.metadata.keywords.some(k => dep.toLowerCase().includes(k.toLowerCase())) ||
           c.content.toLowerCase().includes(dep.toLowerCase()))
        );
        
        chunk.overlapWith.push(...relatedChunks.map(c => c.id));
      }
    }
  }

  /**
   * Calculate overlap relationships between chunks
   */
  private static calculateOverlapRelationships(chunks: ProjectChunk[], options: ChunkingOptions): void {
    for (let i = 0; i < chunks.length; i++) {
      for (let j = i + 1; j < chunks.length; j++) {
        const chunk1 = chunks[i];
        const chunk2 = chunks[j];
        
        // Check for keyword overlap
        const commonKeywords = chunk1.metadata.keywords.filter(k => 
          chunk2.metadata.keywords.includes(k)
        );
        
        if (commonKeywords.length >= 2) {
          if (!chunk1.overlapWith.includes(chunk2.id)) {
            chunk1.overlapWith.push(chunk2.id);
          }
          if (!chunk2.overlapWith.includes(chunk1.id)) {
            chunk2.overlapWith.push(chunk1.id);
          }
        }
      }
    }
  }

  /**
   * Determine optimal processing order for chunks
   */
  private static determineProcessingOrder(chunks: ProjectChunk[]): string[] {
    // Sort by importance and type priority
    const typePriority = { prd: 1, architecture: 2, specifications: 3, dependencies: 4, tasks: 5, mixed: 6 };
    
    const sortedChunks = [...chunks].sort((a, b) => {
      const typeDiff = typePriority[a.type] - typePriority[b.type];
      if (typeDiff !== 0) return typeDiff;
      
      return b.metadata.importance - a.metadata.importance;
    });

    return sortedChunks.map(chunk => chunk.id);
  }

  /**
   * Calculate overall overlap ratio for metadata
   */
  private static calculateOverallOverlapRatio(chunks: ProjectChunk[]): number {
    if (chunks.length === 0) return 0;
    
    const totalOverlaps = chunks.reduce((sum, chunk) => sum + chunk.overlapWith.length, 0);
    const maxPossibleOverlaps = chunks.length * (chunks.length - 1);
    
    return maxPossibleOverlaps > 0 ? totalOverlaps / maxPossibleOverlaps : 0;
  }
}