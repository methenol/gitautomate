import { 
  runGenerateArchitecture, 
  runGenerateTasks, 
  runGenerateFileStructure, 
  runResearchTask 
} from '@/app/actions';
import * as generateArchitectureFlow from '@/ai/flows/generate-architecture';
import * as generateTasksFlow from '@/ai/flows/generate-tasks';
import * as generateFileStructureFlow from '@/ai/flows/generate-file-structure';
import * as researchTaskFlow from '@/ai/flows/research-task';

// Mock all AI flows
jest.mock('@/ai/flows/generate-architecture');
jest.mock('@/ai/flows/generate-tasks');
jest.mock('@/ai/flows/generate-file-structure');
jest.mock('@/ai/flows/research-task');

const mockGenerateArchitecture = generateArchitectureFlow.generateArchitecture as jest.MockedFunction<typeof generateArchitectureFlow.generateArchitecture>;
const mockGenerateTasks = generateTasksFlow.generateTasks as jest.MockedFunction<typeof generateTasksFlow.generateTasks>;
const mockGenerateFileStructure = generateFileStructureFlow.generateFileStructure as jest.MockedFunction<typeof generateFileStructureFlow.generateFileStructure>;
const mockResearchTask = researchTaskFlow.researchTask as jest.MockedFunction<typeof researchTaskFlow.researchTask>;

