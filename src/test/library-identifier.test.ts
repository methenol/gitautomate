import { LibraryIdentifier } from '@/services/library-identifier';
import type { IdentifiedLibrary } from '@/types/documentation';

describe('LibraryIdentifier', () => {
  const mockTasks = [
    {
      id: 'task-001',
      title: 'Setup React application with TypeScript',
      details: 'Create a new React app using Next.js framework with TypeScript configuration. Install dependencies: react, @types/react, eslint.',
    },
    {
      id: 'task-002', 
      title: 'Implement authentication system',
      details: 'Set up authentication using Express.js backend with JWT tokens and bcrypt for password hashing.',
    },
    {
      id: 'task-003',
      title: 'Database integration',
      details: 'Configure PostgreSQL database connection and implement database models using Prisma ORM.',
    },
    {
      id: 'task-004',
      title: 'Testing setup',
      details: 'Configure Jest testing framework and set up unit tests for components.',
    },
  ];

  test('identifies libraries from task content', () => {
    const libraries = LibraryIdentifier.identifyLibraries(mockTasks);
    
    expect(libraries.length).toBeGreaterThan(0);
    
    // Should find React (frontend)
    const reactLib = libraries.find(lib => lib.name === 'react');
    expect(reactLib).toBeDefined();
    expect(reactLib?.category).toBe('frontend');
    expect(reactLib?.confidenceScore).toBeGreaterThan(0.5);
    
    // Should find Next.js (frontend)
    const nextLib = libraries.find(lib => lib.name === 'next' || lib.name === 'nextjs');
    expect(nextLib).toBeDefined();
    
    // Should find Express (backend)
    const expressLib = libraries.find(lib => lib.name === 'express');
    expect(expressLib).toBeDefined();
    expect(expressLib?.category).toBe('backend');
    
    // Should find PostgreSQL (database)
    const pgLib = libraries.find(lib => lib.name === 'postgresql' || lib.name === 'postgres');
    expect(pgLib).toBeDefined();
    expect(pgLib?.category).toBe('database');
    
    // Should find Jest (testing)
    const jestLib = libraries.find(lib => lib.name === 'jest');
    expect(jestLib).toBeDefined();
    expect(jestLib?.category).toBe('testing');
    
    console.log('✅ Library identification test passed');
  });

  test('calculates confidence scores correctly', () => {
    const singleTask = [{
      id: 'test',
      title: 'Install React and setup React Router',
      details: 'npm install react react-router using React components with React hooks',
    }];
    
    const libraries = LibraryIdentifier.identifyLibraries(singleTask);
    const reactLib = libraries.find(lib => lib.name === 'react');
    
    expect(reactLib).toBeDefined();
    expect(reactLib?.confidenceScore).toBeGreaterThan(0.8); // Should be high confidence due to multiple mentions
    
    console.log('✅ Confidence scoring test passed');
  });

  test('filters libraries by criteria', () => {
    const libraries = LibraryIdentifier.identifyLibraries(mockTasks);
    
    // Filter by minimum confidence
    const highConfidence = LibraryIdentifier.filterLibraries(libraries, { minConfidence: 0.7 });
    expect(highConfidence.every(lib => lib.confidenceScore >= 0.7)).toBe(true);
    
    // Filter by category
    const frontendOnly = LibraryIdentifier.filterLibraries(libraries, { categories: ['frontend'] });
    expect(frontendOnly.every(lib => lib.category === 'frontend')).toBe(true);
    
    // Filter by max count
    const limited = LibraryIdentifier.filterLibraries(libraries, { maxCount: 3 });
    expect(limited.length).toBeLessThanOrEqual(3);
    
    console.log('✅ Library filtering test passed');
  });

  test('handles edge cases gracefully', () => {
    // Empty tasks
    expect(LibraryIdentifier.identifyLibraries([])).toEqual([]);
    
    // Tasks with no recognizable libraries
    const noLibTasks = [{
      id: 'test',
      title: 'Write documentation',
      details: 'Create user manual and API documentation',
    }];
    
    const result = LibraryIdentifier.identifyLibraries(noLibTasks);
    expect(result.length).toBe(0);
    
    console.log('✅ Edge cases test passed');
  });

  test('tracks library detection across multiple tasks', () => {
    const libraries = LibraryIdentifier.identifyLibraries(mockTasks);
    
    // Find a library that appears in multiple tasks
    const reactLib = libraries.find(lib => lib.name === 'react');
    expect(reactLib?.detectedIn).toBeDefined();
    expect(Array.isArray(reactLib?.detectedIn)).toBe(true);
    
    console.log('✅ Multi-task detection test passed');
  });
});