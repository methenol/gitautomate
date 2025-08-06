

'use server';

/**
 * @fileOverview Dependency graph management system for AI-driven project planning.
 * Handles task dependency modeling, topological sorting, cycle detection, and optimization.
 */

import { z } from 'genkit';
import type { Task, TaskDependencyGraph, ValidationResult } from './unified-project-context';

export interface DependencyAnalysis {
  isValid: boolean;
  hasCycles: boolean;
  cycleDetails?: Array<string[]>;
  topologicalOrder?: string[];
  criticalPath: string[];
  parallelBatches: Array<string[]>;
  blockingTasks: string[];
}

/**
 * Manages task dependencies and provides scheduling utilities
 */
export class DependencyGraphManager {
  private graph: TaskDependencyGraph;

  constructor(graph?: TaskDependencyGraph) {
    this.graph = graph || {
      tasks: {},
      edges: []
    };
  }

  /**
   * Adds a task to the dependency graph
   */
  addTask(task: Task): void {
    this.graph.tasks[task.id] = task;
    
    // Add edges for dependencies
    task.dependencies.forEach(depId => {
      this.addEdge(depId, task.id, 'hard', 8);
    });
    
    // Add edges for prerequisites
    task.prerequisites.forEach(prereq => {
      this.addEdge(`prerequisite_${prereq.target}_${task.id}`, task.id, 'soft', 5);
    });
  }

  /**
   * Adds a dependency edge between tasks
   */
  addEdge(from: string, to: string, type: 'hard' | 'soft', weight: number): void {
    // Remove existing edge if present
    this.graph.edges = this.graph.edges.filter(edge => 
      !(edge.from === from && edge.to === to)
    );
    
    this.graph.edges.push({ from, to, type, weight });
  }

  /**
   * Removes a task and all its edges from the graph
   */
  removeTask(taskId: string): void {
    delete this.graph.tasks[taskId];
    
    // Remove all edges connected to this task
    this.graph.edges = this.graph.edges.filter(edge => 
      edge.from !== taskId && edge.to !== taskId
    );
  }

  /**
   * Analyzes the dependency graph for validity and provides scheduling information
   */
  analyzeGraph(): DependencyAnalysis {
    const tasks = Object.keys(this.graph.tasks);
    
    // Check for cycles
    const cycleDetection = this.detectCycles();
    
    // Get topological order if no cycles
    let topologicalOrder: string[] | undefined;
    if (!cycleDetection.hasCycles) {
      topologicalOrder = this.getTopologicalSort();
    }
    
    // Find critical path (longest path in DAG)
    const criticalPath = this.findCriticalPath();
    
    // Group tasks into parallel batches
    const parallelBatches = this.groupIntoParallelBatches(topologicalOrder || tasks);
    
    // Identify blocking tasks (tasks with many dependents)
    const blockingTasks = this.findBlockingTasks();
    
    return {
      isValid: !cycleDetection.hasCycles,
      hasCycles: cycleDetection.hasCycles,
      cycleDetails: cycleDetection.cycles,
      topologicalOrder,
      criticalPath,
      parallelBatches,
      blockingTasks
    };
  }

  /**
   * Detects cycles in the dependency graph using DFS
   */
  private detectCycles(): { hasCycles: boolean; cycles: string[][] } {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (nodeId: string, path: string[]): void => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStartIndex = path.indexOf(nodeId);
        cycles.push(path.slice(cycleStartIndex).concat([nodeId]));
        return;
      }

      if (visited.has(nodeId)) {
        return;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = this.getNeighbors(nodeId);
      for (const neighbor of neighbors) {
        dfs(neighbor, [...path, nodeId]);
      }

      recursionStack.delete(nodeId);
    };

    Object.keys(this.graph.tasks).forEach(taskId => {
      if (!visited.has(taskId)) {
        dfs(taskId, []);
      }
    });

