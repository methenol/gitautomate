import { LibraryIdentifier } from '@/services/library-identifier';

describe('Enhanced Library Extraction', () => {
  describe('REQUIRED LIBRARIES pattern extraction', () => {
    it('should extract libraries from REQUIRED LIBRARIES sections with highest confidence', async () => {
      const tasks = [
        {
          id: 'task1',
          title: 'Setup React Frontend',
          details: `Implementation steps:
1. Create React app structure
2. Setup routing with React Router
3. Configure Tailwind CSS for styling

REQUIRED LIBRARIES: react, react-router-dom, tailwindcss, typescript

DOCUMENTATION: Refer to the reference documentation for the required libraries listed above.`
        },
        {
          id: 'task2', 
          title: 'Setup Express Backend',
          details: `Implementation steps:
1. Initialize Express server
2. Setup MongoDB connection
3. Implement JWT authentication

REQUIRED LIBRARIES: express, mongoose, jsonwebtoken, bcryptjs, cors

DOCUMENTATION: Refer to the reference documentation for the required libraries listed above.`
        }
      ];

      const result = await LibraryIdentifier.identifyLibraries(
        tasks,
        'test-api-key',
        'test/model',
        'test-base'
      );
      
      // Should extract all explicitly required libraries
      const libraryNames = result.map(lib => lib.name).sort();
      expect(libraryNames).toContain('react');
      expect(libraryNames).toContain('react-router-dom');
      expect(libraryNames).toContain('tailwindcss');
      expect(libraryNames).toContain('typescript');
      expect(libraryNames).toContain('express');
      expect(libraryNames).toContain('mongoose');
      expect(libraryNames).toContain('jsonwebtoken');
      expect(libraryNames).toContain('bcryptjs');
      expect(libraryNames).toContain('cors');

      // All REQUIRED LIBRARIES should have high confidence (0.9 for LLM)
      const requiredLibs = result.filter(lib => lib.confidenceScore === 0.9);
      expect(requiredLibs.length).toBeGreaterThan(6);
      
      // All should be detected from LLM extraction
      requiredLibs.forEach(lib => {
        expect(lib.source).toBe('llm');
      });
    });

    it('should handle comma-separated and space-separated library lists', async () => {
      const tasks = [
        {
          id: 'test1',
          title: 'Mixed separators',
          details: 'REQUIRED LIBRARIES: react, vue angular svelte'
        }
      ];

      const result = await LibraryIdentifier.identifyLibraries(
        tasks,
        'test-api-key',
        'test/model',
        'test-base'
      );
      const names = result.map(lib => lib.name).sort();
      expect(names).toEqual(['angular', 'react', 'svelte', 'vue']);
    });

    it('should extract all valid library names from REQUIRED LIBRARIES', async () => {
      const tasks = [
        {
          id: 'test1', 
          title: 'Test libraries',
          details: 'REQUIRED LIBRARIES: react, config, utils, validlibrary'
        }
      ];

      const result = await LibraryIdentifier.identifyLibraries(tasks, "test-api-key", "test/model", "test-base");
      const names = result.map(lib => lib.name).sort();
      // Now that we have better filtering, only valid library names should be extracted
      expect(names).toEqual(['react', 'validlibrary']);
      
      // Should filter out common non-library words like 'config' and 'utils'
      expect(names).not.toContain('config');
      expect(names).not.toContain('utils');
    });
  });

  describe('Combined extraction patterns', () => {
    it('should prioritize REQUIRED LIBRARIES over other patterns', async () => {
      const tasks = [
        {
          id: 'test1',
          title: 'Mixed patterns',
          details: `
Setup Express server with npm install express
import React from 'react'

REQUIRED LIBRARIES: fastify, vue
          `
        }
      ];

      const result = await LibraryIdentifier.identifyLibraries(tasks, "test-api-key", "test/model", "test-base");
      
      // All libraries should be extracted with LLM confidence
      const expressLib = result.find(lib => lib.name === 'express');
      const reactLib = result.find(lib => lib.name === 'react');
      const fastifyLib = result.find(lib => lib.name === 'fastify');
      const vueLib = result.find(lib => lib.name === 'vue');

      // All libraries extracted by LLM have the same confidence score
      expect(expressLib?.confidenceScore).toBe(0.9); // LLM extracted
      expect(reactLib?.confidenceScore).toBe(0.9); // LLM extracted
      expect(fastifyLib?.confidenceScore).toBe(0.9); // LLM extracted
      expect(vueLib?.confidenceScore).toBe(0.9); // LLM extracted
      
      // All should have LLM source
      expect(expressLib?.source).toBe('llm');
      expect(reactLib?.source).toBe('llm');
      expect(fastifyLib?.source).toBe('llm');
      expect(vueLib?.source).toBe('llm');
    });
  });

  describe('Real-world task scenarios', () => {
    it('should extract comprehensive library list from realistic tasks', async () => {
      const tasks = [
        {
          id: 'frontend-setup',
          title: 'Setup React Frontend with TypeScript',
          details: `
Implementation steps:
1. Initialize React app with TypeScript
2. Setup routing with React Router
3. Configure Tailwind CSS for styling
4. Setup testing with Jest and React Testing Library

REQUIRED LIBRARIES: react, typescript, react-router-dom, tailwindcss, jest, @testing-library/react

DOCUMENTATION: Refer to the reference documentation for the required libraries listed above.
          `
        },
        {
          id: 'backend-setup',
          title: 'Create Express API Server',
          details: `
Implementation steps:
1. Setup Express server with TypeScript
2. Configure MongoDB connection with Mongoose
3. Implement JWT authentication
4. Setup API validation with Joi
5. Add rate limiting and CORS

REQUIRED LIBRARIES: express, typescript, mongoose, jsonwebtoken, joi, express-rate-limit, cors

DOCUMENTATION: Refer to the reference documentation for the required libraries listed above.
          `
        },
        {
          id: 'testing-setup',
          title: 'Configure Testing Environment',
          details: `
Implementation steps:
1. Setup Jest testing framework
2. Configure Supertest for API testing
3. Setup test database with MongoDB Memory Server
4. Add code coverage reporting

REQUIRED LIBRARIES: jest, supertest, mongodb-memory-server, @types/jest

DOCUMENTATION: Refer to the reference documentation for the required libraries listed above.
          `
        }
      ];

      const result = await LibraryIdentifier.identifyLibraries(tasks, "test-api-key", "test/model", "test-base");
      
      // Should extract 12+ distinct libraries
      expect(result.length).toBeGreaterThanOrEqual(12);

      // All libraries should have reasonable confidence
      result.forEach(lib => {
        expect(lib.confidenceScore).toBeGreaterThan(0.6);
      });

      // Should include key libraries from all tasks
      const names = result.map(lib => lib.name);
      expect(names).toContain('react');
      expect(names).toContain('express');
      expect(names).toContain('mongoose');
      expect(names).toContain('jest');
      expect(names).toContain('typescript');
      expect(names).toContain('jsonwebtoken');
    });

    it('should filter out invalid patterns that caused DNS errors', async () => {
      const tasks = [
        {
          id: 'problematic-task',
          title: 'Task with problematic content',
          details: `
Use pygame.sprite.Sprite class for game objects
Configure config.font_path for font loading  
Setup base.collision.detection system
Import hooks from react

REQUIRED LIBRARIES: pygame, react

Should NOT extract: pygame.sprite.sprite, config.font_path, base.collision.detection, hooks
          `
        }
      ];

      const result = await LibraryIdentifier.identifyLibraries(tasks, "test-api-key", "test/model", "test-base");
      const names = result.map(lib => lib.name);
      
      // Should only extract valid library names
      expect(names).toContain('pygame');
      expect(names).toContain('react');
      
      // Should NOT extract problematic patterns
      expect(names).not.toContain('pygame.sprite.sprite');
      expect(names).not.toContain('config.font_path');
      expect(names).not.toContain('base.collision.detection');
      expect(names).not.toContain('sprite');
      expect(names).not.toContain('hooks');
    });
  });
});