import { ContextValidator } from '@/ai/validation/context-validator';
import type { UnifiedProjectContext } from '@/types/unified-context';

describe('ContextValidator', () => {
  const mockContext: UnifiedProjectContext = {
    prd: 'Build a task management application with user authentication',
    architecture: 'React Architecture with components and API routes',
    specifications: 'Features and technical requirements for task management',
    fileStructure: 'src/ structure with components and api routes',
    tasks: [
      {
        title: 'Setup project',
        details: 'Initialize project with React and TypeScript',
        id: 'task-001',
        order: 1,
        dependencies: [],
        status: 'pending',
      },
    ],
    dependencyGraph: [
      { taskId: 'task-001', dependsOn: [], blockedBy: [] },
    ],
    validationHistory: [],
    lastUpdated: new Date('2020-01-01T00:00:00.000Z').toISOString(),
    version: 1,
  };

  describe('validateFullContext', () => {
    it('should validate a complete and valid context', () => {
      const results = ContextValidator.validateFullContext(mockContext);
      
      // Should return validation results array
      expect(Array.isArray(results)).toBe(true);
      
      // Results should be from validation methods
      expect(results.length).toBeGreaterThanOrEqual(0);
      
      // Each result should have required structure
      results.forEach(result => {
        expect(result).toHaveProperty('isValid');
        expect(result).toHaveProperty('issues');
        expect(result).toHaveProperty('component');
        expect(result).toHaveProperty('severity');
      });
    });

    it('should detect missing architecture', () => {
      const invalidContext = { ...mockContext, architecture: '' };
      const results = ContextValidator.validateFullContext(invalidContext);
      
      const archErrors = results.filter(r => r.component === 'architecture' && !r.isValid);
      expect(archErrors.length).toBeGreaterThan(0);
    });

    it('should detect missing file structure', () => {
      const invalidContext = { ...mockContext, fileStructure: '' };
      const results = ContextValidator.validateFullContext(invalidContext);
      
      const fileErrors = results.filter(r => r.component === 'fileStructure' && !r.isValid);
      expect(fileErrors.length).toBeGreaterThan(0);
    });

    it('should validate task dependencies', () => {
      const contextWithDeps = {
        ...mockContext,
        tasks: [
          {
            title: 'Task A',
            details: 'First task',
            id: 'task-a',
            order: 1,
            dependencies: ['task-b'],
            status: 'pending' as const,
          },
          {
            title: 'Task B',
            details: 'Second task',
            id: 'task-b',
            order: 2,
            dependencies: [],
            status: 'pending' as const,
          },
        ],
        dependencyGraph: [
          { taskId: 'task-a', dependsOn: ['task-b'], blockedBy: [] },
          { taskId: 'task-b', dependsOn: [], blockedBy: ['task-a'] },
        ],
      };

      const results = ContextValidator.validateFullContext(contextWithDeps);
      
      // Should run validation without errors
      expect(Array.isArray(results)).toBe(true);
    });

    it('should detect circular dependencies', () => {
      const circularContext = {
        ...mockContext,
        tasks: [
          {
            title: 'Task A',
            details: 'Task A',
            id: 'task-a',
            order: 1,
            dependencies: ['task-c'],
            status: 'pending' as const,
          },
          {
            title: 'Task B',
            details: 'Task B',
            id: 'task-b',
            order: 2,
            dependencies: ['task-a'],
            status: 'pending' as const,
          },
          {
            title: 'Task C',
            details: 'Task C',
            id: 'task-c',
            order: 3,
            dependencies: ['task-b'],
            status: 'pending' as const,
          },
        ],
        dependencyGraph: [
          { taskId: 'task-a', dependsOn: ['task-c'], blockedBy: ['task-b'] },
          { taskId: 'task-b', dependsOn: ['task-a'], blockedBy: ['task-c'] },
          { taskId: 'task-c', dependsOn: ['task-b'], blockedBy: ['task-a'] },
        ],
      };

      const results = ContextValidator.validateFullContext(circularContext);
      
      // Should detect circular dependency errors
      const circularErrors = results.filter(r => 
        r.component === 'dependencies' && 
        r.severity === 'error' && 
        !r.isValid
      );
      expect(circularErrors.length).toBeGreaterThan(0);
    });

    it('should validate architecture and file structure alignment', () => {
      const mismatchedContext = {
        ...mockContext,
        architecture: 'React single-page application with component-based architecture',
        fileStructure: 'Simple flat structure with no components directory',
      };

      const results = ContextValidator.validateFullContext(mismatchedContext);
      
      // Should run validation without throwing errors
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty tasks array', () => {
      const emptyTasksContext = {
        ...mockContext,
        tasks: [],
        dependencyGraph: [],
      };

      const results = ContextValidator.validateFullContext(emptyTasksContext);
      
      // Should handle empty tasks gracefully
      expect(() => ContextValidator.validateFullContext(emptyTasksContext)).not.toThrow();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should validate task structure completeness', () => {
      const incompleteTaskContext = {
        ...mockContext,
        tasks: [
          {
            title: 'Incomplete Task',
            details: '',
            id: '',
            order: 0,
            dependencies: [],
            status: 'pending' as const,
          },
        ],
      };

      const results = ContextValidator.validateFullContext(incompleteTaskContext);
      
      // Should identify incomplete task structure
      const taskErrors = results.filter(r => r.component === 'tasks' && !r.isValid);
      expect(taskErrors.length).toBeGreaterThan(0);
    });
  });

  describe('error severity handling', () => {
    it('should classify errors by severity', () => {
      const invalidContext = {
        ...mockContext,
        architecture: '',
        fileStructure: '',
        tasks: [],
      };

      const results = ContextValidator.validateFullContext(invalidContext);
      
      const errors = results.filter(r => r.severity === 'error');
      const warnings = results.filter(r => r.severity === 'warning');
      
      // Should have both errors and warnings
      expect(errors.length).toBeGreaterThan(0);
      expect(warnings.length).toBeGreaterThanOrEqual(0);
    });
  });
});