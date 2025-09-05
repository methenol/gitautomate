/**
 * Test the research task output to ensure it generates proper markdown
 */
import { ResearchTaskOutput } from '../ai/flows/research-task';

describe('Research Task Output', () => {
  test('ResearchTaskOutput should have markdownContent field', () => {
    // Simulate what the LLM should return
    const mockOutput: ResearchTaskOutput = {
      markdownContent: `# Setup User Authentication

## Context

This task implements user authentication using JWT tokens and bcrypt for password hashing.

## Implementation Steps

1. Install required packages: \`npm install bcryptjs jsonwebtoken\`
2. Create user schema with email and password fields
3. Implement password hashing middleware
4. Create login and register endpoints
5. Implement JWT token generation and validation

## Required Libraries

bcryptjs, jsonwebtoken, express, mongoose

## Documentation

Refer to the reference documentation for the required libraries listed above to understand their APIs, best practices, and implementation details before beginning development.

## Acceptance Criteria

- Users can register with email and password
- Users can login with valid credentials
- Passwords are properly hashed before storage
- JWT tokens are generated on successful login
- Protected routes validate JWT tokens`
    };

    expect(mockOutput.markdownContent).toBeDefined();
    expect(mockOutput.markdownContent).toContain('# Setup User Authentication');
    expect(mockOutput.markdownContent).toContain('## Context');
    expect(mockOutput.markdownContent).toContain('## Implementation Steps');
    expect(mockOutput.markdownContent).toContain('## Required Libraries');
    expect(mockOutput.markdownContent).toContain('## Documentation');
    expect(mockOutput.markdownContent).toContain('## Acceptance Criteria');
    expect(mockOutput.markdownContent).toContain('bcryptjs, jsonwebtoken, express, mongoose');
  });

  test('ResearchTaskOutput format should be GitHub issue ready', () => {
    const mockOutput: ResearchTaskOutput = {
      markdownContent: `# Create React Component Library

## Context

This task establishes reusable UI components for the application.

## Implementation Steps

1. Create components directory structure
2. Implement Button component with variants
3. Implement Input component with validation
4. Create Storybook documentation

## Required Libraries

react, typescript, storybook, tailwindcss

## Documentation

Refer to the reference documentation for the required libraries listed above.

## Acceptance Criteria

- Button component supports primary, secondary, destructive variants
- Input component handles validation states
- Components are documented in Storybook`
    };

    // Verify it's valid markdown structure
    expect(mockOutput.markdownContent).toMatch(/^# [^\n]+\n\n## Context\n\n/);
    expect(mockOutput.markdownContent).toMatch(/## Implementation Steps\n\n/);
    expect(mockOutput.markdownContent).toMatch(/## Required Libraries\n\n/);
    expect(mockOutput.markdownContent).toMatch(/## Documentation\n\n/);
    expect(mockOutput.markdownContent).toMatch(/## Acceptance Criteria\n\n/);
    
    // Verify no JSON structure remnants
    expect(mockOutput.markdownContent).not.toContain('"phase":');
    expect(mockOutput.markdownContent).not.toContain('"description":');
    expect(mockOutput.markdownContent).not.toContain('{"');
    expect(mockOutput.markdownContent).not.toContain('"}');
  });
});