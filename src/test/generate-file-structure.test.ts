import { generateFileStructure } from '@/ai/flows/generate-file-structure';
import { createSmartAIMock, getTestParams, suppressConsoleWarnings } from './test-utils';
import { ai } from '@/ai/litellm';

// Mock the ai module to avoid real API calls during tests
jest.mock('@/ai/litellm', () => ({
  ai: {
    generate: jest.fn()
  }
}));

// Mock the MarkdownLinter to return valid results
jest.mock('@/services/markdown-linter', () => ({
  MarkdownLinter: {
    lintAndFix: jest.fn().mockResolvedValue({
      isValid: true,
      fixedContent: null,
      errors: []
    })
  }
}));

const mockAI = ai as jest.Mocked<typeof ai>;

describe('generateFileStructure AI Flow', () => {
  suppressConsoleWarnings();

  beforeEach(() => {
    jest.clearAllMocks();
    mockAI.generate.mockImplementation(createSmartAIMock());
    
    // Reset console.log mock
    const consoleSpy = jest.spyOn(console, 'log');
    consoleSpy.mockClear();
  });

  describe('basic functionality', () => {
    it('should generate file structure from PRD, architecture, and specifications', async () => {
      const input = {
        prd: 'Build a task management web application',
        architecture: 'React frontend with Node.js backend and PostgreSQL database',
        specifications: 'User authentication, task CRUD, real-time notifications'
      };

      // Mock response with comprehensive file structure
      mockAI.generate.mockResolvedValueOnce({
        output: `\`\`\`
task-manager/
  src/
    components/
      auth/
        Login.tsx
        Register.tsx
      tasks/
        TaskList.tsx
        TaskItem.tsx
      common/
        Header.tsx
        Footer.tsx
    pages/
      HomePage.tsx
      DashboardPage.tsx
    api/
      auth.ts
      tasks.ts
    utils/
      helpers.ts
      constants.ts
  server/
    routes/
      auth.js
      tasks.js
    models/
      User.js
      Task.js
    middleware/
      auth.js
    config/
      database.js
  package.json
  README.md
  .env.example
\`\`\``
      });

      const params = getTestParams();
      const result = await generateFileStructure(input, params.apiKey, params.model, params.apiBase);

      expect(result.fileStructure).toContain('task-manager/');
      expect(result.fileStructure).toContain('components/');
      expect(result.fileStructure).toContain('routes/');
      expect(result.fileStructure).toContain('package.json');
      expect(result.fileStructure).toContain('README.md');
    });

    it('should handle Python/Flask project structure', async () => {
      const input = {
        prd: 'Create an inventory management API',
        architecture: 'Python Flask with MongoDB and JWT authentication',
        specifications: 'REST API for inventory CRUD operations'
      };

      mockAI.generate.mockResolvedValueOnce({
        output: `\`\`\`
inventory-api/
  app/
    __init__.py
    models/
      __init__.py
      inventory.py
      user.py
    routes/
      __init__.py
      auth.py
      inventory.py
    utils/
      auth_utils.py
      validators.py
  tests/
    test_auth.py
    test_inventory.py
    conftest.py
  config/
    __init__.py
    config.py
  requirements.txt
  app.py
  .env.example
  README.md
\`\`\``
      });

      const params = getTestParams();
      const result = await generateFileStructure(input, params.apiKey, params.model, params.apiBase);

      expect(result.fileStructure).toContain('inventory-api/');
      expect(result.fileStructure).toContain('models/');
      expect(result.fileStructure).toContain('tests/');
      expect(result.fileStructure).toContain('requirements.txt');
      expect(result.fileStructure).toContain('__init__.py');
    });

    it('should require model parameter', async () => {
      const input = {
        prd: 'Build a simple app',
        architecture: 'Simple architecture',
        specifications: 'Basic specs'
      };

      await expect(generateFileStructure(input)).rejects.toThrow(
        'Model is required. Please provide a model in "provider/model" format in settings.'
      );
    });

    it('should log debug information', async () => {
      const input = {
        prd: 'Test PRD',
        architecture: 'Test architecture',
        specifications: 'Test specifications'
      };

      mockAI.generate.mockResolvedValueOnce({
        output: '```\ntest-project/\n  src/\n    index.js\n```'
      });

      const consoleSpy = jest.spyOn(console, 'log');
      const params = getTestParams();
      
      await generateFileStructure(input, params.apiKey, params.model, params.apiBase);

      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] generateFileStructure called with model:', params.model);
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const input = {
        prd: 'Test PRD',
        architecture: 'Test architecture',
        specifications: 'Test specifications'
      };

      mockAI.generate.mockRejectedValueOnce(new Error('API Error'));

      const params = getTestParams();
      await expect(generateFileStructure(input, params.apiKey, params.model, params.apiBase))
        .rejects.toThrow('API Error');
    });

    it('should handle empty response', async () => {
      const input = {
        prd: 'Test PRD',
        architecture: 'Test architecture',  
        specifications: 'Test specifications'
      };

      mockAI.generate.mockResolvedValueOnce({
        output: null
      });

      const params = getTestParams();
      await expect(generateFileStructure(input, params.apiKey, params.model, params.apiBase))
        .rejects.toThrow('An unexpected response was received from the server.');
    });

    it('should retry on markdown linting failures', async () => {
      const input = {
        prd: 'Test PRD',
        architecture: 'Test architecture',
        specifications: 'Test specifications'
      };

      // Mock MarkdownLinter to fail initially
      const { MarkdownLinter } = require('@/services/markdown-linter');
      MarkdownLinter.lintAndFix
        .mockResolvedValueOnce({ isValid: false, fixedContent: null, errors: ['Invalid markdown'] })
        .mockResolvedValueOnce({ isValid: false, fixedContent: null, errors: ['Invalid markdown'] })
        .mockResolvedValueOnce({ isValid: true, fixedContent: 'Fixed content', errors: [] });

      mockAI.generate.mockResolvedValue({
        output: '```\ntest-structure/\n```'
      });

      const params = getTestParams();
      const result = await generateFileStructure(input, params.apiKey, params.model, params.apiBase);

      expect(result.fileStructure).toBe('Fixed content');
      expect(mockAI.generate).toHaveBeenCalledTimes(3); // Should retry
    });

    it('should return best available content after max retries', async () => {
      const input = {
        prd: 'Test PRD',
        architecture: 'Test architecture',
        specifications: 'Test specifications'
      };

      // Mock MarkdownLinter to always fail
      const { MarkdownLinter } = require('@/services/markdown-linter');
      MarkdownLinter.lintAndFix.mockResolvedValue({
        isValid: false,
        fixedContent: 'Partially fixed content',
        errors: ['Some markdown errors']
      });

      mockAI.generate.mockResolvedValue({
        output: '```\ntest-structure/\n```'
      });

      const params = getTestParams();
      const result = await generateFileStructure(input, params.apiKey, params.model, params.apiBase);

      expect(result.fileStructure).toBe('Partially fixed content');
      expect(mockAI.generate).toHaveBeenCalledTimes(3); // Should exhaust retries
    });
  });

  describe('configuration options', () => {
    it('should pass configuration options to AI service', async () => {
      const input = {
        prd: 'Test PRD',
        architecture: 'Test architecture',
        specifications: 'Test specifications'
      };

      const apiKey = 'test-key';
      const model = 'test/model';
      const apiBase = 'https://api.test.com';
      const temperature = 0.3;

      mockAI.generate.mockResolvedValueOnce({
        output: '```\ntest-project/\n  src/\n    index.js\n```'
      });

      await generateFileStructure(input, apiKey, model, apiBase, temperature);

      expect(mockAI.generate).toHaveBeenCalledWith({
        model: 'test/model',
        prompt: expect.stringContaining('Test PRD'),
        config: {
          apiKey: 'test-key',
          apiBase: 'https://api.test.com',
          temperature: 0.3
        }
      });
    });

    it('should handle undefined configuration gracefully', async () => {
      const input = {
        prd: 'Test PRD',
        architecture: 'Test architecture',
        specifications: 'Test specifications'
      };

      mockAI.generate.mockResolvedValueOnce({
        output: '```\ntest-project/\n```'
      });

      const params = getTestParams();
      await generateFileStructure(input, undefined, params.model, undefined, undefined);

      expect(mockAI.generate).toHaveBeenCalledWith({
        model: expect.any(String),
        prompt: expect.any(String),
        config: undefined
      });
    });
  });

  describe('prompt template', () => {
    it('should include all input parameters in the prompt', async () => {
      const input = {
        prd: 'Custom PRD content',
        architecture: 'Custom architecture details',
        specifications: 'Custom specification requirements'
      };

      mockAI.generate.mockResolvedValueOnce({
        output: '```\ncustom-project/\n  src/\n```'
      });

      const params = getTestParams();
      await generateFileStructure(input, params.apiKey, params.model, params.apiBase);

      const calledPrompt = mockAI.generate.mock.calls[0][0].prompt;
      expect(calledPrompt).toContain('Custom PRD content');
      expect(calledPrompt).toContain('Custom architecture details');
      expect(calledPrompt).toContain('Custom specification requirements');
      expect(calledPrompt).toContain('senior software architect');
      expect(calledPrompt).toContain('file and folder structure');
    });

    it('should include instructions for markdown output', async () => {
      const input = {
        prd: 'Test PRD',
        architecture: 'Test architecture',
        specifications: 'Test specifications'
      };

      mockAI.generate.mockResolvedValueOnce({
        output: '```\ntest-project/\n```'
      });

      const params = getTestParams();
      await generateFileStructure(input, params.apiKey, params.model, params.apiBase);

      const calledPrompt = mockAI.generate.mock.calls[0][0].prompt;
      expect(calledPrompt).toContain('CRITICAL: You MUST output ONLY valid markdown format');
      expect(calledPrompt).toContain('DO NOT output JSON format');
      expect(calledPrompt).toContain('tree notation');
      expect(calledPrompt).toContain('code block');
    });
  });

  describe('markdown linting integration', () => {
    it('should call MarkdownLinter with correct parameters', async () => {
      const input = {
        prd: 'Test PRD',
        architecture: 'Test architecture',
        specifications: 'Test specifications'
      };

      const mockOutput = '```\ntest-structure/\n  src/\n    index.js\n```';
      mockAI.generate.mockResolvedValueOnce({
        output: mockOutput
      });

      const { MarkdownLinter } = require('@/services/markdown-linter');
      const params = getTestParams();
      
      await generateFileStructure(input, params.apiKey, params.model, params.apiBase);

      expect(MarkdownLinter.lintAndFix).toHaveBeenCalledWith(mockOutput, 'file-structure.md');
    });

    it('should return fixed content when linter provides it', async () => {
      const input = {
        prd: 'Test PRD',
        architecture: 'Test architecture',
        specifications: 'Test specifications'
      };

      mockAI.generate.mockResolvedValueOnce({
        output: 'Original content'
      });

      const { MarkdownLinter } = require('@/services/markdown-linter');
      MarkdownLinter.lintAndFix.mockResolvedValueOnce({
        isValid: true,
        fixedContent: 'Linted and fixed content',
        errors: []
      });

      const params = getTestParams();
      const result = await generateFileStructure(input, params.apiKey, params.model, params.apiBase);

      expect(result.fileStructure).toBe('Linted and fixed content');
    });
  });
});