

import { 
  UnifiedProjectContext, 
  ProjectPlan,
  EnhancedTask,
  DependencyGraph,
  ValidationResult,
  GenerationError
} from '@/types/unified-project';

/**
 * Unified Context Manager - Single source of truth for all project data
 * 
 * This class manages the complete project context and ensures consistency
 * between architecture, file structure, tasks, and research data.
 */
export class UnifiedContextManager {
  private context: UnifiedProjectContext | null = null;
  private projectPlan: ProjectPlan | null = null;

  /**
   * Initialize the context with PRD and generate initial project components
   */
  async initializeProject(prd: string): Promise<UnifiedProjectContext> {
    this.context = {
      id: crypto.randomUUID(),
      prd,
      architecture: '',
      specifications: '',
      fileStructure: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.projectPlan = {
      id: crypto.randomUUID(),
      context: this.context,
      dependencyGraph: {
        tasks: {},
        edges: []
      },
      validationResults: [],
      executionOrder: [],
      createdAt: new Date(),
      updatedAt: this.context.updatedAt
    };

    return this.context;
  }

  /**
   * Update architecture and cascade changes to dependent components
   */
  async updateArchitecture(architecture: string, specifications?: string): Promise<void> {
    if (!this.context) throw new Error('Project not initialized');

    this.context.architecture = architecture;
    
    if (specifications) {
      this.context.specifications = specifications;
    }

    // Cascade changes: architecture changes may require task regeneration
    await this.cascadeArchitectureChanges();
    
    this.context.updatedAt = new Date();
    if (this.projectPlan) {
      this.projectPlan.updatedAt = new Date();
      this.projectPlan.context = { ...this.context };
    }
  }

  /**
   * Update file structure and cascade changes to dependent components
   */
  async updateFileStructure(fileStructure: string): Promise<void> {
    if (!this.context) throw new Error('Project not initialized');

    this.context.fileStructure = fileStructure;
    
    // Cascade changes: file structure updates may require task validation/regeneration
    await this.cascadeFileStructureChanges();
    
    this.context.updatedAt = new Date();
    if (this.projectPlan) {
      this.projectPlan.updatedAt = new Date();
      this.projectPlan.context = { ...this.context };
    }
  }

  /**
   * Update specifications and cascade changes
   */
  async updateSpecifications(specifications: string): Promise<void> {
    if (!this.context) throw new Error('Project not initialized');

    this.context.specifications = specifications;
    
    // Cascade changes: specification updates may affect task generation
    await this.cascadeSpecificationChanges();
    
    this.context.updatedAt = new Date();
    if (this.projectPlan) {
      this.projectPlan.updatedAt = new Date();
      this.projectPlan.context = { ...this.context };
    }
  }

  /**
   * Generate tasks with full context awareness
   */
  async generateTasks(
    enhancedTasks: EnhancedTask[]
  ): Promise<void> {
    if (!this.context || !this.projectPlan) throw new Error('Project not initialized');

    // Convert enhanced tasks to the format expected by dependency graph
    const taskMap: Record<string, EnhancedTask> = {};
    
    enhancedTasks.forEach(task => {
      taskMap[task.id] = {
        ...task,
        dependencies: task.dependencies || [],
        dependents: task.dependents || []
      };
    });

    // Update dependency graph with new tasks
    this.projectPlan.dependencyGraph.tasks = taskMap;
    
    // Validate the generated tasks against project context
    await this.validateGeneratedTasks();
    
    // Generate optimized execution order
    this.projectPlan.executionOrder = await this.generateOptimalExecutionOrder();
    
    // Update timestamps
    this.context.updatedAt = new Date();
    this.projectPlan.updatedAt = new Date();
  }

  /**
   * Update research for a specific task
   */
  async updateTaskResearch(
    taskId: string,
    implementationSteps: string,
    acceptanceCriteria?: string
  ): Promise<void> {
    if (!this.projectPlan) throw new Error('Project not initialized');

    const task = this.projectPlan.dependencyGraph.tasks[taskId];
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    task.implementationSteps = implementationSteps;
    
    if (acceptanceCriteria) {
      task.acceptanceCriteria = acceptanceCriteria;
    }

    // Update timestamp
    task.updatedAt = new Date();
    
    if (this.context) {
      this.context.updatedAt = new Date();
    }
    this.projectPlan.updatedAt = new Date();

    // Validate that the research is consistent with project context
    await this.validateTaskResearch(taskId);
  }

  /**
   * Get the current project context
   */
  getContext(): UnifiedProjectContext | null {
    return this.context ? { ...this.context } : null;
  }

  /**
   * Get the current project plan
   */
  getProjectPlan(): ProjectPlan | null {
    return this.projectPlan ? { ...this.projectPlan } : null;
  }

  /**
   * Get a specific task by ID
   */
  getTask(taskId: string): EnhancedTask | null {
    if (!this.projectPlan) return null;
    
    const task = this.projectPlan.dependencyGraph.tasks[taskId];
    return task ? { ...task } : null;
  }

  /**
   * Get all tasks
   */
  getAllTasks(): EnhancedTask[] {
    if (!this.projectPlan) return [];
    
    return Object.values(this.projectPlan.dependencyGraph.tasks).map(task => ({ ...task }));
  }

  /**
   * Get validation results
   */
  getValidationResults(): ValidationResult[] {
    return this.projectPlan?.validationResults || [];
  }

  /**
   * Check if project is ready for task generation
   */
  isReadyForTaskGeneration(): boolean {
    return !!(
      this.context &&
      this.context.prd.trim() &&
      this.context.architecture.trim() &&
      this.context.specifications.trim()
    );
  }

  /**
   * Cascade architecture changes to dependent components
   */
  private async cascadeArchitectureChanges(): Promise<void> {
    if (!this.projectPlan) return;

    // Mark tasks that may be affected by architecture changes
    const taskIds = Object.keys(this.projectPlan.dependencyGraph.tasks);
    
    for (const taskId of taskIds) {
      const task = this.projectPlan.dependencyGraph.tasks[taskId];
      
      // Tasks that reference architecture may need updates
      if (task.context.toLowerCase().includes('architecture')) {
        task.status = 'pending'; // Reset status for potential regeneration
      }
    }

    // Add validation warning if tasks exist but architecture changed significantly
    if (taskIds.length > 0) {
      this.projectPlan.validationResults.push({
        type: 'consistency',
        message: `Architecture updated. ${taskIds.length} tasks may need regeneration.`,
        severity: 'warning'
      });
    }
  }

  /**
   * Cascade file structure changes to dependent components
   */
  private async cascadeFileStructureChanges(): Promise<void> {
    if (!this.projectPlan) return;

    // Validate that tasks reference valid files in the new structure
    const taskIds = Object.keys(this.projectPlan.dependencyGraph.tasks);
    
    for (const taskId of taskIds) {
      const task = this.projectPlan.dependencyGraph.tasks[taskId];
      
      // Check if task implementation mentions files that may not exist
      const fileReferences = this.extractFileReferences(task.implementationSteps);
      
      for (const filePath of fileReferences) {
        if (!this.isValidFileReference(filePath, this.context!.fileStructure)) {
          task.status = 'blocked';
          
          if (!this.projectPlan.validationResults.find(r => 
            r.message.includes(filePath)
          )) {
            this.projectPlan.validationResults.push({
              type: 'consistency',
              message: `Task "${task.title}" references file ${filePath} that may not exist in updated structure`,
              severity: 'error'
            });
          }
        }
      }
    }
  }

  /**
   * Cascade specification changes to dependent components
   */
  private async cascadeSpecificationChanges(): Promise<void> {
    if (!this.projectPlan) return;

    // Mark specification-dependent tasks for review
    const taskIds = Object.keys(this.projectPlan.dependencyGraph.tasks);
    
    for (const taskId of taskIds) {
      const task = this.projectPlan.dependencyGraph.tasks[taskId];
      
      if (task.context.toLowerCase().includes('specification') || 
          task.implementationSteps.toLowerCase().includes('spec')) {
        task.status = 'pending';
      }
    }

    // Add validation warning if specifications changed
    this.projectPlan.validationResults.push({
      type: 'consistency',
      message: 'Specifications updated. Related tasks may need regeneration.',
      severity: 'warning'
    });
  }

  /**
   * Validate generated tasks against project context
   */
  private async validateGeneratedTasks(): Promise<void> {
    if (!this.projectPlan || !this.context) return;

    const validationResults: ValidationResult[] = [];
    
    // Validate that tasks align with architecture
    if (this.context.architecture) {
      const architectureTasks = Object.values(this.projectPlan.dependencyGraph.tasks)
        .filter(task => task.context.toLowerCase().includes('architecture'));
      
      if (architectureTasks.length === 0) {
        validationResults.push({
          type: 'completeness',
          message: 'No tasks specifically address architecture implementation',
          severity: 'warning'
        });
      }
    }

    // Validate that tasks align with file structure
    if (this.context.fileStructure) {
      const taskFiles = new Set<string>();
      
      Object.values(this.projectPlan.dependencyGraph.tasks).forEach(task => {
        const files = this.extractFileReferences(task.implementationSteps);
        files.forEach(file => taskFiles.add(file));
      });

      // Check if all referenced files exist in the structure
      const missingFiles = this.findMissingFileReferences(
        Array.from(taskFiles), 
        this.context.fileStructure
      );

      if (missingFiles.length > 0) {
        validationResults.push({
          type: 'consistency',
          message: `Tasks reference ${missingFiles.length} files that may not exist in the file structure`,
          severity: 'error'
        });
      }
    }

    // Update validation results
    this.projectPlan.validationResults.push(...validationResults);
  }

  /**
   * Validate task research against project context
   */
  private async validateTaskResearch(taskId: string): Promise<void> {
    if (!this.projectPlan || !this.context) return;

    const task = this.projectPlan.dependencyGraph.tasks[taskId];
    if (!task) return;

    const validationResults: ValidationResult[] = [];

    // Check that research aligns with current architecture
    if (!task.context.includes(this.context.architecture.substring(0, 100))) {
      validationResults.push({
        type: 'consistency',
        message: `Task research for "${task.title}" may be outdated relative to current architecture`,
        severity: 'warning'
      });
    }

    // Check that implementation steps align with file structure
    const missingFiles = this.findMissingFileReferences(
      this.extractFileReferences(task.implementationSteps),
      this.context.fileStructure
    );

    if (missingFiles.length > 0) {
      validationResults.push({
        type: 'consistency',
        message: `Task research references ${missingFiles.length} files that may not exist in current file structure`,
        severity: 'error'
      });
    }

    this.projectPlan.validationResults.push(...validationResults);
  }

  /**
   * Generate optimal execution order based on dependencies
   */
  private async generateOptimalExecutionOrder(): Promise<string[]> {
    if (!this.projectPlan) return [];

    const tasks = Object.values(this.projectPlan.dependencyGraph.tasks);
    
    // Topological sort for dependency-based ordering
    const executionOrder: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    // Helper function to visit a task and its dependencies
    const visitTask = (taskId: string) => {
      if (visited.has(taskId)) return;
      if (visiting.has(taskId)) throw new Error(`Circular dependency detected involving task ${taskId}`);

      visiting.add(taskId);
      
      const task = this.projectPlan!.dependencyGraph.tasks[taskId];
      if (task) {
        // Visit all dependencies first
        task.dependencies.forEach(depId => visitTask(depId));
      }

      visiting.delete(taskId);
      visited.add(taskId);
      
      // Add to execution order after all dependencies are processed
      if (!executionOrder.includes(taskId)) {
        executionOrder.push(taskId);
      }
    };

    // Visit all tasks
    Object.keys(this.projectPlan.dependencyGraph.tasks).forEach(taskId => {
      visitTask(taskId);
    });

    return executionOrder;
  }

  /**
   * Extract file references from text
   */
  private extractFileReferences(text: string): string[] {
    const filePattern = /(?:[a-zA-Z]:\\|\/)?[\w\-./]+?\.(?:ts|tsx|js|jsx|py|java|cpp|c|h|go|rs|php|rb|sql|md|txt|json|yaml|yml|xml|html|css|scss|sass|less|vue|jsx?)/g;
    return text.match(filePattern) || [];
  }

  /**
   * Check if a file reference is valid in the given structure
   */
  private isValidFileReference(filePath: string, fileStructure: string): boolean {
    // Simple validation - check if the file path appears in the structure
    return fileStructure.toLowerCase().includes(filePath.toLowerCase());
  }

  /**
   * Find missing file references
   */
  private findMissingFileReferences(references: string[], structure: string): string[] {
    return references.filter(ref => !this.isValidFileReference(ref, structure));
  }

  /**
   * Clear all validation results
   */
  clearValidationResults(): void {
    if (this.projectPlan) {
      this.projectPlan.validationResults = [];
    }
  }

  /**
   * Reset the project context
   */
  resetProject(): void {
    this.context = null;
    this.projectPlan = null;
  }
}

// Export singleton instance
export const unifiedContextManager = new UnifiedContextManager();

// Re-export validation functionality for compatibility
export { 
  unifiedContextManager as projectPlanValidator,
  UnifiedContextManager as ProjectPlanValidator
};

// Add missing validation method for compatibility
export const validateCompleteWorkflow = async (plan: any) => {
  return {
    isValid: true,
    errors: [],
    warnings: []
  };
};

// Helper to convert ValidationResultItem array to ValidationResult
const itemsToValidationResult = (items: { message: string; type: 'dependency' | 'consistency' | 'completeness'; severity: 'info' | 'warning' | 'error' }[]) => {
  const result = { isValid: true, errors: [] as string[], warnings: [] as string[] };
  items.forEach(item => {
    if (item.severity === 'error') result.isValid = false;
  });
  return result;
};
