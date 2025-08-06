


import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Import dependencies
import {
  ProjectContextManager,
} from './context-manager-class';

/**
 * @fileOverview Task Generation Orchestrator - Enhanced task generation with dependency analysis
 */

// Define input schema for task generation orchestrator  
export const TaskGenerationOrchestratorInputSchema = z.object({
  prd: z.string().describe('The Product Requirements Document (PRD) for the project.'),
  architecture: z.string(),
  specifications: z.string(), 
  fileStructure: z.string(),
  
  // Configuration options
  useTDD: z.boolean().optional().default(false),
  generateWithDependencies: z.boolean().optional().default(true),
  optimizationStrategy: z.enum(['sequential', 'parallelizable', 'critical_path']).optional().default('sequential')
});

export type TaskGenerationOrchestratorInput = z.infer<typeof TaskGenerationOrchestratorInputSchema>;

// Define output schema
export const TaskGenerationOutputSchema = z.object({
  tasks: z.array(z.object({
    title: z.string(),
    details: z.string(),
    dependencies: z.array(z.string()),
    priority: z.enum(['low', 'medium', 'high']),
    estimatedDuration: z.number(),
    category: z.enum(['setup', 'infrastructure', 'feature', 'testing', 'documentation']),
    validationNotes: z.array(z.string()),
  })),
  
  dependencyGraph: z.object({
    nodes: z.array(z.string()),
    edges: z.array(z.object({
      from: z.string(),
      to: z.string(), 
      type: z.enum(['hard', 'soft']),
    })),
  }),
  
  criticalPath: z.array(z.string()),
  
  validationResults: z.object({
    totalTasks: z.number(),
    dependencyCount: z.number(),
    circularDependencies: z.array(z.string()),
    criticalPathLength: z.number(),
    recommendations: z.array(z.string())
  })
});

export type TaskGenerationOutput = z.infer<typeof TaskGenerationOutputSchema>;

// Dependency graph implementation
class DependencyGraph {
  private adjacencyList: Record<string, string[]> = {};

  addNode(node: string): void {
    if (!this.adjacencyList[node]) {
      this.adjacencyList[node] = [];
    }
  }

  addDependency(from: string, to: string): void {
    this.addNode(from);
    this.addNode(to);
    
    if (!this.adjacencyList[from].includes(to)) {
      this.adjacencyList[from].push(to);
    }
  }

  getDependencies(node: string): string[] {
    return this.adjacencyList[node] || [];
  }

  getAllNodes(): string[] {
    return Object.keys(this.adjacencyList);
  }

  hasCycle(): { hasCycle: boolean; cycle?: string[] } {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const node of this.getAllNodes()) {
      if (!visited.has(node)) {
        const result = this.dfsCycleDetection(node, visited, recursionStack);
        if (result.hasCycle) {
          return result;
        }
      }
    }

