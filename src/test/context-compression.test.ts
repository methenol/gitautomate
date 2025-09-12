import { ContextCompressor } from '@/ai/utils/context-compression';
import { UnifiedProjectContext, ValidationResult, EnhancedTask } from '@/types/unified-context';

describe('Context Compression', () => {
  
  // Mock data for testing
  const createMockContext = (size: 'small' | 'large' = 'small'): UnifiedProjectContext => {
    const baseTasks: EnhancedTask[] = [
      {
        id: 'task-1',
        title: 'Setup project structure and configuration',
        details: 'Create the basic project structure with TypeScript configuration, linting setup, and initial dependencies.',
        acceptanceCriteria: 'Project builds successfully',
        timeEstimate: '2 hours',
        priority: 'high',
        order: 1,
        dependencies: [],
        status: 'pending'
      },
      {
        id: 'task-2', 
        title: 'Implement authentication system',
        details: 'Create user authentication with JWT tokens, login/logout functionality, and protected routes.',
        acceptanceCriteria: 'Users can login and access protected areas',
        timeEstimate: '4 hours',
        priority: 'high',
        order: 2,
        dependencies: ['task-1'],
        status: 'pending'
      }
    ];

    const largeTasks = size === 'large' ? Array.from({ length: 25 }, (_, i) => ({
      ...baseTasks[0],
      id: `task-${i + 3}`,
      title: `Task ${i + 3}: ${baseTasks[0].title} with additional complexity`,
      order: i + 3,
      dependencies: i > 0 ? [`task-${i + 2}`] : ['task-2']
    })) : [];

    return {
      prd: size === 'large' 
        ? 'A comprehensive project management system with user authentication, project creation, task management, team collaboration, real-time notifications, file sharing, reporting dashboards, advanced search functionality, mobile responsiveness, and integration with third-party services like Slack and GitHub.'
        : 'A simple task management application with user authentication and basic CRUD operations.',
      architecture: size === 'large'
        ? 'Microservices architecture with separate services for authentication, project management, notifications, file storage, and reporting. Uses React frontend, Node.js backend, PostgreSQL database, Redis for caching, and Docker for containerization.'
        : 'Simple full-stack application with React frontend and Node.js backend using Express and SQLite database.',
      specifications: size === 'large'
        ? 'RESTful API with OpenAPI specification, JWT authentication, role-based access control, real-time WebSocket connections, file upload with S3 storage, comprehensive error handling, logging with Winston, monitoring with Prometheus.'
        : 'REST API with basic CRUD endpoints for tasks and simple JWT authentication.',
      fileStructure: size === 'large'
        ? 'Complex multi-service structure with separate repositories, shared libraries, deployment configurations, monitoring setup, and comprehensive documentation.'
        : 'Standard React/Node.js structure with src/, components/, and api/ folders.',
      tasks: [...baseTasks, ...largeTasks],
      dependencyGraph: [],
      validationHistory: [],
      lastUpdated: new Date().toISOString(),
      version: 1
    };
  };

  const createMockValidationResults = (): ValidationResult[] => [
    {
      isValid: false,
      issues: ['Missing error handling in authentication flow', 'No validation for user input'],
      component: 'architecture',
      severity: 'error'
    },
    {
      isValid: false,
      issues: ['Task dependencies may cause circular references'],
      component: 'dependencies', 
      severity: 'warning'
    }
  ];

  describe('compressForAnalysis', () => {
    it('should compress context while preserving essential information', () => {
      const context = createMockContext('small');
      const validationResults = createMockValidationResults();
      
      const compressed = ContextCompressor.compressForAnalysis(context, validationResults, {
        maxTokens: 2000 // Increased to ensure validation results aren't truncated
      });

      expect(compressed).toBeDefined();
      expect(compressed.prd).toContain('task management');
      expect(compressed.architecture).toContain('React');
      expect(compressed.tasks).toContain('task-1');
      expect(compressed.validationIssues).toContain('ERROR:');
      expect(compressed.compressionRatio).toBeGreaterThan(0);
      expect(compressed.compressionRatio).toBeLessThanOrEqual(1);
    });

    it('should achieve higher compression for large contexts', () => {
      const smallContext = createMockContext('small');
      const largeContext = createMockContext('large');
      const validationResults = createMockValidationResults();
      
      const smallCompressed = ContextCompressor.compressForAnalysis(smallContext, validationResults, {
        maxTokens: 3000  // Give small context plenty of space
      });
      
      const largeCompressed = ContextCompressor.compressForAnalysis(largeContext, validationResults, {
        maxTokens: 1500  // Force compression on large context
      });

      // Large context should have lower compression ratio (more compressed) 
      expect(largeCompressed.compressionRatio).toBeLessThan(smallCompressed.compressionRatio);
      expect(largeCompressed.tokensSaved).toBeGreaterThan(smallCompressed.tokensSaved);
    });

    it('should preserve priority keywords in compressed documents', () => {
      const context = createMockContext('large');
      const validationResults = createMockValidationResults();
      
      const compressed = ContextCompressor.compressForAnalysis(context, validationResults, {
        maxTokens: 1500
      });

      // Should preserve key terms
      expect(compressed.prd.toLowerCase()).toMatch(/user|authentication|management/);
      expect(compressed.architecture.toLowerCase()).toMatch(/react|node|database/);
      expect(compressed.tasks).toContain('authentication');
    });

    it('should handle empty or minimal contexts gracefully', () => {
      const emptyContext: UnifiedProjectContext = {
        prd: '',
        architecture: '',
        specifications: '',
        fileStructure: '',
        tasks: [],
        dependencyGraph: [],
        validationHistory: [],
        lastUpdated: new Date().toISOString(),
        version: 1
      };
      
      const compressed = ContextCompressor.compressForAnalysis(emptyContext, [], {
        maxTokens: 1000
      });

      expect(compressed.prd).toBe('');
      expect(compressed.tasks).toContain('No tasks defined');
      expect(compressed.validationIssues).toContain('No validation issues found');
      expect(compressed.compressionRatio).toBe(1);
      expect(compressed.tokensSaved).toBe(0);
    });
  });

  describe('createFocusedChunks', () => {
    it('should create architecture-focused chunks', () => {
      const context = createMockContext('large');
      const validationResults = createMockValidationResults();
      
      const chunk = ContextCompressor.createFocusedChunks(context, validationResults, 'architecture');

      expect(chunk).toBeDefined();
      expect(chunk.architecture.length).toBeGreaterThan(0);
      expect(chunk.specifications.length).toBeGreaterThan(0);
    });

    it('should create task-focused chunks', () => {
      const context = createMockContext('large');
      const validationResults = createMockValidationResults();
      
      const chunk = ContextCompressor.createFocusedChunks(context, validationResults, 'tasks');

      expect(chunk.tasks).toContain('task-1');
      expect(chunk.tasks).toContain('authentication');
    });

    it('should create dependency-focused chunks', () => {
      const context = createMockContext('large');
      const validationResults = createMockValidationResults();
      
      const chunk = ContextCompressor.createFocusedChunks(context, validationResults, 'dependencies');

      expect(chunk.tasks).toContain('Deps:');
      expect(chunk.validationIssues).toContain('dependencies');
    });

    it('should create cross-validation chunks', () => {
      const context = createMockContext('large'); 
      const validationResults = createMockValidationResults();
      
      const chunk = ContextCompressor.createFocusedChunks(context, validationResults, 'cross-validation');

      expect(chunk.prd.length).toBeGreaterThan(0);
      expect(chunk.architecture.length).toBeGreaterThan(0);
      expect(chunk.tasks.length).toBeGreaterThan(0);
    });
  });

  describe('Task Compression', () => {
    it('should prioritize tasks with more dependencies', () => {
      const context = createMockContext('large');
      const validationResults = createMockValidationResults();
      
      const compressed = ContextCompressor.compressForAnalysis(context, validationResults, {
        maxTokens: 1000
      });

      // Should prioritize early tasks that others depend on
      expect(compressed.tasks).toContain('task-1');
      expect(compressed.tasks).toContain('task-2');
    });

    it('should include dependency information when requested', () => {
      const context = createMockContext('small');
      const validationResults = createMockValidationResults();
      
      const compressed = ContextCompressor.compressForAnalysis(context, validationResults, {
        maxTokens: 2000,
        focusAreas: ['dependencies']
      });

      expect(compressed.tasks).toContain('Deps:');
    });
  });

  describe('Validation Results Compression', () => {
    it('should prioritize error-level validation results', () => {
      const context = createMockContext('small');
      const validationResults: ValidationResult[] = [
        {
          isValid: false,
          issues: ['Low priority info'],
          component: 'architecture',
          severity: 'info'
        },
        {
          isValid: false,
          issues: ['Critical error that breaks build'],
          component: 'tasks', 
          severity: 'error'
        },
        {
          isValid: false,
          issues: ['Warning about potential issue'],
          component: 'dependencies',
          severity: 'warning'
        }
      ];
      
      const compressed = ContextCompressor.compressForAnalysis(context, validationResults, {
        maxTokens: 1000
      });

      const issues = compressed.validationIssues;
      const errorIndex = issues.indexOf('ERROR:');
      const warningIndex = issues.indexOf('WARNING:');
      const infoIndex = issues.indexOf('INFO:');

      // Errors should come first
      expect(errorIndex).toBeLessThan(warningIndex);
      expect(warningIndex).toBeLessThan(infoIndex);
    });
  });
});