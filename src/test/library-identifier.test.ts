import { LibraryIdentifier } from '@/services/library-identifier';

describe('LibraryIdentifier', () => {
  describe('identifyLibraries', () => {
    it('should extract libraries from import statements', async () => {
      const tasks = [
        {
          id: '1',
          title: 'Setup React Frontend',
          details: 'import React from "react"; import axios from "axios";'
        }
      ];

      const libraries = await LibraryIdentifier.identifyLibraries(tasks);
      
      expect(libraries).toHaveLength(2);
      expect(libraries.map(lib => lib.name)).toContain('react');
      expect(libraries.map(lib => lib.name)).toContain('axios');
      
      const reactLib = libraries.find(lib => lib.name === 'react');
      expect(reactLib?.category).toBe('frontend');
      expect(reactLib?.confidenceScore).toBeGreaterThan(0.9);
    });

    it('should extract libraries from package manager commands', async () => {
      const tasks = [
        {
          id: '1',
          title: 'Install Dependencies',
          details: 'npm install express jest mongoose'
        }
      ];

      const libraries = await LibraryIdentifier.identifyLibraries(tasks);
      
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

      const libraries = await LibraryIdentifier.identifyLibraries(tasks);
      
      expect(libraries.map(lib => lib.name)).toContain('postgresql');
      expect(libraries.map(lib => lib.name)).toContain('redis');
      expect(libraries.map(lib => lib.name)).toContain('jest');
      expect(libraries.map(lib => lib.name)).toContain('cypress');
      
      const postgresLib = libraries.find(lib => lib.name === 'postgresql');
      expect(postgresLib?.category).toBe('database');
      
      const jestLib = libraries.find(lib => lib.name === 'jest');
      expect(jestLib?.category).toBe('testing');
    });

    it('should filter out invalid library names', async () => {
      const tasks = [
        {
          id: '1',
          title: 'Invalid Names Test',
          details: 'config.font_path.sprite and some-very-long-invalid-library-name-that-should-be-rejected'
        }
      ];

      const libraries = await LibraryIdentifier.identifyLibraries(tasks);
      
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

      const libraries = await LibraryIdentifier.identifyLibraries(tasks);
      
      const categorizedLibs = libraries.reduce((acc, lib) => {
        acc[lib.category] = acc[lib.category] || [];
        acc[lib.category].push(lib.name);
        return acc;
      }, {} as Record<string, string[]>);

      expect(categorizedLibs.frontend).toContain('react');
      expect(categorizedLibs.frontend).toContain('vue');
      expect(categorizedLibs.backend).toContain('express');
      expect(categorizedLibs.backend).toContain('django');
      expect(categorizedLibs.database).toContain('mongodb');
      expect(categorizedLibs.testing).toContain('jest');
      expect(categorizedLibs.devops).toContain('docker');
    });

    it('should handle empty tasks gracefully', async () => {
      const tasks: Array<{ id: string; title: string; details: string }> = [];
      
      const libraries = await LibraryIdentifier.identifyLibraries(tasks);
      
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

      const libraries = await LibraryIdentifier.identifyLibraries(tasks);
      
      expect(libraries).toHaveLength(0);
    });

    it('should filter libraries by confidence score', () => {
      const mockLibraries = [
        { name: 'react', confidenceScore: 0.95, category: 'frontend' as const, detectedIn: ['1'], source: 'pattern' as const },
        { name: 'express', confidenceScore: 0.8, category: 'backend' as const, detectedIn: ['1'], source: 'pattern' as const },
        { name: 'lowconf', confidenceScore: 0.3, category: 'utility' as const, detectedIn: ['1'], source: 'pattern' as const },
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
        category: 'utility' as const,
        detectedIn: ['1'],
        source: 'pattern' as const,
      }));

      const filtered = LibraryIdentifier.filterLibraries(mockLibraries, { maxCount: 5 });
      
      expect(filtered).toHaveLength(5);
    });
  });
});