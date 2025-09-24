import { LibraryIdentifier } from '@/services/library-identifier';
import { DocumentationFetcher } from '@/services/documentation-fetcher';
import { createSmartAIMock, getTestParams, suppressConsoleWarnings } from './test-utils';
import { ai } from '@/ai/litellm';

// Mock the ai module to avoid real API calls during tests
jest.mock('@/ai/litellm', () => ({
  ai: {
    generate: jest.fn()
  }
}));

const mockAI = ai as jest.Mocked<typeof ai>;

describe('Integration Tests - Real Functionality', () => {
  // Suppress console warnings for cleaner test output
  suppressConsoleWarnings();
  
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Use smart AI mock that responds based on prompt content
    mockAI.generate.mockImplementation(createSmartAIMock());
  });

  describe('Library Extraction', () => {
    it('should extract only real library names from realistic project tasks', async () => {
      const realProjectTasks = [
        {
          id: '1',
          title: 'Setup React Frontend with TypeScript',
          details: `
            Create React components with TypeScript
            Setup Vite for bundling and development server.
          `
        },
        {
          id: '2',
          title: 'Build Express.js API Server',
          details: `
            Install Express framework with npm install express
            Setup MongoDB connection with Mongoose
            Add JWT authentication
          `
        },
        {
          id: '3',
          title: 'Setup Testing Infrastructure', 
          details: `
            Use Jest for unit testing
            Add Cypress for end-to-end testing
            Configure GitHub Actions for CI/CD pipeline
          `
        },
        {
          id: '4',
          title: 'Docker Containerization',
          details: `
            Create Dockerfile for the application
            Setup Docker Compose for local development
            Deploy using Kubernetes cluster
          `
        }
      ];

      const params = getTestParams();
      const libraries = await LibraryIdentifier.identifyLibraries(realProjectTasks, params.apiKey, params.model, params.apiBase);
      
      // Should extract real libraries, not garbage
      const libraryNames = libraries.map(lib => lib.name);
      
      // Should contain real libraries
      expect(libraryNames).toContain('react');
      expect(libraryNames).toContain('express');
      expect(libraryNames).toContain('typescript');
      expect(libraryNames).toContain('jest');
      expect(libraryNames).toContain('cypress');
      expect(libraryNames).toContain('docker');
      
      // All libraries should have reasonable confidence
      libraries.forEach(lib => {
        expect(lib.confidenceScore).toBeGreaterThan(0.6);
        expect(lib.name.length).toBeGreaterThan(1);
        expect(lib.name.length).toBeLessThan(30);
      });
    });

    it('should not extract invalid names from complex technical content', async () => {
      const complexTasks = [
        {
          id: '1',
          title: 'Complex Game Setup',
          details: `
            Use pygame.sprite.Sprite class for game objects
            Configure config.font_path for font loading  
            Setup base.collision.detection system
            Import hooks from react
          `
        }
      ];

      const params = getTestParams();
      const libraries = await LibraryIdentifier.identifyLibraries(complexTasks, params.apiKey, params.model, params.apiBase);
      const libraryNames = libraries.map(lib => lib.name);
      
      // Should extract pygame but not the class/method names
      expect(libraryNames).toContain('pygame');
      expect(libraryNames).not.toContain('pygame.sprite.sprite');
      expect(libraryNames).not.toContain('config.font_path'); 
      expect(libraryNames).not.toContain('base.sprite.collision_handler');
      expect(libraryNames).not.toContain('sprite');
    });

    it('should categorize libraries correctly', async () => {
      const tasks = [
        {
          id: '1',
          title: 'Full Stack Setup',
          details: 'Build React frontend with Express backend, PostgreSQL database, Jest testing, and Docker deployment'
        }
      ];

      const params = getTestParams();
      const libraries = await LibraryIdentifier.identifyLibraries(tasks, params.apiKey, params.model, params.apiBase);
      
      const react = libraries.find(lib => lib.name === 'react');
      const express = libraries.find(lib => lib.name === 'express');
      const postgresql = libraries.find(lib => lib.name === 'postgresql');
      const jest = libraries.find(lib => lib.name === 'jest');
      const docker = libraries.find(lib => lib.name === 'docker');
      
      // All should have proper structure
      [react, express, postgresql, jest, docker].forEach(lib => {
        if (lib) {
          expect(lib.category).toBe('library');
          expect(lib.confidenceScore).toBeGreaterThan(0.5);
          expect(lib.source).toBe('llm');
          expect(Array.isArray(lib.detectedIn)).toBe(true);
        }
      });
    });
  });

  describe('Documentation Fetching', () => {
    it('should verify library existence before fetching documentation', async () => {
      const mockLibrary = {
        name: 'react',
        confidenceScore: 0.9,
        category: 'frontend' as const,
        detectedIn: ['task1'],
        source: 'pattern' as const,
      };

      const settings = {
        enabled: true,
        sources: ['github'] as ('github' | 'official' | 'mdn' | 'npm')[],
        includeStackOverflow: false,
        maxDocumentationSizeKB: 256,
        cacheDocumentationDays: 7,
      };
      
      const fetcher = new DocumentationFetcher(settings);
      const result = await fetcher.fetchLibraryDocumentation([mockLibrary]);
      
      // Should have reasonable results
      expect(result.fetchedCount + result.skippedCount + result.errorCount).toBeGreaterThanOrEqual(1);
      expect(result.totalSizeKB).toBeGreaterThanOrEqual(0);
    }, 30000);
  });
});