import { TaskDependencyGraph } from '../lib/dependency-graph';
import { UnifiedProjectManager } from '../lib/unified-project-manager';
import { UnifiedProjectContext, EnhancedTask } from '../types/unified-context';

// Mock the AI flows
jest.mock('../ai/flows/generate-architecture', () => ({
  generateArchitecture: jest.fn().mockResolvedValue({
    architecture: 'Sample architecture',
    specifications: 'Sample specifications',
  }),
}));

jest.mock('../ai/flows/generate-file-structure', () => ({
  generateFileStructure: jest.fn().mockResolvedValue({
    fileStructure: 'Sample file structure',
  }),
}));

jest.mock('../ai/flows/generate-tasks', () => ({
  generateTasks: jest.fn().mockResolvedValue({
    tasks: [
      { title: 'Setup project', details: '' },
      { title: 'Create API', details: '' },
      { title: 'Build UI', details: '' },
      { title: 'Add tests', details: '' },
    ],
  }),
}));

jest.mock('../ai/flows/research-task', () => ({
  researchTask: jest.fn().mockImplementation(({ title }) => Promise.resolve({
    context: `Context for ${title}`,
    implementationSteps: `Steps for ${title}`,
    acceptanceCriteria: `Criteria for ${title}`,
  })),
}));

describe('TaskDependencyGraph', () => {
  let graph: TaskDependencyGraph<string>;

  beforeEach(() => {
    graph = new TaskDependencyGraph<string>();
  });

  test('should add nodes and dependencies correctly', () => {
    graph.addNode('A', 'Task A');
    graph.addNode('B', 'Task B');
    graph.addDependency('B', 'A'); // B depends on A

    expect(graph.nodes.has('A')).toBe(true);
    expect(graph.nodes.has('B')).toBe(true);
    expect(graph.getDirectDependencies('B')).toContain('A');
  });

  test('should detect cycles', () => {
    graph.addNode('A', 'Task A');
    graph.addNode('B', 'Task B');
    graph.addNode('C', 'Task C');
    
    graph.addDependency('A', 'B');
    graph.addDependency('B', 'C');
    graph.addDependency('C', 'A'); // Creates cycle

    expect(graph.hasCycle()).toBe(true);
  });

  test('should generate topological order for acyclic graph', () => {
    graph.addNode('Setup', 'Setup');
    graph.addNode('API', 'API');
    graph.addNode('UI', 'UI');
    graph.addNode('Tests', 'Tests');
    
    graph.addDependency('API', 'Setup');
    graph.addDependency('UI', 'API');
    graph.addDependency('Tests', 'UI');

    const order = graph.getTopologicalOrder();
    
    expect(order.indexOf('Setup')).toBeLessThan(order.indexOf('API'));
    expect(order.indexOf('API')).toBeLessThan(order.indexOf('UI'));
    expect(order.indexOf('UI')).toBeLessThan(order.indexOf('Tests'));
  });

  test('should throw error for topological sort on cyclic graph', () => {
    graph.addNode('A', 'Task A');
    graph.addNode('B', 'Task B');
    
    graph.addDependency('A', 'B');
    graph.addDependency('B', 'A');

    expect(() => graph.getTopologicalOrder()).toThrow('Cannot create topological order: graph contains cycles');
  });

  test('should identify executable nodes correctly', () => {
    graph.addNode('Setup', 'Setup');
    graph.addNode('API', 'API');
    graph.addNode('UI', 'UI');
    
    graph.addDependency('API', 'Setup');
    graph.addDependency('UI', 'API');

    const completedTasks = new Set(['Setup']);
    const executable = graph.getExecutableNodes(completedTasks);
    
    expect(executable).toContain('API');
    expect(executable).not.toContain('UI');
  });
});

