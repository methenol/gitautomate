import { BrowserMarkdownLinter } from '@/lib/browser-markdown-linter';

describe('BrowserMarkdownLinter', () => {
  it('should fix basic markdown formatting issues', () => {
    const content = `#Header Without Space
No blank line before next header
##Another Header
- List item without space
*  Multiple spaces
Some content  

Extra blank lines




Final line`;

    const result = BrowserMarkdownLinter.lintAndFix(content);
    
    expect(result.fixedContent).toBeDefined();
    expect(result.fixedContent).toContain('# Header Without Space');
    expect(result.fixedContent).toContain('## Another Header');
    expect(result.fixedContent).toContain('- List item without space');
    expect(result.fixedContent).toContain('* Multiple spaces');
    expect(result.fixedContent).not.toContain('  \n'); // No trailing spaces
    expect(result.fixedContent).not.toContain('\n\n\n\n'); // No excessive blank lines
    expect(result.fixedContent).toMatch(/\n$/); // Ends with single newline
  });

  it('should validate already well-formatted markdown', () => {
    const content = `# Proper Header

## Another Section

- List item
- Another item

Some content here.

## Final Section

Final content.
`;

    const result = BrowserMarkdownLinter.lintAndFix(content);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle code blocks properly', () => {
    const content = `# Header
Code block without blank line:
\`\`\`javascript
code here
\`\`\`
No blank line after.`;

    const result = BrowserMarkdownLinter.lintAndFix(content);
    
    expect(result.fixedContent).toContain('\n```javascript\n');
    expect(result.fixedContent).toContain('```\n\n');
  });

  it('should fix list formatting', () => {
    const content = `# Lists
-Item without space
*  Item with extra spaces
+Item without space`;

    const result = BrowserMarkdownLinter.lintAndFix(content);
    
    expect(result.fixedContent).toContain('- Item without space');
    expect(result.fixedContent).toContain('* Item with extra spaces');
    expect(result.fixedContent).toContain('+ Item without space');
  });
});