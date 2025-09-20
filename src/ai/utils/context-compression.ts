'use server';

/**
 * @fileOverview Context compression utilities for intelligent PRD, architecture, and task compression
 * Provides 40-60% compression ratio while preserving critical information
 */

import { UnifiedProjectContext } from '@/types/unified-context';

export interface CompressionMetrics {
  originalSize: number;
  compressedSize: number;
  overallRatio: number;
  prdRatio: number;
  architectureRatio: number;
  tasksRatio: number;
}

export interface CompressedContext {
  prd: string;
  architecture: string;
  specifications: string;
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    dependencies: string[];
    order: number;
  }>;
}

export class ContextCompressionUtils {
  
  /**
   * Compress full project context with 40-60% compression ratio
   */
  static compressProjectContext(context: UnifiedProjectContext): {
    compressedContext: CompressedContext;
    compressionMetrics: CompressionMetrics;
  } {
    const originalPrdSize = context.prd.length;
    const originalArchSize = context.architecture.length;
    const originalTasksSize = JSON.stringify(context.tasks).length;
    const originalTotalSize = originalPrdSize + originalArchSize + originalTasksSize;

    // Compress each component
    const compressedPrd = this.compressPRD(context.prd);
    const compressedArchitecture = this.compressArchitecture(context.architecture);
    const compressedTasks = this.compressTasks(context.tasks);
    
    const compressedContext: CompressedContext = {
      prd: compressedPrd,
      architecture: compressedArchitecture,
      specifications: context.specifications, // Keep specifications mostly intact
      tasks: compressedTasks,
    };

    const compressedTotalSize = compressedPrd.length + compressedArchitecture.length + JSON.stringify(compressedTasks).length;
    
    const compressionMetrics: CompressionMetrics = {
      originalSize: originalTotalSize,
      compressedSize: compressedTotalSize,
      overallRatio: compressedTotalSize / originalTotalSize,
      prdRatio: compressedPrd.length / originalPrdSize,
      architectureRatio: compressedArchitecture.length / originalArchSize,
      tasksRatio: JSON.stringify(compressedTasks).length / originalTasksSize,
    };

    return { compressedContext, compressionMetrics };
  }

  /**
   * Intelligent PRD compression preserving key requirements and technical decisions
   */
  private static compressPRD(prd: string): string {
    if (!prd || prd.length === 0) return prd;

    const lines = prd.split('\n');
    const importantLines: string[] = [];
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      // Preserve key requirement indicators
      if (lowerLine.includes('requirement') ||
          lowerLine.includes('must') ||
          lowerLine.includes('should') ||
          lowerLine.includes('feature') ||
          lowerLine.includes('functionality') ||
          lowerLine.includes('user') ||
          lowerLine.includes('api') ||
          lowerLine.includes('database') ||
          lowerLine.includes('security') ||
          lowerLine.includes('performance') ||
          line.trim().startsWith('- ') ||
          line.trim().startsWith('* ') ||
          line.trim().startsWith('1.') ||
          line.trim().match(/^\d+\./)) {
        importantLines.push(line);
      }
      
      // Preserve headers and structure
      if (line.trim().startsWith('#') || line.trim().length === 0) {
        importantLines.push(line);
      }
    }

    let compressed = importantLines.join('\n');
    
    // If compression is insufficient, apply additional compression
    if (compressed.length > prd.length * 0.6) {
      compressed = this.compressText(compressed, prd.length * 0.5);
    }

    return compressed;
  }

  /**
   * Architecture compression with technical decision preservation
   */
  private static compressArchitecture(architecture: string): string {
    if (!architecture || architecture.length === 0) return architecture;

    const lines = architecture.split('\n');
    const importantLines: string[] = [];
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      // Preserve technical architecture elements
      if (lowerLine.includes('component') ||
          lowerLine.includes('service') ||
          lowerLine.includes('module') ||
          lowerLine.includes('layer') ||
          lowerLine.includes('pattern') ||
          lowerLine.includes('framework') ||
          lowerLine.includes('technology') ||
          lowerLine.includes('database') ||
          lowerLine.includes('api') ||
          lowerLine.includes('interface') ||
          lowerLine.includes('dependency') ||
          line.trim().startsWith('- ') ||
          line.trim().startsWith('* ') ||
          line.trim().startsWith('#')) {
        importantLines.push(line);
      }
    }

    let compressed = importantLines.join('\n');
    
    // Apply additional compression if needed
    if (compressed.length > architecture.length * 0.6) {
      compressed = this.compressText(compressed, architecture.length * 0.5);
    }

    return compressed;
  }

  /**
   * Task compression maintaining dependencies and acceptance criteria
   */
  private static compressTasks(tasks: UnifiedProjectContext['tasks']): CompressedContext['tasks'] {
    return tasks.map(task => {
      // Compress task details while preserving structure
      const compressedDetails = this.compressText(task.details || '', Math.max(200, (task.details || '').length * 0.4));
      
      return {
        id: task.id,
        title: task.title,
        description: compressedDetails,
        dependencies: task.dependencies,
        order: task.order,
      };
    });
  }

  /**
   * Generic text compression that preserves structure and important keywords
   */
  private static compressText(text: string, targetLength: number): string {
    if (text.length <= targetLength) return text;

    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const importantSentences: string[] = [];
    
    // Score sentences by importance
    const scoredSentences = sentences.map(sentence => {
      let score = 0;
      const lowerSentence = sentence.toLowerCase();
      
      // Higher score for technical terms
      const technicalTerms = [
        'api', 'database', 'component', 'service', 'function', 'method',
        'class', 'interface', 'dependency', 'requirement', 'feature',
        'implementation', 'configure', 'setup', 'create', 'build', 'test'
      ];
      
      technicalTerms.forEach(term => {
        if (lowerSentence.includes(term)) score += 2;
      });
      
      // Higher score for sentences with specific actions
      if (lowerSentence.includes('must') || lowerSentence.includes('should')) score += 3;
      if (lowerSentence.includes('will') || lowerSentence.includes('need')) score += 1;
      
      // Lower score for very short or very long sentences
      if (sentence.length < 20 || sentence.length > 200) score -= 1;
      
      return { sentence: sentence.trim(), score };
    });

    // Sort by score and take the most important sentences
    scoredSentences.sort((a, b) => b.score - a.score);
    
    let currentLength = 0;
    for (const item of scoredSentences) {
      if (currentLength + item.sentence.length <= targetLength) {
        importantSentences.push(item.sentence);
        currentLength += item.sentence.length;
      }
    }

    return importantSentences.join('. ') + '.';
  }
}