describe('UnifiedProjectManager', () => {
  let manager: UnifiedProjectManager;

  beforeEach(() => {
    manager = new UnifiedProjectManager();
  });

  test('should initialize context correctly', () => {
    const prd = 'Build a todo app';
    const context = manager.initializeContext(prd);

    expect(context.prd).toBe(prd);
    expect(context.architecture).toBe('');
    expect(context.tasks).toEqual([]);
    expect(context.componentVersions.architecture).toBe(1);
  });

  test('should update context and version tracking', () => {
    const context = manager.initializeContext('Test PRD');
    const updated = manager.updateContext(context, {
      architecture: 'New architecture',
    });

    expect(updated.architecture).toBe('New architecture');
    expect(updated.componentVersions.architecture).toBe(2);
  });

  test('should validate context correctly', () => {
    const incompleteContext = manager.initializeContext('Test PRD');
    const validation = manager.validateContext(incompleteContext);
    
    expect(validation.isValid).toBe(false);
    expect(validation.issues).toContain('Architecture is missing');
    expect(validation.issues).toContain('Specifications are missing');
  });

  test('should validate task consistency', () => {
    const context = manager.initializeContext('Test PRD');
    context.architecture = 'Test arch';
    context.specifications = 'Test specs';
    context.fileStructure = 'src/main.js\nsrc/api.js';
    context.tasks = [
      {
        title: 'Test task',
        details: 'Create nonexistent.py file',
        dependencies: {
          taskTitle: 'Test task',
          dependsOn: ['Non-existent task'],
          blockedBy: [],
          priority: 3,
          category: 'core',
        },
        researched: true,
      },
    ];

    const validation = manager.validateTaskConsistency(context);
    
    expect(validation.isValid).toBe(false);
    expect(validation.issues.some(issue => 
      issue.includes('depends on non-existent task')
    )).toBe(true);
  });

  test('should generate architecture with dependencies', async () => {
    const context = manager.initializeContext('Build a todo app');
    const updated = await manager.generateArchitectureWithDependencies(context);

    expect(updated.architecture).toBe('Sample architecture');
    expect(updated.specifications).toBe('Sample specifications');
    expect(updated.fileStructure).toBe('Sample file structure');
    expect(updated.componentVersions.architecture).toBe(2);
  });

  test('should generate tasks with dependencies', async () => {
    const context = manager.initializeContext('Build a todo app');
    context.architecture = 'Test architecture';
    context.specifications = 'Test specs';
    context.fileStructure = 'Test structure';

    const updated = await manager.generateTasksWithDependencies(context);

    expect(updated.tasks.length).toBeGreaterThan(0);
    expect(updated.tasks[0]).toHaveProperty('dependencies');
    expect(updated.dependencyGraph).toBeDefined();
  });

  test('should categorize tasks correctly', () => {
    const manager = new UnifiedProjectManager();
    
    // Access private method for testing
    const categorizeTask = (manager as any).categorizeTask.bind(manager);
    
    expect(categorizeTask('Setup project environment')).toBe('setup');
    expect(categorizeTask('Add unit tests')).toBe('testing');
    expect(categorizeTask('Deploy to production')).toBe('deployment');
    expect(categorizeTask('Create user interface')).toBe('feature');
  });

  test('should optimize dependency ordering', () => {
    const context = manager.initializeContext('Test PRD');
    
    const enhancedTasks: EnhancedTask[] = [
      {
        title: 'Tests',
        details: '',
        dependencies: {
          taskTitle: 'Tests',
          dependsOn: ['API'],
          blockedBy: [],
          priority: 2,
          category: 'testing',
        },
        researched: false,
      },
      {
        title: 'API',
        details: '',
        dependencies: {
          taskTitle: 'API',
          dependsOn: ['Setup'],
          blockedBy: [],
          priority: 3,
          category: 'core',
        },
        researched: false,
      },
      {
        title: 'Setup',
        details: '',
        dependencies: {
          taskTitle: 'Setup',
          dependsOn: [],
          blockedBy: [],
          priority: 5,
          category: 'setup',
        },
        researched: false,
      },
    ];

    context.tasks = enhancedTasks;
    
    // Manually create and populate dependency graph
    const graph = new TaskDependencyGraph<EnhancedTask>();
    enhancedTasks.forEach(task => {
      graph.addNode(task.title, task);
    });
    enhancedTasks.forEach(task => {
      task.dependencies.dependsOn.forEach(dep => {
        graph.addDependency(task.title, dep);
      });
    });
    context.dependencyGraph = graph;

    const optimized = manager.optimizeDependencyOrdering(context);
    
    expect(optimized.tasks[0].title).toBe('Setup');
    expect(optimized.tasks[1].title).toBe('API');
    expect(optimized.tasks[2].title).toBe('Tests');
  });
});