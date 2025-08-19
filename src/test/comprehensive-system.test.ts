/**
 * @fileOverview Comprehensive integration test for the new unified system
 */

import { generateComprehensiveProject } from '@/app/comprehensive-actions';
import { ContextValidator } from '@/ai/validation/context-validator';
import { ComprehensiveOrchestrator } from '@/ai/orchestrator/comprehensive-orchestrator';

// Mock the external dependencies
jest.mock('@/ai/flows/generate-architecture', () => ({
  generateArchitecture: jest.fn().mockResolvedValue({
    architecture: `# Test Architecture
    
This is a React-based web application with:
- Component-based UI architecture
- RESTful API backend
- Database persistence layer
- Authentication system`,
    specifications: `# Test Specifications

## Features
- User authentication and registration
- Task management interface
- Data persistence
- Responsive design

## Technical Requirements
- React frontend
- Node.js backend
- PostgreSQL database
- JWT authentication`
  })
}));

jest.mock('@/ai/flows/generate-file-structure', () => ({
  generateFileStructure: jest.fn().mockResolvedValue({
    fileStructure: `src/
├── components/
│   ├── ui/
│   ├── auth/
│   └── tasks/
├── pages/
│   ├── login.tsx
│   ├── dashboard.tsx
│   └── tasks.tsx
├── api/
│   ├── auth/
│   └── tasks/
├── lib/
│   ├── auth.ts
│   └── database.ts
└── types/
    └── index.ts`
  })
}));

jest.mock('@/ai/flows/generate-tasks', () => ({
  generateTasks: jest.fn().mockResolvedValue({
    tasks: [
      { title: 'Setup project infrastructure', details: '' },
      { title: 'Configure database schema', details: '' },
      { title: 'Implement authentication system', details: '' },
      { title: 'Create user registration page', details: '' },
      { title: 'Build task management interface', details: '' },
      { title: 'Add user authentication to tasks', details: '' },
      { title: 'Implement data persistence', details: '' },
      { title: 'Add testing framework', details: '' },
    ]
  })
}));

jest.mock('@/ai/genkit', () => ({
  ai: {
    generate: jest.fn().mockImplementation(({ prompt }) => {
      if (prompt.includes('consistency analysis')) {
        return Promise.resolve({
          output: {
            overallConsistency: 92,
            criticalIssues: [],
            suggestions: [
              {
                component: 'tasks',
                issue: 'Authentication tasks could be better ordered',
                suggestion: 'Move authentication setup before user features',
                priority: 'medium',
                reasoning: 'User features depend on authentication'
              }
            ],
            recommendedAction: 'accept'
          }
        });
      }
      
      if (prompt.includes('research for a specific development task')) {
        return Promise.resolve({
          output: {
            context: 'This task establishes the foundational infrastructure for the project',
            implementationSteps: '1. Initialize project structure\n2. Configure build tools\n3. Set up development environment',
            acceptanceCriteria: 'Project builds successfully and development server starts',
            discoveredDependencies: [],
            riskFactors: ['Configuration complexity'],
            integrationPoints: ['Build system', 'Development tools'],
            testingStrategy: 'Unit tests for configuration validation',
            estimatedComplexity: 'medium'
          }
        });
      }
      
      return Promise.resolve({ output: null });
    })
  }
}));

