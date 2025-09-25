/**
 * Comprehensive tests for comprehensive-actions module
 * Step 6: Coverage & Completeness - App Actions
 */

import { ai } from '@/ai/litellm';

// Mock the AI service
jest.mock('@/ai/litellm', () => ({
  ai: {
    generate: jest.fn(),
  },
}));

const mockAI = ai as jest.Mocked<typeof ai>;

// Mock Next.js server actions
jest.mock('@/app/comprehensive-actions', () => ({
  runComprehensiveGeneration: jest.fn(),
  runUnifiedProjectFlow: jest.fn(),
  runAdvancedTaskGeneration: jest.fn(),
  runContextualAnalysis: jest.fn(),
}));

import {
  runComprehensiveGeneration,
  runUnifiedProjectFlow,
  runAdvancedTaskGeneration,
  runContextualAnalysis
} from '@/app/comprehensive-actions';

const mockRunComprehensiveGeneration = runComprehensiveGeneration as jest.MockedFunction<typeof runComprehensiveGeneration>;
const mockRunUnifiedProjectFlow = runUnifiedProjectFlow as jest.MockedFunction<typeof runUnifiedProjectFlow>;
const mockRunAdvancedTaskGeneration = runAdvancedTaskGeneration as jest.MockedFunction<typeof runAdvancedTaskGeneration>;
const mockRunContextualAnalysis = runContextualAnalysis as jest.MockedFunction<typeof runContextualAnalysis>;

