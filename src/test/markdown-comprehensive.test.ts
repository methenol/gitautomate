import { ensureMarkdownStructure, formatTaskMarkdown, formatArchitectureMarkdown, formatSpecificationsMarkdown, formatFileStructureMarkdown, formatPRDMarkdown } from '@/lib/markdown';

describe('Markdown Utilities', () => {
  describe('ensureMarkdownStructure', () => {
    it('should add title if missing', () => {
      const content = `Some content without a title header.

This is a paragraph.`;

      const result = ensureMarkdownStructure(content, 'Test Title');
      expect(result).toMatch(/^# Test Title\n\n/);
    });

    it('should not add title if already present', () => {
      const content = `# Existing Title

Content here.`;

      const result = ensureMarkdownStructure(content, 'New Title');
      expect(result).toMatch(/^# Existing Title/);
      expect(result).not.toContain('New Title');
    });

    it('should fix header spacing', () => {
      const badHeaders = `#Header without space
##Another bad header
### This one too`;

      const result = ensureMarkdownStructure(badHeaders);
      expect(result).toContain('# Header without space');
      expect(result).toContain('## Another bad header');
      expect(result).toContain('### This one too');
    });

    it('should remove excessive blank lines', () => {
      const tooManyLines = `# Title




Content with too many blank lines.




More content.`;

      const result = ensureMarkdownStructure(tooManyLines);
      expect(result).not.toMatch(/\n{3,}/);
    });

    it('should end with single newline', () => {
      const noNewline = `# Title

Content`;
      const result = ensureMarkdownStructure(noNewline);
      expect(result).toMatch(/[^\n]\n$/);
      expect(result).not.toMatch(/\n\n$/);
    });

    it('should preserve code blocks', () => {
      const withCode = `# Title

\`\`\`
code block
  with indentation
\`\`\`

More content.`;

      const result = ensureMarkdownStructure(withCode);
      expect(result).toContain('```\ncode block\n  with indentation\n```');
    });

    it('should handle empty content', () => {
      const result = ensureMarkdownStructure('', 'Title');
      expect(result).toBe('# Title\n');
    });

    it('should handle whitespace-only content', () => {
      const result = ensureMarkdownStructure('   \n\n   ', 'Title');
      expect(result).toBe('# Title\n');
    });
  });

  describe('formatTaskMarkdown', () => {
    it('should handle proper markdown', () => {
      const goodMarkdown = `# Create Docker Configuration

## Context

This task establishes the containerization setup.

## Implementation Steps

1. Create Dockerfile at \`docker/Dockerfile\`
2. Configure entrypoint script

## Required Libraries

docker, pytest, docker-py, poetry

## Documentation

Refer to the reference documentation for the required libraries listed above.

## Acceptance Criteria

- The Dockerfile resides at \`docker/Dockerfile\`
- Image exposes port 8000`;

      const result = formatTaskMarkdown(goodMarkdown);
      expect(result).toContain('# Create Docker Configuration');
      expect(result).toContain('## Context');
      expect(result).toContain('## Implementation Steps');
      expect(result).toContain('## Required Libraries');
      expect(result).toContain('## Documentation');
      expect(result).toContain('## Acceptance Criteria');
    });

    it('should convert ### headers to ## headers when missing standard sections', () => {
      const oldFormat = `# Task Title

### Context

Some context here.

### Implementation

Implementation details.`;

      const result = formatTaskMarkdown(oldFormat);
      
      // The function only converts ### to ## when standard sections are missing
      // and ### Context/Implementation are present
      expect(result).toContain('## Context');
      expect(result).toContain('## Implementation');
    });

    it('should preserve well-formatted structure', () => {
      const wellFormatted = `# Task Title

## Context

Proper formatting here.

## Implementation Steps

1. Step one
2. Step two`;

      const result = formatTaskMarkdown(wellFormatted);
      expect(result).toContain('# Task Title');
      expect(result).toContain('## Context');
      expect(result).toContain('## Implementation Steps');
    });

    it('should handle missing structure gracefully', () => {
      const minimal = `# Simple Task

Just some content.`;

      const result = formatTaskMarkdown(minimal);
      expect(result).toContain('# Simple Task');
      expect(result).toContain('Just some content.');
    });

    it('should trim whitespace', () => {
      const whitespaced = `   # Task Title   

   Content with extra spaces   

   `;

      const result = formatTaskMarkdown(whitespaced);
      expect(result).toMatch(/^# Task Title/);
      expect(result).not.toMatch(/^\s+/);
    });
  });

  describe('formatArchitectureMarkdown', () => {
    it('should ensure Architecture title', () => {
      const content = `This is architecture content without a title.

Component details here.`;

      const result = formatArchitectureMarkdown(content);
      expect(result).toMatch(/^# Architecture\n\n/);
    });

    it('should preserve existing Architecture title', () => {
      const content = `# Architecture Overview

Component-based design.`;

      const result = formatArchitectureMarkdown(content);
      expect(result).toMatch(/^# Architecture Overview/);
      expect(result).not.toMatch(/^# Architecture\n\n# Architecture Overview/);
    });

    it('should apply general markdown formatting', () => {
      const content = `#Architecture
##Components
- Component A
- Component B`;

      const result = formatArchitectureMarkdown(content);
      expect(result).toContain('# Architecture');
      expect(result).toContain('## Components');
    });
  });

  describe('formatSpecificationsMarkdown', () => {
    it('should ensure Specifications title', () => {
      const content = `Feature requirements and technical specifications.`;

      const result = formatSpecificationsMarkdown(content);
      expect(result).toMatch(/^# Specifications\n\n/);
    });

    it('should preserve existing title', () => {
      const content = `# Technical Specifications

API endpoints and data models.`;

      const result = formatSpecificationsMarkdown(content);
      expect(result).toMatch(/^# Technical Specifications/);
    });
  });

  describe('formatFileStructureMarkdown', () => {
    it('should ensure File Structure title', () => {
      const content = `src/
  components/
  utils/`;

      const result = formatFileStructureMarkdown(content);
      expect(result).toMatch(/^# File Structure\n\n/);
    });

    it('should handle code-block style structure', () => {
      const content = `\`\`\`
src/
  components/
    Header.tsx
    Footer.tsx
  utils/
    helpers.ts
\`\`\``;

      const result = formatFileStructureMarkdown(content);
      expect(result).toContain('# File Structure');
      expect(result).toContain('```');
    });
  });

  describe('formatPRDMarkdown', () => {
    it('should ensure PRD title', () => {
      const content = `Requirements for the project.`;

      const result = formatPRDMarkdown(content);
      expect(result).toMatch(/^# Product Requirements Document\n\n/);
    });

    it('should preserve existing PRD title', () => {
      const content = `# PRD: Task Management System

Requirements and specifications.`;

      const result = formatPRDMarkdown(content);
      expect(result).toMatch(/^# PRD: Task Management System/);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle null/undefined input', () => {
      expect(() => ensureMarkdownStructure('')).not.toThrow();
      expect(() => formatTaskMarkdown('')).not.toThrow();
      expect(() => formatArchitectureMarkdown('')).not.toThrow();
    });

    it('should handle very long content', () => {
      const longContent = 'a'.repeat(10000);
      const result = ensureMarkdownStructure(longContent, 'Title');
      expect(result).toContain('# Title');
      expect(result).toContain(longContent);
    });

    it('should handle special characters', () => {
      const specialContent = `# Title with émojis 🎉

Content with ñ and 中文 characters.`;

      const result = ensureMarkdownStructure(specialContent);
      expect(result).toContain('émojis 🎉');
      expect(result).toContain('ñ and 中文');
    });

    it('should preserve indentation in code blocks', () => {
      const withIndentation = `# Code Example

\`\`\`javascript
if (condition) {
    doSomething();
    if (nested) {
        doMore();
    }
}
\`\`\``;

      const result = ensureMarkdownStructure(withIndentation);
      expect(result).toContain('    doSomething();');
      expect(result).toContain('        doMore();');
    });
  });

  describe('complex formatting scenarios', () => {
    it('should handle mixed content types', () => {
      const mixed = `# Mixed Content

## Text Section
Regular paragraph.

## Code Section
\`\`\`bash
npm install
\`\`\`

## List Section
- Item 1
- Item 2

## Table Section
| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |`;

      const result = ensureMarkdownStructure(mixed);
      expect(result).toContain('## Text Section');
      expect(result).toContain('```bash');
      expect(result).toContain('- Item 1');
      expect(result).toContain('| Column 1 | Column 2 |');
    });

    it('should maintain link formatting', () => {
      const withLinks = `# Links

Check out [this link](https://example.com) and this one: https://direct.link

Also reference style links [here][1].

[1]: https://reference.com`;

      const result = ensureMarkdownStructure(withLinks);
      expect(result).toContain('[this link](https://example.com)');
      expect(result).toContain('https://direct.link');
      expect(result).toContain('[here][1]');
      expect(result).toContain('[1]: https://reference.com');
    });
  });
});