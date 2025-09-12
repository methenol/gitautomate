/**
 * @fileOverview Intelligent truncation functions that preserve meaning and structure
 * Part of Sprint 2: Context Management Foundation
 */

export interface TruncationOptions {
  maxLength: number;
  preserveCodeBlocks: boolean;
  preserveListItems: boolean;
  preserveKeywords: string[];
  truncationStrategy: 'aggressive' | 'conservative' | 'balanced';
}

export interface TruncationResult {
  truncatedText: string;
  originalLength: number;
  truncatedLength: number;
  preservedElements: string[];
  truncatedElements: string[];
  truncationRatio: number;
}

/**
 * Content-aware truncation that preserves structure, keywords, code blocks, and list items
 */
export class IntelligentTruncation {
  private static readonly DEFAULT_OPTIONS: TruncationOptions = {
    maxLength: 2000,
    preserveCodeBlocks: true,
    preserveListItems: true,
    preserveKeywords: ['must', 'required', 'shall', 'critical', 'important', 'interface', 'api'],
    truncationStrategy: 'balanced',
  };

  /**
   * Intelligently truncate text while preserving critical structure and meaning
   */
  static truncateWithStructure(text: string, options: Partial<TruncationOptions> = {}): TruncationResult {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const originalLength = text.length;

    if (originalLength <= opts.maxLength) {
      return {
        truncatedText: text,
        originalLength,
        truncatedLength: originalLength,
        preservedElements: ['Full text preserved'],
        truncatedElements: [],
        truncationRatio: 1.0,
      };
    }

    const preservedElements: string[] = [];
    const truncatedElements: string[] = [];
    
    // Extract and preserve critical elements first
    const { preservedContent, remainingContent } = this.extractCriticalContent(text, opts, preservedElements);
    
    // Calculate remaining budget after preserving critical content
    const remainingBudget = opts.maxLength - preservedContent.length;
    
    if (remainingBudget <= 0) {
      // Critical content exceeds budget, truncate even critical content
      const criticalTruncated = this.truncateCriticalContent(preservedContent, opts.maxLength);
      return {
        truncatedText: criticalTruncated,
        originalLength,
        truncatedLength: criticalTruncated.length,
        preservedElements: ['Partially preserved critical content'],
        truncatedElements: ['Critical content was truncated due to size constraints'],
        truncationRatio: criticalTruncated.length / originalLength,
      };
    }

    // Intelligently select from remaining content
    const selectedContent = this.selectContentIntelligently(remainingContent, remainingBudget, opts, truncatedElements);
    
    // Combine preserved and selected content
    const finalText = this.combineContent(preservedContent, selectedContent);
    const truncatedLength = finalText.length;

    return {
      truncatedText: finalText,
      originalLength,
      truncatedLength,
      preservedElements,
      truncatedElements,
      truncationRatio: truncatedLength / originalLength,
    };
  }

  /**
   * Truncate task descriptions while preserving acceptance criteria and dependencies
   */
  static truncateTaskDescription(description: string, maxLength: number = 500): TruncationResult {
    const options: TruncationOptions = {
      maxLength,
      preserveCodeBlocks: true,
      preserveListItems: true,
      preserveKeywords: ['acceptance criteria', 'dependencies', 'requirements', 'must', 'should'],
      truncationStrategy: 'conservative',
    };

    return this.truncateWithStructure(description, options);
  }

  /**
   * Truncate specifications while preserving technical details
   */
  static truncateSpecifications(specs: string, maxLength: number = 1500): TruncationResult {
    const options: TruncationOptions = {
      maxLength,
      preserveCodeBlocks: true,
      preserveListItems: true,
      preserveKeywords: ['interface', 'api', 'endpoint', 'schema', 'model', 'database', 'framework'],
      truncationStrategy: 'balanced',
    };

    return this.truncateWithStructure(specs, options);
  }