    return {
      hasCycles: cycles.length > 0,
      cycles
    };
  }

  /**
   * Performs topological sort using Kahn's algorithm
   */
  private getTopologicalSort(): string[] {
    const inDegree: Record<string, number> = {};
    const queue: string[] = [];
    const result: string[] = [];

    // Initialize in-degree
    Object.keys(this.graph.tasks).forEach(taskId => {
      inDegree[taskId] = 0;
    });

    // Calculate in-degree for each node
    this.graph.edges.forEach(edge => {
      if (inDegree[edge.to] !== undefined) {
        inDegree[edge.to]++;
      }
    });

    // Enqueue nodes with no incoming edges
    Object.entries(inDegree).forEach(([taskId, degree]) => {
      if (degree === 0) {
        queue.push(taskId);
      }
    });

    // Process the queue
    while (queue.length > 0) {
      const taskId = queue.shift()!;
      result.push(taskId);

      // Decrease in-degree for neighbors
      const neighbors = this.getNeighbors(taskId);
      neighbors.forEach(neighbor => {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) {
          queue.push(neighbor);
        }
      });
    }

    // Check if topological sort includes all tasks
    if (result.length !== Object.keys(this.graph.tasks).length) {
      throw new Error('Graph has cycles, cannot perform topological sort');
    }

    return result;
  }

  /**
   * Finds the critical path (longest path) in the DAG
   */
  private findCriticalPath(): string[] {
    const tasks = Object.keys(this.graph.tasks);
    
    if (tasks.length === 0) return [];
    if (tasks.length === 1) return tasks;

    // Try to get topological sort first
    try {
      const topoOrder = this.getTopologicalSort();
      
      // Calculate longest paths using dynamic programming
      const dist: Record<string, number> = {};
      const prev: Record<string, string | null> = {};
      
      // Initialize distances
      tasks.forEach(taskId => {
        dist[taskId] = 0;
        prev[taskId] = null;
      });

      // Process in topological order
      topoOrder.forEach(taskId => {
        const task = this.graph.tasks[taskId];
        if (!task) return;
        
        // Update distances for dependents
        const dependents = this.getDependents(taskId);
        dependents.forEach(dependent => {
          const edgeWeight = this.getEdgeWeight(taskId, dependent);
          if (dist[dependent] < dist[taskId] + edgeWeight) {
            dist[dependent] = dist[taskId] + edgeWeight;
            prev[dependent] = taskId;
          }
        });
      });

      // Find the node with maximum distance
      let maxNode = tasks[0];
      let maxValue = dist[maxNode];
      
      Object.entries(dist).forEach(([taskId, value]) => {
        if (value > maxValue) {
          maxNode = taskId;
          maxValue = value;
        }
      });

      // Reconstruct the critical path
      const criticalPath: string[] = [];
      let current: string | null = maxNode;
      
      while (current !== null) {
        criticalPath.unshift(current);
        current = prev[current];
      }

      return criticalPath;
    } catch (error) {
      // If there are cycles, fall back to simple heuristics
      return this.getFallbackCriticalPath();
    }
  }

  /**
   * Groups tasks into parallel batches that can be executed simultaneously
   */
  private groupIntoParallelBatches(taskOrder: string[]): Array<string[]> {
    const batches: Array<string[]> = [];
    const inDegree: Record<string, number> = {};
    
    // Calculate in-degree for each task
    Object.keys(this.graph.tasks).forEach(taskId => {
      inDegree[taskId] = 0;
    });

    this.graph.edges.forEach(edge => {
      if (inDegree[edge.to] !== undefined) {
        inDegree[edge.to]++;
      }
    });

    // Group tasks by their "level" (distance from source nodes)
    const levels: Record<string, number> = {};
    
    taskOrder.forEach(taskId => {
      if (inDegree[taskId] === 0) {
        levels[taskId] = 0;
      } else {
        const maxPredecessorLevel = Math.max(
          ...this.getDependencies(taskId).map(dep => levels[dep] || 0)
        );
        levels[taskId] = maxPredecessorLevel + 1;
      }
    });

    // Group by level
    const levelsToTasks: Record<number, string[]> = {};
    Object.entries(levels).forEach(([taskId, level]) => {
      if (!levelsToTasks[level]) {
        levelsToTasks[level] = [];
      }
      levelsToTasks[level].push(taskId);
    });

    return Object.values(levelsToTasks).filter(batch => batch.length > 0);
  }

  /**
   * Finds tasks that block many other tasks (high dependency count)
   */
  private findBlockingTasks(): string[] {
    const dependentCounts: Record<string, number> = {};
    
    // Initialize counts
    Object.keys(this.graph.tasks).forEach(taskId => {
      dependentCounts[taskId] = 0;
    });

    // Count dependents for each task
    this.graph.edges.forEach(edge => {
      if (dependentCounts[edge.from] !== undefined) {
        dependentCounts[edge.from]++;
      }
    });

    // Return tasks with above-average number of dependents
    const avgDependents = Object.values(dependentCounts).reduce((a, b) => a + b, 0) / Object.keys(dependentCounts).length;
    
    return Object.entries(dependentCounts)
      .filter(([_, count]) => count > avgDependents)
      .map(([taskId, _]) => taskId);
  }

  /**
   * Gets neighboring nodes (tasks that depend on the given task)
   */
  private getNeighbors(taskId: string): string[] {
    return this.graph.edges
      .filter(edge => edge.from === taskId)
      .map(edge => edge.to);
  }

  /**
   * Gets dependent nodes (tasks the given task depends on)
   */
  private getDependents(taskId: string): string[] {
    return this.graph.edges
      .filter(edge => edge.to === taskId)
      .map(edge => edge.from);
  }

  /**
   * Gets direct dependencies of a task
   */
  private getDependencies(taskId: string): string[] {
    return this.graph.edges
      .filter(edge => edge.to === taskId)
      .map(edge => edge.from);
  }

  /**
   * Gets the weight of an edge between two tasks
   */
  private getEdgeWeight(from: string, to: string): number {
    const edge = this.graph.edges.find(e => e.from === from && e.to === to);
    return edge?.weight || 1;
  }

  /**
   * Fallback critical path calculation for cyclic graphs
   */
  private getFallbackCriticalPath(): string[] {
    const tasks = Object.keys(this.graph.tasks);
    
    // Simple heuristic: sort by number of dependents
    const taskScores = tasks.map(taskId => {
      const dependentCount = this.getNeighbors(taskId).length;
      return { taskId, score: dependentCount };
    });

    taskScores.sort((a, b) => b.score - a.score);
    
    return taskScores.slice(0, Math.min(5, tasks.length)).map(item => item.taskId);
  }

  /**
   * Validates the dependency graph and returns validation results
   */
  validate(): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    // Check for cycles
    const analysis = this.analyzeGraph();
    
    if (analysis.hasCycles) {
      results.push({
        id: `cycle-detected-${Date.now()}`,
        timestamp: new Date(),
        type: 'dependency_validation',
        passed: false,
        message: `Circular dependencies detected: ${analysis.cycleDetails?.map(cycle => cycle.join(' → ')).join(', ')}`,
        severity: 'error'
      });
    }

    // Check for isolated tasks
    const taskIds = new Set(Object.keys(this.graph.tasks));
    this.graph.edges.forEach(edge => {
      taskIds.delete(edge.from);
      taskIds.delete(edge.to);
    });

    if (taskIds.size > 0) {
      results.push({
        id: `isolated-tasks-${Date.now()}`,
        timestamp: new Date(),
        type: 'dependency_validation',
        passed: false,
        message: `Isolated tasks with no dependencies: ${Array.from(taskIds).join(', ')}`,
        severity: 'warning'
      });
    }

    return results;
  }
}

/**
 * Creates an optimized task order based on dependencies and priorities
 */
export function optimizeTaskExecution(graph: TaskDependencyGraph): string[] {
  const manager = new DependencyGraphManager(graph);
  
  try {
    return manager.analyzeGraph().topologicalOrder || Object.keys(graph.tasks);
  } catch (error) {
    // Fallback to simple priority-based sort
    const tasks = Object.values(graph.tasks);
    
    return tasks
      .sort((a, b) => {
        // Sort by priority first
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority] || 0;
        const bPriority = priorityOrder[b.priority] || 0;
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        
        // Then by estimated duration (shorter tasks first)
        const aDuration = a.estimatedDuration || 999;
        const bDuration = b.estimatedDuration || 999;
        
        return aDuration - bDuration;
      })
      .map(task => task.id);
  }
}

