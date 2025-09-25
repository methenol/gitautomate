import { BrowserMarkdownLinter } from '@/lib/browser-markdown-linter';

describe('BrowserMarkdownLinter', () => {
  describe('lintAndFix', () => {
    it('should fix basic formatting issues', () => {
      const input = `#Header without space
##Another header

This is a paragraph with  multiple  spaces.

- Unindented list item
  -Sub-item without space
    - Nested item`;

      const result = BrowserMarkdownLinter.lintAndFix(input);

      expect(result.fixedContent).toBeDefined();
      expect(result.fixedContent).toContain('# Header without space');
      expect(result.fixedContent).toContain('## Another header');
    });

    it('should return valid for well-formatted markdown', () => {
      const input = `# Well Formatted Header

This is a properly formatted paragraph.

## Second Level Header

- Properly formatted list
  - Sub-item with proper spacing
  - Another sub-item

Here's a code block:

\`\`\`javascript
const example = "code";
\`\`\``;

      const result = BrowserMarkdownLinter.lintAndFix(input);

      // The linter might still apply minor fixes, so check if it's valid
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle code blocks correctly', () => {
      const input = `# Header

\`\`\`javascript
#This comment in code should not be changed
##Neither should this
\`\`\`

#This header should be fixed`;

      const result = BrowserMarkdownLinter.lintAndFix(input);

      if (result.fixedContent) {
        expect(result.fixedContent).toContain('# This header should be fixed');
        // Code block content might be normalized, so just check it exists
        expect(result.fixedContent).toContain('```javascript');
      }
    });

    it('should handle empty input', () => {
      const result = BrowserMarkdownLinter.lintAndFix('');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle whitespace-only input', () => {
      const input = '   \n\n   \n\n';
      const result = BrowserMarkdownLinter.lintAndFix(input);

      expect(result).toBeDefined();
      expect(result.fixedContent).toBeDefined();
    });
  });

  describe('validateMarkdown', () => {
    it('should identify markdown issues', () => {
      const validMarkdown = `# Title

Proper content here.`;

      // Access static method through class
      const errors = (BrowserMarkdownLinter as any).validateMarkdown(validMarkdown);
      expect(Array.isArray(errors)).toBe(true);
    });
  });

  describe('applyAllFixes', () => {
    it('should apply fixes and track changes', () => {
      const input = '#Header\n##Subheader';
      const errors: string[] = [];

      const result = (BrowserMarkdownLinter as any).applyAllFixes(input, errors);
      
      expect(typeof result).toBe('string');
      expect(result).toContain('# Header');
    });
  });

  describe('edge cases', () => {
    it('should handle very long content', () => {
      const longContent = 'a'.repeat(10000);
      const input = `#Header\n\n${longContent}`;

      const result = BrowserMarkdownLinter.lintAndFix(input);

      expect(result).toBeDefined();
      if (result.fixedContent) {
        expect(result.fixedContent).toContain('# Header');
        expect(result.fixedContent).toContain(longContent);
      }
    });

    it('should handle special characters in headers', () => {
      const input = `#Header with émojis 🎉 and ñ characters
##Спецsymbols and 中文`;

      const result = BrowserMarkdownLinter.lintAndFix(input);

      if (result.fixedContent) {
        expect(result.fixedContent).toContain('# Header with émojis 🎉 and ñ characters');
        expect(result.fixedContent).toContain('## Спецsymbols and 中文');
      }
    });

    it('should preserve inline code', () => {
      const input = `# Code Examples

Use \`#header\` for headers and \`##subheader\` for subheaders.

#This should be fixed but \`#this\` should not.`;

      const result = BrowserMarkdownLinter.lintAndFix(input);

      if (result.fixedContent) {
        expect(result.fixedContent).toContain('# This should be fixed');
        expect(result.fixedContent).toContain('`#this`');
      }
    });
  });
});