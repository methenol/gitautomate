/**
 * Comprehensive tests for generate-architecture flow
 * Step 6: Coverage & Completeness - AI Flows
 */

import { generateArchitecture } from '@/ai/flows/generate-architecture';
import { ai } from '@/ai/litellm';

// Mock the AI service
jest.mock('@/ai/litellm', () => ({
  ai: {
    generate: jest.fn(),
  },
}));

const mockAI = ai as jest.Mocked<typeof ai>;

describe('Generate Architecture - Comprehensive Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Architecture Generation', () => {
    it('should generate React architecture successfully', async () => {
      mockAI.generate.mockResolvedValue({
        output: `# React Architecture

## Frontend Framework
- React 18 with TypeScript
- Component-based architecture
- State management with Context API

## Project Structure
- /src/components - React components
- /src/hooks - Custom hooks
- /src/pages - Page components
- /src/types - TypeScript definitions

## Key Technologies
- React Router for navigation
- Tailwind CSS for styling
- ESLint and Prettier for code quality`
      });

      const result = await generateArchitecture(
        { prd: 'Build a React todo application' },
        'test-api-key',
        'gpt-4',
        'https://api.openai.com/v1'
      );

      expect(result.architecture).toContain('React Architecture');
      expect(result.architecture).toContain('React 18');
      expect(result.architecture).toContain('Component-based');
      expect(mockAI.generate).toHaveBeenCalledTimes(1);
    });

    it('should generate Next.js architecture successfully', async () => {
      mockAI.generate.mockResolvedValue({
        output: `# Next.js Full-Stack Architecture

## Frontend & Backend
- Next.js 14 with App Router
- Server-side rendering and static generation
- API routes for backend functionality

## Database & Storage
- PostgreSQL for data persistence
- Prisma ORM for database management

## Authentication & Security
- NextAuth.js for authentication
- JWT tokens for session management`
      });

      const result = await generateArchitecture(
        { prd: 'Create a full-stack e-commerce platform' },
        'test-api-key',
        'gpt-4',
        'https://api.openai.com/v1'
      );

      expect(result.architecture).toContain('Next.js Full-Stack');
      expect(result.architecture).toContain('App Router');
      expect(result.architecture).toContain('PostgreSQL');
    });

    it('should generate Python architecture successfully', async () => {
      mockAI.generate.mockResolvedValue({
        output: `# Python API Architecture

## Backend Framework
- FastAPI for high-performance API
- Async/await for concurrency
- Pydantic for data validation

## Database & ORM
- SQLAlchemy for database operations
- Alembic for database migrations
- PostgreSQL as primary database

## Testing & Quality
- Pytest for testing framework
- Black for code formatting
- Mypy for type checking`
      });

      const result = await generateArchitecture(
        { prd: 'Build a Python REST API for data analytics' },
        'test-api-key',
        'gpt-4',
        'https://api.openai.com/v1'
      );

      expect(result.architecture).toContain('Python API');
      expect(result.architecture).toContain('FastAPI');
      expect(result.architecture).toContain('SQLAlchemy');
    });
  });

  describe('Error Handling', () => {
    it('should handle API failures gracefully', async () => {
      mockAI.generate.mockRejectedValue(new Error('API request failed'));

      await expect(
        generateArchitecture(
          { prd: 'Test application' },
          'invalid-key',
          'gpt-4',
          'https://api.openai.com/v1'
        )
      ).rejects.toThrow('Failed to generate architecture');
    });

    it('should handle empty PRD input', async () => {
      mockAI.generate.mockResolvedValue({
        output: `# Basic Architecture

## Framework
- Generic web application structure
- Standard component organization`
      });

      const result = await generateArchitecture(
        { prd: '' },
        'test-api-key',
        'gpt-4',
        'https://api.openai.com/v1'
      );

      expect(result.architecture).toContain('Basic Architecture');
      expect(mockAI.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('PRD: ')
        })
      );
    });

    it('should handle malformed AI responses', async () => {
      mockAI.generate.mockResolvedValue({
        output: 'Invalid response without proper structure'
      });

      const result = await generateArchitecture(
        { prd: 'Test application' },
        'test-api-key',
        'gpt-4',
        'https://api.openai.com/v1'
      );

      expect(result.architecture).toBe('Invalid response without proper structure');
    });

    it('should handle network timeouts', async () => {
      mockAI.generate.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      await expect(
        generateArchitecture(
          { prd: 'Test application' },
          'test-api-key',
          'gpt-4',
          'https://api.openai.com/v1'
        )
      ).rejects.toThrow('Failed to generate architecture');
    });
  });

  describe('Configuration Options', () => {
    it('should handle different AI models', async () => {
      mockAI.generate.mockResolvedValue({
        output: '# Model-specific architecture response'
      });

      await generateArchitecture(
        { prd: 'Test app' },
        'test-key',
        'claude-3',
        'https://api.anthropic.com/v1'
      );

      expect(mockAI.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3'
        })
      );
    });

    it('should handle different API bases', async () => {
      mockAI.generate.mockResolvedValue({
        output: '# Architecture response'
      });

      await generateArchitecture(
        { prd: 'Test app' },
        'test-key',
        'gpt-4',
        'https://custom-api.com/v1'
      );

      expect(mockAI.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          apiBase: 'https://custom-api.com/v1'
        })
      );
    });

    it('should handle missing optional parameters', async () => {
      mockAI.generate.mockResolvedValue({
        output: '# Default architecture'
      });

      const result = await generateArchitecture(
        { prd: 'Simple app' },
        'test-key'
      );

      expect(result.architecture).toContain('Default architecture');
      expect(mockAI.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: undefined,
          apiBase: undefined
        })
      );
    });
  });

  describe('Content Processing', () => {
    it('should handle complex PRD with multiple requirements', async () => {
      const complexPRD = `
# E-commerce Platform Requirements

## Core Features
- User authentication and authorization
- Product catalog with search and filtering
- Shopping cart and checkout process
- Payment integration with Stripe
- Order management and tracking
- Admin dashboard for inventory management

## Technical Requirements
- Responsive design for mobile and desktop
- SEO optimization
- Performance monitoring
- Security compliance (PCI DSS)
- Scalable architecture for high traffic
      `;

      mockAI.generate.mockResolvedValue({
        output: `# E-commerce Platform Architecture

## Frontend Architecture
- Next.js 14 with App Router for SSR and SSG
- React components with TypeScript
- Tailwind CSS for responsive design
- React Query for state management

## Backend Architecture
- Next.js API routes for backend logic
- PostgreSQL for data persistence
- Redis for caching and sessions
- Stripe API integration for payments

## Security & Performance
- NextAuth.js for authentication
- Rate limiting and CORS protection
- Image optimization with Next.js
- CDN integration for static assets`
      });

      const result = await generateArchitecture(
        { prd: complexPRD },
        'test-api-key',
        'gpt-4',
        'https://api.openai.com/v1'
      );

      expect(result.architecture).toContain('E-commerce Platform Architecture');
      expect(result.architecture).toContain('Next.js 14');
      expect(result.architecture).toContain('PostgreSQL');
      expect(result.architecture).toContain('Stripe API');
    });

    it('should preserve markdown formatting', async () => {
      mockAI.generate.mockResolvedValue({
        output: `# Architecture Title

## Section 1
- Point 1
- Point 2

### Subsection
1. Numbered item
2. Another item

\`\`\`javascript
const example = 'code block';
\`\`\`

**Bold text** and *italic text*`
      });

      const result = await generateArchitecture(
        { prd: 'Test markdown preservation' },
        'test-api-key',
        'gpt-4',
        'https://api.openai.com/v1'
      );

      expect(result.architecture).toContain('# Architecture Title');
      expect(result.architecture).toContain('## Section 1');
      expect(result.architecture).toContain('### Subsection');
      expect(result.architecture).toContain('```javascript');
      expect(result.architecture).toContain('**Bold text**');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle very long PRD input', async () => {
      const longPRD = 'Very detailed requirement '.repeat(1000);
      
      mockAI.generate.mockResolvedValue({
        output: '# Architecture for large project'
      });

      const result = await generateArchitecture(
        { prd: longPRD },
        'test-api-key',
        'gpt-4',
        'https://api.openai.com/v1'
      );

      expect(result.architecture).toContain('Architecture for large project');
      expect(mockAI.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining(longPRD)
        })
      );
    });

    it('should handle special characters in PRD', async () => {
      const specialCharPRD = 'App with émojis 🚀, symbols @#$%, and quotes "test"';
      
      mockAI.generate.mockResolvedValue({
        output: '# International Architecture Support'
      });

      const result = await generateArchitecture(
        { prd: specialCharPRD },
        'test-api-key',
        'gpt-4',
        'https://api.openai.com/v1'
      );

      expect(result.architecture).toContain('International Architecture');
    });

    it('should handle concurrent generation requests', async () => {
      mockAI.generate.mockImplementation(() => 
        Promise.resolve({ output: '# Concurrent architecture' })
      );

      const requests = Array(5).fill(null).map((_, i) =>
        generateArchitecture(
          { prd: `App ${i}` },
          'test-api-key',
          'gpt-4',
          'https://api.openai.com/v1'
        )
      );

      const results = await Promise.all(requests);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.architecture).toContain('Concurrent architecture');
      });
      expect(mockAI.generate).toHaveBeenCalledTimes(5);
    });
  });

  describe('Integration Scenarios', () => {
    it('should integrate with downstream task generation', async () => {
      mockAI.generate.mockResolvedValue({
        output: `# Task-Ready Architecture

## Development Phases
1. Setup and Configuration
2. Core Feature Development  
3. Testing and Quality Assurance
4. Deployment and Monitoring

## Component Structure
- Authentication module
- Data processing layer
- User interface components
- API integration layer`
      });

      const result = await generateArchitecture(
        { prd: 'Application ready for task breakdown' },
        'test-api-key',
        'gpt-4',
        'https://api.openai.com/v1'
      );

      expect(result.architecture).toContain('Development Phases');
      expect(result.architecture).toContain('Component Structure');
      // Architecture should be structured for task generation
      expect(result.architecture).toMatch(/\d+\./); // Should contain numbered items
    });

    it('should provide architecture suitable for file structure generation', async () => {
      mockAI.generate.mockResolvedValue({
        output: `# Structured Architecture

## Directory Organization
- /src/components - React components
- /src/pages - Application pages
- /src/api - Backend API routes
- /src/utils - Utility functions
- /src/types - TypeScript definitions

## File Naming Conventions
- Components: PascalCase (UserProfile.tsx)
- Pages: kebab-case (user-profile.tsx)
- Utils: camelCase (formatDate.ts)`
      });

      const result = await generateArchitecture(
        { prd: 'Well-structured application' },
        'test-api-key',
        'gpt-4',
        'https://api.openai.com/v1'
      );

      expect(result.architecture).toContain('Directory Organization');
      expect(result.architecture).toContain('/src/');
      expect(result.architecture).toContain('File Naming Conventions');
    });
  });
});