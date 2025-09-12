/**
 * @fileOverview Context compression utilities for intelligent information preservation
 * Part of Sprint 2: Context Management Foundation
 */

import { UnifiedProjectContext } from '@/types/unified-context';

export interface CompressionOptions {
  targetCompressionRatio: number; // 0.4 = 40% of original size
  preserveCodeBlocks: boolean;
  preserveKeyRequirements: boolean;
  preserveTechnicalDecisions: boolean;
  preserveInterfaces: boolean;
}

export interface CompressionResult {
  compressedText: string;
  originalLength: number;
  compressedLength: number;
  compressionRatio: number;
  preservedElements: string[];
  removedElements: string[];
}

/**
 * Intelligent context compression utilities that maintain critical information
 * while reducing token usage by 40-60%
 */
export class ContextCompressionUtils {
  private static readonly DEFAULT_OPTIONS: CompressionOptions = {
    targetCompressionRatio: 0.5, // 50% compression
    preserveCodeBlocks: true,
    preserveKeyRequirements: true,
    preserveTechnicalDecisions: true,
    preserveInterfaces: true,
  };

  /**
   * Compress PRD while preserving key requirements and technical decisions
   */
  static compressPRD(prd: string, options: Partial<CompressionOptions> = {}): CompressionResult {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const originalLength = prd.length;
    
    let compressed = prd;
    const preservedElements: string[] = [];
    const removedElements: string[] = [];

    // Extract and preserve key requirements
    if (opts.preserveKeyRequirements) {
      const reqPatterns = [
        /(?:must|shall|required|mandatory)[\s\S]*?(?:\.|$)/gi,
        /(?:functional requirement|non-functional requirement)[\s\S]*?(?:\n\n|$)/gi,
        /(?:acceptance criteria)[\s\S]*?(?:\n\n|$)/gi,
      ];
      
      reqPatterns.forEach(pattern => {
        const matches = compressed.match(pattern) || [];
        matches.forEach(match => preservedElements.push(`Requirement: ${match.substring(0, 100)}...`));
      });
    }

    // Remove redundant explanatory text
    compressed = compressed.replace(/(?:for example|such as|including but not limited to)[\s\S]*?(?:\.|$)/gi, '');
    compressed = compressed.replace(/(?:note:|important:|please note)[\s\S]*?(?:\n|$)/gi, '');
    
    // Compress repetitive sections
    compressed = this.compressRepetitiveSections(compressed, removedElements);
    
    // Remove excessive whitespace
    compressed = compressed.replace(/\n{3,}/g, '\n\n');
    compressed = compressed.replace(/\s{2,}/g, ' ');

    const compressedLength = compressed.length;
    const compressionRatio = compressedLength / originalLength;

    return {
      compressedText: compressed.trim(),
      originalLength,
      compressedLength,
      compressionRatio,
      preservedElements,
      removedElements,
    };
  }

  /**
   * Compress architecture documentation while preserving technical decisions
   */
  static compressArchitecture(architecture: string, options: Partial<CompressionOptions> = {}): CompressionResult {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const originalLength = architecture.length;
    
    let compressed = architecture;
    const preservedElements: string[] = [];
    const removedElements: string[] = [];

    // Preserve technical decisions and interfaces
    if (opts.preserveTechnicalDecisions) {
      const techPatterns = [
        /(?:technology stack|framework|library|database)[\s\S]*?(?:\n\n|$)/gi,
        /(?:api|interface|contract)[\s\S]*?(?:\n\n|$)/gi,
        /(?:architecture decision|design pattern)[\s\S]*?(?:\n\n|$)/gi,
      ];
      
      techPatterns.forEach(pattern => {
        const matches = compressed.match(pattern) || [];
        matches.forEach(match => preservedElements.push(`Tech Decision: ${match.substring(0, 100)}...`));
      });
    }

    // Preserve code blocks and interfaces
    if (opts.preserveCodeBlocks) {
      const codeBlocks = compressed.match(/```[\s\S]*?```/g) || [];
      codeBlocks.forEach(block => preservedElements.push(`Code Block: ${block.substring(0, 100)}...`));
    }

    // Remove verbose descriptions while keeping core information
    compressed = compressed.replace(/(?:detailed explanation|comprehensive overview)[\s\S]*?(?:\n\n|$)/gi, '');
    compressed = this.compressRepetitiveSections(compressed, removedElements);

    const compressedLength = compressed.length;
    const compressionRatio = compressedLength / originalLength;

    return {
      compressedText: compressed.trim(),
      originalLength,
      compressedLength,
      compressionRatio,
      preservedElements,
      removedElements,
    };
  }

