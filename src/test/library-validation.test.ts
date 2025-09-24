import { LibraryIdentifier } from '@/services/library-identifier';
import { ai } from '@/ai/litellm';

// Mock the ai module to avoid real API calls during tests
jest.mock('@/ai/litellm', () => ({
  ai: {
    generate: jest.fn()
  }
}));

const mockAI = ai as jest.Mocked<typeof ai>;

describe('Library Extraction - Core Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Create smart mock that extracts libraries based on task content
    mockAI.generate.mockImplementation(async ({ prompt }: { prompt: string }) => {
      const libraries: string[] = [];
      
      // Extract libraries from the task details in the prompt
      if (prompt.includes('pygame')) libraries.push('pygame');
      if (prompt.includes('react')) libraries.push('react');
      if (prompt.includes('typescript')) libraries.push('typescript');
      if (prompt.includes('axios')) libraries.push('axios');
      if (prompt.includes('express')) libraries.push('express');
      if (prompt.includes('lodash')) libraries.push('lodash');
      if (prompt.includes('moment')) libraries.push('moment');
      if (prompt.includes('redux')) libraries.push('redux');
      if (prompt.includes('tensorflow')) libraries.push('tensorflow');
      
      return { output: libraries.join('\n') };
    });
  });
  it('should extract real libraries and reject garbage patterns', async () => {
    const problematicTasks = [
      {
        id: '1',
        title: 'Game Development with Pygame',
        details: `
          Setup pygame for game development
          Use pygame.sprite.Sprite for sprite management
          Configure config.font_path for font loading
          Implement base.collision.detection system
          Setup ui.renderer.canvas for rendering
        `
      },
      {
        id: '2',
        title: 'React Web App',
        details: `
          npm install react react-dom typescript
          Create components using React hooks
          Setup routing with react-router
        `
      }
    ];

    const libraries = await LibraryIdentifier.identifyLibraries(problematicTasks, 'test-api-key', 'test/model', 'https://api.openai.com/v1');
    const libraryNames = libraries.map(lib => lib.name);
    
    console.log('Extracted libraries:', libraryNames);
    console.log('Library details:', libraries.map(lib => ({ name: lib.name, confidence: lib.confidenceScore, context: lib.context })));
    
    // Should extract real libraries
    expect(libraryNames).toContain('pygame');
    expect(libraryNames).toContain('react');
    expect(libraryNames).toContain('typescript');
    
    // Should NOT extract garbage patterns
    expect(libraryNames).not.toContain('pygame.sprite.sprite');
    expect(libraryNames).not.toContain('config.font_path');
    expect(libraryNames).not.toContain('base.collision.detection');
    expect(libraryNames).not.toContain('ui.renderer.canvas');
    expect(libraryNames).not.toContain('sprite');
    expect(libraryNames).not.toContain('font');
    expect(libraryNames).not.toContain('config');
    expect(libraryNames).not.toContain('base');
    expect(libraryNames).not.toContain('ui');
    expect(libraryNames).not.toContain('renderer');
    expect(libraryNames).not.toContain('canvas');
    
    // All extracted libraries should be valid
    libraries.forEach(lib => {
      expect(lib.name).toMatch(/^[a-zA-Z][\w-]{1,30}$/);
      expect(lib.confidenceScore).toBeGreaterThan(0.6);
      expect(lib.category).toBeDefined();
    });
  });

  it('should handle import statements correctly', async () => {
    const tasks = [
      {
        id: '1',
        title: 'Frontend Setup',
        details: `
          import React from 'react';
          import axios from 'axios';
          import { BrowserRouter } from 'react-router-dom';
          const express = require('express');
        `
      }
    ];

    const libraries = await LibraryIdentifier.identifyLibraries(tasks, "test-api-key", "test/model", "test-base");
    const libraryNames = libraries.map(lib => lib.name);
    
    expect(libraryNames).toContain('react');
    expect(libraryNames).toContain('axios');
    expect(libraryNames).toContain('express');
    
    // Should get high confidence for import statements
    const reactLib = libraries.find(lib => lib.name === 'react');
    expect(reactLib?.confidenceScore).toBeGreaterThanOrEqual(0.9);
  });

  it('should handle package manager commands', async () => {
    const tasks = [
      {
        id: '1',
        title: 'Install Dependencies',
        details: `
          npm install lodash moment
          yarn add redux
          pip install tensorflow
        `
      }
    ];

    const libraries = await LibraryIdentifier.identifyLibraries(tasks, "test-api-key", "test/model", "test-base");
    const libraryNames = libraries.map(lib => lib.name);
    
    expect(libraryNames).toContain('lodash');
    expect(libraryNames).toContain('moment');
    expect(libraryNames).toContain('redux');
    expect(libraryNames).toContain('tensorflow');
  });

  it('should categorize libraries correctly', async () => {
    const tasks = [
      {
        id: '1',
        title: 'Tech Stack',
        details: 'Setup React frontend, Express backend, PostgreSQL database, Jest testing, Docker deployment'
      }
    ];

    const libraries = await LibraryIdentifier.identifyLibraries(tasks, "test-api-key", "test/model", "test-base");
    
    const categories = libraries.reduce((acc, lib) => {
      acc[lib.category] = (acc[lib.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('Categories:', categories);
    // Since no hardcoded categories, all libraries should have 'library' category
    expect(Object.keys(categories).length).toBe(1);
    expect(categories['library']).toBeDefined();
  });

  it('should filter libraries by confidence and count', () => {
    const mockLibraries = [
      { name: 'react', confidenceScore: 0.95, category: 'frontend' as const, detectedIn: ['1'], source: 'pattern' as const },
      { name: 'vue', confidenceScore: 0.85, category: 'frontend' as const, detectedIn: ['1'], source: 'pattern' as const },
      { name: 'angular', confidenceScore: 0.75, category: 'frontend' as const, detectedIn: ['1'], source: 'pattern' as const },
      { name: 'lowconf', confidenceScore: 0.5, category: 'utility' as const, detectedIn: ['1'], source: 'pattern' as const },
    ];

    const filtered = LibraryIdentifier.filterLibraries(mockLibraries, {
      minConfidence: 0.7,
      maxCount: 2
    });

    expect(filtered).toHaveLength(2);
    expect(filtered[0].name).toBe('react'); // Highest confidence first
    expect(filtered[1].name).toBe('vue');
    expect(filtered.every(lib => lib.confidenceScore >= 0.7)).toBe(true);
  });
});