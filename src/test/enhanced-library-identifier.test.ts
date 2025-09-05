import { LibraryIdentifier } from '@/services/library-identifier';
import type { IdentifiedLibrary } from '@/types/documentation';

// Mock the AI flow since we're testing the integration, not the AI itself
jest.mock('@/ai/flows/extract-libraries', () => ({
  extractLibraries: jest.fn(),
}));

import { extractLibraries } from '@/ai/flows/extract-libraries';
const mockExtractLibraries = extractLibraries as jest.MockedFunction<typeof extractLibraries>;

describe('Enhanced LibraryIdentifier with AI', () => {
  beforeEach(() => {
    mockExtractLibraries.mockClear();
  });

  describe('AI-enhanced extraction', () => {
    test('combines AI and pattern results effectively', async () => {
      // Mock AI response
      mockExtractLibraries.mockResolvedValue({
        libraries: [
          {
            name: 'react',
            category: 'frontend',
            confidence: 0.95,
            taskIds: ['task-001'],
            context: 'Building a React application'
          },
          {
            name: 'fastapi',
            category: 'backend', 
            confidence: 0.9,
            taskIds: ['task-002'],
            context: 'Creating REST API with FastAPI'
          },
          {
            name: 'tensorflow',
            category: 'ml',
            confidence: 0.85,
            taskIds: ['task-003'],
            context: 'Machine learning model training'
          }
        ]
      });

      const tasks = [
        {
          id: 'task-001',
          title: 'Setup React frontend',
          details: 'Create a React application with TypeScript and set up routing with react-router-dom'
        },
        {
          id: 'task-002', 
          title: 'Build API server',
          details: 'Implement REST API using FastAPI with Pydantic models'
        },
        {
          id: 'task-003',
          title: 'ML model integration',
          details: 'Train TensorFlow model and integrate with Express.js backend'
        }
      ];

      const libraries = await LibraryIdentifier.identifyLibraries(tasks, {
        useAI: true,
        model: 'test-model',
        fallbackToPatterns: true
      });

      // Should have AI results plus pattern-detected ones
      expect(libraries.length).toBeGreaterThan(3);
      
      // AI-detected libraries should be present
      const reactLib = libraries.find(lib => lib.name === 'react');
      expect(reactLib).toBeDefined();
      expect(reactLib?.source).toBe('combined'); // Combined because patterns also detect it
      expect(reactLib?.confidenceScore).toBeGreaterThan(0.8);

      const fastApiLib = libraries.find(lib => lib.name === 'fastapi');
      expect(fastApiLib).toBeDefined();
      expect(fastApiLib?.category).toBe('backend');

      // Pattern-only detections should also be present (react-router-dom, express)
      const routerLib = libraries.find(lib => lib.name === 'react-router' || lib.name === 'react-router-dom');
      expect(routerLib).toBeDefined();

      const expressLib = libraries.find(lib => lib.name === 'express');
      expect(expressLib).toBeDefined();

      console.log('✅ AI + Pattern combination test passed');
    });

    test('falls back to patterns when AI fails', async () => {
      // Mock AI failure
      mockExtractLibraries.mockRejectedValue(new Error('AI service unavailable'));

      const tasks = [
        {
          id: 'task-001',
          title: 'Setup React with Next.js',
          details: 'Create Next.js application with React and TypeScript'
        }
      ];

      const libraries = await LibraryIdentifier.identifyLibraries(tasks, {
        useAI: true,
        model: 'test-model',
        fallbackToPatterns: true
      });

      // Should still detect libraries using patterns
      expect(libraries.length).toBeGreaterThan(0);
      
      const reactLib = libraries.find(lib => lib.name === 'react');
      expect(reactLib).toBeDefined();
      expect(reactLib?.source).toBe('pattern');

      console.log('✅ AI fallback test passed');
    });

    test('works with AI-only mode when patterns disabled', async () => {
      mockExtractLibraries.mockResolvedValue({
        libraries: [
          {
            name: 'custom-framework',
            category: 'frontend',
            confidence: 0.8,
            taskIds: ['task-001'],
            context: 'Using custom framework for UI'
          }
        ]
      });

      const tasks = [
        {
          id: 'task-001',
          title: 'Implement custom framework',
          details: 'Use our internal custom-framework for building the UI'
        }
      ];

      const libraries = await LibraryIdentifier.identifyLibraries(tasks, {
        useAI: true,
        model: 'test-model',
        fallbackToPatterns: false
      });

      expect(libraries.length).toBe(1);
      expect(libraries[0].name).toBe('custom-framework');
      expect(libraries[0].source).toBe('ai');

      console.log('✅ AI-only mode test passed');
    });
  });

  describe('Pattern-based extraction improvements', () => {
    test('detects expanded library set', async () => {
      const tasks = [
        {
          id: 'task-001',
          title: 'DevOps setup',
          details: 'Configure Docker containers, set up Kubernetes cluster, and implement Terraform infrastructure'
        },
        {
          id: 'task-002',
          title: 'Mobile development',
          details: 'Build React Native app with Expo and set up Flutter for cross-platform development'
        },
        {
          id: 'task-003',
          title: 'Machine learning pipeline', 
          details: 'Setup TensorFlow training pipeline with Pandas data processing and Jupyter notebooks'
        }
      ];

      const libraries = await LibraryIdentifier.identifyLibraries(tasks, {
        useAI: false, // Test patterns only
        fallbackToPatterns: true
      });

      // DevOps libraries
      expect(libraries.some(lib => lib.name === 'docker')).toBe(true);
      expect(libraries.some(lib => lib.name === 'kubernetes' || lib.name === 'k8s')).toBe(true);
      expect(libraries.some(lib => lib.name === 'terraform')).toBe(true);

      // Mobile libraries
      expect(libraries.some(lib => lib.name === 'react-native' || lib.name === 'expo')).toBe(true);
      expect(libraries.some(lib => lib.name === 'flutter')).toBe(true);

      // ML libraries
      expect(libraries.some(lib => lib.name === 'tensorflow')).toBe(true);
      expect(libraries.some(lib => lib.name === 'pandas')).toBe(true);
      expect(libraries.some(lib => lib.name === 'jupyter')).toBe(true);

      console.log('✅ Expanded library detection test passed');
    });

    test('handles edge cases and variations', async () => {
      const edgeCaseTasks = [
        {
          id: 'task-001',
          title: 'Package managers and variations',
          details: 'Install with npm install @angular/core, yarn add @emotion/styled, pip install scikit-learn'
        },
        {
          id: 'task-002',
          title: 'Import statements and configs',
          details: 'Import from "react-router-dom", require("express"), and configure webpack.config.js'
        },
        {
          id: 'task-003',
          title: 'Context mentions',
          details: 'Using PostgreSQL for data storage, implement JWT authentication, setup Redis caching'
        }
      ];

      const libraries = await LibraryIdentifier.identifyLibraries(edgeCaseTasks, {
        useAI: false,
        fallbackToPatterns: true
      });

      // Should detect variations and contexts
      expect(libraries.some(lib => lib.name === 'angular')).toBe(true);
      expect(libraries.some(lib => lib.name === 'emotion')).toBe(true);
      expect(libraries.some(lib => lib.name === 'react-router')).toBe(true);
      expect(libraries.some(lib => lib.name === 'express')).toBe(true);
      expect(libraries.some(lib => lib.name === 'webpack')).toBe(true);
      expect(libraries.some(lib => lib.name === 'postgresql')).toBe(true);
      expect(libraries.some(lib => lib.name === 'jsonwebtoken' || lib.name === 'jwt')).toBe(true);
      expect(libraries.some(lib => lib.name === 'redis')).toBe(true);

      console.log('✅ Edge cases and variations test passed');
    });

    test('assigns correct categories to new libraries', async () => {
      const tasks = [
        {
          id: 'task-001',
          title: 'Full stack with new categories',
          details: 'Setup Grafana monitoring, implement Kafka messaging, configure Helm charts, and add Sentry error tracking'
        }
      ];

      const libraries = await LibraryIdentifier.identifyLibraries(tasks, {
        useAI: false,
        fallbackToPatterns: true
      });

      const grafanaLib = libraries.find(lib => lib.name === 'grafana');
      expect(grafanaLib?.category).toBe('devops');

      const kafkaLib = libraries.find(lib => lib.name === 'kafka');
      expect(kafkaLib?.category).toBe('backend');

      const helmLib = libraries.find(lib => lib.name === 'helm');
      expect(helmLib?.category).toBe('devops');

      const sentryLib = libraries.find(lib => lib.name === 'sentry');
      expect(sentryLib?.category).toBe('devops');

      console.log('✅ Category assignment test passed');
    });
  });

  describe('Confidence scoring and filtering', () => {
    test('calculates higher confidence for multiple mentions', async () => {
      const tasks = [
        {
          id: 'task-001',
          title: 'React setup',
          details: 'npm install react react-dom, configure React components with React hooks'
        }
      ];

      const libraries = await LibraryIdentifier.identifyLibraries(tasks, {
        useAI: false,
        fallbackToPatterns: true
      });

      const reactLib = libraries.find(lib => lib.name === 'react');
      expect(reactLib?.confidenceScore).toBeGreaterThan(0.8); // High confidence due to multiple mentions

      console.log('✅ Confidence scoring test passed');
    });

    test('filters libraries by confidence and categories correctly', async () => {
      mockExtractLibraries.mockResolvedValue({
        libraries: [
          { name: 'react', category: 'frontend', confidence: 0.9, taskIds: ['task-001'], context: 'Frontend framework' },
          { name: 'express', category: 'backend', confidence: 0.8, taskIds: ['task-001'], context: 'Backend API' },
          { name: 'uncertain-lib', category: 'utility', confidence: 0.3, taskIds: ['task-001'], context: 'Maybe used' },
        ]
      });

      const tasks = [{ id: 'task-001', title: 'Full stack app', details: 'Build with React and Express' }];

      const libraries = await LibraryIdentifier.identifyLibraries(tasks, {
        useAI: true,
        model: 'test-model',
        fallbackToPatterns: false
      });

      // Test confidence filtering
      const highConfidence = LibraryIdentifier.filterLibraries(libraries, { minConfidence: 0.7 });
      expect(highConfidence.length).toBe(2); // react and express only
      expect(highConfidence.every(lib => lib.confidenceScore >= 0.7)).toBe(true);

      // Test category filtering  
      const frontendOnly = LibraryIdentifier.filterLibraries(libraries, { categories: ['frontend'] });
      expect(frontendOnly.length).toBe(1);
      expect(frontendOnly[0].name).toBe('react');

      console.log('✅ Filtering test passed');
    });
  });

  describe('Error handling and edge cases', () => {
    test('handles empty tasks gracefully', async () => {
      mockExtractLibraries.mockResolvedValue({ libraries: [] });

      const libraries = await LibraryIdentifier.identifyLibraries([], {
        useAI: true,
        model: 'test-model'
      });

      expect(libraries).toEqual([]);
      console.log('✅ Empty tasks handling test passed');
    });

    test('handles tasks with no libraries', async () => {
      mockExtractLibraries.mockResolvedValue({ libraries: [] });

      const tasks = [
        {
          id: 'task-001',
          title: 'Write documentation',
          details: 'Create user manual and project README files'
        }
      ];

      const libraries = await LibraryIdentifier.identifyLibraries(tasks, {
        useAI: true,
        model: 'test-model',
        fallbackToPatterns: true
      });

      expect(libraries.length).toBe(0);
      console.log('✅ No libraries handling test passed');
    });

    test('throws error when AI fails and fallback disabled', async () => {
      mockExtractLibraries.mockRejectedValue(new Error('AI service error'));

      const tasks = [{ id: 'task-001', title: 'Test', details: 'Test task' }];

      await expect(
        LibraryIdentifier.identifyLibraries(tasks, {
          useAI: true,
          model: 'test-model',
          fallbackToPatterns: false
        })
      ).rejects.toThrow('AI service error');

      console.log('✅ Error handling test passed');
    });
  });
});