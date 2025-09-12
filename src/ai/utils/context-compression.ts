'use server';

/**
 * @fileOverview Context compression utilities for managing large project contexts in AI prompts
 * Provides intelligent truncation, summarization, and chunking strategies to optimize token usage
 */

import { UnifiedProjectContext, ValidationResult, EnhancedTask } from '@/types/unified-context';

export interface ContextCompressionOptions {
  maxTokens?: number;
  preserveKeywords?: string[];
  prioritizeRecent?: boolean;
  focusAreas?: ('architecture' | 'tasks' | 'dependencies' | 'specifications')[];
}

export interface CompressedContext {
  prd: string;
  architecture: string;
  specifications: string;
  fileStructure: string;
  tasks: string;
  validationIssues: string;
  compressionRatio: number;
  tokensSaved: number;
}

/**
 * Intelligently compress project context while preserving critical information
 */
export class ContextCompressor {
  
  /**
   * Compress full project context for analysis
   */
  static compressForAnalysis(
    context: UnifiedProjectContext,
    validationResults: ValidationResult[],
    options: ContextCompressionOptions = {}
  ): CompressedContext {
    const { maxTokens = 4000, focusAreas = ['architecture', 'tasks', 'dependencies'] } = options;
    
    // Estimate current token usage (rough approximation: 1 token ≈ 4 characters)
    const currentSize = this.estimateTokens(context);
    const targetSize = Math.min(maxTokens, currentSize);
    
    const compressionRatio = targetSize / currentSize;
    const includesDependencies = focusAreas.includes('dependencies');
    
    return {
      prd: this.compressDocument(context.prd, Math.floor(targetSize * 0.15), 'prd'),
      architecture: this.compressDocument(context.architecture, Math.floor(targetSize * 0.25), 'architecture'),
      specifications: this.compressDocument(context.specifications, Math.floor(targetSize * 0.15), 'specifications'),
      fileStructure: this.compressFileStructure(context.fileStructure, Math.floor(targetSize * 0.10)),
      tasks: this.compressTasksIntelligently(context.tasks, Math.floor(targetSize * 0.25), includesDependencies),
      validationIssues: this.compressValidationResults(validationResults, Math.floor(targetSize * 0.10)),
      compressionRatio,
      tokensSaved: Math.max(0, currentSize - targetSize)
    };
  }

  /**
   * Estimate token count for text (rough approximation)
   */
  private static estimateTokens(context: UnifiedProjectContext): number {
    const text = context.prd + context.architecture + context.specifications + 
                 context.fileStructure + context.tasks.map(t => t.title + t.details).join(' ');
    return Math.ceil(text.length / 4);
  }

  /**
   * Intelligently compress a document while preserving key information
   */
  private static compressDocument(document: string, maxTokens: number, type: 'prd' | 'architecture' | 'specifications'): string {
    if (!document) return '';
    
    const maxChars = maxTokens * 4;
    if (document.length <= maxChars) return document;
    
    const sentences = document.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Priority keywords for different document types
    const priorityKeywords = {
      prd: ['requirement', 'user', 'feature', 'must', 'should', 'goal', 'objective', 'critical'],
      architecture: ['component', 'service', 'database', 'api', 'security', 'scalability', 'pattern', 'layer'],
      specifications: ['interface', 'endpoint', 'schema', 'validation', 'format', 'protocol', 'standard']
    };
    
    const keywords = priorityKeywords[type] || [];
    
    // Score sentences by importance
    const scoredSentences = sentences.map(sentence => {
      let score = sentence.length; // Base score by length
      
      // Boost score for sentences containing priority keywords
      keywords.forEach(keyword => {
        if (sentence.toLowerCase().includes(keyword)) {
          score += 100;
        }
      });
      
      // Boost score for sentences with technical details
      if (sentence.includes(':') || sentence.includes('->') || sentence.includes('=>')) {
        score += 50;
      }
      
      return { sentence: sentence.trim(), score };
    });
    
    // Sort by score (highest first) and take top sentences that fit
    scoredSentences.sort((a, b) => b.score - a.score);
    
    let compressed = '';
    let currentLength = 0;
    
    for (const item of scoredSentences) {
      if (currentLength + item.sentence.length + 2 <= maxChars) {
        compressed += item.sentence + '. ';
        currentLength += item.sentence.length + 2;
      } else {
        break;
      }
    }
    
    return compressed.trim() + (compressed.length < document.length ? '\n[...content compressed...]' : '');
  }

  /**
   * Compress file structure focusing on key directories and files
   */
  private static compressFileStructure(fileStructure: string, maxTokens: number): string {
    if (!fileStructure) return '';
    
    const maxChars = maxTokens * 4;
    if (fileStructure.length <= maxChars) return fileStructure;
    
    const lines = fileStructure.split('\n');
    const importantPatterns = [
      /src\//, /app\//, /components\//, /pages\//, /api\//, /lib\//, /utils\//, /types\//, 
      /\.ts$/, /\.tsx$/, /\.js$/, /\.jsx$/, /\.json$/, /package\.json/, /tsconfig/, /README/
    ];
    
    // Prioritize important files and directories
    const prioritizedLines = lines.filter(line => 
      importantPatterns.some(pattern => pattern.test(line))
    );
    
    let compressed = prioritizedLines.join('\n');
    
    if (compressed.length > maxChars) {
      compressed = compressed.substring(0, maxChars - 30) + '\n[...structure truncated...]';
    }
    
    return compressed;
  }

