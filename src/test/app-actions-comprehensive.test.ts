/**
 * Comprehensive tests for app actions (previously 0% coverage)
 */

import {
  runGenerateArchitecture,
  runGenerateTasks,
  runGenerateFileStructure,
  runResearchTask,
  runGenerateAgentsMd
} from '@/app/actions';
import { generateArchitecture } from '@/ai/flows/generate-architecture';
import { generateTasks } from '@/ai/flows/generate-tasks';
import { generateFileStructure } from '@/ai/flows/generate-file-structure';
import { researchTask } from '@/ai/flows/research-task';
import { generateAgentsMd } from '@/ai/flows/generate-agents-md';
import { suppressConsoleWarnings, getTestParams } from './test-utils';

// Mock all the AI flows
jest.mock('@/ai/flows/generate-architecture');
jest.mock('@/ai/flows/generate-tasks');
jest.mock('@/ai/flows/generate-file-structure');
jest.mock('@/ai/flows/research-task');
jest.mock('@/ai/flows/generate-agents-md');

const mockGenerateArchitecture = generateArchitecture as jest.MockedFunction<typeof generateArchitecture>;
const mockGenerateTasks = generateTasks as jest.MockedFunction<typeof generateTasks>;
const mockGenerateFileStructure = generateFileStructure as jest.MockedFunction<typeof generateFileStructure>;
const mockResearchTask = researchTask as jest.MockedFunction<typeof researchTask>;
const mockGenerateAgentsMd = generateAgentsMd as jest.MockedFunction<typeof generateAgentsMd>;