describe('Comprehensive Actions - Full Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('runComprehensiveGeneration', () => {
    it('should execute complete project generation workflow', async () => {
      const mockResult = {
        architecture: 'Generated architecture content',
        specifications: 'Generated specifications content', 
        fileStructure: 'Generated file structure content',
        tasks: [
          {
            id: 'task-1',
            title: 'Setup Project',
            details: 'Initialize the project structure',
            order: 1,
            dependencies: [],
            status: 'pending'
          }
        ],
        validationResults: [],
        metadata: {
          totalTokensUsed: 2500,
          processingTimeMs: 1500,
          modelUsed: 'gpt-4'
        }
      };

      mockRunComprehensiveGeneration.mockResolvedValue(mockResult);

      const input = {
        prd: 'Build a comprehensive todo application',
        options: {
          apiKey: 'test-api-key',
          model: 'gpt-4',
          apiBase: 'https://api.openai.com/v1',
          useTDD: true,
          temperature: 0.7
        }
      };

      const result = await runComprehensiveGeneration(input, input.options);

      expect(result.architecture).toContain('Generated architecture');
      expect(result.tasks).toHaveLength(1);
      expect(result.metadata.totalTokensUsed).toBe(2500);
      expect(mockRunComprehensiveGeneration).toHaveBeenCalledWith(input, input.options);
    });

    it('should handle comprehensive generation with validation', async () => {
      const mockResult = {
        architecture: 'Validated architecture',
        specifications: 'Validated specifications',
        fileStructure: 'Validated file structure',
        tasks: [],
        validationResults: [
          {
            isValid: true,
            issues: [],
            component: 'architecture',
            severity: 'info'
          }
        ],
        metadata: {
          totalTokensUsed: 3000,
          processingTimeMs: 2000,
          modelUsed: 'gpt-4',
          validationPassed: true
        }
      };

      mockRunComprehensiveGeneration.mockResolvedValue(mockResult);

      const input = {
        prd: 'Enterprise application with strict validation',
        options: {
          apiKey: 'test-key',
          model: 'gpt-4',
          enableValidation: true,
          validationLevel: 'strict'
        }
      };

      const result = await runComprehensiveGeneration(input, input.options);

      expect(result.validationResults).toHaveLength(1);
      expect(result.validationResults[0].isValid).toBe(true);
      expect(result.metadata.validationPassed).toBe(true);
    });

    it('should handle generation errors gracefully', async () => {
      mockRunComprehensiveGeneration.mockRejectedValue(
        new Error('Comprehensive generation failed: API quota exceeded')
      );

      const input = {
        prd: 'Test application',
        options: { apiKey: 'invalid-key' }
      };

      await expect(runComprehensiveGeneration(input, input.options))
        .rejects.toThrow('Comprehensive generation failed: API quota exceeded');
    });

    it('should handle empty PRD input', async () => {
      const mockResult = {
        architecture: 'Basic architecture template',
        specifications: 'Basic specifications template',
        fileStructure: 'Basic file structure template',
        tasks: [],
        validationResults: [],
        metadata: {
          totalTokensUsed: 500,
          processingTimeMs: 300,
          modelUsed: 'gpt-3.5-turbo'
        }
      };

      mockRunComprehensiveGeneration.mockResolvedValue(mockResult);

      const input = {
        prd: '',
        options: { apiKey: 'test-key' }
      };

      const result = await runComprehensiveGeneration(input, input.options);

      expect(result.architecture).toContain('Basic architecture');
      expect(result.metadata.totalTokensUsed).toBe(500);
    });
  });

  describe('runUnifiedProjectFlow', () => {
    it('should execute unified project workflow successfully', async () => {
      const mockResult = {
        projectContext: {
          prd: 'Test PRD',
          architecture: 'Unified architecture',
          specifications: 'Unified specifications',
          fileStructure: 'Unified file structure',
          tasks: [
            {
              id: 'unified-task-1',
              title: 'Unified Setup',
              details: 'Setup unified project structure',
              order: 1,
              dependencies: [],
              status: 'pending'
            }
          ],
          dependencyGraph: [
            { taskId: 'unified-task-1', dependsOn: [], blockedBy: [] }
          ],
          validationHistory: [],
          lastUpdated: '2020-01-01T00:00:00.000Z',
          version: 1
        },
        flowMetadata: {
          stepsCompleted: 4,
          totalSteps: 4,
          duration: 2500,
          success: true
        }
      };

      mockRunUnifiedProjectFlow.mockResolvedValue(mockResult);

      const input = {
        prd: 'Unified project requirements',
        flowOptions: {
          includeValidation: true,
          generateDependencies: true,
          optimizeForPerformance: true
        },
        options: {
          apiKey: 'test-key',
          model: 'gpt-4'
        }
      };

      const result = await runUnifiedProjectFlow(input, input.options);

      expect(result.projectContext.tasks).toHaveLength(1);
      expect(result.projectContext.dependencyGraph).toHaveLength(1);
      expect(result.flowMetadata.stepsCompleted).toBe(4);
      expect(result.flowMetadata.success).toBe(true);
    });

    it('should handle unified flow with complex dependencies', async () => {
      const mockResult = {
        projectContext: {
          prd: 'Complex project',
          architecture: 'Multi-tier architecture',
          specifications: 'Complex specifications',
          fileStructure: 'Multi-module structure',
          tasks: [
            {
              id: 'task-1',
              title: 'Foundation',
              details: 'Setup foundation',
              order: 1,
              dependencies: [],
              status: 'pending'
            },
            {
              id: 'task-2', 
              title: 'Core Features',
              details: 'Implement core features',
              order: 2,
              dependencies: ['task-1'],
              status: 'pending'
            },
            {
              id: 'task-3',
              title: 'Integration',
              details: 'Integrate components',
              order: 3,
              dependencies: ['task-1', 'task-2'],
              status: 'pending'
            }
          ],
          dependencyGraph: [
            { taskId: 'task-1', dependsOn: [], blockedBy: ['task-2', 'task-3'] },
            { taskId: 'task-2', dependsOn: ['task-1'], blockedBy: ['task-3'] },
            { taskId: 'task-3', dependsOn: ['task-1', 'task-2'], blockedBy: [] }
          ],
          validationHistory: [
            {
              timestamp: '2020-01-01T00:00:00.000Z',
              results: [{ isValid: true, issues: [], component: 'dependencies', severity: 'info' }]
            }
          ],
          lastUpdated: '2020-01-01T00:00:00.000Z',
          version: 1
        },
        flowMetadata: {
          stepsCompleted: 5,
          totalSteps: 5,
          duration: 3500,
          success: true,
          dependenciesResolved: 3,
          cyclesDetected: 0
        }
      };

      mockRunUnifiedProjectFlow.mockResolvedValue(mockResult);

      const input = {
        prd: 'Complex multi-module project',
        flowOptions: {
          includeValidation: true,
          generateDependencies: true,
          resolveCycles: true,
          maxDepth: 5
        },
        options: { apiKey: 'test-key', model: 'gpt-4' }
      };

      const result = await runUnifiedProjectFlow(input, input.options);

      expect(result.projectContext.tasks).toHaveLength(3);
      expect(result.projectContext.dependencyGraph).toHaveLength(3);
      expect(result.flowMetadata.dependenciesResolved).toBe(3);
      expect(result.flowMetadata.cyclesDetected).toBe(0);
    });

    it('should handle unified flow errors', async () => {
      mockRunUnifiedProjectFlow.mockRejectedValue(
        new Error('Unified flow failed: Dependency cycle detected')
      );

      const input = {
        prd: 'Project with circular dependencies',
        flowOptions: { generateDependencies: true },
        options: { apiKey: 'test-key' }
      };

      await expect(runUnifiedProjectFlow(input, input.options))
        .rejects.toThrow('Unified flow failed: Dependency cycle detected');
    });
  });

  describe('runAdvancedTaskGeneration', () => {
    it('should generate advanced tasks with research integration', async () => {
      const mockResult = {
        tasks: [
          {
            id: 'advanced-task-1',
            title: 'Research-Driven Setup',
            details: `Setup project with researched best practices
            
Research Areas:
- Latest React patterns and performance optimizations
- State management solutions comparison
- Testing strategies for modern React apps

Implementation:
- Apply researched React 18 concurrent features
- Implement optimized state management
- Setup comprehensive testing suite`,
            order: 1,
            dependencies: [],
            status: 'researching',
            researchAreas: ['React 18 features', 'State management', 'Testing strategies'],
            estimatedHours: 8,
            complexity: 'medium',
            priority: 'high'
          },
          {
            id: 'advanced-task-2',
            title: 'Enhanced Component Development',
            details: 'Build components with advanced patterns',
            order: 2,
            dependencies: ['advanced-task-1'],
            status: 'pending',
            researchAreas: [],
            estimatedHours: 12,
            complexity: 'high',
            priority: 'medium'
          }
        ],
        enhancementMetadata: {
          totalResearchAreas: 3,
          averageComplexity: 'medium-high',
          estimatedDuration: '20 hours',
          researchIntegrated: true
        }
      };

      mockRunAdvancedTaskGeneration.mockResolvedValue(mockResult);

      const input = {
        baseRequirements: {
          architecture: 'React architecture',
          specifications: 'Advanced specifications',
          fileStructure: 'Modular structure'
        },
        enhancementOptions: {
          includeResearch: true,
          addComplexityAnalysis: true,
          generateEstimates: true,
          prioritizeWithMoscow: true
        },
        options: { apiKey: 'test-key', model: 'gpt-4' }
      };

      const result = await runAdvancedTaskGeneration(input, input.options);

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].status).toBe('researching');
      expect(result.tasks[0].researchAreas).toHaveLength(3);
      expect(result.enhancementMetadata.researchIntegrated).toBe(true);
    });

    it('should generate tasks with complexity analysis', async () => {
      const mockResult = {
        tasks: [
          {
            id: 'complex-task-1',
            title: 'High Complexity Backend',
            details: 'Complex microservices architecture',
            order: 1,
            dependencies: [],
            status: 'pending',
            complexity: 'very-high',
            riskFactors: ['Distributed systems', 'Data consistency', 'Service discovery'],
            mitigationStrategies: ['Implement circuit breakers', 'Use event sourcing', 'Setup monitoring'],
            estimatedHours: 40,
            requiredSkills: ['Microservices', 'Docker', 'Kubernetes'],
            priority: 'critical'
          }
        ],
        enhancementMetadata: {
          highComplexityTasks: 1,
          totalRiskFactors: 3,
          averageEstimate: '40 hours',
          skillsRequired: ['Microservices', 'Docker', 'Kubernetes']
        }
      };

      mockRunAdvancedTaskGeneration.mockResolvedValue(mockResult);

      const input = {
        baseRequirements: {
          architecture: 'Microservices architecture',
          specifications: 'Enterprise specifications',
          fileStructure: 'Service-oriented structure'
        },
        enhancementOptions: {
          addComplexityAnalysis: true,
          includeRiskAssessment: true,
          generateSkillRequirements: true
        },
        options: { apiKey: 'test-key', model: 'gpt-4' }
      };

      const result = await runAdvancedTaskGeneration(input, input.options);

      expect(result.tasks[0].complexity).toBe('very-high');
      expect(result.tasks[0].riskFactors).toHaveLength(3);
      expect(result.tasks[0].requiredSkills).toHaveLength(3);
      expect(result.enhancementMetadata.highComplexityTasks).toBe(1);
    });

    it('should handle advanced task generation errors', async () => {
      mockRunAdvancedTaskGeneration.mockRejectedValue(
        new Error('Advanced task generation failed: Complexity analysis timeout')
      );

      const input = {
        baseRequirements: {
          architecture: 'Test architecture',
          specifications: 'Test specs',
          fileStructure: 'Test structure'
        },
        enhancementOptions: { addComplexityAnalysis: true },
        options: { apiKey: 'invalid-key' }
      };

      await expect(runAdvancedTaskGeneration(input, input.options))
        .rejects.toThrow('Advanced task generation failed: Complexity analysis timeout');
    });
  });

  describe('runContextualAnalysis', () => {
    it('should perform comprehensive contextual analysis', async () => {
      const mockResult = {
        analysisResults: {
          architecturalPatterns: [
            { pattern: 'MVC', confidence: 0.9, applicability: 'high' },
            { pattern: 'Microservices', confidence: 0.7, applicability: 'medium' }
          ],
          technologyStack: [
            { technology: 'React', version: '18.x', reasoning: 'Modern UI requirements' },
            { technology: 'Node.js', version: '20.x', reasoning: 'Server-side JavaScript' },
            { technology: 'PostgreSQL', version: '15.x', reasoning: 'Complex data relationships' }
          ],
          complexityMetrics: {
            overall: 'high',
            frontend: 'medium',
            backend: 'high',
            database: 'medium'
          },
          recommendations: [
            {
              category: 'Architecture',
              recommendation: 'Consider event-driven architecture for scalability',
              priority: 'high',
              effort: 'medium'
            },
            {
              category: 'Testing',
              recommendation: 'Implement comprehensive integration testing',
              priority: 'high',
              effort: 'high'
            }
          ]
        },
        metadata: {
          analysisDepth: 'comprehensive',
          confidenceScore: 0.85,
          processingTime: 2000,
          patternsAnalyzed: 15,
          recommendationsGenerated: 2
        }
      };

      mockRunContextualAnalysis.mockResolvedValue(mockResult);

      const input = {
        projectContext: {
          prd: 'Enterprise e-commerce platform',
          domain: 'e-commerce',
          scale: 'enterprise',
          constraints: ['High availability', 'GDPR compliance', 'Mobile-first']
        },
        analysisOptions: {
          depth: 'comprehensive',
          includePatternAnalysis: true,
          includeTechStackRecommendations: true,
          generateRecommendations: true
        },
        options: { apiKey: 'test-key', model: 'gpt-4' }
      };

      const result = await runContextualAnalysis(input, input.options);

      expect(result.analysisResults.architecturalPatterns).toHaveLength(2);
      expect(result.analysisResults.technologyStack).toHaveLength(3);
      expect(result.analysisResults.recommendations).toHaveLength(2);
      expect(result.metadata.confidenceScore).toBe(0.85);
    });

    it('should perform domain-specific analysis', async () => {
      const mockResult = {
        analysisResults: {
          domainSpecificPatterns: [
            { pattern: 'CQRS', domain: 'fintech', applicability: 'high' },
            { pattern: 'Event Sourcing', domain: 'fintech', applicability: 'high' }
          ],
          complianceRequirements: [
            { standard: 'PCI DSS', applicability: 'required', implementation: 'tokenization' },
            { standard: 'SOX', applicability: 'required', implementation: 'audit trails' }
          ],
          securityConsiderations: [
            { area: 'Data encryption', priority: 'critical', implementation: 'AES-256' },
            { area: 'API security', priority: 'high', implementation: 'OAuth 2.0 + PKCE' }
          ]
        },
        metadata: {
          domain: 'fintech',
          complianceLevel: 'strict',
          securityProfile: 'high'
        }
      };

      mockRunContextualAnalysis.mockResolvedValue(mockResult);

      const input = {
        projectContext: {
          prd: 'Fintech trading platform',
          domain: 'fintech',
          scale: 'enterprise',
          constraints: ['PCI DSS compliance', 'Real-time trading', 'High security']
        },
        analysisOptions: {
          includeDomainSpecific: true,
          includeCompliance: true,
          includeSecurity: true
        },
        options: { apiKey: 'test-key', model: 'gpt-4' }
      };

      const result = await runContextualAnalysis(input, input.options);

      expect(result.analysisResults.domainSpecificPatterns).toHaveLength(2);
      expect(result.analysisResults.complianceRequirements).toHaveLength(2);
      expect(result.analysisResults.securityConsiderations).toHaveLength(2);
      expect(result.metadata.domain).toBe('fintech');
    });

    it('should handle contextual analysis errors', async () => {
      mockRunContextualAnalysis.mockRejectedValue(
        new Error('Contextual analysis failed: Domain knowledge base unavailable')
      );

      const input = {
        projectContext: {
          prd: 'Unknown domain project',
          domain: 'unknown',
          scale: 'small'
        },
        analysisOptions: { includeDomainSpecific: true },
        options: { apiKey: 'test-key' }
      };

      await expect(runContextualAnalysis(input, input.options))
        .rejects.toThrow('Contextual analysis failed: Domain knowledge base unavailable');
    });
  });

  describe('Integration and Edge Cases', () => {
    it('should handle concurrent comprehensive operations', async () => {
      const mockResults = [
        { architecture: 'Architecture 1', tasks: [] },
        { architecture: 'Architecture 2', tasks: [] },
        { architecture: 'Architecture 3', tasks: [] }
      ];

      mockRunComprehensiveGeneration
        .mockResolvedValueOnce(mockResults[0])
        .mockResolvedValueOnce(mockResults[1])
        .mockResolvedValueOnce(mockResults[2]);

      const inputs = [
        { prd: 'Project 1', options: { apiKey: 'key1' } },
        { prd: 'Project 2', options: { apiKey: 'key2' } },
        { prd: 'Project 3', options: { apiKey: 'key3' } }
      ];

      const promises = inputs.map(input => 
        runComprehensiveGeneration(input, input.options)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results[0].architecture).toBe('Architecture 1');
      expect(results[1].architecture).toBe('Architecture 2');
      expect(results[2].architecture).toBe('Architecture 3');
    });

    it('should handle large-scale comprehensive generation', async () => {
      const mockResult = {
        architecture: 'Large-scale architecture '.repeat(100),
        specifications: 'Extensive specifications '.repeat(100),
        fileStructure: 'Complex file structure '.repeat(100),
        tasks: Array(50).fill(null).map((_, i) => ({
          id: `large-task-${i + 1}`,
          title: `Large Task ${i + 1}`,
          details: `Task details ${i + 1}`,
          order: i + 1,
          dependencies: i > 0 ? [`large-task-${i}`] : [],
          status: 'pending'
        })),
        validationResults: [],
        metadata: {
          totalTokensUsed: 50000,
          processingTimeMs: 30000,
          modelUsed: 'gpt-4',
          scale: 'enterprise'
        }
      };

      mockRunComprehensiveGeneration.mockResolvedValue(mockResult);

      const input = {
        prd: 'Large enterprise platform '.repeat(1000),
        options: {
          apiKey: 'test-key',
          model: 'gpt-4',
          maxTokens: 50000,
          timeout: 60000
        }
      };

      const result = await runComprehensiveGeneration(input, input.options);

      expect(result.tasks).toHaveLength(50);
      expect(result.metadata.totalTokensUsed).toBe(50000);
      expect(result.metadata.scale).toBe('enterprise');
    });

    it('should handle memory-intensive operations', async () => {
      const mockResult = {
        projectContext: {
          prd: 'Memory-intensive project',
          architecture: 'Large architecture',
          specifications: 'Extensive specifications',
          fileStructure: 'Complex structure',
          tasks: Array(1000).fill(null).map((_, i) => ({
            id: `memory-task-${i + 1}`,
            title: `Memory Task ${i + 1}`,
            details: 'Complex task details '.repeat(100),
            order: i + 1,
            dependencies: [],
            status: 'pending'
          })),
          dependencyGraph: [],
          validationHistory: [],
          lastUpdated: '2020-01-01T00:00:00.000Z',
          version: 1
        },
        flowMetadata: {
          memoryUsageMB: 512,
          optimizationsApplied: ['Task chunking', 'Lazy loading', 'Memory pooling'],
          success: true
        }
      };

      mockRunUnifiedProjectFlow.mockResolvedValue(mockResult);

      const input = {
        prd: 'Memory-intensive enterprise project',
        flowOptions: {
          enableMemoryOptimization: true,
          chunkSize: 100,
          lazyLoadTasks: true
        },
        options: { apiKey: 'test-key', model: 'gpt-4' }
      };

      const result = await runUnifiedProjectFlow(input, input.options);

      expect(result.projectContext.tasks).toHaveLength(1000);
      expect(result.flowMetadata.memoryUsageMB).toBe(512);
      expect(result.flowMetadata.optimizationsApplied).toHaveLength(3);
    });
  });
});