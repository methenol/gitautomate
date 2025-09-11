

/**
 * @fileOverview Context compression utilities to manage token usage in iterative refinement
 */

import { UnifiedProjectContext } from '@/types/unified-context';

/**
 * Compress text by removing redundant information while preserving key content
 */
export function compressText(text: string, maxLength: number, preserveKeyContent: boolean = true): string {
  if (text.length <= maxLength) {
    return text;
  }

  // If we should preserve key content, try to find and keep important parts
  if (preserveKeyContent) {
    // Look for code blocks, technical specifications, or important lists
    const codeBlocks = text.match(/```[\s\S]*?```/g) || [];
    // Split text into paragraphs and filter those containing technical keywords
    const technicalKeywords = ['architecture', 'component', 'service', 'api', 'endpoint', 'database'];
    const paragraphs = text.split(/\n{2,}/);
    const technicalContent = paragraphs.filter(p =>
      technicalKeywords.some(keyword => new RegExp(`\\b${keyword}\\b`, 'i').test(p))
    );
    
    // Combine important content
    const importantContent = [...codeBlocks, ...technicalContent].join('\n\n');
    
    if (importantContent.length > 0 && importantContent.length < maxLength) {
      return importantContent;
    }
    
    // If important content is too long, truncate it but keep structure
    if (importantContent.length > 0) {
      return importantContent.substring(0, maxLength - 3) + '...';
    }
  }

  // Fallback to intelligent truncation
  return smartTruncate(text, maxLength);
}

/**
 * Smart truncate that preserves sentence structure
 */
function smartTruncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  // Try to truncate at sentence boundaries
  const truncated = text.substring(0, maxLength);
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('? '),
    truncated.lastIndexOf('\n')
  );

  if (lastSentenceEnd > maxLength * 0.7) {
    return truncated.substring(0, lastSentenceEnd + 1) + '...';
  }

  // If no good sentence boundary, just truncate
  return truncated.substring(0, maxLength - 3) + '...';
}

/**
 * Compress PRD while preserving key requirements
 */
export function compressPRD(prd: string, maxLength: number = 2000): string {
  // Extract key sections typically found in PRDs
  const keySections = [
    extractSection(prd, /requirements?/i),
    extractSection(prd, /features?/i),
    extractSection(prd, /functionality/i),
  ].filter(section => section.length > 0);

  if (keySections.length === 0) {
    return compressText(prd, maxLength);
  }

  const combinedKeySections = keySections.join('\n\n');
  
  if (combinedKeySections.length <= maxLength) {
    return combinedKeySections;
  }

  return compressText(combinedKeySections, maxLength);
}

/**
 * Compress architecture while preserving technical details
 */
export function compressArchitecture(architecture: string, maxLength: number = 3000): string {
  // Preserve technical diagrams, component relationships, and key decisions
  const techSections = [
    extractSection(architecture, /components?/i),
    extractSection(architecture, /services?/i),
    extractSection(architecture, /architecture/i),
  ].filter(section => section.length > 0);

  if (techSections.length === 0) {
    return compressText(architecture, maxLength);
  }

  const combinedTechSections = techSections.join('\n\n');
  
  if (combinedTechSections.length <= maxLength) {
    return combinedTechSections;
  }

  return compressText(combinedTechSections, maxLength);
}

/**
 * Extract a section from text based on keywords
 */
function extractSection(text: string, keywordRegex: RegExp): string {
  const lines = text.split('\n');
  const sectionLines: string[] = [];
  let inSection = false;

  for (const line of lines) {
    if (keywordRegex.test(line)) {
      inSection = true;
      sectionLines.push(line);
    } else if (inSection && line.trim() === '') {
      // End of section on empty line after finding keywords, but only if we have content
      if (sectionLines.length > 1) break; // Need at least the keyword line + one content line
    } else if (inSection) {
      sectionLines.push(line);
    }
  }

  return sectionLines.join('\n').trim();
}

/**
 * Compress tasks to focus on critical dependencies and acceptance criteria
 */
export function compressTasks(tasks: Array<{ id: string; title: string; details: string; dependencies: string[] }>, maxTasks: number = 10): string {
  // Sort tasks by dependencies (tasks with fewer dependencies first)
  const sortedTasks = [...tasks].sort((a, b) => a.dependencies.length - b.dependencies.length);
  
  // Take the first N tasks (most independent ones)
  const selectedTasks = sortedTasks.slice(0, maxTasks);
  
  return selectedTasks.map(task => 
    `${task.id}: ${task.title}\nDependencies: [${task.dependencies.join(', ') || 'none'}]\nKey Requirements: ${extractKeyRequirements(task.details)}`
  ).join('\n\n');
}

/**
 * Extract key requirements from task details
 */
function extractKeyRequirements(details: string): string {
  // Look for acceptance criteria, requirements, or key outcomes
  const requirementPatterns = [
    /acceptance\s*criteria[:\s]*([\s\S]*?)(?=\n|$)/i,
    /requirements?:[\s]*([\s\S]*?)(?=\n|$)/i,
    /must[:\s]*([\s\S]*?)(?=\n|$)/i,
  ];

  for (const pattern of requirementPatterns) {
    const match = details.match(pattern);
    if (match && match[1]) {
      return compressText(match[1].trim(), 100);
    }
  }

  // Fallback to first sentence or truncated details
  const sentences = details.split(/[.!?]/);
  if (sentences.length > 0 && sentences[0].trim().length > 0) {
    return compressText(sentences[0].trim(), 100);
  }

  return compressText(details, 100);
}

/**
 * Calculate estimated token count for text
 * Note: This is a rough approximation using ~4 characters per token on average.
 * Actual token count may vary significantly based on the tokenizer used by the AI model.
 */
export function estimateTokens(text: string): number {
  // Simple estimation: ~4 characters per token on average
  return Math.ceil(text.length / 4);
}

/**
 * Compress context to stay within token limits
 */
export function compressContext(
  context: UnifiedProjectContext,
  maxTokens: number = 8000
): { compressedContext: Partial<UnifiedProjectContext>; compressionRatio: number } {
  const originalTokens = estimateTokens(JSON.stringify(context));
  
  if (originalTokens <= maxTokens) {
    return { compressedContext: context, compressionRatio: 1.0 };
  }

  const compressedContext: Partial<UnifiedProjectContext> = {
    ...context,
    prd: compressPRD(context.prd, Math.floor(maxTokens * 0.25)),
    architecture: compressArchitecture(context.architecture, Math.floor(maxTokens * 0.3)),
    specifications: compressText(context.specifications, Math.floor(maxTokens * 0.2)),
    tasks: context.tasks.map(task => ({
      ...task,
      details: compressText(task.details, Math.floor(maxTokens * 0.05 / context.tasks.length))
    }))
  };

  const compressedTokens = estimateTokens(JSON.stringify(compressedContext));
  const compressionRatio = compressedTokens / originalTokens;

  return { compressedContext, compressionRatio };
}

