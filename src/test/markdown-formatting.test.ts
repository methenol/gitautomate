/**
 * Test the markdown formatting utilities to ensure they work correctly
 */
import { formatTaskMarkdown, ensureMarkdownStructure } from '../lib/markdown';

describe('Markdown Formatting', () => {
  test('formatTaskMarkdown should handle proper markdown', () => {
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

  test('ensureMarkdownStructure should add title if missing', () => {
    const contentWithoutTitle = `Some content without a title header.

This is a paragraph.`;

    const result = ensureMarkdownStructure(contentWithoutTitle, 'Test Title');
    expect(result).toMatch(/^# Test Title\n\n/);
  });

  test('ensureMarkdownStructure should fix header spacing', () => {
    const badHeaders = `#Header without space
##Another bad header
### This one too`;

    const result = ensureMarkdownStructure(badHeaders);
    expect(result).toContain('# Header without space');
    expect(result).toContain('## Another bad header'); 
    expect(result).toContain('### This one too');
  });

  test('ensureMarkdownStructure should remove excessive blank lines', () => {
    const tooManyLines = `# Title



Content with too many blank lines.




More content.`;

    const result = ensureMarkdownStructure(tooManyLines);
    expect(result).not.toMatch(/\n{3,}/);
  });

  test('ensureMarkdownStructure should end with single newline', () => {
    const noNewline = `# Title\n\nContent`;
    const result = ensureMarkdownStructure(noNewline);
    expect(result).toMatch(/[^\n]\n$/);
    expect(result).not.toMatch(/\n\n$/);
  });
});