  /**
   * Extract critical content that must be preserved
   */
  private static extractCriticalContent(
    text: string, 
    options: TruncationOptions, 
    preservedElements: string[]
  ): { preservedContent: string; remainingContent: string } {
    let preservedContent = '';
    let remainingContent = text;

    // Preserve code blocks
    if (options.preserveCodeBlocks) {
      const codeBlockRegex = /```[\s\S]*?```/g;
      const codeBlocks = text.match(codeBlockRegex) || [];
      
      codeBlocks.forEach(block => {
        preservedContent += block + '\n\n';
        remainingContent = remainingContent.replace(block, '');
        preservedElements.push(`Code block: ${block.substring(0, 50)}...`);
      });
    }

    // Preserve list items
    if (options.preserveListItems) {
      const listItemRegex = /^\s*[-*+]\s+.+$/gm;
      const listItems = remainingContent.match(listItemRegex) || [];
      
      listItems.forEach(item => {
        preservedContent += item + '\n';
        remainingContent = remainingContent.replace(item, '');
        preservedElements.push(`List item: ${item.substring(0, 50)}...`);
      });
    }

    // Preserve sentences with keywords
    const sentences = remainingContent.split(/[.!?]+/);
    const keywordSentences: string[] = [];
    
    sentences.forEach(sentence => {
      const lowerSentence = sentence.toLowerCase();
      const hasKeyword = options.preserveKeywords.some(keyword => 
        lowerSentence.includes(keyword.toLowerCase())
      );
      
      if (hasKeyword && sentence.trim().length > 0) {
        keywordSentences.push(sentence.trim());
        preservedElements.push(`Keyword sentence: ${sentence.substring(0, 50)}...`);
      }
    });

    preservedContent += keywordSentences.join('. ') + (keywordSentences.length > 0 ? '.' : '');
    
    // Remove preserved sentences from remaining content
    keywordSentences.forEach(sentence => {
      remainingContent = remainingContent.replace(sentence, '');
    });

    return { preservedContent: preservedContent.trim(), remainingContent: remainingContent.trim() };
  }

  /**
   * Intelligently select content from remaining text based on strategy
   */
  private static selectContentIntelligently(
    content: string, 
    budget: number, 
    options: TruncationOptions,
    truncatedElements: string[]
  ): string {
    if (content.length <= budget) return content;

    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    switch (options.truncationStrategy) {
      case 'aggressive':
        return this.selectAggressively(sentences, budget, truncatedElements);
      
      case 'conservative':
        return this.selectConservatively(sentences, budget, truncatedElements);
      
      case 'balanced':
      default:
        return this.selectBalanced(sentences, budget, truncatedElements);
    }
  }

  /**
   * Aggressive selection: prioritize shorter, high-value sentences
   */
  private static selectAggressively(sentences: string[], budget: number, truncatedElements: string[]): string {
    // Sort by value density (importance indicators per character)
    const scoredSentences = sentences.map(sentence => {
      const importance = this.calculateImportanceScore(sentence);
      const density = importance / sentence.length;
      return { sentence: sentence.trim(), score: density, length: sentence.length };
    });

    scoredSentences.sort((a, b) => b.score - a.score);

    let selected = '';
    for (const item of scoredSentences) {
      if ((selected + item.sentence).length <= budget - 10) {
        selected += (selected ? '. ' : '') + item.sentence;
      } else {
        truncatedElements.push(`Aggressive truncation: ${item.sentence.substring(0, 50)}...`);
      }
    }

    return selected;
  }

