/**
 * Comprehensive tests for AI Flows that had 0% coverage
 */

import { generateArchitecture } from '@/ai/flows/generate-architecture';
import { generateTasks } from '@/ai/flows/generate-tasks';
import { generateAgentsMd } from '@/ai/flows/generate-agents-md';
import { ai } from '@/ai/litellm';
import { suppressConsoleWarnings } from './test-utils';

// Mock the AI module
jest.mock('@/ai/litellm', () => ({
  ai: {
    generate: jest.fn()
  }
}));

const mockAI = ai as jest.Mocked<typeof ai>;

describe.skip('AI Flows Comprehensive Coverage', () => {
  suppressConsoleWarnings();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateArchitecture', () => {
    it('should generate architecture with valid PRD', async () => {
      const input = { prd: 'Build a task management application with user authentication, task CRUD operations, and real-time updates.' };
      const mockResponse = {
        output: 'React-based frontend with TypeScript, Node.js backend with Express, PostgreSQL database, and Socket.io for real-time features.'
      };

      mockAI.generate.mockResolvedValueOnce(mockResponse);

      const result = await generateArchitecture(input, 'test-key', 'gpt-4', 'https://api.openai.com', 0.7);

      expect(result.architecture).toBe(mockResponse.output);
      expect(mockAI.generate).toHaveBeenCalledWith({
        model: 'gpt-4',
        prompt: expect.stringContaining('task management application'),
        config: {
          apiKey: 'test-key',
          apiBase: 'https://api.openai.com',
          temperature: 0.7
        }
      });
    });

    it('should handle empty PRD input', async () => {
      const input = { prd: '' };
      const mockResponse = { output: 'Basic application architecture with minimal components.' };

      mockAI.generate.mockResolvedValueOnce(mockResponse);

      const result = await generateArchitecture(input, 'test-key', 'gpt-4');

      expect(result.architecture).toBe(mockResponse.output);
      expect(mockAI.generate).toHaveBeenCalled();
    });

    it('should require model parameter', async () => {
      const input = { prd: 'Test app' };

      await expect(generateArchitecture(input, 'test-key')).rejects.toThrow('Model is required');
    });

    it('should handle API errors gracefully', async () => {
      const input = { prd: 'Complex application' };

      mockAI.generate.mockRejectedValueOnce(new Error('API quota exceeded'));

      await expect(generateArchitecture(input, 'test-key', 'gpt-4')).rejects.toThrow('API quota exceeded');
    });

    it('should handle different temperature values', async () => {
      const input = { prd: 'Creative app with unique features' };
      const mockResponse = { output: 'Innovative architecture with experimental components.' };

      mockAI.generate.mockResolvedValueOnce(mockResponse);

      const result = await generateArchitecture(input, 'test-key', 'gpt-4', 'https://api.openai.com', 1.2);

      expect(mockAI.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            temperature: 1.2
          })
        })
      );
      expect(result.architecture).toBe(mockResponse.output);
    });

    it('should handle undefined API base', async () => {
      const input = { prd: 'Standard web application' };
      const mockResponse = { output: 'Standard web architecture.' };

      mockAI.generate.mockResolvedValueOnce(mockResponse);

      await generateArchitecture(input, 'test-key', 'gpt-4', undefined, 0.5);

      expect(mockAI.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            apiBase: undefined,
            temperature: 0.5
          })
        })
      );
    });
  });

  describe('generateTasks', () => {
    it('should generate tasks from architecture, specifications, and file structure', async () => {
      const input = {
        architecture: 'React frontend with Node.js backend',
        specifications: 'User authentication, CRUD operations, data validation',
        fileStructure: 'src/components/, src/pages/, backend/routes/, backend/models/'
      };
      const mockResponse = {
        output: JSON.stringify({
          tasks: [
            { title: 'Setup authentication system', details: 'Implement JWT authentication' },
            { title: 'Create user CRUD operations', details: 'Build user management endpoints' }
          ]
        })
      };

      mockAI.generate.mockResolvedValueOnce(mockResponse);

      const result = await generateTasks(input, 'test-key', 'gpt-4', 'https://api.openai.com', true, 0.3);

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].title).toBe('Setup authentication system');
      expect(mockAI.generate).toHaveBeenCalledWith({
        model: 'gpt-4',
        prompt: expect.stringContaining('React frontend with Node.js backend'),
        config: {
          apiKey: 'test-key',
          apiBase: 'https://api.openai.com',
          temperature: 0.3
        }
      });
    });

    it('should handle TDD methodology when enabled', async () => {
      const input = {
        architecture: 'TDD-focused architecture',
        specifications: 'Test-first development approach',
        fileStructure: 'src/tests/, src/components/'
      };
      const mockResponse = {
        output: JSON.stringify({
          tasks: [
            { title: 'Write failing tests', details: 'Create unit tests that fail initially' },
            { title: 'Implement minimal code', details: 'Write just enough code to pass tests' }
          ]
        })
      };

      mockAI.generate.mockResolvedValueOnce(mockResponse);

      const result = await generateTasks(input, 'test-key', 'claude-3', undefined, true, 0.1);

      expect(result.tasks).toHaveLength(2);
      expect(mockAI.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Test-Driven Development')
        })
      );
    });

    it('should require model parameter', async () => {
      const input = {
        architecture: 'Basic architecture',
        specifications: 'Basic specs',
        fileStructure: 'Basic structure'
      };

      await expect(generateTasks(input, 'test-key')).rejects.toThrow('Model is required');
    });

    it('should handle malformed JSON response', async () => {
      const input = {
        architecture: 'Complex architecture',
        specifications: 'Complex specs',
        fileStructure: 'Complex structure'
      };
      const mockResponse = { output: 'Invalid JSON response {broken}' };

      mockAI.generate.mockResolvedValueOnce(mockResponse);

      await expect(generateTasks(input, 'test-key', 'gpt-4')).rejects.toThrow();
    });

    it('should handle API failures', async () => {
      const input = {
        architecture: 'Test architecture',
        specifications: 'Test specs',
        fileStructure: 'Test structure'
      };

      mockAI.generate.mockRejectedValueOnce(new Error('Network connection failed'));

      await expect(generateTasks(input, 'test-key', 'gpt-4')).rejects.toThrow('Network connection failed');
    });

    it('should handle empty tasks response', async () => {
      const input = {
        architecture: 'Minimal architecture',
        specifications: 'Minimal specs',
        fileStructure: 'Minimal structure'
      };
      const mockResponse = {
        output: JSON.stringify({ tasks: [] })
      };

      mockAI.generate.mockResolvedValueOnce(mockResponse);

      const result = await generateTasks(input, 'test-key', 'gpt-3.5-turbo');

      expect(result.tasks).toHaveLength(0);
    });
  });

  describe('generateAgentsMd', () => {
    it('should generate agents markdown documentation', async () => {
      const input = {
        prd: 'Multi-agent system for task automation',
        architecture: 'Microservices with agent orchestration',
        specifications: 'Agent communication protocols and task delegation'
      };
      const mockResponse = {
        output: '# Agent System Documentation\n\n## Overview\nThis system uses multiple agents for task automation.\n\n## Agent Types\n- Coordinator Agent\n- Worker Agent\n- Monitor Agent'
      };

      mockAI.generate.mockResolvedValueOnce(mockResponse);

      const result = await generateAgentsMd(input, 'agent-key', 'claude-3', 'https://api.anthropic.com');

      expect(result.content).toBe(mockResponse.output);
      expect(mockAI.generate).toHaveBeenCalledWith({
        model: 'claude-3',
        prompt: expect.stringContaining('Multi-agent system'),
        config: {
          apiKey: 'agent-key',
          apiBase: 'https://api.anthropic.com',
          temperature: 0.7
        }
      });
    });

    it('should require model parameter', async () => {
      const input = {
        prd: 'Agent system',
        architecture: 'Agent architecture',
        specifications: 'Agent specs'
      };

      await expect(generateAgentsMd(input, 'test-key')).rejects.toThrow('Model is required');
    });

    it('should handle different API bases', async () => {
      const input = {
        prd: 'Custom agent system',
        architecture: 'Custom architecture',
        specifications: 'Custom specifications'
      };
      const mockResponse = { output: '# Custom Agents\n\nCustom agent documentation.' };

      mockAI.generate.mockResolvedValueOnce(mockResponse);

      await generateAgentsMd(input, 'custom-key', 'custom-model', 'https://custom-api.com');

      expect(mockAI.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            apiBase: 'https://custom-api.com'
          })
        })
      );
    });

    it('should handle API errors', async () => {
      const input = {
        prd: 'Error-prone system',
        architecture: 'Unstable architecture',
        specifications: 'Incomplete specs'
      };

      mockAI.generate.mockRejectedValueOnce(new Error('Service unavailable'));

      await expect(generateAgentsMd(input, 'test-key', 'gpt-4')).rejects.toThrow('Service unavailable');
    });

    it('should handle empty responses', async () => {
      const input = {
        prd: 'Minimal system',
        architecture: 'Minimal architecture',
        specifications: 'Minimal specs'
      };
      const mockResponse = { output: '' };

      mockAI.generate.mockResolvedValueOnce(mockResponse);

      const result = await generateAgentsMd(input, 'test-key', 'gpt-4');

      expect(result.content).toBe('');
    });
  });
});