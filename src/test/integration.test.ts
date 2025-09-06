import { LibraryIdentifier } from '@/services/library-identifier';
import { DocumentationFetcher } from '@/services/documentation-fetcher';

describe('Integration Tests - Real Functionality', () => {
  describe('Library Extraction', () => {
    it('should extract only real library names from realistic project tasks', async () => {
      const realProjectTasks = [
        {
          id: '1',
          title: 'Setup React Frontend with TypeScript',
          details: `
            Create a React application using TypeScript.
            Use npm install react react-dom @types/react @types/react-dom typescript
            Setup Vite for bundling and development server.
          `
        },
        {
          id: '2', 
          title: 'Build Express.js API Server',
          details: `
            Install Express framework with npm install express
            Add authentication using jsonwebtoken library
            Connect to PostgreSQL database using sequelize ORM
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

      const libraries = await LibraryIdentifier.identifyLibraries(realProjectTasks);
      
      // Should extract real libraries, not garbage
      const libraryNames = libraries.map(lib => lib.name);
      console.log('Extracted libraries:', libraryNames);
      
      // Should contain real libraries
      expect(libraryNames).toContain('react');
      expect(libraryNames).toContain('express');
      expect(libraryNames).toContain('typescript');
      expect(libraryNames).toContain('jest');
      expect(libraryNames).toContain('cypress');
      expect(libraryNames).toContain('docker');
      
      // Should NOT contain garbage like config.font_path or pygame.sprite.sprite
      const invalidNames = libraryNames.filter(name => 
        name.includes('.') || 
        name.includes('config') ||
        name.includes('sprite') ||
        name.includes('font') ||
        name.includes('path')
      );
      expect(invalidNames).toHaveLength(0);
      
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
          title: 'Game Development Setup',
          details: `
            Create a game using pygame library
            Setup sprite animation system with pygame.sprite.Sprite class
            Configure font rendering using config.font_path settings
            Implement collision detection in base.sprite.collision_handler
          `
        }
      ];

      const libraries = await LibraryIdentifier.identifyLibraries(complexTasks);
      const libraryNames = libraries.map(lib => lib.name);
      
      // Should extract pygame but not the class/method names
      expect(libraryNames).toContain('pygame');
      expect(libraryNames).not.toContain('pygame.sprite.sprite');
      expect(libraryNames).not.toContain('config.font_path'); 
      expect(libraryNames).not.toContain('base.sprite.collision_handler');
      expect(libraryNames).not.toContain('sprite');
      expect(libraryNames).not.toContain('font');
      expect(libraryNames).not.toContain('config');
    });

    it('should categorize libraries correctly', async () => {
      const tasks = [
        {
          id: '1',
          title: 'Full Stack App',
          details: 'Build React frontend with Express backend, PostgreSQL database, Jest testing, and Docker deployment'
        }
      ];

      const libraries = await LibraryIdentifier.identifyLibraries(tasks, "test-api-key", "test/model", "test-base");
      
      const react = libraries.find(lib => lib.name === 'react');
      const express = libraries.find(lib => lib.name === 'express');
      const postgresql = libraries.find(lib => lib.name === 'postgresql');
      const jest = libraries.find(lib => lib.name === 'jest');
      const docker = libraries.find(lib => lib.name === 'docker');
      
      // All libraries should have 'library' category since no hardcoding allowed
      expect(react?.category).toBe('library');
      expect(express?.category).toBe('library');
      expect(postgresql?.category).toBe('library');
      expect(jest?.category).toBe('library');
      expect(docker?.category).toBe('library');
    });
  });

  describe('Documentation Fetching', () => {
    // Note: These tests will make real HTTP requests in integration testing
    it('should verify library existence before fetching documentation', async () => {
      const mockSettings = {
        sources: ['github', 'npm'] as ('github' | 'official' | 'mdn' | 'npm')[],
        includeStackOverflow: false,
        maxDocumentationSizeKB: 512,
        cacheDocumentationDays: 7,
        enabled: true,
      };
      
      const fetcher = new DocumentationFetcher(mockSettings);
      
      // Test with a real library that should exist
      const realLibraries = [
        {
          name: 'react',
          confidenceScore: 0.95,
          category: 'frontend' as const,
          detectedIn: ['1'],
          source: 'pattern' as const,
          context: 'Framework mention',
        }
      ];
      
      const result = await fetcher.fetchLibraryDocumentation(realLibraries);
      
      // Should successfully fetch or at least not error on verification
      expect(result.errorCount).toBeLessThan(result.fetchedCount + result.skippedCount);
      expect(result.errors).not.toContain('Library "react" not found or not verified');
    }, 30000); // 30 second timeout for network requests

    it('should handle non-existent libraries gracefully', async () => {
      const mockSettings = {
        sources: ['github', 'npm'] as ('github' | 'official' | 'mdn' | 'npm')[],
        includeStackOverflow: false,
        maxDocumentationSizeKB: 512,
        cacheDocumentationDays: 7,
        enabled: true,
      };
      
      const fetcher = new DocumentationFetcher(mockSettings);
      
      // Test with libraries that definitely don't exist
      const invalidLibraries = [
        {
          name: 'pygame-sprite-sprite',
          confidenceScore: 0.8,
          category: 'utility' as const,
          detectedIn: ['1'],
          source: 'pattern' as const,
          context: 'Invalid extraction',
        },
        {
          name: 'config-font-path',
          confidenceScore: 0.7,
          category: 'utility' as const,
          detectedIn: ['1'],
          source: 'pattern' as const,
          context: 'Invalid extraction',
        }
      ];
      
      const result = await fetcher.fetchLibraryDocumentation(invalidLibraries);
      
      // Should skip these libraries without crashing
      expect(result.fetchedCount).toBe(0);
      expect(result.skippedCount).toBe(2);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Should not attempt to fetch from invalid domains
      const hasInvalidDomainErrors = result.errors.some(error => 
        error.includes('pygame-sprite-sprite.org') || 
        error.includes('config-font-path.org')
      );
      expect(hasInvalidDomainErrors).toBe(false);
    }, 30000);
  });

  describe('End-to-End Documentation Flow', () => {
    it('should extract libraries and fetch documentation for a complete project', async () => {
      const projectTasks = [
        {
          id: '1',
          title: 'Setup Modern Web App',
          details: `
            Create a React TypeScript application
            Build Express.js REST API with JWT authentication  
            Use PostgreSQL database with Sequelize ORM
            Add Jest unit tests and Cypress E2E tests
            Deploy using Docker containers
          `
        }
      ];

      // Step 1: Extract libraries
      const libraries = await LibraryIdentifier.identifyLibraries(projectTasks);
      expect(libraries.length).toBeGreaterThan(3);
      
      // Step 2: Filter high-confidence libraries
      const filtered = LibraryIdentifier.filterLibraries(libraries, {
        minConfidence: 0.7,
        maxCount: 10
      });
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.length).toBeLessThanOrEqual(10);
      
      // Step 3: Attempt to fetch documentation
      const mockSettings = {
        sources: ['github'] as ('github' | 'official' | 'mdn' | 'npm')[],
        includeStackOverflow: false,
        maxDocumentationSizeKB: 256, // Smaller limit for testing
        cacheDocumentationDays: 7,
        enabled: true,
      };
      
      const fetcher = new DocumentationFetcher(mockSettings);
      const result = await fetcher.fetchLibraryDocumentation(filtered.slice(0, 3)); // Test with first 3 libraries
      
      // Should have made attempts without major errors (adjust to match actual library count)
      expect(result.fetchedCount + result.skippedCount + result.errorCount).toBeGreaterThanOrEqual(1);
      
      // If any documentation was fetched, it should have content
      if (result.fetchedCount > 0) {
        expect(result.libraries.length).toBeGreaterThan(0);
        result.libraries.forEach(lib => {
          expect(lib.sources.length).toBeGreaterThan(0);
          lib.sources.forEach(source => {
            expect(source.content.length).toBeGreaterThan(50);
            expect(source.url).toMatch(/^https?:\/\//);
          });
        });
      }
    }, 60000); // 60 second timeout for full integration test
  });
});