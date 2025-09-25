/**
 * Comprehensive tests for generate-tasks flow
 * Step 6: Coverage & Completeness - AI Flows
 */

import { generateTasks } from '@/ai/flows/generate-tasks';
import { ai } from '@/ai/litellm';

// Mock the AI service
jest.mock('@/ai/litellm', () => ({
  ai: {
    generate: jest.fn(),
  },
}));

const mockAI = ai as jest.Mocked<typeof ai>;

describe('Generate Tasks - Comprehensive Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const sampleInput = {
    architecture: `# React Architecture
- React 18 with TypeScript
- Component-based structure
- State management with Context API`,
    specifications: `# Specifications
- User authentication
- Todo CRUD operations
- Responsive design`,
    fileStructure: `# File Structure
/src/components
/src/pages
/src/hooks
/src/types`
  };

  describe('Basic Task Generation', () => {
    it('should generate tasks with dependencies successfully', async () => {
      mockAI.generate.mockResolvedValue({
        output: `# Task List

## Task 1: Setup Project
- Initialize React app with TypeScript
- Configure ESLint and Prettier
- Setup folder structure

Dependencies: []
Estimated Time: 2 hours

## Task 2: Create Authentication
- Implement login/logout functionality
- Create user context
- Add protected routes

Dependencies: [Task 1]
Estimated Time: 4 hours

## Task 3: Build Todo Components
- Create TodoList component
- Implement add/edit/delete functionality
- Add local storage persistence

Dependencies: [Task 1, Task 2]
Estimated Time: 6 hours`
      });

      const result = await generateTasks(
        sampleInput,
        'test-api-key',
        'gpt-4',
        'https://api.openai.com/v1'
      );

      expect(result.tasks).toHaveLength(3);
      expect(result.tasks[0].title).toContain('Setup Project');
      expect(result.tasks[1].dependencies).toContain('task-1');
      expect(result.tasks[2].dependencies).toHaveLength(2);
    });

    it('should generate tasks with TDD support when enabled', async () => {
      mockAI.generate.mockResolvedValue({
        output: `# TDD Task List

## Task 1: Setup Testing Environment
- Configure Jest and React Testing Library
- Setup test utils and mocks
- Create sample test structure

Testing Approach: Unit tests for all utilities
Dependencies: []

## Task 2: Authentication Module (TDD)
- Write tests for auth context
- Implement login/logout with tests
- Test protected route behavior

Testing Approach: Component testing with user interactions
Dependencies: [Task 1]

## Task 3: Todo CRUD Operations (TDD)
- Write tests for todo operations
- Implement CRUD functionality
- Test edge cases and error handling  

Testing Approach: Integration tests with mock API
Dependencies: [Task 1, Task 2]`
      });

      const result = await generateTasks(
        sampleInput,
        'test-api-key',
        'gpt-4',
        'https://api.openai.com/v1',
        true // useTDD = true
      );

      expect(result.tasks).toHaveLength(3);
      expect(result.tasks[0].details).toContain('Testing Environment');
      expect(result.tasks[1].details).toContain('TDD');
      expect(result.tasks[2].details).toContain('Integration tests');
    });

    it('should handle complex project with multiple features', async () => {
      const complexInput = {
        architecture: `# Full-Stack E-commerce Architecture
- Next.js frontend with TypeScript
- PostgreSQL database with Prisma
- Stripe payment integration
- Redis for caching`,
        specifications: `# E-commerce Specifications
- User registration and authentication
- Product catalog with search
- Shopping cart functionality
- Payment processing
- Order management
- Admin dashboard`,
        fileStructure: `# File Structure
/src/app - Next.js app directory
/src/components - React components
/src/lib - Utility libraries
/prisma - Database schema
/api - API routes`
      };

      mockAI.generate.mockResolvedValue({
        output: `# E-commerce Development Tasks

## Task 1: Database Setup
- Setup PostgreSQL database
- Configure Prisma ORM
- Create initial schemas for users, products, orders

Dependencies: []
Estimated Time: 3 hours

## Task 2: Authentication System  
- Implement NextAuth.js
- Create user registration/login
- Setup JWT token handling

Dependencies: [Task 1]
Estimated Time: 5 hours

## Task 3: Product Catalog
- Create product models and API
- Implement search functionality
- Build product listing components

Dependencies: [Task 1, Task 2]
Estimated Time: 8 hours

## Task 4: Shopping Cart
- Implement cart state management
- Create cart UI components
- Add local storage persistence

Dependencies: [Task 2, Task 3]
Estimated Time: 6 hours

## Task 5: Payment Integration
- Setup Stripe configuration
- Implement checkout flow
- Handle payment webhooks

Dependencies: [Task 1, Task 4]
Estimated Time: 10 hours`
      });

      const result = await generateTasks(
        complexInput,
        'test-api-key',
        'gpt-4',
        'https://api.openai.com/v1'
      );

      expect(result.tasks).toHaveLength(5);
      expect(result.tasks[0].title).toContain('Database Setup');
      expect(result.tasks[4].title).toContain('Payment');
      expect(result.tasks[4].dependencies).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle API failures gracefully', async () => {
      mockAI.generate.mockRejectedValue(new Error('API request failed'));

      await expect(
        generateTasks(
          sampleInput,
          'invalid-key',
          'gpt-4',
          'https://api.openai.com/v1'
        )
      ).rejects.toThrow('Failed to generate tasks');
    });

    it('should handle malformed AI response', async () => {
      mockAI.generate.mockResolvedValue({
        output: `# Invalid Task Format

## Some Task Title
Some description without proper markdown structure
- Random bullet point
- Another bullet point

This is not properly structured but should still work.`
      });

      const result = await generateTasks(
        sampleInput,
        'test-api-key',
        'gpt-4',
        'https://api.openai.com/v1'
      );

      // Should still return tasks array even with malformed response
      expect(Array.isArray(result.tasks)).toBe(true);
      expect(result.tasks.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle empty input fields', async () => {
      mockAI.generate.mockResolvedValue({
        output: `# Basic Tasks
## Task 1: Initial Setup
- Setup basic project structure`
      });

      const emptyInput = {
        architecture: '',
        specifications: '',
        fileStructure: ''
      };

      const result = await generateTasks(
        emptyInput,
        'test-api-key',
        'gpt-4',
        'https://api.openai.com/v1'
      );

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].title).toContain('Initial Setup');
    });

    it('should handle network timeouts', async () => {
      mockAI.generate.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      await expect(
        generateTasks(
          sampleInput,
          'test-api-key',
          'gpt-4',
          'https://api.openai.com/v1'
        )
      ).rejects.toThrow('Failed to generate tasks');
    });

    it('should handle missing required parameters', async () => {
      await expect(
        generateTasks(
          sampleInput,
          '', // empty API key
          'gpt-4',
          'https://api.openai.com/v1'
        )
      ).rejects.toThrow();
    });
  });

  describe('Configuration Options', () => {
    it('should handle different AI models', async () => {
      mockAI.generate.mockResolvedValue({
        output: '# Model-specific tasks'
      });

      await generateTasks(
        sampleInput,
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

    it('should handle temperature parameter', async () => {
      mockAI.generate.mockResolvedValue({
        output: '# Temperature-controlled tasks'
      });

      await generateTasks(
        sampleInput,
        'test-key',
        'gpt-4',
        'https://api.openai.com/v1',
        false, // useTDD
        0.9    // temperature
      );

      expect(mockAI.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.9
        })
      );
    });

    it('should use default temperature when not specified', async () => {
      mockAI.generate.mockResolvedValue({
        output: '# Default temperature tasks'
      });

      await generateTasks(
        sampleInput,
        'test-key',
        'gpt-4',
        'https://api.openai.com/v1'
      );

      expect(mockAI.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7 // default value
        })
      );
    });
  });

  describe('Task Structure and Validation', () => {
    it('should generate tasks with proper ID format', async () => {
      mockAI.generate.mockResolvedValue({
        output: `# Task List
## Task 1: First Task
Details here
## Task 2: Second Task  
More details
## Task 3: Third Task
Final details`
      });

      const result = await generateTasks(
        sampleInput,
        'test-api-key',
        'gpt-4',
        'https://api.openai.com/v1'
      );

      expect(result.tasks[0].id).toBe('task-1');
      expect(result.tasks[1].id).toBe('task-2');
      expect(result.tasks[2].id).toBe('task-3');
    });

    it('should assign proper order to tasks', async () => {
      mockAI.generate.mockResolvedValue({
        output: `# Ordered Task List
## Task 1: First
## Task 2: Second
## Task 3: Third`
      });

      const result = await generateTasks(
        sampleInput,
        'test-api-key',
        'gpt-4',
        'https://api.openai.com/v1'
      );

      expect(result.tasks[0].order).toBe(1);
      expect(result.tasks[1].order).toBe(2);
      expect(result.tasks[2].order).toBe(3);
    });

    it('should parse dependencies correctly', async () => {
      mockAI.generate.mockResolvedValue({
        output: `# Task List with Dependencies
## Task 1: Base Task
Dependencies: []
## Task 2: Dependent Task
Dependencies: [Task 1]
## Task 3: Multi-Dependent Task
Dependencies: [Task 1, Task 2]`
      });

      const result = await generateTasks(
        sampleInput,
        'test-api-key',
        'gpt-4',
        'https://api.openai.com/v1'
      );

      expect(result.tasks[0].dependencies).toEqual([]);
      expect(result.tasks[1].dependencies).toEqual(['task-1']);
      expect(result.tasks[2].dependencies).toEqual(['task-1', 'task-2']);
    });

    it('should set initial status for all tasks', async () => {
      mockAI.generate.mockResolvedValue({
        output: `# Task List
## Task 1: First Task
Description of first task
## Task 2: Second Task  
Description of second task`
      });

      const result = await generateTasks(
        sampleInput,
        'test-api-key',
        'gpt-4',
        'https://api.openai.com/v1'
      );

      result.tasks.forEach(task => {
        expect(task.status).toBe('pending');
      });
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle very long input content', async () => {
      const longInput = {
        architecture: 'Very detailed architecture '.repeat(500),
        specifications: 'Extensive specifications '.repeat(500),
        fileStructure: 'Complex file structure '.repeat(500)
      };

      mockAI.generate.mockResolvedValue({
        output: `# Tasks for Large Project
## Task 1: Handle Large Scale Setup
Setup project with extensive architecture consideration`
      });

      const result = await generateTasks(
        longInput,
        'test-api-key',
        'gpt-4',
        'https://api.openai.com/v1'
      );

      expect(Array.isArray(result.tasks)).toBe(true);
      expect(result.tasks.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle special characters in content', async () => {
      const specialInput = {
        architecture: 'Architecture with émojis 🚀 and symbols @#$%',
        specifications: 'Specs with "quotes" and <html> tags',
        fileStructure: 'Files with spaces & special chars'
      };

      mockAI.generate.mockResolvedValue({
        output: '# International project tasks'
      });

      const result = await generateTasks(
        specialInput,
        'test-api-key',
        'gpt-4',
        'https://api.openai.com/v1'
      );

      expect(Array.isArray(result.tasks)).toBe(true);
    });

    it('should handle concurrent task generation requests', async () => {
      mockAI.generate.mockImplementation(() =>
        Promise.resolve({ output: '# Concurrent tasks' })
      );

      const requests = Array(3).fill(null).map((_, i) =>
        generateTasks(
          { ...sampleInput, architecture: `Architecture ${i}` },
          'test-api-key',
          'gpt-4',
          'https://api.openai.com/v1'
        )
      );

      const results = await Promise.all(requests);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(Array.isArray(result.tasks)).toBe(true);
      });
      expect(mockAI.generate).toHaveBeenCalledTimes(3);
    });
  });

  describe('Integration Scenarios', () => {
    it('should generate tasks compatible with project orchestration', async () => {
      mockAI.generate.mockResolvedValue({
        output: `# Orchestration-Ready Tasks

## Task 1: Foundation Setup
- Initialize project repository
- Setup development environment
- Configure CI/CD pipeline

Dependencies: []
Status: Ready for execution
Priority: High

## Task 2: Core Development
- Implement main features
- Add comprehensive tests
- Setup monitoring

Dependencies: [Task 1]
Status: Waiting for dependencies
Priority: High

## Task 3: Deployment Preparation
- Optimize for production
- Setup deployment scripts
- Configure monitoring

Dependencies: [Task 2]
Status: Blocked
Priority: Medium`
      });

      const result = await generateTasks(
        sampleInput,
        'test-api-key',
        'gpt-4',
        'https://api.openai.com/v1'
      );

      expect(result.tasks).toHaveLength(3);
      expect(result.tasks[0].dependencies).toEqual([]);
      expect(result.tasks[1].dependencies).toContain('task-1');
      expect(result.tasks[2].dependencies).toContain('task-2');
    });

    it('should generate research-ready tasks', async () => {
      mockAI.generate.mockResolvedValue({
        output: `# Research-Enhanced Tasks

## Task 1: Technology Research
- Research best practices for React 18
- Evaluate state management options
- Compare UI component libraries

Research Areas: React ecosystem, performance optimization
Dependencies: []

## Task 2: Implementation with Research
- Apply researched best practices
- Implement chosen state management
- Integrate selected UI library

Research Dependencies: [Task 1 research findings]
Dependencies: [Task 1]`
      });

      const result = await generateTasks(
        sampleInput,
        'test-api-key',
        'gpt-4',
        'https://api.openai.com/v1'
      );

      expect(result.tasks[0].details).toContain('Research');
      expect(result.tasks[1].details).toContain('researched best practices');
    });
  });
});