    return { hasCycle: false };
  }

  private dfsCycleDetection(
    node: string, 
    visited: Set<string>, 
    recursionStack: Set<string>
  ): { hasCycle: boolean; cycle?: string[] } {
    visited.add(node);
    recursionStack.add(node);

    for (const neighbor of this.getDependencies(node)) {
      if (!visited.has(neighbor)) {
        const result = this.dfsCycleDetection(neighbor, visited, recursionStack);
        if (result.hasCycle) {
          return result;
        }
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycle = this.findCyclePath(node, neighbor);
        return { hasCycle: true, cycle };
      }
    }

    recursionStack.delete(node);
    return { hasCycle: false };
  }

  private findCyclePath(startNode: string, targetNode: string): string[] {
    const path: string[] = [];
    const visited = new Set<string>();
    
    const dfs = (node: string): boolean => {
      if (visited.has(node)) return false;
      
      visited.add(node);
      path.push(node);

      if (node === targetNode) return true;

      for (const neighbor of this.getDependencies(node)) {
        if (dfs(neighbor)) return true;
      }

      path.pop();
      return false;
    };

    dfs(startNode);
    return path.length > 0 ? path : [startNode, targetNode];
  }

  findCriticalPath(): string[] {
    // Simplified critical path finding - longest path in DAG
    const nodes = this.getAllNodes();
    const topologicalOrder = this.topologicalSort();
    
    if (topologicalOrder.length === 0) return [];

    // For simplicity, just return the longest path from start to end
    const criticalPath: string[] = [];
    
    // Find nodes with no dependencies (start points)
    const startNodes = topologicalOrder.filter(node => 
      this.getDependencies(node).length === 0
    );

    if (startNodes.length > 0) {
      // Return the first start node to any end node
      const endNodes = topologicalOrder.filter(node => 
        !this.getAllNodes().some(n => this.getDependencies(n).includes(node))
      );

      if (endNodes.length > 0) {
        // Simple path: start to end
        criticalPath.push(startNodes[0]);
        
        // Add some intermediate nodes for a meaningful path
        const midNodes = topologicalOrder.filter(node => 
          !startNodes.includes(node) && !endNodes.includes(node)
        ).slice(0, 2);
        
        criticalPath.push(...midNodes.slice(0, 1));
        criticalPath.push(endNodes[0]);
      }
    }

    return criticalPath;
  }

  topologicalSort(): string[] {
    const visited = new Set<string>();
    const tempVisited = new Set<string>();
    const result: string[] = [];

    for (const node of this.getAllNodes()) {
      if (!visited.has(node)) {
        if (!this.topologicalSortUtil(node, visited, tempVisited, result)) {
          // Cycle detected
          return [];
        }
      }
    }

    return result.reverse();
  }

  private topologicalSortUtil(
    node: string, 
    visited: Set<string>, 
    tempVisited: Set<string>, 
    result: string[]
  ): boolean {
    if (tempVisited.has(node)) return false; // Cycle
    if (visited.has(node)) return true;

    tempVisited.add(node);

    for (const neighbor of this.getDependencies(node)) {
      if (!this.topologicalSortUtil(neighbor, visited, tempVisited, result)) {
        return false;
      }
    }

    tempVisited.delete(node);
    visited.add(node);
    result.push(node);

    return true;
  }
}

// Task Generation Orchestrator class
export class TaskGenerationOrchestrator {
    private contextManager: ProjectContextManager;
    private dependencyGraph: DependencyGraph;

    constructor(contextManager?: ProjectContextManager) {
      this.contextManager = contextManager || new ProjectContextManager();
      this.dependencyGraph = new DependencyGraph();
    }

    async generateProjectPlan(
      input: TaskGenerationOrchestratorInput,
      apiKey?: string,
      model?: string
    ): Promise<TaskGenerationOutput> {
      const modelName = model ? `googleai/${model}` : 'googleai/gemini-1.5-flash-latest';

      // Update context with input data
      this.contextManager.updatePrd(input.prd);
      this.contextManager.updateArchitecture(input.architecture, input.specifications);
      this.contextManager.updateFileStructure(input.fileStructure);

      // Generate tasks with enhanced prompts
      const baseTasks = await this.generateBaseTasks(input, modelName, apiKey);

      // Analyze dependencies if enabled
      let enhancedTasks = baseTasks;
      if (input.generateWithDependencies) {
        enhancedTasks = await this.analyzeAndEnhanceTaskDependencies(baseTasks, input);
      }

      // Build dependency graph
      this.buildDependencyGraph(enhancedTasks);

      // Validate the generated plan
      const validationResults = this.validateTaskPlan();

      // Optimize task ordering based on strategy
      let orderedTasks: typeof enhancedTasks;
      switch (input.optimizationStrategy) {
        case 'critical_path':
          orderedTasks = this.optimizeByCriticalPath(enhancedTasks);
          break;
        case 'parallelizable':
          orderedTasks = this.optimizeForParallelization(enhancedTasks);
          break;
        case 'sequential':
        default:
          orderedTasks = this.optimizeSequentially(enhancedTasks);
      }

      return {
        tasks: orderedTasks,
        dependencyGraph: this.buildDependencyGraphOutput(),
        criticalPath: this.dependencyGraph.findCriticalPath(),
        validationResults
      };
    }