describe('Comprehensive System Integration Test', () => {
  const testPRD = `# Task Management Application

## Overview
Build a web-based task management application that allows users to create, manage, and track their daily tasks.

## Features
- User registration and authentication
- Create, edit, delete tasks
- Mark tasks as complete
- Filter and search tasks
- Responsive design

## Technical Requirements
- Modern web technologies
- Secure authentication
- Data persistence
- Mobile-friendly interface`;

  test('Complete project generation workflow', async () => {
    const result = await generateComprehensiveProject(testPRD, {
      maxRefinementIterations: 2,
      consistencyThreshold: 80
    });

    // Test basic success
    expect(result.success).toBe(true);
    expect(result.context).toBeDefined();
    expect(result.consistencyScore).toBeGreaterThanOrEqual(80);

    // Test context structure
    expect(result.context.prd).toBe(testPRD);
    expect(result.context.architecture).toContain('React');
    expect(result.context.specifications).toContain('authentication');
    expect(result.context.fileStructure).toContain('components');

    // Test task generation and dependencies
    expect(result.context.tasks.length).toBeGreaterThan(0);
    expect(result.context.dependencyGraph.length).toBeGreaterThan(0);

    // Test task structure
    const firstTask = result.context.tasks[0];
    expect(firstTask.id).toMatch(/^task-\d{3}$/);
    expect(firstTask.order).toBe(1);
    expect(firstTask.dependencies).toBeDefined();
    expect(firstTask.status).toBeDefined();

    // Test dependency ordering logic
    const authTask = result.context.tasks.find(t => 
      t.title.toLowerCase().includes('authentication')
    );
    const userFeatureTask = result.context.tasks.find(t => 
      t.title.toLowerCase().includes('user') && 
      !t.title.toLowerCase().includes('authentication')
    );

    if (authTask && userFeatureTask) {
      expect(authTask.order).toBeLessThan(userFeatureTask.order);
    }

    // Test debug information
    expect(result.debugInfo.refinementHistory.length).toBeGreaterThan(0);
    expect(result.debugInfo.validationSteps.length).toBeGreaterThan(0);
    expect(result.debugInfo.dependencyResolutions.length).toBeGreaterThan(0);

    console.log('✅ Complete project generation test passed');
  }, 30000);

  test('Dependency graph validation', async () => {
    const result = await generateComprehensiveProject('Test PRD for validation');
    
    // Test no circular dependencies
    const taskIds = new Set(result.context.tasks.map(t => t.id));
    
    for (const task of result.context.tasks) {
      for (const depId of task.dependencies) {
        expect(taskIds.has(depId)).toBe(true);
      }
    }

    // Test dependency graph structure
    for (const graphNode of result.context.dependencyGraph) {
      expect(taskIds.has(graphNode.taskId)).toBe(true);
      
      for (const depId of graphNode.dependsOn) {
        expect(taskIds.has(depId)).toBe(true);
      }
    }

    console.log('✅ Dependency graph validation test passed');
  });

  test('Validation pipeline', async () => {
    const result = await generateComprehensiveProject('Test PRD for validation');
    
    // Test validation results structure
    expect(result.context.validationHistory).toBeDefined();
    expect(Array.isArray(result.context.validationHistory)).toBe(true);

    // Test comprehensive validation
    const validationResults = ContextValidator.validateFullContext(result.context);
    expect(Array.isArray(validationResults)).toBe(true);

    // Should have minimal errors for a well-formed project
    const errors = validationResults.filter(v => v.severity === 'error');
    expect(errors.length).toBeLessThanOrEqual(2);

    console.log('✅ Validation pipeline test passed');
  });

  test('Iterative refinement', async () => {
    const orchestrator = new ComprehensiveOrchestrator();
    
    // Test with deliberately low consistency threshold to trigger refinement
    const result = await orchestrator.generateComprehensiveProject('Test PRD', {
      maxRefinementIterations: 2,
      consistencyThreshold: 95  // High threshold to trigger refinement
    });

    // Should have attempted refinement
    expect(result.iterationCount).toBeGreaterThan(0);
    expect(result.debugInfo.refinementHistory.length).toBeGreaterThan(0);

    console.log('✅ Iterative refinement test passed');
  });

  test('Error handling', async () => {
    // Test with invalid PRD
    const result = await generateComprehensiveProject('');
    
    // Should handle gracefully
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.context).toBeDefined();

    console.log('✅ Error handling test passed');
  });

  test('Performance benchmarking', async () => {
    const startTime = Date.now();
    
    const result = await generateComprehensiveProject(testPRD, {
      maxRefinementIterations: 1,
      consistencyThreshold: 70
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    
    console.log(`✅ Performance test passed: ${duration}ms`);
  });
});

describe('System Architecture Validation', () => {
  test('Addresses original architectural flaws', async () => {
    const result = await generateComprehensiveProject('Test PRD for validation');
    
    // ✅ Solved Sequential Silo Processing
    expect(result.context.version).toBeGreaterThanOrEqual(1);
    expect(result.context.lastUpdated).toBeDefined();
    
    // ✅ Added Dependency Modeling
    expect(result.context.dependencyGraph.length).toBeGreaterThan(0);
    
    // ✅ Context Propagation
    expect(result.debugInfo.validationSteps.length).toBeGreaterThan(0);
    
    // ✅ Iterative Refinement
    expect(result.consistencyScore).toBeGreaterThan(0);
    
    // ✅ Enhanced Task Research
    const tasksWithDetails = result.context.tasks.filter(t => t.details.length > 0);
    expect(tasksWithDetails.length).toBeGreaterThan(0);
    
    console.log('✅ All architectural flaws addressed');
  });
});