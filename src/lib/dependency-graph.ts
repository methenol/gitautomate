import { DependencyGraphNode, UnifiedTask, ValidationIssue } from '@/types/unified-context';

export class TaskDependencyGraph {
  private nodes: Map<string, DependencyGraphNode> = new Map();
  private edges: Map<string, Set<string>> = new Map();

  constructor() {}

  addTask(task: UnifiedTask): void {
    if (this.nodes.has(task.id)) {
      return; // Task already exists
    }

    const node: DependencyGraphNode = {
      id: task.id,
      task,
      dependencies: task.dependencies.dependsOn,
      dependents: [],
      level: 0,
    };

    this.nodes.set(task.id, node);
    this.edges.set(task.id, new Set(task.dependencies.dependsOn));

    // Update dependents for dependencies
    task.dependencies.dependsOn.forEach(depId => {
      const depNode = this.nodes.get(depId);
      if (depNode) {
        depNode.dependents.push(task.id);
      }
    });

    this.calculateLevels();
  }

  addMultipleTasks(tasks: UnifiedTask[]): void {
    // First pass: add all nodes
    tasks.forEach(task => {
      const node: DependencyGraphNode = {
        id: task.id,
        task,
        dependencies: task.dependencies.dependsOn,
        dependents: [],
        level: 0,
      };
      this.nodes.set(task.id, node);
      this.edges.set(task.id, new Set(task.dependencies.dependsOn));
    });

    // Second pass: update dependents
    tasks.forEach(task => {
      task.dependencies.dependsOn.forEach(depId => {
        const depNode = this.nodes.get(depId);
        if (depNode) {
          depNode.dependents.push(task.id);
        }
      });
    });

    this.calculateLevels();
  }

  hasCycles(): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycleDFS = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const dependencies = this.edges.get(nodeId) || new Set();
      for (const depId of dependencies) {
        if (!visited.has(depId)) {
          if (hasCycleDFS(depId)) {
            return true;
          }
        } else if (recursionStack.has(depId)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        if (hasCycleDFS(nodeId)) {
          return true;
        }
      }
    }

    return false;
  }

  findCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Map<string, string | null>();

    const findCycleDFS = (nodeId: string, path: string[]): void => {
      visited.add(nodeId);
      path.push(nodeId);

      const dependencies = this.edges.get(nodeId) || new Set();
      for (const depId of dependencies) {
        if (!visited.has(depId)) {
          findCycleDFS(depId, [...path]);
        } else if (path.includes(depId)) {
          // Found a cycle
          const cycleStartIndex = path.indexOf(depId);
          const cycle = path.slice(cycleStartIndex);
          cycle.push(depId); // Complete the cycle
          cycles.push(cycle);
        }
      }
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        findCycleDFS(nodeId, []);
      }
    }

    return cycles;
  }

  topologicalSort(): UnifiedTask[] {
    if (this.hasCycles()) {
      throw new Error('Cannot perform topological sort on graph with cycles');
    }

    const inDegree = new Map<string, number>();
    const result: UnifiedTask[] = [];
    const queue: string[] = [];

    // Initialize in-degree count
    for (const nodeId of this.nodes.keys()) {
      inDegree.set(nodeId, 0);
    }

    // Calculate in-degrees
    for (const [nodeId, dependencies] of this.edges) {
      for (const depId of dependencies) {
        if (this.nodes.has(depId)) {
          inDegree.set(depId, (inDegree.get(depId) || 0) + 1);
        }
      }
    }

    // Find nodes with no incoming edges
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    // Process queue
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const node = this.nodes.get(nodeId);
      if (node) {
        result.push(node.task);
      }

      // Remove this node from the graph and reduce in-degree of dependent nodes
      const dependencies = this.edges.get(nodeId) || new Set();
      for (const depId of dependencies) {
        if (this.nodes.has(depId)) {
          const newInDegree = (inDegree.get(depId) || 0) - 1;
          inDegree.set(depId, newInDegree);
          if (newInDegree === 0) {
            queue.push(depId);
          }
        }
      }
    }

    return result;
  }

  getTasksByCategory(category: string): UnifiedTask[] {
    return Array.from(this.nodes.values())
      .filter(node => node.task.dependencies.category === category)
      .map(node => node.task);
  }

  getExecutionOrder(): UnifiedTask[] {
    try {
      return this.topologicalSort();
    } catch {
      // If there are cycles, return tasks sorted by category and priority
      const tasks = Array.from(this.nodes.values()).map(node => node.task);
      return tasks.sort((a, b) => {
        const categoryOrder = { setup: 0, core: 1, feature: 2, testing: 3, deployment: 4 };
        const aCat = categoryOrder[a.dependencies.category as keyof typeof categoryOrder];
        const bCat = categoryOrder[b.dependencies.category as keyof typeof categoryOrder];
        
        if (aCat !== bCat) {
          return aCat - bCat;
        }
        
        return b.dependencies.priority - a.dependencies.priority;
      });
    }
  }

  private calculateLevels(): void {
    const levels = new Map<string, number>();
    const visited = new Set<string>();

    const calculateLevel = (nodeId: string): number => {
      if (levels.has(nodeId)) {
        return levels.get(nodeId)!;
      }

      if (visited.has(nodeId)) {
        return 0; // Cycle detected, assign level 0
      }

      visited.add(nodeId);
      const dependencies = this.edges.get(nodeId) || new Set();
      let maxDepLevel = -1;

      for (const depId of dependencies) {
        if (this.nodes.has(depId)) {
          maxDepLevel = Math.max(maxDepLevel, calculateLevel(depId));
        }
      }

      const level = maxDepLevel + 1;
      levels.set(nodeId, level);
      
      const node = this.nodes.get(nodeId);
      if (node) {
        node.level = level;
      }

      visited.delete(nodeId);
      return level;
    };

    for (const nodeId of this.nodes.keys()) {
      if (!levels.has(nodeId)) {
        calculateLevel(nodeId);
      }
    }
  }

  validate(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check for cycles
    if (this.hasCycles()) {
      const cycles = this.findCycles();
      cycles.forEach(cycle => {
        issues.push({
          type: 'error',
          message: `Circular dependency detected: ${cycle.join(' → ')}`,
          category: 'dependencies',
          affectedTasks: cycle,
        });
      });
    }

    // Check for missing dependencies
    for (const node of this.nodes.values()) {
      for (const depId of node.dependencies) {
        if (!this.nodes.has(depId)) {
          issues.push({
            type: 'warning',
            message: `Task "${node.task.title}" depends on non-existent task with ID: ${depId}`,
            category: 'dependencies',
            affectedTasks: [node.id],
          });
        }
      }
    }

    // Check for isolated tasks (no dependencies and no dependents)
    for (const node of this.nodes.values()) {
      if (node.dependencies.length === 0 && node.dependents.length === 0 && this.nodes.size > 1) {
        issues.push({
          type: 'warning',
          message: `Task "${node.task.title}" has no dependencies or dependents - it may be isolated`,
          category: 'structure',
          affectedTasks: [node.id],
        });
      }
    }

    return issues;
  }

  getStats() {
    return {
      totalTasks: this.nodes.size,
      hasCycles: this.hasCycles(),
      maxLevel: Math.max(...Array.from(this.nodes.values()).map(n => n.level)),
      categoryCounts: this.getCategoryCounts(),
    };
  }

  private getCategoryCounts() {
    const counts: Record<string, number> = {};
    for (const node of this.nodes.values()) {
      const category = node.task.dependencies.category;
      counts[category] = (counts[category] || 0) + 1;
    }
    return counts;
  }
}