describe('App Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('runGenerateArchitecture', () => {
    it('should call generateArchitecture with input and options', async () => {
      const input = { prd: 'Build a task management application' };
      const options = { 
        apiKey: 'test-key', 
        model: 'test/model', 
        apiBase: 'https://api.test.com',
        temperature: 0.7 
      };
      
      const mockResult = {
        architecture: 'Generated architecture',
        specifications: 'Generated specifications'
      };
      
      mockGenerateArchitecture.mockResolvedValueOnce(mockResult);

      const result = await runGenerateArchitecture(input, options);

      expect(mockGenerateArchitecture).toHaveBeenCalledWith(
        input,
        'test-key',
        'test/model',
        'https://api.test.com',
        0.7
      );
      expect(result).toBe(mockResult);
    });

    it('should handle undefined options', async () => {
      const input = { prd: 'Build an app' };
      const mockResult = {
        architecture: 'Architecture',
        specifications: 'Specifications'
      };

      mockGenerateArchitecture.mockResolvedValueOnce(mockResult);

      const result = await runGenerateArchitecture(input);

      expect(mockGenerateArchitecture).toHaveBeenCalledWith(
        input,
        undefined,
        undefined,
        undefined,
        undefined
      );
      expect(result).toBe(mockResult);
    });

    it('should handle errors from generateArchitecture', async () => {
      const input = { prd: 'Build an app' };
      const error = new Error('AI generation failed');

      mockGenerateArchitecture.mockRejectedValueOnce(error);

      await expect(runGenerateArchitecture(input)).rejects.toThrow(
        'Failed to generate architecture. The model may have returned an unexpected response.'
      );
    });

    it('should preserve original error if it contains specific messages', async () => {
      const input = { prd: 'Build an app' };
      const error = new Error('Model is required');

      mockGenerateArchitecture.mockRejectedValueOnce(error);

      await expect(runGenerateArchitecture(input)).rejects.toThrow('Model is required');
    });
  });

  describe('runGenerateTasks', () => {
    it('should validate required input fields', async () => {
      const invalidInput = {
        architecture: 'Architecture',
        specifications: '',  // Missing specifications
        fileStructure: 'File structure'
      };

      await expect(runGenerateTasks(invalidInput)).rejects.toThrow(
        'Architecture, specifications, and file structure are required to generate tasks.'
      );
    });

    it('should call generateTasks with all parameters', async () => {
      const input = {
        architecture: 'React with Node.js',
        specifications: 'User auth and CRUD',
        fileStructure: 'src/components/, src/api/'
      };
      const options = {
        apiKey: 'test-key',
        model: 'test/model',
        apiBase: 'https://api.test.com',
        useTDD: true,
        temperature: 0.5
      };

      const mockResult = {
        tasks: [
          { title: 'Setup project', details: '' },
          { title: 'Implement auth', details: '' }
        ]
      };

      mockGenerateTasks.mockResolvedValueOnce(mockResult);

      const result = await runGenerateTasks(input, options);

      expect(mockGenerateTasks).toHaveBeenCalledWith(
        input,
        'test-key',
        'test/model',
        'https://api.test.com',
        true,
        0.5
      );
      expect(result).toBe(mockResult);
    });

    it('should handle missing architecture field', async () => {
      const input = {
        specifications: 'Specifications',
        fileStructure: 'File structure'
      };

      await expect(runGenerateTasks(input as any)).rejects.toThrow(
        'Architecture, specifications, and file structure are required to generate tasks.'
      );
    });

    it('should handle errors from generateTasks', async () => {
      const input = {
        architecture: 'Architecture',
        specifications: 'Specifications',
        fileStructure: 'File structure'
      };

      mockGenerateTasks.mockRejectedValueOnce(new Error('Generation failed'));

      await expect(runGenerateTasks(input)).rejects.toThrow(
        'Failed to generate tasks. The model may have returned an unexpected response.'
      );
    });
  });

  describe('runGenerateFileStructure', () => {
    it('should call generateFileStructure with correct parameters', async () => {
      const input = {
        prd: 'Build a web app',
        architecture: 'Modern web architecture',
        specifications: 'Detailed specifications'
      };
      const options = {
        apiKey: 'test-key',
        model: 'test/model',
        apiBase: 'https://api.test.com',
        temperature: 0.3
      };

      const mockResult = {
        fileStructure: 'Generated file structure'
      };

      mockGenerateFileStructure.mockResolvedValueOnce(mockResult);

      const result = await runGenerateFileStructure(input, options);

      expect(mockGenerateFileStructure).toHaveBeenCalledWith(
        input,
        'test-key',
        'test/model',
        'https://api.test.com',
        0.3
      );
      expect(result).toBe(mockResult);
    });

    it('should handle API key errors with specific message', async () => {
      const input = {
        prd: 'Build an app',
        architecture: 'Architecture',
        specifications: 'Specifications'
      };

      mockGenerateFileStructure.mockRejectedValueOnce(new Error('Invalid API key'));

      await expect(runGenerateFileStructure(input)).rejects.toThrow(
        'Failed to generate file structure: Your LLM API key is missing or invalid. Please check it in settings.'
      );
    });

    it('should handle general errors', async () => {
      const input = {
        prd: 'Build an app',
        architecture: 'Architecture',
        specifications: 'Specifications'
      };

      mockGenerateFileStructure.mockRejectedValueOnce(new Error('Unknown error'));

      await expect(runGenerateFileStructure(input)).rejects.toThrow(
        'File structure generation failed. The model may have returned an unexpected response. Try a different model or adjust the PRD, architecture, or specifications.'
      );
    });
  });

  describe('runResearchTask', () => {
    it('should call researchTask with correct parameters', async () => {
      const input = {
        title: 'Implement user authentication',
        architecture: 'React with JWT',
        specifications: 'Login and registration',
        fileStructure: 'src/auth/'
      };
      const options = {
        apiKey: 'test-key',
        model: 'test/model',
        apiBase: 'https://api.test.com',
        temperature: 0.8
      };

      const mockResult = {
        markdownContent: 'Detailed task implementation'
      };

      mockResearchTask.mockResolvedValueOnce(mockResult);

      const result = await runResearchTask(input, options);

      expect(mockResearchTask).toHaveBeenCalledWith(
        input,
        'test-key',
        'test/model',
        'https://api.test.com',
        0.8
      );
      expect(result).toBe(mockResult);
    });

    it('should handle errors from researchTask', async () => {
      const input = {
        title: 'Test task',
        architecture: 'Test architecture',
        specifications: 'Test specifications',
        fileStructure: 'Test structure'
      };

      mockResearchTask.mockRejectedValueOnce(new Error('Research failed'));

      await expect(runResearchTask(input)).rejects.toThrow(
        'Failed to research task. The model may have returned an unexpected response.'
      );
    });

    it('should handle undefined options', async () => {
      const input = {
        title: 'Test task',
        architecture: 'Test architecture',
        specifications: 'Test specifications',
        fileStructure: 'Test structure'
      };

      const mockResult = {
        markdownContent: 'Task details'
      };

      mockResearchTask.mockResolvedValueOnce(mockResult);

      const result = await runResearchTask(input);

      expect(mockResearchTask).toHaveBeenCalledWith(
        input,
        undefined,
        undefined,
        undefined,
        undefined
      );
      expect(result).toBe(mockResult);
    });
  });

  describe('error handling patterns', () => {
    it('should preserve specific error messages', async () => {
      const specificErrors = [
        'Model is required',
        'API key is required',
        'Invalid model format'
      ];

      for (const errorMessage of specificErrors) {
        mockGenerateArchitecture.mockRejectedValueOnce(new Error(errorMessage));
        
        await expect(runGenerateArchitecture({ prd: 'Test' }))
          .rejects.toThrow(errorMessage);
      }
    });

    it('should provide generic error messages for unexpected errors', async () => {
      const unexpectedError = new Error('Weird internal error');
      
      mockGenerateTasks.mockRejectedValueOnce(unexpectedError);

      const input = {
        architecture: 'Architecture',
        specifications: 'Specifications',
        fileStructure: 'File structure'
      };

      await expect(runGenerateTasks(input)).rejects.toThrow(
        'Failed to generate tasks. The model may have returned an unexpected response.'
      );
    });
  });

  describe('parameter passing', () => {
    it('should handle partial options correctly', async () => {
      const input = { prd: 'Test PRD' };
      const options = {
        apiKey: 'test-key',
        model: 'test/model'
        // Missing apiBase, useTDD, temperature
      };

      mockGenerateArchitecture.mockResolvedValueOnce({
        architecture: 'Architecture',
        specifications: 'Specifications'
      });

      await runGenerateArchitecture(input, options);

      expect(mockGenerateArchitecture).toHaveBeenCalledWith(
        input,
        'test-key',
        'test/model',
        undefined,
        undefined
      );
    });

    it('should handle boolean and number options correctly', async () => {
      const input = {
        architecture: 'Architecture',
        specifications: 'Specifications',
        fileStructure: 'File structure'
      };
      const options = {
        useTDD: false,
        temperature: 0
      };

      mockGenerateTasks.mockResolvedValueOnce({
        tasks: []
      });

      await runGenerateTasks(input, options);

      expect(mockGenerateTasks).toHaveBeenCalledWith(
        input,
        undefined,
        undefined,
        undefined,
        false,
        0
      );
    });
  });
});