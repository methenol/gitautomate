

'use server';

/**
 * @fileOverview Task Generation Orchestrator - Dependency-aware task generation system
 *
 * This module implements the new task generation architecture that addresses Issue #7 by:
 * 1. Creating inter-task dependency modeling
 * 2. Providing context-aware task generation with full project awareness
 * 3. Implementing dependency graph construction and validation
 * 4. Optimizing task ordering based on dependencies
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { 
  UnifiedProjectContext, 
  ProjectContextManager,
  getGlobalContextManager,
  UnifiedProjectContextSchema
} from './unified-context';
import type { Task } from '@/types';

// Define input schema for the new task generation system
const TaskGenerationOrchestratorInputSchema = z.object({
  prd: z.string().describe('The Product Requirements Document (PRD) for the project.'),
  architecture: z.string().describe('The proposed software architecture for the project.'),
  specifications: z.string().describe('The detailed specifications for the project.'),
  fileStructure: z.string().describe('The proposed file/folder structure for the project.'),
  useTDD: z.boolean().optional().default(false),
  generateWithDependencies: z.boolean().optional().default(true).describe('Whether to analyze and enforce task dependencies.'),
  optimizationStrategy: z.enum(['sequential', 'parallelizable', 'critical_path']).optional().default('sequential')
});

export type TaskGenerationOrchestratorInput = z.infer<typeof TaskGenerationOrchestratorInputSchema>;

// Define output schema
const TaskGenerationOutputSchema = z.object({
  tasks: z.array(z.object({
    title: z.string().describe('A concise title for the development task.'),
    details: z.string().describe('Detailed implementation guidance.'),
    dependencies: z.array(z.string()).describe('List of task titles this task depends on.'),
    priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
    estimatedDuration: z.number().optional().describe('Estimated duration in hours.'),
    category: z.enum(['setup', 'infrastructure', 'feature', 'testing', 'documentation']).optional().default('feature'),
    validationNotes: z.array(z.string()).optional().describe('Any validation notes or concerns about this task.'),
  })),
  dependencyGraph: z.object({
    nodes: z.array(z.string()).describe('List of all task titles (nodes).'),
    edges: z.array(z.object({
      from: z.string().describe('Source task title.'),
      to: z.string().describe('Target task title (dependent).'),
      type: z.enum(['hard', 'soft']).optional().default('hard').describe('Dependency type.'),
    })).describe('List of dependencies (edges).'),
  }),
  criticalPath: z.array(z.string()).optional().describe('Critical path of task dependencies.'),
  validationResults: z.object({
    totalTasks: z.number().describe('Total number of tasks generated.'),
    dependencyCount: z.number().describe('Total number of dependencies identified.'),
    circularDependencies: z.array(z.string()).optional().describe('Any detected circular dependencies.'),
    criticalPathLength: z.number().optional().describe('Length of the critical path in hours.'),
    recommendations: z.array(z.string()).describe('Recommendations for implementation order and approach.'),
  })
});

export type TaskGenerationOutput = z.infer<typeof TaskGenerationOutputSchema>;

// Dependency graph class for managing task relationships
class DependencyGraph {
  private adjacencyList: Map<string, string[]> = new Map();
  private nodes: Set<string> = new Set();

  addNode(taskTitle: string): void {
    this.nodes.add(taskTitle);
    if (!this.adjacencyList.has(taskTitle)) {
      this.adjacencyList.set(taskTitle, []);
    }
  }

  addDependency(fromTask: string, toTask: string, type: 'hard' | 'soft' = 'hard'): void {
    this.addNode(fromTask);
    this.addNode(toTask);
    
    const dependencies = this.adjacencyList.get(fromTask) || [];
    if (!dependencies.includes(toTask)) {
      dependencies.push(toTask);
      this.adjacencyList.set(fromTask, dependencies);
    }
  }

  getDependencies(taskTitle: string): string[] {
    return this.adjacencyList.get(taskTitle) || [];
  }

  getAllNodes(): string[] {
    return Array.from(this.nodes);
  }

  hasCycle(): { hasCycle: boolean; cycle?: string[] } {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const node of this.nodes) {
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

    const neighbors = this.adjacencyList.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const result = this.dfsCycleDetection(neighbor, visited, recursionStack);
        if (result.hasCycle) {
          return result;
        }
      } else if (recursionStack.has(neighbor)) {
        // Cycle detected
        const cycle = this.findCyclePath(node, neighbor);
        return { hasCycle: true, cycle };
      }
    }

    recursionStack.delete(node);
    return { hasCycle: false };
  }

  private findCyclePath(startNode: string, endNode: string): string[] {
    // Simple cycle path finding - can be enhanced for more complex scenarios
    return [endNode, startNode];
  }

  topologicalSort(): string[] {
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: string[] = [];

    // Initialize in-degree
    for (const node of this.nodes) {
      inDegree.set(node, 0);
    }

    // Calculate in-degree
    for (const [node, neighbors] of this.adjacencyList) {
      for (const neighbor of neighbors) {
        inDegree.set(neighbor, (inDegree.get(neighbor) || 0) + 1);
      }
    }

    // Find nodes with no incoming edges
    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    // Process nodes
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);

      for (const neighbor of this.adjacencyList.get(node) || []) {
        inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
        if ((inDegree.get(neighbor) || 0) === 0) {
          queue.push(neighbor);
        }
      }
    }

    return result;
  }

  findCriticalPath(): string[] {
    // Simplified critical path finding based on task categories and dependencies
    const setupTasks = this.filterTasksByCategory(['setup', 'infrastructure']);
    const featureTasks = this.filterTasksByCategory(['feature']);
    const testingTasks = this.filterTasksByCategory(['testing']);

    return [...setupTasks, ...featureTasks, ...testingTasks];
  }

  private filterTasksByCategory(categories: string[]): string[] {
    return Array.from(this.nodes).filter(node => 
      categories.some(cat => node.toLowerCase().includes(cat))
    );
  }
}

// Task Generation Orchestrator class
export class TaskGenerationOrchestrator {
  private contextManager: ProjectContextManager;
  private dependencyGraph: DependencyGraph;

  constructor(contextManager?: ProjectContextManager) {
    this.contextManager = contextManager || getGlobalContextManager();
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
    const prompt = this.buildEnhancedTaskPrompt(input);
    
    try {
      const { output } = await ai.generate({
        model: modelName,
        prompt: prompt,
        output: {
          schema: z.object({
            tasks: z.array(z.object({
              title: z.string(),
              details: z.string().optional().default(''),
              dependencies: z.array(z.string()).optional().default([]),
              priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
              estimatedDuration: z.number().optional(),
              category: z.enum(['setup', 'infrastructure', 'feature', 'testing', 'documentation']).optional().default('feature'),
              validationNotes: z.array(z.string()).optional().default([]),
            }))
          })
        },
        config: apiKey ? { apiKey } : undefined,
      });

      return output?.tasks || [];
    } catch (error) {
      console.error('Error generating base tasks:', error);
      throw new Error(`Failed to generate tasks: ${(error as Error).message}`);
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
${fileStructure}

## Task Generation Requirements

### 1. Dependency Analysis
- Identify which tasks must be completed before others can begin
- Mark dependencies clearly for each task
- Avoid circular dependencies that would make implementation impossible

### 2. Task Categorization
Categorize each task appropriately:
- **setup**: Initial project setup, configuration, environment preparation
- **infrastructure**: Database setup, API infrastructure, core services
- **feature**: User-facing features and functionality  
- **testing**: Unit tests, integration tests, test infrastructure
- **documentation**: README files, API docs, user guides

### 3. Priority Assessment
Assign realistic priorities:
- **high**: Critical path items, blocking features, essential infrastructure
- **medium**: Important but non-blocking features and improvements  
- **low**: Nice-to-have features, documentation, optimizations

### 4. Duration Estimation
Provide realistic time estimates in hours for each task.

${useTDD ? `
### 5. Test-Driven Development Requirements
If TDD is enabled, ensure all implementation plans follow Red-Green-Refactor methodology.
` : ''}

## Expected Output Format

Respond with ONLY a valid JSON object containing an array of "tasks" objects. Each task should include:
- title: Clear, concise task name
- details: Brief description of what needs to be implemented  
- dependencies: Array of task titles this depends on
- priority: "low", "medium", or "high"
- estimatedDuration: Number (hours)
- category: One of the predefined categories
- validationNotes: Any concerns or considerations for this task

Generate a comprehensive set of tasks that covers all aspects of the project while maintaining logical dependency relationships.`;
  }

  private async analyzeAndEnhanceTaskDependencies(
    baseTasks: TaskGenerationOutput['tasks'],
    input: TaskGenerationOrchestratorInput
  ): Promise<TaskGenerationOutput['tasks']> {
    // Enhanced dependency analysis based on content and project context
    const enhancedTasks = baseTasks.map(task => {
      // Analyze task content to identify implicit dependencies
      const explicitDeps = task.dependencies || [];
      const implicitDeps = this.extractImplicitDependencies(task.title, input);
      
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

  private extractImplicitDependencies(taskTitle: string, input: TaskGenerationOrchestratorInput): string[] {
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
    
    if (lowerTitle.includes('test')) {
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
          to: dep
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
  
  try {
    return await orchestrator.generateProjectPlan(input, apiKey, model);
  } catch (error) {
    console.error('Error in project plan generation:', error);
    
    // Fallback to basic task generation if orchestrator fails
    console.log('Falling back to basic task generation...');
    
    try {
      const { generateTasks } from './generate-tasks';
      const basicResult = await generateTasks(
        {
          architecture: input.architecture,
          specifications: input.specifications,
          fileStructure: input.fileStructure
        },
        apiKey,
        model,
        input.useTDD
      );

      // Convert to new format with minimal enhancement
      return {
        tasks: basicResult.tasks.map(task => ({
          title: task.title,
          details: task.details || '',
          dependencies: [],
          priority: 'medium' as const,
          estimatedDuration: 8, // Default estimate
          category: 'feature' as const,
          validationNotes: ['Generated using legacy system - dependencies not analyzed']
        })),
        dependencyGraph: { nodes: [], edges: [] },
        criticalPath: [],
        validationResults: {
          totalTasks: basicResult.tasks.length,
          dependencyCount: 0,
          circularDependencies: [],
          criticalPathLength: basicResult.tasks.length * 8, // Rough estimate
          recommendations: ['Consider regenerating with dependency analysis enabled for better task planning.']
        }
      };
    } catch (fallbackError) {
      throw new Error(`Both orchestrator and fallback generation failed: ${(error as Error).message}`);
    }
  }
}

