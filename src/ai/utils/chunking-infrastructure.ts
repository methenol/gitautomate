'use server';

/**
 * @fileOverview Advanced chunking infrastructure for large project context management
 * Supports semantic chunking, dependency-aware grouping, and multiple strategies
 */

import { UnifiedProjectContext } from '@/types/unified-context';

export interface ProcessingChunk {
  id: string;
  type: ChunkType;
  content: string;
  dependencies: string[];
  relatedTasks: string[];
  importance: number;
  tokenEstimate: number;
  processingOrder: number;
}

export type ChunkType = 'architecture' | 'specifications' | 'tasks' | 'dependencies' | 'hybrid';
export type ChunkingStrategy = 'semantic' | 'sliding-window' | 'dependency-aware' | 'hybrid';

export interface ChunkingOptions {
  strategy: ChunkingStrategy;
  maxTokensPerChunk: number;
  overlapPercentage: number; // 10-20% for context continuity
  prioritizeByImportance: boolean;
  groupByDependencies: boolean;
}

export interface ChunkingResult {
  chunks: ProcessingChunk[];
  processingOrder: string[];
  totalTokens: number;
  strategy: ChunkingStrategy;
  metrics: {
    originalContextSize: number;
    numberOfChunks: number;
    averageChunkSize: number;
    maxChunkSize: number;
    minChunkSize: number;
  };
}

export class ChunkingInfrastructure {
  
  /**
   * Create processing chunks with semantic awareness and 10-20% overlap
   */
  static createProcessingChunks(
    context: UnifiedProjectContext,
    options: ChunkingOptions
  ): ChunkingResult {
    const chunks: ProcessingChunk[] = [];
    
    switch (options.strategy) {
      case 'semantic':
        return this.semanticChunking(context, options);
      case 'sliding-window':
        return this.slidingWindowChunking(context, options);
      case 'dependency-aware':
        return this.dependencyAwareChunking(context, options);
      case 'hybrid':
      default:
        return this.hybridChunking(context, options);
    }
  }

  /**
   * Semantic chunking with natural content boundaries
   */
  private static semanticChunking(
    context: UnifiedProjectContext,
    options: ChunkingOptions
  ): ChunkingResult {
    const chunks: ProcessingChunk[] = [];
    
    // Create architecture chunk
    if (context.architecture && context.architecture.length > 0) {
      chunks.push({
        id: 'arch-001',
        type: 'architecture',
        content: `ARCHITECTURE:\n${context.architecture}\n\nSPECIFICATIONS:\n${context.specifications}`,
        dependencies: [],
        relatedTasks: context.tasks.map(t => t.id),
        importance: 10, // Highest importance
        tokenEstimate: this.estimateTokens(context.architecture + context.specifications),
        processingOrder: 1
      });
    }

    // Group tasks by semantic similarity and dependencies
    const taskGroups = this.groupTasksBySemantic(context.tasks, options.maxTokensPerChunk);
    
    taskGroups.forEach((group, index) => {
      const chunkContent = this.buildTaskChunkContent(group, context);
      
      chunks.push({
        id: `tasks-${String(index + 1).padStart(3, '0')}`,
        type: 'tasks',
        content: chunkContent,
        dependencies: this.extractChunkDependencies(group),
        relatedTasks: group.map(t => t.id),
        importance: this.calculateGroupImportance(group),
        tokenEstimate: this.estimateTokens(chunkContent),
        processingOrder: index + 2 // After architecture
      });
    });

    const processingOrder = this.determineProcessingOrder(chunks, options.prioritizeByImportance);
    
    return this.buildChunkingResult(chunks, processingOrder, options.strategy, context);
  }