  /**
   * Conservative selection: preserve sentence order, take from beginning
   */
  private static selectConservatively(sentences: string[], budget: number, truncatedElements: string[]): string {
    let selected = '';
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if ((selected + sentence).length <= budget - 10) {
        selected += (selected ? '. ' : '') + sentence;
      } else {
        // Record all remaining sentences as truncated
        for (let j = i; j < sentences.length; j++) {
          truncatedElements.push(`Conservative truncation: ${sentences[j].substring(0, 50)}...`);
        }
        break;
      }
    }
    return selected;
  }

  /**
   * Balanced selection: mix of importance and order preservation
   */
  private static selectBalanced(sentences: string[], budget: number, truncatedElements: string[]): string {
    // Score sentences by importance and position
    const scoredSentences = sentences.map((sentence, index) => {
      const importance = this.calculateImportanceScore(sentence);
      const positionBonus = Math.max(0, 1 - (index / sentences.length)) * 0.5; // Earlier sentences get bonus
      return { 
        sentence: sentence.trim(), 
        score: importance + positionBonus, 
        originalIndex: index,
        length: sentence.length 
      };
    });

    // Sort by score but maintain some order preference
    scoredSentences.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (Math.abs(scoreDiff) < 0.1) {
        return a.originalIndex - b.originalIndex; // Maintain order for similar scores
      }
      return scoreDiff;
    });

    let selected = '';
    for (const item of scoredSentences) {
      if ((selected + item.sentence).length <= budget - 10) {
        selected += (selected ? '. ' : '') + item.sentence;
      } else {
        truncatedElements.push(`Balanced truncation: ${item.sentence.substring(0, 50)}...`);
      }
    }

    return selected;
  }

  /**
   * Calculate importance score for a sentence
   */
  private static calculateImportanceScore(sentence: string): number {
    const lower = sentence.toLowerCase();
    let score = 0;

    // High importance indicators
    if (lower.includes('must') || lower.includes('required') || lower.includes('shall')) score += 3;
    if (lower.includes('important') || lower.includes('critical') || lower.includes('essential')) score += 2.5;
    if (lower.includes('should') || lower.includes('recommended') || lower.includes('preferred')) score += 1.5;
    
    // Technical terms
    if (lower.includes('api') || lower.includes('interface') || lower.includes('endpoint')) score += 2;
    if (lower.includes('database') || lower.includes('schema') || lower.includes('model')) score += 1.5;
    if (lower.includes('framework') || lower.includes('library') || lower.includes('component')) score += 1;

    // Structural indicators
    if (lower.includes('because') || lower.includes('therefore') || lower.includes('however')) score += 1;
    if (lower.includes('first') || lower.includes('second') || lower.includes('finally')) score += 0.5;

    // Penalties for low-value content
    if (lower.includes('for example') || lower.includes('such as') || lower.includes('etc')) score -= 0.5;
    if (lower.includes('note:') || lower.includes('reminder:')) score -= 1;

    return Math.max(0, score);
  }

  /**
   * Truncate even critical content when it exceeds budget
   */
  private static truncateCriticalContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;

    // Try to break at sentence boundaries
    const sentences = content.split(/[.!?]+/);
    let result = '';
    
    for (const sentence of sentences) {
      const addition = sentence.trim() + '. ';
      if ((result + addition).length <= maxLength - 10) {
        result += addition;
      } else {
        break;
      }
    }

    // If no complete sentences fit, truncate at word boundaries
    if (result.length < maxLength * 0.1) {
      const words = content.split(' ');
      result = '';
      for (const word of words) {
        if ((result + word + ' ').length <= maxLength - 3) {
          result += word + ' ';
        } else {
          break;
        }
      }
      result += '...';
    }

    return result.trim();
  }

  /**
   * Combine preserved and selected content intelligently
   */
  private static combineContent(preserved: string, selected: string): string {
    if (!preserved && !selected) return '';
    if (!preserved) return selected;
    if (!selected) return preserved;

    // Ensure proper spacing and formatting
    let combined = preserved.trim();
    if (!combined.endsWith('.') && !combined.endsWith('!') && !combined.endsWith('?')) {
      combined += '.';
    }
    
    combined += '\n\n' + selected.trim();
    
    return combined;
  }
}