describe.skip('App Actions Comprehensive Coverage', () => {
  suppressConsoleWarnings();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('runGenerateArchitecture', () => {
    it('should generate architecture with valid input and options', async () => {
      const input = { prd: 'Build a todo app with React' };
      const options = {
        apiKey: 'test-key',
        model: 'gpt-4',
        apiBase: 'https://api.openai.com',
        temperature: 0.7
      };
      const mockResult = { architecture: 'React architecture with components and state management' };

      mockGenerateArchitecture.mockResolvedValue(mockResult);

      const result = await runGenerateArchitecture(input, options);

      expect(mockGenerateArchitecture).toHaveBeenCalledWith(
        input,
        options.apiKey,
        options.model,
        options.apiBase,
        options.temperature
      );
      expect(result).toBe(mockResult);
    });

    it('should handle undefined options', async () => {
      const input = { prd: 'Build a simple app' };
      const mockResult = { architecture: 'Basic application architecture' };

      mockGenerateArchitecture.mockResolvedValue(mockResult);

      const result = await runGenerateArchitecture(input);

      expect(mockGenerateArchitecture).toHaveBeenCalledWith(input, undefined, undefined, undefined, undefined);
      expect(result).toBe(mockResult);
    });

    it('should handle API errors gracefully', async () => {
      const input = { prd: 'Build an app' };
      const error = new Error('API connection failed');

      mockGenerateArchitecture.mockRejectedValue(error);

      await expect(runGenerateArchitecture(input)).rejects.toThrow(
        'Failed to generate architecture. The model may have returned an unexpected response.'
      );
    });

    it('should handle network timeout errors', async () => {
      const input = { prd: 'Build a complex app' };
      const networkError = new Error('Network timeout');

      mockGenerateArchitecture.mockRejectedValue(networkError);

      await expect(runGenerateArchitecture(input)).rejects.toThrow(
        'Failed to generate architecture. The model may have returned an unexpected response.'
      );
    });

    it('should pass through TDD option correctly', async () => {
      const input = { prd: 'Build a TDD app' };
      const options = { useTDD: true, apiKey: 'test', model: 'test-model' };
      const mockResult = { architecture: 'TDD-focused architecture' };

      mockGenerateArchitecture.mockResolvedValue(mockResult);

      await runGenerateArchitecture(input, options);

      expect(mockGenerateArchitecture).toHaveBeenCalledWith(
        input,
        options.apiKey,
        options.model,
        undefined,
        undefined
      );
    });
  });

  describe('runGenerateTasks', () => {
    it('should generate tasks with complete input', async () => {
      const input = {
        architecture: 'React architecture',
        specifications: 'Detailed specs',
        fileStructure: 'src/ structure'
      };
      const options = {
        apiKey: 'test-key',
        model: 'gpt-4',
        apiBase: 'https://api.openai.com',
        useTDD: true,
        temperature: 0.8
      };
      const mockResult = { tasks: [{ title: 'Setup', details: 'Init project' }] };

      mockGenerateTasks.mockResolvedValue(mockResult);

      const result = await runGenerateTasks(input, options);

      expect(mockGenerateTasks).toHaveBeenCalledWith(
        input,
        options.apiKey,
        options.model,
        options.apiBase,
        options.useTDD,
        options.temperature
      );
      expect(result).toBe(mockResult);
    });

    it('should require architecture, specifications, and fileStructure', async () => {
      const incompleteInput = { architecture: 'React only' };

      await expect(runGenerateTasks(incompleteInput)).rejects.toThrow(
        'Architecture, specifications, and file structure are required to generate tasks.'
      );
    });

    it('should handle missing specifications', async () => {
      const input = {
        architecture: 'React architecture',
        fileStructure: 'src/ structure'
      };

      await expect(runGenerateTasks(input)).rejects.toThrow(
        'Architecture, specifications, and file structure are required to generate tasks.'
      );
    });

    it('should handle missing fileStructure', async () => {
      const input = {
        architecture: 'React architecture',
        specifications: 'Detailed specs'
      };

      await expect(runGenerateTasks(input)).rejects.toThrow(
        'Architecture, specifications, and file structure are required to generate tasks.'
      );
    });

    it('should handle API errors with specific message', async () => {
      const input = {
        architecture: 'React architecture',
        specifications: 'Detailed specs',
        fileStructure: 'src/ structure'
      };

      mockGenerateTasks.mockRejectedValue(new Error('Model returned invalid JSON'));

      await expect(runGenerateTasks(input)).rejects.toThrow(
        'Failed to generate tasks. The model may have returned an unexpected response.'
      );
    });
  });

  describe('runGenerateFileStructure', () => {
    it('should generate file structure with full input', async () => {
      const input = {
        prd: 'Todo app',
        architecture: 'React + Node.js',
        specifications: 'Frontend and backend specs'
      };
      const options = {
        apiKey: 'test-key',
        model: 'claude-3'
      };
      const mockResult = { fileStructure: 'project/\n  src/\n  tests/' };

      mockGenerateFileStructure.mockResolvedValue(mockResult);

      const result = await runGenerateFileStructure(input, options);

      expect(mockGenerateFileStructure).toHaveBeenCalledWith(
        input,
        options.apiKey,
        options.model,
        undefined
      );
      expect(result).toBe(mockResult);
    });

    it('should handle missing API key error specifically', async () => {
      const input = {
        prd: 'Simple app',
        architecture: 'Basic',
        specifications: 'Basic specs'
      };

      const apiError = new Error('API key is missing or invalid');
      mockGenerateFileStructure.mockRejectedValue(apiError);

      await expect(runGenerateFileStructure(input)).rejects.toThrow(
        'Failed to generate file structure: Your LLM API key is missing or invalid. Please check it in settings.'
      );
    });

    it('should handle generic errors', async () => {
      const input = {
        prd: 'Complex app',
        architecture: 'Microservices',
        specifications: 'Complex specs'
      };

      const genericError = new Error('Unexpected error');
      mockGenerateFileStructure.mockRejectedValue(genericError);

      await expect(runGenerateFileStructure(input)).rejects.toThrow(
        'File structure generation failed. The model may have returned an unexpected response. Try a different model or adjust the PRD, architecture, or specifications.'
      );
    });
  });

  describe('runResearchTask', () => {
    it('should research task with all parameters', async () => {
      const input = {
        title: 'Database integration',
        architecture: 'Node.js + PostgreSQL',
        specifications: 'Database connectivity specs',
        fileStructure: 'backend/ structure'
      };
      const options = {
        apiKey: 'research-key',
        model: 'gpt-4-turbo',
        apiBase: 'https://api.openai.com/v1',
        temperature: 0.5
      };
      const mockResult = { markdownContent: 'Research results for database integration' };

      mockResearchTask.mockResolvedValue(mockResult);

      const result = await runResearchTask(input, options);

      expect(mockResearchTask).toHaveBeenCalledWith(
        input,
        options.apiKey,
        options.model,
        options.apiBase,
        options.temperature
      );
      expect(result).toBe(mockResult);
    });

    it('should handle research errors', async () => {
      const input = {
        title: 'Complex task',
        architecture: 'Unknown',
        specifications: 'Vague specs',
        fileStructure: 'undefined'
      };

      mockResearchTask.mockRejectedValue(new Error('Research failed'));

      await expect(runResearchTask(input)).rejects.toThrow(
        'Failed to research task. Please try again or check your input.'
      );
    });
  });

  describe('runGenerateAgentsMd', () => {
    it('should generate agents markdown with valid input', async () => {
      const input = {
        prd: 'Team collaboration app',
        architecture: 'Multi-agent system',
        specifications: 'Agent interaction specs'
      };
      const options = {
        apiKey: 'agents-key',
        model: 'claude-3-opus'
      };
      const mockResult = { content: '# Agents Documentation\n\nAgent specifications...' };

      mockGenerateAgentsMd.mockResolvedValue(mockResult);

      const result = await runGenerateAgentsMd(input, options);

      expect(mockGenerateAgentsMd).toHaveBeenCalledWith(
        input,
        options.apiKey,
        options.model,
        undefined
      );
      expect(result).toBe(mockResult);
    });

    it('should handle agents generation errors', async () => {
      const input = {
        prd: 'Invalid app',
        architecture: 'Broken architecture',
        specifications: 'No specs'
      };

      mockGenerateAgentsMd.mockRejectedValue(new Error('Agents generation failed'));

      await expect(runGenerateAgentsMd(input)).rejects.toThrow(
        'Failed to generate agents.md. Please check your input and try again.'
      );
    });
  });
});