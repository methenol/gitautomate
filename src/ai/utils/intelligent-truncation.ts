'use server';

/**
 * @fileOverview Intelligent truncation functions with content-aware processing
 * Preserves structure, keywords, code blocks, and list items
 */

export interface TruncationResult {
  truncatedText: string;
  originalLength: number;
  truncatedLength: number;
  preservedElements: string[];
  strategy: TruncationStrategy;
}

export type TruncationStrategy = 'aggressive' | 'conservative' | 'balanced';

export interface TruncationOptions {
  maxLength: number;
  strategy?: TruncationStrategy;
  preserveCodeBlocks?: boolean;
  preserveListItems?: boolean;
  preserveHeaders?: boolean;
  keywordsToPreserve?: string[];
}

export class IntelligentTruncation {
  
  /**
   * Content-aware truncation preserving structure and important elements
   */
  static truncateWithStructure(
    text: string, 
    options: TruncationOptions
  ): TruncationResult {
    const {
      maxLength,
      strategy = 'balanced',
      preserveCodeBlocks = true,
      preserveListItems = true,
      preserveHeaders = true,
      keywordsToPreserve = []
    } = options;

    if (text.length <= maxLength) {
      return {
        truncatedText: text,
        originalLength: text.length,
        truncatedLength: text.length,
        preservedElements: [],
        strategy
      };
    }

    const preservedElements: string[] = [];
    let workingText = text;

    // Extract and preserve code blocks
    const codeBlocks: string[] = [];
    if (preserveCodeBlocks) {
      workingText = workingText.replace(/```[\s\S]*?```/g, (match) => {
        codeBlocks.push(match);
        preservedElements.push('code block');
        return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
      });
    }

    // Extract and preserve headers
    const headers: string[] = [];
    if (preserveHeaders) {
      workingText = workingText.replace(/^#{1,6}\s+.*/gm, (match) => {
        headers.push(match);
        preservedElements.push('header');
        return `__HEADER_${headers.length - 1}__`;
      });
    }

    // Extract and preserve list items
    const listItems: string[] = [];
    if (preserveListItems) {
      workingText = workingText.replace(/^[\s]*[-*+]\s+.*/gm, (match) => {
        listItems.push(match);
        preservedElements.push('list item');
        return `__LIST_ITEM_${listItems.length - 1}__`;
      });
    }

    // Apply truncation strategy
    let truncatedContent = this.applyTruncationStrategy(workingText, maxLength, strategy, keywordsToPreserve);

    // Restore preserved elements
    codeBlocks.forEach((block, index) => {
      truncatedContent = truncatedContent.replace(`__CODE_BLOCK_${index}__`, block);
    });
    
    headers.forEach((header, index) => {
      truncatedContent = truncatedContent.replace(`__HEADER_${index}__`, header);
    });
    
    listItems.forEach((item, index) => {
      truncatedContent = truncatedContent.replace(`__LIST_ITEM_${index}__`, item);
    });

