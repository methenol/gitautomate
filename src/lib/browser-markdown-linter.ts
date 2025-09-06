/**
 * Browser-compatible markdown validation and fixing utilities
 * Uses manual fixes since markdownlint-cli2 requires Node.js
 */

export interface BrowserMarkdownLintResult {
  isValid: boolean;
  errors: string[];
  fixedContent?: string;
}

export class BrowserMarkdownLinter {
  /**
   * Validate and fix markdown content in the browser
   */
  static lintAndFix(content: string, filename = 'document.md'): BrowserMarkdownLintResult {
    const errors: string[] = [];
    let fixed = content;

    // Apply comprehensive manual fixes
    fixed = this.applyAllFixes(fixed, errors);

    // Validate the fixed content
    const validationErrors = this.validateMarkdown(fixed);
    errors.push(...validationErrors);

    return {
      isValid: validationErrors.length === 0,
      errors,
      fixedContent: fixed !== content ? fixed : undefined
    };
  }

  /**
   * Apply all available markdown fixes
   */
  private static applyAllFixes(content: string, errors: string[]): string {
    let fixed = content;

    try {
      // 1. Fix line endings and trailing whitespace
      fixed = fixed.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      fixed = fixed.replace(/ +$/gm, '');

      // 2. Ensure single trailing newline
      fixed = fixed.replace(/\n*$/, '\n');

      // 3. Fix headers: ensure space after hash(es)
      fixed = fixed.replace(/^(#{1,6})([^ #])/gm, '$1 $2');
      
      // 4. Fix headers: ensure blank line before (except first line)
      fixed = fixed.replace(/(?<!^|\n\n)(^#{1,6} .+)/gm, '\n$1');
      
      // 5. Fix headers: ensure blank line after 
      fixed = fixed.replace(/(^#{1,6} .+$)(?!\n\n|\n$)/gm, '$1\n');

      // 6. Fix list formatting
      fixed = fixed.replace(/^(\s*)-(\S)/gm, '$1- $2');
      fixed = fixed.replace(/^(\s*)\*(\S)/gm, '$1* $2');
      fixed = fixed.replace(/^(\s*)\+(\S)/gm, '$1+ $2');
      fixed = fixed.replace(/^(\s*)(\d+\.)(\S)/gm, '$1$2 $3');
      // Also fix extra spaces after list markers
      fixed = fixed.replace(/^(\s*[-*+])\s{2,}/gm, '$1 ');
      fixed = fixed.replace(/^(\s*\d+\.)\s{2,}/gm, '$1 ');

      // 7. Fix code blocks: ensure blank lines around
      fixed = fixed.replace(/(?<!^|\n\n)(^```)/gm, '\n$1');
      fixed = fixed.replace(/(^```[^\n]*$)(?!\n\n|\n$)/gm, '$1\n');
      fixed = fixed.replace(/(^```$)(?!\n\n|\n$)/gm, '$1\n');

      // 8. Fix blockquotes: ensure blank lines around
      fixed = fixed.replace(/(?<!^|\n\n)(^>)/gm, '\n$1');
      fixed = fixed.replace(/(^>.*$)(?!\n\n|\n$|\n>)/gm, '$1\n');

      // 9. Fix horizontal rules: ensure blank lines around
      fixed = fixed.replace(/(?<!^|\n\n)(^[\s]*[-*_]{3,}[\s]*$)/gm, '\n$1');
      fixed = fixed.replace(/(^[\s]*[-*_]{3,}[\s]*$)(?!\n\n|\n$)/gm, '$1\n');

      // 10. Fix multiple blank lines (max 2)
      fixed = fixed.replace(/\n{3,}/g, '\n\n');

      // 11. Fix table formatting (basic)
      fixed = fixed.replace(/\|(\S)/g, '| $1');
      fixed = fixed.replace(/(\S)\|/g, '$1 |');

      // 12. Fix emphasis formatting
      fixed = fixed.replace(/\*{3,}/g, '***');
      fixed = fixed.replace(/_{3,}/g, '___');

      // 13. Fix link formatting
      fixed = fixed.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (match, text, url) => {
        return `[${text.trim()}](${url.trim()})`;
      });

      // 14. Ensure proper indentation for nested lists
      fixed = fixed.replace(/^( {2,})([*+-]|\d+\.)/gm, (match, spaces, marker) => {
        const indentLevel = Math.floor(spaces.length / 2) * 2;
        return ' '.repeat(indentLevel) + marker;
      });

    } catch (error) {
      errors.push(`Error applying fixes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return fixed;
  }

  /**
   * Validate markdown content for common issues
   */
  private static validateMarkdown(content: string): string[] {
    const errors: string[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Check for trailing whitespace
      if (line.endsWith(' ') || line.endsWith('\t')) {
        errors.push(`Line ${lineNum}: Trailing whitespace`);
      }

      // Check for malformed headers
      if (line.match(/^#{1,6}[^ #]/)) {
        errors.push(`Line ${lineNum}: Header missing space after hash(es)`);
      }

      // Check for malformed lists
      if (line.match(/^\s*[-*+]\S/) || line.match(/^\s*\d+\.\S/)) {
        errors.push(`Line ${lineNum}: List item missing space after marker`);
      }

      // Check for multiple consecutive blank lines
      if (i > 0 && lines[i-1] === '' && line === '' && i < lines.length - 1 && lines[i+1] === '') {
        errors.push(`Line ${lineNum}: Multiple consecutive blank lines`);
      }
    }

    // Check file ending
    if (!content.endsWith('\n')) {
      errors.push('File should end with a single newline');
    } else if (content.endsWith('\n\n')) {
      errors.push('File should not end with multiple newlines');
    }

    return errors;
  }

  /**
   * Quick validation without fixing
   */
  static validate(content: string, filename = 'document.md'): boolean {
    const result = this.lintAndFix(content, filename);
    return result.isValid;
  }

  /**
   * Get fixed content or return original if no fixes needed
   */
  static getFixedContent(content: string, filename = 'document.md'): string {
    const result = this.lintAndFix(content, filename);
    return result.fixedContent || content;
  }
}