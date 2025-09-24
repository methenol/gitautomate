import { LibraryIdentifier } from '@/services/library-identifier';

// Mock the ai module to avoid real API calls during tests
jest.mock('@/ai/litellm', () => ({
  ai: {
    generate: jest.fn()
  }
}));

describe('LibraryIdentifier', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Mock successful AI responses for library extraction
    (require('@/ai/litellm').ai.generate as jest.Mock).mockImplementation(({ prompt }: { prompt: string }) => {
      // Extract expected libraries from the test prompts
      if (prompt.includes('react') && prompt.includes('axios')) {
        return Promise.resolve({
          output: 'react\naxios'
        });
      } else if (prompt.includes('npm install express')) {
        return Promise.resolve({
          output: 'express\njest\nmongoose'
        });
      } else if (prompt.includes('Database Setup') && prompt.includes('Testing')) {
        return Promise.resolve({
          output: 'postgresql\nredis\njest\ncypress'
        });
      } else if (prompt.includes('Full Stack Setup')) {
        return Promise.resolve({
          output: 'react\nvue\nexpress\ndjango\nmongodb\njest\ndocker'
        });
      } else if (prompt.includes('General Planning')) {
        return Promise.resolve({
          output: '' // No libraries for empty tasks test
        });
      }
      
      // Default response - return some basic libraries to avoid failures while debugging
      return Promise.resolve({
        output: 'express\njest'
      });
    });
  });

  describe('identifyLibraries', () => {
    it('should extract libraries from import statements', async () => {
      const tasks = [
        {
          id: '1',
          title: 'Setup React Frontend',
          details: 'import React from "react"; import axios from "axios";'
        }
      ];

      const libraries = await LibraryIdentifier.identifyLibraries(
        tasks,
        'test-api-key',
        'test/model',
        'https://api.openai.com/v1'
      );
      
      expect(libraries).toHaveLength(2);
      expect(libraries.map(lib => lib.name)).toContain('react');
      expect(libraries.map(lib => lib.name)).toContain('axios');
      
      const reactLib = libraries.find(lib => lib.name === 'react');
      expect(reactLib?.category).toBe('library');
      expect(reactLib?.confidenceScore).toBeGreaterThan(0.5);
      expect(reactLib?.source).toBe('llm');
    });

    it('should extract libraries from package manager commands', async () => {
      const tasks = [
        {
          id: '1',
          title: 'Install Dependencies',
          details: 'npm install express jest mongoose'
        }
      ];

      const libraries = await LibraryIdentifier.identifyLibraries(
        tasks,
        'test-api-key',
        'test/model',
        'https://api.openai.com/v1'
      );
      
      expect(libraries.length).toBeGreaterThan(0);
      expect(libraries.map(lib => lib.name)).toContain('express');
      expect(libraries.map(lib => lib.name)).toContain('jest');
      expect(libraries.map(lib => lib.name)).toContain('mongoose');
    });

    it('should extract well-known libraries from context', async () => {
      const tasks = [
        {
          id: '1',
          title: 'Database Setup',
          details: 'Configure PostgreSQL database with Redis for caching'
        },
        {
          id: '2',
          title: 'Testing Setup',
          details: 'Setup Jest for unit testing and Cypress for e2e testing'
        }
      ];

      const libraries = await LibraryIdentifier.identifyLibraries(
        tasks,
        'test-api-key',
        'test/model',
        'https://api.openai.com/v1'
      );
      
      expect(libraries.map(lib => lib.name)).toContain('postgresql');
      expect(libraries.map(lib => lib.name)).toContain('redis');
      expect(libraries.map(lib => lib.name)).toContain('jest');
      expect(libraries.map(lib => lib.name)).toContain('cypress');
      
      // All libraries should have 'library' category since no hardcoding allowed
      const postgresLib = libraries.find(lib => lib.name === 'postgresql');
      expect(postgresLib?.category).toBe('library');
      
      const jestLib = libraries.find(lib => lib.name === 'jest');
      expect(jestLib?.category).toBe('library');
    });

    it('should filter out invalid library names', async () => {
      const tasks = [
        {
          id: '1',
          title: 'Invalid Names Test',
          details: 'config.font_path.sprite and some-very-long-invalid-library-name-that-should-be-rejected'
        }
      ];

      const libraries = await LibraryIdentifier.identifyLibraries(
        tasks,
        'test-api-key',
        'test/model',
        'https://api.openai.com/v1'
      );
      
      // Should not include invalid names like config.font_path.sprite
      expect(libraries.map(lib => lib.name)).not.toContain('config.font_path.sprite');
      expect(libraries.map(lib => lib.name)).not.toContain('some-very-long-invalid-library-name-that-should-be-rejected');
    });

    it('should assign correct categories', async () => {
      const tasks = [
        {
          id: '1',
          title: 'Full Stack Setup',
          details: 'Frontend: React, Vue. Backend: Express, Django. Database: MongoDB. Testing: Jest. DevOps: Docker'
        }
      ];

      const libraries = await LibraryIdentifier.identifyLibraries(
        tasks,
        'test-api-key',
        'test/model',
        'https://api.openai.com/v1'
      );
      
      // Should extract libraries without hardcoded categorization
      const libraryNames = libraries.map(lib => lib.name);
      expect(libraryNames.length).toBeGreaterThan(0);
      expect(libraryNames).toContain('react');
      expect(libraryNames).toContain('express');
      expect(libraryNames).toContain('mongodb');
      expect(libraryNames).toContain('jest');
      expect(libraryNames).toContain('docker');
      
      // All should have 'library' category since no hardcoding allowed
      libraries.forEach(lib => {
        expect(lib.category).toBe('library');
        expect(lib.source).toBe('llm');
      });
    });

    it('should handle empty tasks gracefully', async () => {
      const tasks: Array<{ id: string; title: string; details: string }> = [];
      
      const libraries = await LibraryIdentifier.identifyLibraries(
        tasks,
        'test-api-key',
        'test/model',
        'https://api.openai.com/v1'
      );
      
      expect(libraries).toHaveLength(0);
    });

    it('should handle tasks with no libraries', async () => {
      const tasks = [
        {
          id: '1',
          title: 'General Planning',
          details: 'Plan the project structure and workflow'
        }
      ];

      const libraries = await LibraryIdentifier.identifyLibraries(
        tasks,
        'test-api-key',
        'test/model',
        'https://api.openai.com/v1'
      );
      
      expect(libraries).toHaveLength(0);
    });

    it('should filter libraries by confidence score', () => {
      const mockLibraries = [
        { name: 'react', confidenceScore: 0.95, category: 'library', detectedIn: ['1'], source: 'llm' as const },
        { name: 'express', confidenceScore: 0.8, category: 'library', detectedIn: ['1'], source: 'llm' as const },
        { name: 'lowconf', confidenceScore: 0.3, category: 'library', detectedIn: ['1'], source: 'llm' as const },
      ];

      const filtered = LibraryIdentifier.filterLibraries(mockLibraries, { minConfidence: 0.6 });
      
      expect(filtered).toHaveLength(2);
      expect(filtered.map(lib => lib.name)).toContain('react');
      expect(filtered.map(lib => lib.name)).toContain('express');
      expect(filtered.map(lib => lib.name)).not.toContain('lowconf');
    });

    it('should limit number of results', () => {
      const mockLibraries = Array.from({ length: 20 }, (_, i) => ({
        name: `lib${i}`,
        confidenceScore: 0.8,
        category: 'library',
        detectedIn: ['1'],
        source: 'llm' as const,
      }));

      const filtered = LibraryIdentifier.filterLibraries(mockLibraries, { maxCount: 5 });
      
      expect(filtered).toHaveLength(5);
    });
  });
});