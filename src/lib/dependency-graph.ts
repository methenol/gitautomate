import { DependencyGraph } from '@/types/unified-context';

export class TaskDependencyGraph<T> implements DependencyGraph<T> {
  public nodes: Map<string, T> = new Map();
  public edges: Map<string, Set<string>> = new Map();

  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
  }

  addNode(id: string, data: T): void {
    this.nodes.set(id, data);
    if (!this.edges.has(id)) {
      this.edges.set(id, new Set());
    }
  }

  addDependency(from: string, to: string): void {
    // 'from' depends on 'to' (to must be completed before from)
    if (!this.edges.has(from)) {
      this.edges.set(from, new Set());
    }
    if (!this.edges.has(to)) {
      this.edges.set(to, new Set());
    }
    this.edges.get(from)!.add(to);
  }

  hasCycle(): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycleDFS = (node: string): boolean => {
      if (recursionStack.has(node)) {
        return true;
      }
      if (visited.has(node)) {
        return false;
      }

      visited.add(node);
      recursionStack.add(node);

      const dependencies = this.edges.get(node) || new Set();
      for (const dep of dependencies) {
        if (hasCycleDFS(dep)) {
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    for (const node of this.nodes.keys()) {
      if (!visited.has(node)) {
        if (hasCycleDFS(node)) {
          return true;
        }
      }
    }
    return false;
  }

  getTopologicalOrder(): string[] {
    if (this.hasCycle()) {
      throw new Error('Cannot create topological order: graph contains cycles');
    }

    const visited = new Set<string>();
    const stack: string[] = [];

    const topologicalSortDFS = (node: string): void => {
      visited.add(node);
      
      const dependencies = this.edges.get(node) || new Set();
      for (const dep of dependencies) {
        if (!visited.has(dep)) {
          topologicalSortDFS(dep);
        }
      }
      
      stack.push(node);
    };

    for (const node of this.nodes.keys()) {
      if (!visited.has(node)) {
        topologicalSortDFS(node);
      }
    }

    // Return reversed stack for correct topological order
    return stack;
  }

  getDependents(taskId: string): Set<string> {
    const dependents = new Set<string>();
    
    for (const [nodeId, deps] of this.edges.entries()) {
      if (deps.has(taskId)) {
        dependents.add(nodeId);
      }
    }
    
    return dependents;
  }

  getDirectDependencies(taskId: string): Set<string> {
    return this.edges.get(taskId) || new Set();
  }

  getAllDependencies(taskId: string): Set<string> {
    const allDeps = new Set<string>();
    const visited = new Set<string>();

    const collectDeps = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);
      
      const directDeps = this.edges.get(id) || new Set();
      for (const dep of directDeps) {
        allDeps.add(dep);
        collectDeps(dep);
      }
    };

    collectDeps(taskId);
    return allDeps;
  }

  canExecute(taskId: string, completedTasks: Set<string>): boolean {
    const dependencies = this.edges.get(taskId) || new Set();
    for (const dep of dependencies) {
      if (!completedTasks.has(dep)) {
        return false;
      }
    }
    return true;
  }

  getExecutableNodes(completedTasks: Set<string>): string[] {
    return Array.from(this.nodes.keys()).filter(taskId => 
      !completedTasks.has(taskId) && this.canExecute(taskId, completedTasks)
    );
  }
}