  /**
   * Sliding window chunking with overlap for context continuity
   */
  private static slidingWindowChunking(
    context: UnifiedProjectContext,
    options: ChunkingOptions
  ): ChunkingResult {
    const chunks: ProcessingChunk[] = [];
    const allTasks = context.tasks;
    const tasksPerChunk = Math.ceil(options.maxTokensPerChunk / 800); // Estimate ~800 tokens per task
    const overlapSize = Math.ceil(tasksPerChunk * (options.overlapPercentage / 100));
    
    // Create overlapping windows
    for (let i = 0; i < allTasks.length; i += tasksPerChunk - overlapSize) {
      const windowTasks = allTasks.slice(i, i + tasksPerChunk);
      const chunkContent = this.buildTaskChunkContent(windowTasks, context);
      
      chunks.push({
        id: `window-${String(Math.floor(i / (tasksPerChunk - overlapSize)) + 1).padStart(3, '0')}`,
        type: 'tasks',
        content: chunkContent,
        dependencies: this.extractChunkDependencies(windowTasks),
        relatedTasks: windowTasks.map(t => t.id),
        importance: this.calculateGroupImportance(windowTasks),
        tokenEstimate: this.estimateTokens(chunkContent),
        processingOrder: Math.floor(i / (tasksPerChunk - overlapSize)) + 1
      });

      if (i + tasksPerChunk >= allTasks.length) break;
    }

    const processingOrder = chunks.map(c => c.id);
    
    return this.buildChunkingResult(chunks, processingOrder, options.strategy, context);
  }

  /**
   * Dependency-aware chunking grouping related tasks and components
   */
  private static dependencyAwareChunking(
    context: UnifiedProjectContext,
    options: ChunkingOptions
  ): ChunkingResult {
    const chunks: ProcessingChunk[] = [];
    
    // Group tasks by dependency relationships
    const dependencyGroups = this.groupTasksByDependencies(context.tasks);
    
    dependencyGroups.forEach((group, index) => {
      const chunkContent = this.buildTaskChunkContent(group.tasks, context);
      
      chunks.push({
        id: `dep-group-${String(index + 1).padStart(3, '0')}`,
        type: 'dependencies',
        content: chunkContent,
        dependencies: group.externalDependencies,
        relatedTasks: group.tasks.map(t => t.id),
        importance: this.calculateGroupImportance(group.tasks) + group.depth, // Higher depth = higher importance
        tokenEstimate: this.estimateTokens(chunkContent),
        processingOrder: group.depth + 1 // Process in dependency order
      });
    });

    const processingOrder = this.determineProcessingOrder(chunks, true); // Always prioritize by importance for dependencies
    
    return this.buildChunkingResult(chunks, processingOrder, options.strategy, context);
  }

  /**
   * Hybrid chunking combining multiple strategies
   */
  private static hybridChunking(
    context: UnifiedProjectContext,
    options: ChunkingOptions
  ): ChunkingResult {
    const chunks: ProcessingChunk[] = [];
    
    // Start with architecture chunk (semantic approach)
    if (context.architecture && context.architecture.length > 0) {
      chunks.push({
        id: 'hybrid-arch-001',
        type: 'architecture',
        content: `ARCHITECTURE & SPECIFICATIONS:\n${context.architecture}\n\n${context.specifications}`,
        dependencies: [],
        relatedTasks: context.tasks.map(t => t.id),
        importance: 10,
        tokenEstimate: this.estimateTokens(context.architecture + context.specifications),
        processingOrder: 1
      });
    }

    // Group critical tasks by dependencies
    const criticalTasks = context.tasks.filter(t => 
      t.title.toLowerCase().includes('setup') ||
      t.title.toLowerCase().includes('core') ||
      t.title.toLowerCase().includes('base') ||
      t.dependencies.length === 0
    );

    if (criticalTasks.length > 0) {
      const criticalContent = this.buildTaskChunkContent(criticalTasks, context);
      chunks.push({
        id: 'hybrid-critical-002',
        type: 'hybrid',
        content: criticalContent,
        dependencies: [],
        relatedTasks: criticalTasks.map(t => t.id),
        importance: 9,
        tokenEstimate: this.estimateTokens(criticalContent),
        processingOrder: 2
      });
    }

    // Group remaining tasks semantically with overlap
    const remainingTasks = context.tasks.filter(t => !criticalTasks.includes(t));
    const semanticGroups = this.groupTasksBySemantic(remainingTasks, options.maxTokensPerChunk * 0.8);
    
    semanticGroups.forEach((group, index) => {
      const chunkContent = this.buildTaskChunkContent(group, context);
      
      chunks.push({
        id: `hybrid-sem-${String(index + 3).padStart(3, '0')}`,
        type: 'hybrid',
        content: chunkContent,
        dependencies: this.extractChunkDependencies(group),
        relatedTasks: group.map(t => t.id),
        importance: this.calculateGroupImportance(group),
        tokenEstimate: this.estimateTokens(chunkContent),
        processingOrder: index + 3
      });
    });

    const processingOrder = this.determineProcessingOrder(chunks, options.prioritizeByImportance);
    
    return this.buildChunkingResult(chunks, processingOrder, options.strategy, context);
  }