  /**
   * Intelligently compress tasks while preserving critical dependencies
   */
  private static compressTasksIntelligently(tasks: EnhancedTask[], maxTokens: number, includeDependencies: boolean): string {
    if (!tasks.length) return 'No tasks defined';
    
    const maxChars = maxTokens * 4;
    
    // Sort tasks by priority (dependency count + order)
    const prioritizedTasks = [...tasks].sort((a, b) => {
      const scoreA = (a.dependencies?.length || 0) * 10 + (100 - a.order);
      const scoreB = (b.dependencies?.length || 0) * 10 + (100 - b.order);
      return scoreB - scoreA;
    });
    
    let compressed = '';
    let currentLength = 0;
    
    for (const task of prioritizedTasks) {
      const taskSummary = this.compressTask(task, includeDependencies);
      
      if (currentLength + taskSummary.length + 2 <= maxChars) {
        compressed += taskSummary + '\n\n';
        currentLength += taskSummary.length + 2;
      } else {
        // Try to fit a minimal version
        const minimalTask = `${task.id}: ${task.title.substring(0, 30)}...`;
        if (currentLength + minimalTask.length + 2 <= maxChars) {
          compressed += minimalTask + '\n';
          currentLength += minimalTask.length + 1;
        } else {
          break;
        }
      }
    }
    
    // Count tasks that didn't fit
    const includedTaskIds = new Set(compressed.match(/task-\d+/g) || []);
    const remainingTasks = tasks.length - includedTaskIds.size;
    
    if (remainingTasks > 0) {
      compressed += `\n[...${remainingTasks} additional tasks truncated...]`;
    }
    
    return compressed.trim();
  }

  /**
   * Compress a single task while preserving essential information
   */
  private static compressTask(task: EnhancedTask, includeDependencies: boolean): string {
    const title = task.title.length > 60 ? task.title.substring(0, 60) + '...' : task.title;
    
    // Extract key points from details
    const details = this.extractKeyPoints(task.details, 150);
    
    let result = `${task.id} (${task.order}): ${title}`;
    
    if (includeDependencies && task.dependencies?.length > 0) {
      result += `\nDeps: [${task.dependencies.slice(0, 3).join(', ')}${task.dependencies.length > 3 ? '...' : ''}]`;
    }
    
    if (details) {
      result += `\nKey: ${details}`;
    }
    
    return result;
  }

  /**
   * Extract key points from task details
   */
  private static extractKeyPoints(details: string, maxLength: number): string {
    if (!details || details.length <= maxLength) return details;
    
    const sentences = details.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Look for sentences with technical keywords or specific actions
    const keywordPatterns = [
      /implement|create|build|develop|design|configure/i,
      /api|endpoint|database|component|service/i,
      /test|validate|verify|ensure/i,
      /integrate|connect|setup|install/i
    ];
    
    const keySentences = sentences.filter(sentence =>
      keywordPatterns.some(pattern => pattern.test(sentence))
    );
    
    if (keySentences.length > 0) {
      let result = keySentences[0].trim();
      if (result.length > maxLength) {
        result = result.substring(0, maxLength - 3) + '...';
      }
      return result;
    }
    
    // Fallback to first sentence
    const firstSentence = sentences[0]?.trim();
    return firstSentence && firstSentence.length > maxLength 
      ? firstSentence.substring(0, maxLength - 3) + '...'
      : firstSentence || '';
  }

  /**
   * Compress validation results focusing on critical issues
   */
  private static compressValidationResults(results: ValidationResult[], maxTokens: number): string {
    if (!results.length) return 'No validation issues found';
    
    const maxChars = maxTokens * 4;
    
    // Prioritize by severity
    const prioritized = [...results].sort((a, b) => {
      const severityOrder = { error: 3, warning: 2, info: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
    
    let compressed = '';
    let currentLength = 0;
    
    for (const result of prioritized) {
      const issueText = `${result.severity.toUpperCase()}: ${result.issues.join('; ')}`;
      
      if (currentLength + issueText.length + 1 <= maxChars) {
        compressed += issueText + '\n';
        currentLength += issueText.length + 1;
      } else {
        compressed += `[...${prioritized.length - prioritized.indexOf(result)} more issues...]`;
        break;
      }
    }
    
    return compressed.trim();
  }

  /**
   * Create focused context chunks for hierarchical analysis
   */
  static createFocusedChunks(
    context: UnifiedProjectContext,
    validationResults: ValidationResult[],
    chunkType: 'architecture' | 'tasks' | 'dependencies' | 'cross-validation'
  ): CompressedContext {
    
    const baseOptions: ContextCompressionOptions = {
      maxTokens: 3000,
      focusAreas: ['architecture', 'tasks', 'dependencies'] // Default focus areas
    };
    
    switch (chunkType) {
      case 'architecture':
        return this.compressForAnalysis(context, validationResults, {
          ...baseOptions,
          maxTokens: 3500,
          focusAreas: ['architecture', 'specifications']
        });
        
      case 'tasks':
        return this.compressForAnalysis(context, validationResults, {
          ...baseOptions,
          maxTokens: 4000,
          focusAreas: ['tasks']
        });
        
      case 'dependencies':
        return this.compressForAnalysis(context, validationResults, {
          ...baseOptions,
          maxTokens: 3000,
          focusAreas: ['dependencies', 'tasks']
        });
        
      case 'cross-validation':
        return this.compressForAnalysis(context, validationResults, {
          ...baseOptions,
          maxTokens: 2500,
          focusAreas: ['architecture', 'tasks', 'dependencies']
        });
        
      default:
        return this.compressForAnalysis(context, validationResults, baseOptions);
    }
  }
}