  /**
   * Compress task details while preserving critical dependencies and acceptance criteria
   */
  static compressTaskDetails(tasks: any[], options: Partial<CompressionOptions> = {}): CompressionResult {
    const originalText = JSON.stringify(tasks, null, 2);
    const originalLength = originalText.length;
    
    const preservedElements: string[] = [];
    const removedElements: string[] = [];

    // Compress each task while preserving critical information
    const compressedTasks = tasks.map(task => {
      const compressedTask = { ...task };
      
      // Preserve key fields, compress descriptions
      if (task.description && task.description.length > 200) {
        const original = task.description;
        compressedTask.description = this.summarizeText(original, 200);
        removedElements.push(`Task description truncated: ${original.substring(0, 50)}...`);
      }

      // Preserve acceptance criteria
      if (task.acceptanceCriteria) {
        preservedElements.push(`Acceptance criteria for ${task.title}`);
      }

      // Preserve dependencies
      if (task.dependencies && task.dependencies.length > 0) {
        preservedElements.push(`Dependencies for ${task.title}: ${task.dependencies.join(', ')}`);
      }

      return compressedTask;
    });

    const compressedText = JSON.stringify(compressedTasks, null, 2);
    const compressedLength = compressedText.length;
    const compressionRatio = compressedLength / originalLength;

    return {
      compressedText,
      originalLength,
      compressedLength,
      compressionRatio,
      preservedElements,
      removedElements,
    };
  }

  /**
   * Compress full project context intelligently
   */
  static compressProjectContext(context: UnifiedProjectContext, options: Partial<CompressionOptions> = {}): {
    compressedContext: Partial<UnifiedProjectContext>;
    compressionMetrics: {
      prd: CompressionResult;
      architecture: CompressionResult;
      tasks: CompressionResult;
      overallRatio: number;
    };
  } {
    // Compress individual components
    const prdCompression = this.compressPRD(context.prd, options);
    const archCompression = this.compressArchitecture(context.architecture, options);
    const tasksCompression = this.compressTaskDetails(context.tasks, options);

    // Build compressed context
    const compressedContext: Partial<UnifiedProjectContext> = {
      prd: prdCompression.compressedText,
      architecture: archCompression.compressedText,
      specifications: this.summarizeText(context.specifications, 1000),
      fileStructure: context.fileStructure, // Keep file structure intact
      tasks: JSON.parse(tasksCompression.compressedText),
      dependencyGraph: context.dependencyGraph, // Keep dependencies intact
    };

    // Calculate overall compression ratio
    const originalTotal = prdCompression.originalLength + archCompression.originalLength + tasksCompression.originalLength;
    const compressedTotal = prdCompression.compressedLength + archCompression.compressedLength + tasksCompression.compressedLength;
    const overallRatio = compressedTotal / originalTotal;

    return {
      compressedContext,
      compressionMetrics: {
        prd: prdCompression,
        architecture: archCompression,
        tasks: tasksCompression,
        overallRatio,
      },
    };
  }

  /**
   * Compress repetitive sections while preserving unique information
   */
  private static compressRepetitiveSections(text: string, removedElements: string[]): string {
    // Find and compress repeated phrases
    const sentences = text.split(/[.!?]+/);
    const uniqueSentences = new Set();
    const processedSentences: string[] = [];

    sentences.forEach(sentence => {
      const normalized = sentence.trim().toLowerCase();
      if (normalized.length > 10 && !uniqueSentences.has(normalized)) {
        uniqueSentences.add(normalized);
        processedSentences.push(sentence.trim());
      } else if (normalized.length > 10) {
        removedElements.push(`Duplicate sentence: ${sentence.substring(0, 50)}...`);
      } else {
        processedSentences.push(sentence.trim());
      }
    });

    return processedSentences.join('. ');
  }

  /**
   * Summarize text to target length while preserving key information
   */
  private static summarizeText(text: string, targetLength: number): string {
    if (text.length <= targetLength) return text;

    // Split into sentences and prioritize by importance indicators
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const importantSentences: Array<{ sentence: string; priority: number }> = [];

    sentences.forEach(sentence => {
      let priority = 0;
      const lower = sentence.toLowerCase();

      // Higher priority for sentences with key indicators
      if (lower.includes('must') || lower.includes('required') || lower.includes('shall')) priority += 3;
      if (lower.includes('important') || lower.includes('critical') || lower.includes('essential')) priority += 2;
      if (lower.includes('should') || lower.includes('recommended')) priority += 1;
      if (lower.includes('example') || lower.includes('such as')) priority -= 1;

      importantSentences.push({ sentence: sentence.trim(), priority });
    });

    // Sort by priority and build summary
    importantSentences.sort((a, b) => b.priority - a.priority);
    
    let summary = '';
    for (const item of importantSentences) {
      if ((summary + item.sentence).length <= targetLength - 10) {
        summary += (summary ? '. ' : '') + item.sentence;
      }
    }

    return summary + (summary.length < targetLength - 20 ? '...' : '');
  }
}