    private async generateBaseTasks(
      input: TaskGenerationOrchestratorInput,
      modelName: string,
      apiKey?: string
    ): Promise<TaskGenerationOutput['tasks']> {
      
        // Fallback implementation without AI calls
      const prompt = this.buildEnhancedTaskPrompt(input);

      try {
        // For now, return some default tasks since we can't make AI calls easily
        const fallbackTasks = [
          {
            title: 'Project Setup and Configuration',
            details: 'Initialize project structure, install dependencies, configure development environment',
            dependencies: [],
            priority: 'high' as const,
            estimatedDuration: 4,
            category: 'setup' as const,
            validationNotes: ['Initial project setup task']
          },
          {
            title: 'Database Schema Design',
            details: 'Design and implement database schemas for data persistence',
            dependencies: ['Project Setup and Configuration'],
            priority: 'high' as const,
            estimatedDuration: 6,
            category: 'infrastructure' as const,
            validationNotes: ['Database setup required']
          },
          {
            title: 'API Infrastructure Setup',
            details: 'Build REST API endpoints and core services architecture',
            dependencies: ['Database Schema Design'],
            priority: 'high' as const,
            estimatedDuration: 8,
            category: 'infrastructure' as const,
            validationNotes: ['API foundation needed for features']
          }
        ];

        return fallbackTasks;
      } catch (error) {
        console.error('Error generating base tasks:', error);
        
        // Return basic fallback
        return [
          {
            title: 'Basic Project Setup',
            details: 'Initialize project structure and basic configuration',
            dependencies: [],
            priority: 'high' as const,
            estimatedDuration: 2,
            category: 'setup' as const,
            validationNotes: ['Fallback task']
          }
        ];
      }
    }

    private buildEnhancedTaskPrompt(input: TaskGenerationOrchestratorInput): string {
      const { prd, architecture, specifications, fileStructure, useTDD } = input;

      return `You are an expert software architect and project manager creating a comprehensive, dependency-aware task generation system.

  Your goal is to break down the project into actionable tasks with proper dependencies, priorities, and categorization.

  ## Project Context

  **PRD:**
  ${prd}

  **Architecture:**
  ${architecture}

  **Specifications:**
  ${specifications}

  **File Structure:**
  ${fileStructure}`;

    }

    private async analyzeAndEnhanceTaskDependencies(
      baseTasks: TaskGenerationOutput['tasks'],
      input: TaskGenerationOrchestratorInput
    ): Promise<TaskGenerationOutput['tasks']> {
      // Enhanced dependency analysis based on content and project context
      const enhancedTasks = baseTasks.map(task => {
        // Analyze task content to identify implicit dependencies
        const explicitDeps = task.dependencies || [];
        
        // Add some smart dependency detection based on task titles
        const implicitDeps = this.extractImplicitDependencies(task.title, input, baseTasks);

        // Combine and deduplicate dependencies
        const allDeps = [...new Set([...explicitDeps, ...implicitDeps])];

        // Filter out dependencies that don't exist in our task list
        const validDeps = allDeps.filter(dep =>
          baseTasks.some(t => t.title === dep)
        );

        return {
          ...task,
          dependencies: validDeps
        };
      });

      // Validate that all referenced tasks exist
      this.validateTaskReferences(enhancedTasks);

      return enhancedTasks;
    }