  /**
   * Group tasks by semantic similarity
   */
  private static groupTasksBySemantic(
    tasks: UnifiedProjectContext['tasks'],
    maxTokensPerChunk: number
  ): UnifiedProjectContext['tasks'][] {
    const groups: UnifiedProjectContext['tasks'][] = [];
    const processed = new Set<string>();
    
    for (const task of tasks) {
      if (processed.has(task.id)) continue;
      
      const group = [task];
      processed.add(task.id);
      let currentTokens = this.estimateTokens(task.title + task.details);
      
      // Find semantically similar tasks
      for (const otherTask of tasks) {
        if (processed.has(otherTask.id)) continue;
        
        const taskTokens = this.estimateTokens(otherTask.title + otherTask.details);
        if (currentTokens + taskTokens > maxTokensPerChunk) continue;
        
        if (this.areTasksSemanticallyRelated(task, otherTask)) {
          group.push(otherTask);
          processed.add(otherTask.id);
          currentTokens += taskTokens;
        }
      }
      
      groups.push(group);
    }
    
    return groups;
  }

  /**
   * Group tasks by dependency relationships
   */
  private static groupTasksByDependencies(tasks: UnifiedProjectContext['tasks']): Array<{
    tasks: UnifiedProjectContext['tasks'];
    externalDependencies: string[];
    depth: number;
  }> {
    const groups: Array<{
      tasks: UnifiedProjectContext['tasks'];
      externalDependencies: string[];
      depth: number;
    }> = [];
    
    // Build dependency depth map
    const depthMap = new Map<string, number>();
    const calculateDepth = (taskId: string, visited = new Set<string>()): number => {
      if (visited.has(taskId)) return 0; // Circular dependency
      if (depthMap.has(taskId)) return depthMap.get(taskId)!;
      
      const task = tasks.find(t => t.id === taskId);
      if (!task || task.dependencies.length === 0) {
        depthMap.set(taskId, 0);
        return 0;
      }
      
      visited.add(taskId);
      const maxDepth = Math.max(...task.dependencies.map(dep => calculateDepth(dep, visited)));
      depthMap.set(taskId, maxDepth + 1);
      visited.delete(taskId);
      
      return maxDepth + 1;
    };
    
    tasks.forEach(task => calculateDepth(task.id));
    
    // Group by depth level
    const depthGroups = new Map<number, UnifiedProjectContext['tasks']>();
    tasks.forEach(task => {
      const depth = depthMap.get(task.id) || 0;
      if (!depthGroups.has(depth)) {
        depthGroups.set(depth, []);
      }
      depthGroups.get(depth)!.push(task);
    });
    
    // Convert to final format
    Array.from(depthGroups.entries()).forEach(([depth, groupTasks]) => {
      groups.push({
        tasks: groupTasks,
        externalDependencies: this.extractChunkDependencies(groupTasks),
        depth
      });
    });
    
    return groups.sort((a, b) => a.depth - b.depth);
  }

