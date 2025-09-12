/**
 * @fileOverview Unit tests for API parameter validation in orchestrators
 */

import { ComprehensiveOrchestrator } from '@/ai/orchestrator/comprehensive-orchestrator';
import { IterativeRefinementEngine } from '@/ai/orchestrator/iterative-refinement';

describe('API Parameter Validation', () => {
  let orchestrator: ComprehensiveOrchestrator;
  let refinementEngine: IterativeRefinementEngine;

  beforeEach(() => {
    orchestrator = new ComprehensiveOrchestrator();
    refinementEngine = new IterativeRefinementEngine();
  });

  test('ComprehensiveOrchestrator validates apiBase when apiKey is provided', async () => {
    const options = {
      apiKey: 'test-key',
      // Missing apiBase
      model: 'test/model'
    };

    await expect(
      orchestrator.generateComprehensiveProject('Test PRD', options)
    ).rejects.toThrow('API base URL is required when API key is provided');
  });

  test('ComprehensiveOrchestrator accepts valid apiKey and apiBase combination', async () => {
    const options = {
      apiKey: 'test-key',
      apiBase: 'https://api.example.com/v1',
      model: 'test/model'
    };

    // This test will fail at the network level, but should pass parameter validation
    const result = await orchestrator.generateComprehensiveProject('Test PRD', options);
    
    // Should not fail due to parameter validation - will fail due to network/AI call
    expect(result.errors).not.toContain('API base URL is required when API key is provided');
    expect(result.success).toBe(false); // Will fail due to network call
    expect(result.errors.some(error => error.includes('fetch failed') || error.includes('network'))).toBeTruthy();
  });

  test('ComprehensiveOrchestrator allows undefined apiKey without apiBase', async () => {
    const options = {
      // Both undefined
      model: 'test/model'
    };

    // This test will fail at the AI call level when API key validation occurs
    const result = await orchestrator.generateComprehensiveProject('Test PRD', options);
    
    // Should not fail due to apiBase validation, but should fail due to missing API key
    expect(result.errors).not.toContain('API base URL is required when API key is provided');
    expect(result.success).toBe(false); // Will fail due to missing API key
    expect(result.errors.some(error => error.includes('API key is required'))).toBeTruthy();
  });

  test('IterativeRefinementEngine compression preserves key information', () => {
    // Test the compression methods directly using private method access
    const engine = refinementEngine as any;

    const longPRD = `
# Product Requirements Document
This is a very long PRD that contains many requirements and features.
Feature 1: User authentication is required for the system.
Feature 2: Data persistence using a database.
Feature 3: API endpoints for all operations.
Goal: Build a scalable application.
Objective: Support 1000 concurrent users.
The system must handle user registration and login.
Additional requirements include monitoring and logging.
Performance requirements specify sub-second response times.
Security requirements mandate encryption at rest and in transit.
`.repeat(10); // Make it very long

    const compressed = engine.compressPRD(longPRD, 100); // 100 tokens = ~400 chars

    expect(compressed).toContain('requirement');
    expect(compressed).toContain('Feature');
    expect(compressed).toContain('[Content compressed');
    expect(compressed.length).toBeLessThan(longPRD.length);
  });

  test('Context compression methods handle empty input gracefully', () => {
    const engine = refinementEngine as any;

    expect(engine.compressPRD('', 100)).toBe('');
    expect(engine.compressArchitecture('', 100)).toBe('');
    expect(engine.compressSpecifications('', 100)).toBe('');
    expect(engine.compressFileStructure('', 100)).toBe('');
  });

  test('Task formatting optimization works for large task lists', () => {
    const engine = refinementEngine as any;
    
    // Create a large task list
    const tasks = Array.from({ length: 25 }, (_, i) => ({
      id: `task-${i + 1}`,
      order: i + 1,
      title: `Task ${i + 1}: Implement feature ${i + 1}`,
      details: `This is a detailed description for task ${i + 1} with implementation steps and acceptance criteria.`,
      dependencies: i > 0 ? [`task-${i}`] : [],
      status: 'pending' as const
    }));

    const formatted = engine.formatTasksForAnalysisOptimized(tasks);
    
    expect(formatted).toContain('Showing first 10 of 25 tasks');
    expect(formatted).toContain('task-1');
    expect(formatted).toContain('task-10');
    expect(formatted).not.toContain('task-25'); // Should not show all tasks
  });
});

describe('Context Compression Edge Cases', () => {
  let engine: IterativeRefinementEngine;

  beforeEach(() => {
    engine = new IterativeRefinementEngine();
  });

  test('compressContextSection handles different section types correctly', () => {
    const engineAccess = engine as any;
    
    const testContent = 'This is test content that is relatively short.';
    
    // Should not compress short content
    expect(engineAccess.compressContextSection(testContent, 1000, 'PRD')).toBe(testContent);
    
    // Should compress long content
    const longContent = 'This is a very long piece of content. '.repeat(100);
    const compressed = engineAccess.compressContextSection(longContent, 50, 'PRD');
    expect(compressed.length).toBeLessThan(longContent.length);
  });

  test('truncateText works correctly', () => {
    const engine = new IterativeRefinementEngine();
    const engineAccess = engine as any;
    
    expect(engineAccess.truncateText('Short text', 50)).toBe('Short text');
    expect(engineAccess.truncateText('This is a very long text that should be truncated', 20))
      .toBe('This is a very long ...');
  });
});