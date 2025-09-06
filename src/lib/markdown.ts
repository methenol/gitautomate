/**
 * Browser-compatible utility functions for markdown formatting
 */

/**
 * Ensure proper markdown headers and structure
 * @param content - Markdown content
 * @param title - Optional title to ensure as H1
 * @returns Properly formatted markdown
 */
export function ensureMarkdownStructure(content: string, title?: string): string {
  let formatted = content.trim();
  
  // Ensure it starts with a title if provided
  if (title && !formatted.startsWith('#')) {
    formatted = `# ${title}\n\n${formatted}`;
  }
  
  // Ensure proper spacing after headers
  formatted = formatted.replace(/^(#{1,6})\s*(.+)$/gm, '$1 $2');
  
  // Ensure double newlines after headers
  formatted = formatted.replace(/^(#{1,6}\s.+)(\n)(?![\n#])/gm, '$1\n\n');
  
  // Remove excessive blank lines (more than 2 consecutive)
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  
  // Fix list formatting
  formatted = formatted.replace(/^(\s*)-\s+/gm, '$1- ');
  formatted = formatted.replace(/^(\s*)\*\s+/gm, '$1* ');
  formatted = formatted.replace(/^(\s*)\d+\.\s+/gm, '$1$&');
  
  // Fix code block formatting
  formatted = formatted.replace(/```(\w+)?\n/g, '```$1\n');
  
  // Fix inline code formatting  
  formatted = formatted.replace(/`([^`]+)`/g, '`$1`');
  
  // Ensure file ends with single newline
  formatted = formatted.replace(/\n*$/, '\n');
  
  return formatted;
}

/**
 * Clean and format task markdown content
 * @param content - Task markdown content
 * @returns Clean, properly formatted task content
 */
export function formatTaskMarkdown(content: string): string {
  let formatted = content.trim();
  
  // Ensure proper task structure if missing
  if (!formatted.includes('## Context') && 
      !formatted.includes('## Implementation') && 
      !formatted.includes('## Acceptance')) {
    
    // This might be old format, try to detect and convert
    if (formatted.includes('### Context')) {
      formatted = formatted.replace(/### /g, '## ');
    }
  }
  
  // Format with general structure rules
  formatted = ensureMarkdownStructure(formatted);
  
  return formatted;
}

/**
 * Format architecture markdown content
 * @param content - Architecture markdown content
 * @returns Properly formatted architecture content
 */
export function formatArchitectureMarkdown(content: string): string {
  return ensureMarkdownStructure(content, 'Architecture');
}

/**
 * Format specifications markdown content
 * @param content - Specifications markdown content
 * @returns Properly formatted specifications content
 */
export function formatSpecificationsMarkdown(content: string): string {
  return ensureMarkdownStructure(content, 'Specifications');
}

/**
 * Format file structure markdown content
 * @param content - File structure markdown content
 * @returns Properly formatted file structure content
 */
export function formatFileStructureMarkdown(content: string): string {
  return ensureMarkdownStructure(content, 'File Structure');
}

/**
 * Format PRD markdown content
 * @param content - PRD markdown content
 * @returns Properly formatted PRD content
 */
export function formatPRDMarkdown(content: string): string {
  return ensureMarkdownStructure(content, 'Product Requirements Document');
}