    return {
      truncatedText: truncatedContent,
      originalLength: text.length,
      truncatedLength: truncatedContent.length,
      preservedElements,
      strategy
    };
  }

  /**
   * Specialized truncation for task descriptions
   */
  static truncateTaskDescription(description: string, maxLength: number): TruncationResult {
    const keywords = [
      'implement', 'create', 'build', 'configure', 'setup', 'test',
      'api', 'database', 'component', 'service', 'function', 'class',
      'requirement', 'dependency', 'integration', 'validation'
    ];

    return this.truncateWithStructure(description, {
      maxLength,
      strategy: 'balanced',
      preserveCodeBlocks: true,
      preserveListItems: true,
      keywordsToPreserve: keywords
    });
  }

  /**
   * Specialized truncation for specifications preserving technical details
   */
  static truncateSpecifications(specifications: string, maxLength: number): TruncationResult {
    const technicalKeywords = [
      'specification', 'requirement', 'constraint', 'interface', 'protocol',
      'format', 'schema', 'validation', 'authentication', 'authorization',
      'performance', 'security', 'scalability', 'availability'
    ];

    return this.truncateWithStructure(specifications, {
      maxLength,
      strategy: 'conservative', // More conservative for specs
      preserveCodeBlocks: true,
      preserveListItems: true,
      preserveHeaders: true,
      keywordsToPreserve: technicalKeywords
    });
  }

  /**
   * Apply specific truncation strategy
   */
  private static applyTruncationStrategy(
    text: string,
    maxLength: number,
    strategy: TruncationStrategy,
    keywordsToPreserve: string[]
  ): string {
    if (text.length <= maxLength) return text;

    switch (strategy) {
      case 'aggressive':
        return this.aggressiveTruncation(text, maxLength, keywordsToPreserve);
      case 'conservative':
        return this.conservativeTruncation(text, maxLength, keywordsToPreserve);
      case 'balanced':
      default:
        return this.balancedTruncation(text, maxLength, keywordsToPreserve);
    }
  }

  /**
   * Aggressive truncation - prioritizes brevity
   */
  private static aggressiveTruncation(
    text: string,
    maxLength: number,
    keywordsToPreserve: string[]
  ): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const importantSentences: string[] = [];
    let currentLength = 0;

    // Score and sort sentences by importance
    const scoredSentences = sentences.map(sentence => ({
      sentence: sentence.trim(),
      score: this.calculateSentenceScore(sentence, keywordsToPreserve)
    }));

    scoredSentences.sort((a, b) => b.score - a.score);

    // Take highest scoring sentences that fit
    for (const item of scoredSentences) {
      if (currentLength + item.sentence.length + 2 <= maxLength) {
        importantSentences.push(item.sentence);
        currentLength += item.sentence.length + 2; // +2 for '. '
      }
    }

    return importantSentences.join('. ') + (importantSentences.length > 0 ? '.' : '');
  }

  /**
   * Conservative truncation - preserves more context
   */
  private static conservativeTruncation(
    text: string,
    maxLength: number,
    keywordsToPreserve: string[]
  ): string {
    // Try to preserve paragraphs and sentence structure
    const paragraphs = text.split('\n\n');
    let result = '';
    
    for (const paragraph of paragraphs) {
      if (result.length + paragraph.length <= maxLength) {
        result += (result ? '\n\n' : '') + paragraph;
      } else {
        // Truncate within the paragraph if there's still space
        const remainingSpace = maxLength - result.length - 2; // -2 for '\n\n'
        if (remainingSpace > 50) {
          const truncatedParagraph = this.truncateAtWordBoundary(paragraph, remainingSpace);
          result += (result ? '\n\n' : '') + truncatedParagraph;
        }
        break;
      }
    }

    return result;
  }

  /**
   * Balanced truncation - compromise between brevity and context
   */
  private static balancedTruncation(
    text: string,
    maxLength: number,
    keywordsToPreserve: string[]
  ): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length <= 2) {
      return this.truncateAtWordBoundary(text, maxLength);
    }

    // Keep first sentence, last sentence, and fill middle with most important
    const firstSentence = sentences[0].trim();
    const lastSentence = sentences[sentences.length - 1].trim();
    const middleSentences = sentences.slice(1, -1);

    let result = firstSentence;
    let remainingLength = maxLength - firstSentence.length - lastSentence.length - 4; // -4 for '. ... .'

    if (remainingLength > 0 && middleSentences.length > 0) {
      const scoredMiddle = middleSentences.map(sentence => ({
        sentence: sentence.trim(),
        score: this.calculateSentenceScore(sentence, keywordsToPreserve)
      }));

      scoredMiddle.sort((a, b) => b.score - a.score);

      for (const item of scoredMiddle) {
        if (remainingLength >= item.sentence.length + 2) {
          result += '. ' + item.sentence;
          remainingLength -= item.sentence.length + 2;
        }
      }

      if (scoredMiddle.length > 1 && remainingLength < 50) {
        result += '. ...';
      }
    }

    result += '. ' + lastSentence;
    return result + '.';
  }

  /**
   * Calculate importance score for a sentence
   */
  private static calculateSentenceScore(sentence: string, keywordsToPreserve: string[]): number {
    let score = 0;
    const lowerSentence = sentence.toLowerCase();

    // Score based on keywords
    keywordsToPreserve.forEach(keyword => {
      if (lowerSentence.includes(keyword.toLowerCase())) {
        score += 3;
      }
    });

    // Score based on sentence characteristics
    if (lowerSentence.includes('must') || lowerSentence.includes('required')) score += 2;
    if (lowerSentence.includes('should') || lowerSentence.includes('will')) score += 1;
    if (lowerSentence.includes('can') || lowerSentence.includes('may')) score += 0.5;

    // Penalize very short or very long sentences
    if (sentence.length < 20) score -= 1;
    if (sentence.length > 150) score -= 0.5;

    return score;
  }

  /**
   * Truncate at word boundary to avoid cutting words
   */
  private static truncateAtWordBoundary(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    } else {
      return truncated + '...';
    }
  }
}