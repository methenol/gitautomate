import { generateTasks } from '@/ai/flows/generate-tasks';
import { createSmartAIMock, getTestParams, suppressConsoleWarnings } from './test-utils';
import { ai } from '@/ai/litellm';

// Mock the ai module to avoid real API calls during tests
jest.mock('@/ai/litellm', () => ({
  ai: {
    generate: jest.fn()
  }
}));

const mockAI = ai as jest.Mocked<typeof ai>;

describe('generateTasks AI Flow', () => {
  suppressConsoleWarnings();

  beforeEach(() => {
    jest.clearAllMocks();
    mockAI.generate.mockImplementation(createSmartAIMock());
  });

  describe('basic functionality', () => {
    it('should generate tasks from architecture, specifications, and file structure', async () => {
      const input = {
        architecture: 'React frontend with Node.js backend and PostgreSQL database',
        specifications: 'User authentication, task management, real-time notifications',
        fileStructure: 'src/components/, src/api/, database/'
      };

      // Mock response with bullet-pointed task list
      mockAI.generate.mockResolvedValueOnce({
        output: `- Setup project structure and dependencies
- Configure development environment
- Implement database schema and migrations
- Create user authentication system
- Build task CRUD operations
- Develop real-time notification system
- Implement frontend components
- Add API endpoints for task management
- Setup testing framework
- Configure CI/CD pipeline`
      });

      const params = getTestParams();
      const result = await generateTasks(input, params.apiKey, params.model, params.apiBase);

      expect(result.tasks).toHaveLength(10);
      expect(result.tasks[0].title).toBe('Setup project structure and dependencies');
      expect(result.tasks[1].title).toBe('Configure development environment');
      expect(result.tasks[9].title).toBe('Configure CI/CD pipeline');
      
      // All tasks should have empty details initially
      result.tasks.forEach(task => {
        expect(task.details).toBe('');
      });
    });

    it('should handle TDD mode with different prompt', async () => {
      const input = {
        architecture: 'Express.js API with MongoDB',
        specifications: 'REST API for inventory management',
        fileStructure: 'src/routes/, src/models/, src/controllers/'
      };

      mockAI.generate.mockResolvedValueOnce({
        output: `- Configure the testing environment
- Implement user registration with TDD approach
- Build inventory CRUD operations using TDD
- Create API validation middleware with tests
- Develop error handling with comprehensive test coverage`
      });

      const params = getTestParams();
      const result = await generateTasks(input, params.apiKey, params.model, params.apiBase, true);

      expect(result.tasks).toHaveLength(5);
      expect(result.tasks[0].title).toBe('Configure the testing environment');
      expect(result.tasks[2].title).toBe('Build inventory CRUD operations using TDD');
    });

    it('should require model parameter', async () => {
      const input = {
        architecture: 'Simple web app',
        specifications: 'Basic features',
        fileStructure: 'src/'
      };

      await expect(generateTasks(input)).rejects.toThrow(
        'Model is required. Please provide a model in "provider/model" format in settings.'
      );
    });
  });

  describe('markdown parsing', () => {
    it('should parse bullet points with dash (-) format', async () => {
      const input = {
        architecture: 'Web app architecture',
        specifications: 'User features',
        fileStructure: 'src/'
      };

      mockAI.generate.mockResolvedValueOnce({
        output: `- Create project setup
- Implement authentication
- Build user dashboard
- Add data persistence`
      });

      const params = getTestParams();
      const result = await generateTasks(input, params.apiKey, params.model, params.apiBase);

      expect(result.tasks).toHaveLength(4);
      expect(result.tasks[0].title).toBe('Create project setup');
      expect(result.tasks[3].title).toBe('Add data persistence');
    });

    it('should parse bullet points with asterisk (*) format', async () => {
      const input = {
        architecture: 'App architecture',
        specifications: 'Features',
        fileStructure: 'structure/'
      };

      mockAI.generate.mockResolvedValueOnce({
        output: `* Setup development environment
* Configure database connections
* Build authentication system
* Create user interface components`
      });

      const params = getTestParams();
      const result = await generateTasks(input, params.apiKey, params.model, params.apiBase);

      expect(result.tasks).toHaveLength(4);
      expect(result.tasks[0].title).toBe('Setup development environment');
      expect(result.tasks[2].title).toBe('Build authentication system');
    });

    it('should handle mixed content with headers and text', async () => {
      const input = {
        architecture: 'Modern web app',
        specifications: 'Full-stack features',
        fileStructure: 'organized structure'
      };

      mockAI.generate.mockResolvedValueOnce({
        output: `# Project Tasks

Here are the recommended tasks:

- Initialize project repository
- Setup development tools
- Create base application structure

## Implementation Tasks

- Implement core business logic
- Add user authentication
- Build frontend components

**Note:** These tasks should be completed in order.

- Setup testing framework
- Configure deployment pipeline`
      });

      const params = getTestParams();
      const result = await generateTasks(input, params.apiKey, params.model, params.apiBase);

      expect(result.tasks).toHaveLength(8);
      expect(result.tasks[0].title).toBe('Initialize project repository');
      expect(result.tasks[7].title).toBe('Configure deployment pipeline');
    });

    it('should use fallback parsing for action-based lines', async () => {
      const input = {
        architecture: 'Simple architecture',
        specifications: 'Basic specs',
        fileStructure: 'simple structure'
      };

      // Response without bullet points
      mockAI.generate.mockResolvedValueOnce({
        output: `Setup the project foundation
Implement user authentication system
Create the main dashboard
Configure database connections
Build API endpoints
Add frontend components
Setup testing environment`
      });

      const params = getTestParams();
      const result = await generateTasks(input, params.apiKey, params.model, params.apiBase);

      expect(result.tasks).toHaveLength(7);
      expect(result.tasks[0].title).toBe('Setup the project foundation');
      expect(result.tasks[1].title).toBe('Implement user authentication system');
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const input = {
        architecture: 'Test architecture',
        specifications: 'Test specs',
        fileStructure: 'test structure'
      };

      mockAI.generate.mockRejectedValueOnce(new Error('API Error'));

      const params = getTestParams();
      await expect(generateTasks(input, params.apiKey, params.model, params.apiBase))
        .rejects.toThrow('API Error');
    });

    it('should throw error when no tasks can be extracted', async () => {
      const input = {
        architecture: 'Architecture',
        specifications: 'Specifications',
        fileStructure: 'File structure'
      };

      mockAI.generate.mockResolvedValueOnce({
        output: `# Some heading
This is just text content without any actionable tasks.
No bullet points or task-like content here.`
      });

      const params = getTestParams();
      await expect(generateTasks(input, params.apiKey, params.model, params.apiBase))
        .rejects.toThrow('Failed to extract task titles from generated content');
    });

    it('should handle empty response', async () => {
      const input = {
        architecture: 'Architecture',
        specifications: 'Specifications',
        fileStructure: 'File structure'
      };

      mockAI.generate.mockResolvedValueOnce({
        output: ''
      });

      const params = getTestParams();
      await expect(generateTasks(input, params.apiKey, params.model, params.apiBase))
        .rejects.toThrow('Failed to extract task titles from generated content');
    });
  });

  describe('configuration options', () => {
    it('should pass configuration options to AI service', async () => {
      const input = {
        architecture: 'Test arch',
        specifications: 'Test specs',
        fileStructure: 'Test structure'
      };

      const apiKey = 'test-key';
      const model = 'test/model';
      const apiBase = 'https://api.test.com';
      const temperature = 0.7;

      mockAI.generate.mockResolvedValueOnce({
        output: '- Setup project\n- Build features'
      });

      await generateTasks(input, apiKey, model, apiBase, false, temperature);

      expect(mockAI.generate).toHaveBeenCalledWith({
        model: 'test/model',
        prompt: expect.stringContaining('Test arch'),
        config: {
          apiKey: 'test-key',
          apiBase: 'https://api.test.com',
          temperature: 0.7
        }
      });
    });

    it('should handle undefined configuration gracefully', async () => {
      const input = {
        architecture: 'Architecture',
        specifications: 'Specifications',
        fileStructure: 'File structure'
      };

      mockAI.generate.mockResolvedValueOnce({
        output: '- Task 1\n- Task 2'
      });

      const params = getTestParams();
      await generateTasks(input, undefined, params.model, undefined, false, undefined);

      expect(mockAI.generate).toHaveBeenCalledWith({
        model: expect.any(String),
        prompt: expect.any(String),
        config: undefined
      });
    });
  });

  describe('prompt templates', () => {
    it('should use standard prompt when TDD is false', async () => {
      const input = {
        architecture: 'Test architecture',
        specifications: 'Test specifications',
        fileStructure: 'Test file structure'
      };

      mockAI.generate.mockResolvedValueOnce({
        output: '- Standard task 1\n- Standard task 2'
      });

      const params = getTestParams();
      await generateTasks(input, params.apiKey, params.model, params.apiBase, false);

      const calledPrompt = mockAI.generate.mock.calls[0][0].prompt;
      expect(calledPrompt).toContain('You are a lead software engineer');
      expect(calledPrompt).toContain('Test architecture');
      expect(calledPrompt).toContain('Test specifications');
      expect(calledPrompt).toContain('Test file structure');
      expect(calledPrompt).not.toContain('Test-Driven Development');
    });

    it('should use TDD prompt when TDD is true', async () => {
      const input = {
        architecture: 'TDD architecture',
        specifications: 'TDD specifications',
        fileStructure: 'TDD file structure'
      };

      mockAI.generate.mockResolvedValueOnce({
        output: '- Configure the testing environment\n- TDD task 1\n- TDD task 2'
      });

      const params = getTestParams();
      await generateTasks(input, params.apiKey, params.model, params.apiBase, true);

      const calledPrompt = mockAI.generate.mock.calls[0][0].prompt;
      expect(calledPrompt).toContain('Test-Driven Development');
      expect(calledPrompt).toContain('Configure the testing environment');
      expect(calledPrompt).toContain('TDD architecture');
      expect(calledPrompt).toContain('TDD specifications');
      expect(calledPrompt).toContain('TDD file structure');
    });
  });
});