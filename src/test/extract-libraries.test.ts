import { extractLibraries } from '@/ai/flows/extract-libraries';
import { createSmartAIMock, getTestParams, suppressConsoleWarnings } from './test-utils';
import { ai } from '@/ai/litellm';

// Mock the ai module to avoid real API calls during tests
jest.mock('@/ai/litellm', () => ({
  ai: {
    generate: jest.fn()
  }
}));

const mockAI = ai as jest.Mocked<typeof ai>;

describe('extractLibraries AI Flow', () => {
  suppressConsoleWarnings();

  beforeEach(() => {
    jest.clearAllMocks();
    mockAI.generate.mockImplementation(createSmartAIMock());
  });

  describe('basic extraction', () => {
    it('should extract libraries from task details', async () => {
      const input = {
        taskDetails: 'Setup React project with TypeScript and install Express for backend'
      };

      const params = getTestParams();
      const result = await extractLibraries(input, params.apiKey, params.model, params.apiBase);

      expect(result.libraries).toContain('react');
      expect(result.libraries).toContain('typescript');
      expect(result.libraries).toContain('express');
      expect(Array.isArray(result.libraries)).toBe(true);
    });

    it('should handle empty task details', async () => {
      const input = {
        taskDetails: ''
      };

      // Smart mock should handle empty input and return empty array
      const params = getTestParams();
      const result = await extractLibraries(input, params.apiKey, params.model, params.apiBase);

      expect(Array.isArray(result.libraries)).toBe(true);
      expect(result.libraries).toHaveLength(0);
    });

    it('should extract from npm install commands', async () => {
      const input = {
        taskDetails: 'Run npm install lodash moment axios to install dependencies'
      };

      const params = getTestParams();
      const result = await extractLibraries(input, params.apiKey, params.model, params.apiBase);

      expect(result.libraries).toContain('lodash');
      expect(result.libraries).toContain('moment');
      expect(result.libraries).toContain('axios');
    });

    it('should normalize library names correctly', async () => {
      const input = {
        taskDetails: 'Install @types/node and react-router-dom'
      };

      const params = getTestParams();
      const result = await extractLibraries(input, params.apiKey, params.model, params.apiBase);

      // Should normalize scoped packages and handle compound names
      expect(result.libraries).toContain('react-router-dom');
    });
  });

  describe('error handling', () => {
    it('should throw error when model is not provided', async () => {
      const input = {
        taskDetails: 'Some task details'
      };

      await expect(extractLibraries(input)).rejects.toThrow(
        'Model is required. Please provide a model in "provider/model" format in settings.'
      );
    });

    it('should handle API errors gracefully', async () => {
      const input = {
        taskDetails: 'Setup React project'
      };

      // Mock API error
      mockAI.generate.mockRejectedValueOnce(
        new Error('API Error')
      );

      const params = getTestParams();
      await expect(extractLibraries(input, params.apiKey, params.model, params.apiBase))
        .rejects.toThrow('API Error');
    });

    it('should handle unexpected response format', async () => {
      const input = {
        taskDetails: 'Setup React project'
      };

      // Mock unexpected response
      mockAI.generate.mockResolvedValueOnce({
        output: null
      });

      const params = getTestParams();
      await expect(extractLibraries(input, params.apiKey, params.model, params.apiBase))
        .rejects.toThrow('An unexpected response was received from the server.');
    });
  });

  describe('library name validation', () => {
    beforeEach(() => {
      // Mock raw response with mixed valid/invalid names
      mockAI.generate.mockResolvedValue({
        output: 'react\nvalid-library\ninvalid..name\n123invalid\n\nvalid_name\nconfig.font.path'
      });
    });

    it('should filter out invalid library names', async () => {
      const input = {
        taskDetails: 'Various library names'
      };

      const params = getTestParams();
      const result = await extractLibraries(input, params.apiKey, params.model, params.apiBase);

      // Should include valid names
      expect(result.libraries).toContain('react');
      
      // Should exclude invalid formats
      expect(result.libraries).not.toContain('invalid..name');
      expect(result.libraries).not.toContain('123invalid');
      expect(result.libraries).not.toContain('config.font.path');
    });

    it('should handle normalized library names', async () => {
      // Mock response with variations
      mockAI.generate.mockResolvedValue({
        output: 'next.js\nNext.js\nnext\nNextJS\nreact-router\nReact Router'
      });

      const input = {
        taskDetails: 'Setup Next.js with React Router'
      };

      const params = getTestParams();
      const result = await extractLibraries(input, params.apiKey, params.model, params.apiBase);

      // Should normalize variations
      expect(result.libraries).toContain('nextjs');
      expect(result.libraries).toContain('react-router');
      
      // Should remove duplicates
      const nextjsCount = result.libraries.filter(lib => lib === 'nextjs').length;
      expect(nextjsCount).toBe(1);
    });
  });

  describe('output parsing', () => {
    it('should parse newline-separated output', async () => {
      mockAI.generate.mockResolvedValue({
        output: 'react\ntypescript\naxios\n\n# comment line\njest'
      });

      const input = {
        taskDetails: 'Libraries for testing'
      };

      const params = getTestParams();
      const result = await extractLibraries(input, params.apiKey, params.model, params.apiBase);

      expect(result.libraries).toEqual(['react', 'typescript', 'axios', 'jest']);
    });

    it('should remove duplicates from output', async () => {
      mockAI.generate.mockResolvedValue({
        output: 'react\nreact\ntypescript\nreact\naxios'
      });

      const input = {
        taskDetails: 'Duplicate libraries'
      };

      const params = getTestParams();
      const result = await extractLibraries(input, params.apiKey, params.model, params.apiBase);

      expect(result.libraries).toEqual(['react', 'typescript', 'axios']);
    });

    it('should filter out comments and empty lines', async () => {
      mockAI.generate.mockResolvedValue({
        output: 'react\n# This is a comment\n\ntypescript\n// Another comment\naxios\n'
      });

      const input = {
        taskDetails: 'Libraries with comments'
      };

      const params = getTestParams();
      const result = await extractLibraries(input, params.apiKey, params.model, params.apiBase);

      expect(result.libraries).toEqual(['react', 'typescript', 'axios']);
    });
  });
});