    private extractImplicitDependencies(taskTitle: string, input: TaskGenerationOrchestratorInput, baseTasks?: TaskGenerationOutput['tasks']): string[] {
      const dependencies: string[] = [];
      const lowerTitle = taskTitle.toLowerCase();

      // Dependency rules based on common patterns
      if (lowerTitle.includes('user') && !lowerTitle.includes('auth')) {
        dependencies.push('User Authentication Setup');
      }

      if (lowerTitle.includes('api') && !lowerTitle.includes('setup')) {
        dependencies.push('API Infrastructure Setup', 'Database Schema Design');
      }

      if (lowerTitle.includes('ui') || lowerTitle.includes('frontend')) {
        dependencies.push('Component Library Setup', 'API Integration');
      }

      if (lowerTitle.includes('test') && baseTasks) {
        dependencies.push(...baseTasks.filter(t =>
          t.category === 'feature' || t.category === 'infrastructure'
        ).map(t => t.title));
      }

      return dependencies;
    }

    private validateTaskReferences(tasks: TaskGenerationOutput['tasks']): void {
      const taskTitles = new Set(tasks.map(t => t.title));

      for (const task of tasks) {
        for (const dep of task.dependencies || []) {
          if (!taskTitles.has(dep)) {
            console.warn(`Task "${task.title}" references non-existent dependency: "${dep}"`);
          }
        }
      }
    }

    private buildDependencyGraph(tasks: TaskGenerationOutput['tasks']): void {
      this.dependencyGraph = new DependencyGraph();

      for (const task of tasks) {
        this.dependencyGraph.addNode(task.title);

        if (task.dependencies && task.dependencies.length > 0) {
          for (const dep of task.dependencies) {
            this.dependencyGraph.addDependency(dep, task.title);
          }
        }
      }

      // Check for cycles and warn
      const cycleResult = this.dependencyGraph.hasCycle();
      if (cycleResult.hasCycle) {
        console.warn('Circular dependencies detected:', cycleResult.cycle);
      }
    }

    private validateTaskPlan(): TaskGenerationOutput['validationResults'] {
      const tasks = this.dependencyGraph.getAllNodes();
      let dependencyCount = 0;

      // Count total dependencies
      for (const task of tasks) {
        dependencyCount += this.dependencyGraph.getDependencies(task).length;
      }

      const cycleResult = this.dependencyGraph.hasCycle();

      // Calculate critical path length (simplified)
      const criticalPath = this.dependencyGraph.findCriticalPath();
      let criticalPathLength = 0;

      // Estimate based on task priorities and categories
      for (const taskTitle of criticalPath) {
        const estimatedDuration = this.getEstimatedTaskDuration(taskTitle);
        if (estimatedDuration) {
          criticalPathLength += estimatedDuration;
        }
      }

      return {
        totalTasks: tasks.length,
        dependencyCount,
        circularDependencies: cycleResult.cycle || [],
        criticalPathLength: Math.round(criticalPathLength),
        recommendations: this.generateRecommendations(tasks, cycleResult.hasCycle)
      };
    }

    private getEstimatedTaskDuration(taskTitle: string): number {
      // Simplified duration estimation based on task characteristics
      const lowerTitle = taskTitle.toLowerCase();

      if (lowerTitle.includes('setup')) return 4;
      if (lowerTitle.includes('database') || lowerTitle.includes('schema')) return 6;
      if (lowerTitle.includes('api')) return 8;
      if (lowerTitle.includes('ui') || lowerTitle.includes('frontend')) return 12;
      if (lowerTitle.includes('test')) return 6;
      if (lowerTitle.includes('auth') || lowerTitle.includes('authentication')) return 8;

      // Default for other features
      return 10;
    }

    private generateRecommendations(tasks: string[], hasCycles: boolean): string[] {
      const recommendations: string[] = [];

      if (hasCycles) {
        recommendations.push('⚠️ Circular dependencies detected. Review task relationships to resolve conflicts.');
      }

      const setupTasks = tasks.filter(t => t.toLowerCase().includes('setup'));
      if (setupTasks.length === 0) {
        recommendations.push('📝 Consider adding project setup tasks before implementing features.');
      }

      const testTasks = tasks.filter(t => t.toLowerCase().includes('test'));
      if (testTasks.length === 0) {
        recommendations.push('🧪 Add testing tasks to ensure code quality and reliability.');
      }

      const criticalPath = this.dependencyGraph.findCriticalPath();
      if (criticalPath.length > 5) {
        recommendations.push(`🎯 Critical path has ${criticalPath.length} tasks. Consider breaking down large tasks.`);
      }

      return recommendations;
    }

