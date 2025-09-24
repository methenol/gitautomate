import { researchTask } from '@/ai/flows/research-task';
import { createSmartAIMock, getTestParams, suppressConsoleWarnings } from './test-utils';
import { ai } from '@/ai/litellm';

// Mock the ai module to avoid real API calls during tests
jest.mock('@/ai/litellm', () => ({
  ai: {
    generate: jest.fn()
  }
}));

const mockAI = ai as jest.Mocked<typeof ai>;

describe('researchTask AI Flow', () => {
  suppressConsoleWarnings();

  beforeEach(() => {
    jest.clearAllMocks();
    // Use a simpler mock that just returns the expected output for research tasks
    mockAI.generate.mockImplementation(async ({ prompt }: { prompt: string }) => {
      if (prompt.includes('Test task')) {
        return { output: 'Task research content' };
      }
      return { output: 'Default research content' };
    });
  });

  describe('basic functionality', () => {
    it('should research task details and return enhanced task information', async () => {
      const input = {
        title: 'Implement user authentication system',
        architecture: 'React frontend with JWT authentication',
        specifications: 'Email/password login with secure session management',
        fileStructure: 'src/auth/, src/components/auth/'
      };

      // Mock response with detailed task research
      mockAI.generate.mockResolvedValueOnce({
        output: `# Task Research: Implement user authentication system

## Context
This task involves creating a secure authentication system for the web application using JWT tokens and React components.

## Implementation Steps
1. Setup authentication middleware for JWT validation
2. Create login and registration forms in React
3. Implement secure password hashing with bcrypt
4. Setup JWT token generation and validation
5. Create protected route components
6. Add logout functionality with token cleanup

## Required Libraries
jsonwebtoken, bcryptjs, react-hook-form, axios

## Documentation
Refer to the JWT and bcryptjs documentation for security best practices.

## Acceptance Criteria
- Users can register with email and password
- Login returns a valid JWT token
- Protected routes require authentication
- Passwords are securely hashed
- Token expires after appropriate time period`
      });

      const params = getTestParams();
      const result = await researchTask(input, params.apiKey, params.model, params.apiBase);

      expect(result.markdownContent).toContain('Implementation Steps');
      expect(result.markdownContent).toContain('Required Libraries');
      expect(result.markdownContent).toContain('Acceptance Criteria');
      expect(result.markdownContent).toContain('jsonwebtoken');
      expect(result.markdownContent).toContain('bcryptjs');
    });

    it('should handle task research for frontend components', async () => {
      const input = {
        title: 'Create responsive dashboard UI',
        architecture: 'React with Tailwind CSS',
        specifications: 'Responsive design with charts and tables',
        fileStructure: 'src/components/dashboard/, src/styles/'
      };

      mockAI.generate.mockResolvedValueOnce({
        output: `# Task Research: Create responsive dashboard UI

## Context
Building a responsive dashboard interface using React and Tailwind CSS for data visualization.

## Implementation Steps
1. Create dashboard layout component with grid system
2. Implement chart components using Chart.js
3. Build data table components with sorting/filtering
4. Add responsive breakpoints for mobile/tablet
5. Style components with Tailwind CSS utilities
6. Implement loading states and error handling

## Required Libraries
react, tailwindcss, chart.js, react-chartjs-2, react-table

## Documentation
Review Chart.js and Tailwind CSS documentation for implementation details.

## Acceptance Criteria
- Dashboard is fully responsive on all screen sizes
- Charts display data correctly with interactions
- Tables support sorting and filtering
- Loading states are shown during data fetch
- Error states are handled gracefully`
      });

      const params = getTestParams();
      const result = await researchTask(input, params.apiKey, params.model, params.apiBase);

      expect(result.markdownContent).toContain('responsive');
      expect(result.markdownContent).toContain('Chart.js');
      expect(result.markdownContent).toContain('Tailwind CSS');
    });

    it('should require model parameter', async () => {
      const input = {
        title: 'Test task',
        architecture: 'Test architecture',
        specifications: 'Test specifications',
        fileStructure: 'Test structure'
      };

      await expect(researchTask(input)).rejects.toThrow(
        'Model is required. Please provide a model in "provider/model" format in settings.'
      );
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const input = {
        title: 'Test task',
        architecture: 'Test architecture',
        specifications: 'Test specifications',
        fileStructure: 'Test structure'
      };

      mockAI.generate.mockRejectedValueOnce(new Error('API Error'));

      const params = getTestParams();
      await expect(researchTask(input, params.apiKey, params.model, params.apiBase))
        .rejects.toThrow('API Error');
    });

    it('should handle empty response', async () => {
      const input = {
        title: 'Test task',
        architecture: 'Test architecture',
        specifications: 'Test specifications',
        fileStructure: 'Test structure'
      };

      mockAI.generate.mockResolvedValueOnce({
        output: null
      });

      const params = getTestParams();
      await expect(researchTask(input, params.apiKey, params.model, params.apiBase))
        .rejects.toThrow('An unexpected response was received from the server.');
    });

    it('should handle malformed response gracefully', async () => {
      const input = {
        title: 'Test task',
        architecture: 'Test architecture',
        specifications: 'Test specifications',
        fileStructure: 'Test structure'
      };

      mockAI.generate.mockResolvedValueOnce({
        output: 'Invalid response format without proper structure'
      });

      const params = getTestParams();
      const result = await researchTask(input, params.apiKey, params.model, params.apiBase);

      expect(result.markdownContent).toBe('Invalid response format without proper structure');
    });
  });

  describe('configuration options', () => {
    it('should pass configuration options to AI service', async () => {
      const input = {
        title: 'Test task',
        architecture: 'Test architecture',
        specifications: 'Test specifications',
        fileStructure: 'Test structure'
      };

      const apiKey = 'test-key';
      const model = 'test/model';
      const apiBase = 'https://api.test.com';
      const temperature = 0.8;

      mockAI.generate.mockResolvedValueOnce({
        output: 'Task research content'
      });

      await researchTask(input, apiKey, model, apiBase, temperature);

      expect(mockAI.generate).toHaveBeenCalledWith({
        model: 'test/model',
        prompt: expect.stringContaining('Test task'),
        config: {
          apiKey: 'test-key',
          apiBase: 'https://api.test.com',
          temperature: 0.8
        }
      });
    });

    it('should handle undefined configuration gracefully', async () => {
      const input = {
        title: 'Test task',
        architecture: 'Test architecture',
        specifications: 'Test specifications',
        fileStructure: 'Test structure'
      };

      mockAI.generate.mockResolvedValueOnce({
        output: 'Task research content'
      });

      const params = getTestParams();
      await researchTask(input, undefined, params.model, undefined, undefined);

      expect(mockAI.generate).toHaveBeenCalledWith({
        model: expect.any(String),
        prompt: expect.any(String),
        config: undefined
      });
    });
  });

  describe('prompt template', () => {
    it('should include all context information in the prompt', async () => {
      const input = {
        title: 'Test task',
        architecture: 'Test architecture',
        specifications: 'Test specifications',
        fileStructure: 'Test structure'
      };

      mockAI.generate.mockResolvedValueOnce({
        output: 'Task research content'
      });

      const params = getTestParams();
      await researchTask(input, params.apiKey, params.model, params.apiBase);

      const calledPrompt = mockAI.generate.mock.calls[0][0].prompt;
      expect(calledPrompt).toContain('Test task');
      expect(calledPrompt).toContain('Test architecture');
      expect(calledPrompt).toContain('Test specifications');
      expect(calledPrompt).toContain('Test structure');
    });

    it('should include required sections in prompt', async () => {
      const input = {
        title: 'Test task',
        architecture: 'Test architecture',
        specifications: 'Test specifications',
        fileStructure: 'Test structure'
      };

      mockAI.generate.mockResolvedValueOnce({
        output: 'Task research content'
      });

      const params = getTestParams();
      await researchTask(input, params.apiKey, params.model, params.apiBase);

      const calledPrompt = mockAI.generate.mock.calls[0][0].prompt;
      expect(calledPrompt).toContain('Implementation Steps');
      expect(calledPrompt).toContain('Required Libraries');
      expect(calledPrompt).toContain('Documentation');
      expect(calledPrompt).toContain('Acceptance Criteria');
      expect(calledPrompt).toContain('Context');
    });

    it('should include markdown formatting instructions', async () => {
      const input = {
        title: 'Test task',
        architecture: 'Test architecture',
        specifications: 'Test specifications',
        fileStructure: 'Test structure'
      };

      mockAI.generate.mockResolvedValueOnce({
        output: 'Task research content'
      });

      const params = getTestParams();
      await researchTask(input, params.apiKey, params.model, params.apiBase);

      const calledPrompt = mockAI.generate.mock.calls[0][0].prompt;
      expect(calledPrompt).toContain('CRITICAL: You MUST output ONLY valid markdown format');
      expect(calledPrompt).toContain('DO NOT output JSON format');
      expect(calledPrompt).toContain('markdown format');
    });
  });

  describe('task enhancement', () => {
    it('should preserve content in research output', async () => {
      const input = {
        title: 'Original Task Title',
        architecture: 'Test architecture',
        specifications: 'Test specifications',
        fileStructure: 'Test structure'
      };

      mockAI.generate.mockResolvedValueOnce({
        output: 'Enhanced task details with research and context'
      });

      const params = getTestParams();
      const result = await researchTask(input, params.apiKey, params.model, params.apiBase);

      expect(result.markdownContent).toBe('Enhanced task details with research and context');
    });

    it('should handle tasks with database operations', async () => {
      const input = {
        title: 'Implement data persistence layer',
        architecture: 'Node.js with PostgreSQL',
        specifications: 'User and task data models with relationships',
        fileStructure: 'src/models/, src/migrations/'
      };

      mockAI.generate.mockResolvedValueOnce({
        output: `# Task Research: Implement data persistence layer

## Context
Setting up PostgreSQL database with Node.js for user and task data management.

## Implementation Steps
1. Setup PostgreSQL connection with connection pooling
2. Create database migrations for user and task tables
3. Implement data models with relationships
4. Add database query methods for CRUD operations
5. Setup transaction handling for data integrity
6. Implement database indexes for performance

## Required Libraries
pg, knex, bcryptjs

## Documentation
PostgreSQL and Knex.js documentation for query building and migrations.

## Acceptance Criteria
- Database schema matches data model requirements
- All CRUD operations work correctly
- Data relationships are properly enforced
- Database queries are optimized with proper indexes`
      });

      const params = getTestParams();
      const result = await researchTask(input, params.apiKey, params.model, params.apiBase);

      expect(result.markdownContent).toContain('PostgreSQL');
      expect(result.markdownContent).toContain('migrations');
      expect(result.markdownContent).toContain('CRUD operations');
      expect(result.markdownContent).toContain('pg, knex');
    });
  });
});