  /**
   * Check if two tasks are semantically related
   */
  private static areTasksSemanticallyRelated(
    task1: UnifiedProjectContext['tasks'][0],
    task2: UnifiedProjectContext['tasks'][0]
  ): boolean {
    const title1 = task1.title.toLowerCase();
    const title2 = task2.title.toLowerCase();
    
    // Check for common keywords
    const keywords1 = title1.split(/\s+/);
    const keywords2 = title2.split(/\s+/);
    const commonKeywords = keywords1.filter(k => keywords2.includes(k) && k.length > 3);
    
    if (commonKeywords.length >= 2) return true;
    
    // Check for similar domain areas
    const domains = [
      ['api', 'endpoint', 'route', 'service'],
      ['database', 'model', 'schema', 'migration'],
      ['ui', 'component', 'interface', 'frontend'],
      ['test', 'testing', 'validation', 'spec'],
      ['auth', 'authentication', 'login', 'security'],
      ['setup', 'config', 'configuration', 'init']
    ];
    
    for (const domain of domains) {
      const task1InDomain = domain.some(term => title1.includes(term));
      const task2InDomain = domain.some(term => title2.includes(term));
      if (task1InDomain && task2InDomain) return true;
    }
    
    return false;
  }

  /**
   * Build content for a task chunk
   */
  private static buildTaskChunkContent(
    tasks: UnifiedProjectContext['tasks'],
    context: UnifiedProjectContext
  ): string {
    const sections = [
      `CONTEXT FOR ${tasks.length} TASKS:`,
      `PRD: ${context.prd.substring(0, 500)}...`,
      `ARCHITECTURE: ${context.architecture.substring(0, 300)}...`,
      '',
      'TASKS:',
      ...tasks.map(task => 
        `${task.id} (Order: ${task.order}): ${task.title}
Dependencies: [${task.dependencies.join(', ') || 'none'}]
Details: ${task.details || 'No details provided'}`
      )
    ];
    
    return sections.join('\n');
  }

  /**
   * Extract dependencies for a chunk
   */
  private static extractChunkDependencies(tasks: UnifiedProjectContext['tasks']): string[] {
    const taskIds = new Set(tasks.map(t => t.id));
    const externalDeps = new Set<string>();
    
    tasks.forEach(task => {
      task.dependencies.forEach(dep => {
        if (!taskIds.has(dep)) {
          externalDeps.add(dep);
        }
      });
    });
    
    return Array.from(externalDeps);
  }

  /**
   * Calculate importance score for a group of tasks
   */
  private static calculateGroupImportance(tasks: UnifiedProjectContext['tasks']): number {
    let score = 0;
    
    tasks.forEach(task => {
      const title = task.title.toLowerCase();
      
      // Base importance
      if (title.includes('setup') || title.includes('core') || title.includes('base')) score += 3;
      if (title.includes('api') || title.includes('service')) score += 2;
      if (title.includes('test')) score += 1;
      
      // Dependency importance
      score += task.dependencies.length * 0.5;
    });
    
    return Math.max(1, Math.min(10, score / tasks.length));
  }

  /**
   * Determine optimal processing order
   */
  private static determineProcessingOrder(
    chunks: ProcessingChunk[],
    prioritizeByImportance: boolean
  ): string[] {
    if (prioritizeByImportance) {
      return chunks
        .sort((a, b) => b.importance - a.importance || a.processingOrder - b.processingOrder)
        .map(c => c.id);
    } else {
      return chunks
        .sort((a, b) => a.processingOrder - b.processingOrder)
        .map(c => c.id);
    }
  }

  /**
   * Estimate tokens in text (rough approximation)
   */
  private static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4); // Rough estimate: 1 token ≈ 4 characters
  }

  /**
   * Build final chunking result
   */
  private static buildChunkingResult(
    chunks: ProcessingChunk[],
    processingOrder: string[],
    strategy: ChunkingStrategy,
    context: UnifiedProjectContext
  ): ChunkingResult {
    const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokenEstimate, 0);
    const chunkSizes = chunks.map(c => c.tokenEstimate);
    
    return {
      chunks,
      processingOrder,
      totalTokens,
      strategy,
      metrics: {
        originalContextSize: this.estimateTokens(
          context.prd + context.architecture + context.specifications + 
          JSON.stringify(context.tasks)
        ),
        numberOfChunks: chunks.length,
        averageChunkSize: totalTokens / chunks.length,
        maxChunkSize: Math.max(...chunkSizes),
        minChunkSize: Math.min(...chunkSizes)
      }
    };
  }
}