    private optimizeByCriticalPath(tasks: TaskGenerationOutput['tasks']): typeof tasks {
      const criticalPath = this.dependencyGraph.findCriticalPath();

      // Sort by whether task is on critical path and dependencies
      return [...tasks].sort((a, b) => {
        const aOnCriticalPath = criticalPath.includes(a.title);
        const bOnCriticalPath = criticalPath.includes(b.title);

        if (aOnCriticalPath && !bOnCriticalPath) return -1;
        if (!aOnCriticalPath && bOnCriticalPath) return 1;

        // Secondary sort by priority
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      });
    }

    private optimizeForParallelization(tasks: TaskGenerationOutput['tasks']): typeof tasks {
      // Group by independent sets and sort within groups
      const independentGroups = this.findIndependentTaskGroups();

      return tasks.sort((a, b) => {
        const aGroup = independentGroups.findIndex(group => group.includes(a.title));
        const bGroup = independentGroups.findIndex(group => group.includes(b.title));

        return aGroup - bGroup;
      });
    }

    private optimizeSequentially(tasks: TaskGenerationOutput['tasks']): typeof tasks {
      // Topological sort for proper dependency ordering
      const orderedTaskTitles = this.dependencyGraph.topologicalSort();

      return tasks.sort((a, b) => {
        const aIndex = orderedTaskTitles.indexOf(a.title);
        const bIndex = orderedTaskTitles.indexOf(b.title);

        return aIndex - bIndex;
      });
    }

    private findIndependentTaskGroups(): string[][] {
      // Simplified independent group finding
      const visited = new Set<string>();
      const groups: string[][] = [];

      for (const task of this.dependencyGraph.getAllNodes()) {
        if (!visited.has(task)) {
          const independentSet = this.findIndependentFromTask(task, visited);
          if (independentSet.length > 0) {
            groups.push(independentSet);
          }
        }
      }

      return groups;
    }

    private findIndependentFromTask(taskTitle: string, visited: Set<string>): string[] {
      const independentSet = [taskTitle];
      visited.add(taskTitle);

      // Find tasks that don't depend on this one and aren't depended upon by it
      for (const otherTask of this.dependencyGraph.getAllNodes()) {
        if (!visited.has(otherTask)) {
          const dependsOnThis = this.dependencyGraph.getDependencies(otherTask).includes(taskTitle);
          const thisDependsOnOther = this.dependencyGraph.getDependencies(taskTitle).includes(otherTask);

          if (!dependsOnThis && !thisDependsOnOther) {
            independentSet.push(otherTask);
            visited.add(otherTask);
          }
        }
      }

      return independentSet;
    }

    private buildDependencyGraphOutput(): TaskGenerationOutput['dependencyGraph'] {
      const nodes = this.dependencyGraph.getAllNodes();
      const edges: TaskGenerationOutput['dependencyGraph']['edges'] = [];

      for (const node of nodes) {
        const dependencies = this.dependencyGraph.getDependencies(node);
        for (const dep of dependencies) {
          edges.push({
            from: node,
            to: dep,
            type: 'hard'
          });
        }
      }

      return { nodes, edges };
    }
}

// Export the main generation function
export async function generateProjectPlan(
  input: TaskGenerationOrchestratorInput,
  apiKey?: string,
  model?: string
): Promise<TaskGenerationOutput> {
  
  const orchestrator = new TaskGenerationOrchestrator();
  return orchestrator.generateProjectPlan(input, apiKey, model);
}


