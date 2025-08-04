

'use server';

/**
 * @fileOverview Unified Project Context - Single source of truth for all project data.
 *
 * - UnifiedProjectContext - Centralized context containing PRD, architecture, file structure, and specifications
 * - ContextUpdateEvent - Events for context changes with propagation subscribers  
 * - ProjectContextManager - Manager class for maintaining consistency across all components
 */

import { Task } from '@/types';
import z from 'genkit';

export interface UnifiedProjectContext {
  id: string;
  prd: string;
  architecture?: string;
  specifications?: string;
  fileStructure?: string;
  tasks: Task[];
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    version: number;
    lastModifiedBy?: string;
  };
}

export interface ContextUpdateEvent {
  type: 'PRD_UPDATED' | 
        'ARCHITECTURE_UPDATED' |
        'SPECIFICATIONS_UPDATED' |
        'FILE_STRUCTURE_UPDATED' |
        'TASKS_UPDATED';
  timestamp: Date;
  fieldName: keyof UnifiedProjectContext;
  oldValue?: any;
  newValue?: any;
}

export interface ContextSubscriber {
  id: string;
  callback: (event: ContextUpdateEvent) => Promise<void> | void;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ContextValidationError[];
  warnings: ContextValidationWarning[];
}

export interface ContextValidationError {
  type: 'MISSING_FIELD' | 'INCONSISTENT_DATA' | 'INVALID_FORMAT';
  message: string;
  affectedFields: (keyof UnifiedProjectContext)[];
}

export interface ContextValidationWarning {
  type: 'DATA_OUTDATED' | 'INCOMPLETE_INFORMATION';
  message: string;
  affectedFields: (keyof UnifiedProjectContext)[];
}

export class ProjectContextManager {
  private context: UnifiedProjectContext;
  private subscribers = new Map<string, ContextSubscriber>();
  private validationCache = new Map<string, ValidationResult>();

 constructor(initialContext: Partial<UnifiedProjectContext> = {}) {
    this.context = this.createInitialContext(initialContext);
  }

 private createInitialContext(
   initial: Partial<UnifiedProjectContext>
 ): UnifiedProjectContext {
    return {
      id: this.generateId(),
      prd: initial.prd || '',
      architecture: initial.architecture,
      specifications: initial.specifications,
      fileStructure: initial.fileStructure,
      tasks: initial.tasks || [],
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        lastModifiedBy: initial.metadata?.lastModifiedBy,
      },
    };
  }

 private generateId(): string {
    return `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

 public getContext(): Readonly<UnifiedProjectContext> {
    return { ...this.context };
  }

 public updatePRD(prd: string): void {
    this.notifyUpdate({
      type: 'PRD_UPDATED',
      timestamp: new Date(),
      fieldName: 'prd',
      oldValue: this.context.prd,
      newValue: prd,
    });

    this.context.prd = prd;
    this.updateMetadata();
  }

 public updateArchitecture(architecture: string): void {
    this.notifyUpdate({
      type: 'ARCHITECTURE_UPDATED',
      timestamp: new Date(),
      fieldName: 'architecture',
      oldValue: this.context.architecture,
      newValue: architecture,
    });

    this.context.architecture = architecture;
    this.updateMetadata();
  }

 public updateSpecifications(specifications: string): void {
    this.notifyUpdate({
      type: 'SPECIFICATIONS_UPDATED',
      timestamp: new Date(),
      fieldName: 'specifications',
      oldValue: this.context.specifications,
      newValue: specifications,
    });

    this.context.specifications = specifications;
    this.updateMetadata();
  }

 public updateFileStructure(fileStructure: string): void {
    this.notifyUpdate({
      type: 'FILE_STRUCTURE_UPDATED',
      timestamp: new Date(),
      fieldName: 'fileStructure',
      oldValue: this.context.fileStructure,
      newValue: fileStructure,
    });

    this.context.fileStructure = fileStructure;
    this.updateMetadata();
  }

 public updateTasks(tasks: Task[]): void {
    const oldTasks = [...this.context.tasks];
    
    this.notifyUpdate({
      type: 'TASKS_UPDATED',
      timestamp: new Date(),
      fieldName: 'tasks',
      oldValue: oldTasks,
      newValue: tasks,
    });

    this.context.tasks = [...tasks];
    this.updateMetadata();
  }

 public addTask(task: Task): void {
    const newTasks = [...this.context.tasks, task];
    this.updateTasks(newTasks);
  }

 public updateTask(taskTitle: string, updates: Partial<Task>): void {
    const updatedTasks = this.context.tasks.map(task =>
      task.title === taskTitle ? { ...task, ...updates } : task
    );
    this.updateTasks(updatedTasks);
  }

 public removeTask(taskTitle: string): void {
    const filteredTasks = this.context.tasks.filter(
      task => task.title !== taskTitle
    );
    this.updateTasks(filteredTasks);
  }

 private updateMetadata(): void {
    this.context.metadata = {
      ...this.context.metadata,
      updatedAt: new Date(),
      version: this.context.metadata.version + 1,
    };
    
    // Clear validation cache when context changes
    this.validationCache.clear();
  }

 private notifyUpdate(event: ContextUpdateEvent): void {
    // Notify all subscribers
    for (const subscriber of this.subscribers.values()) {
      try {
        const result = subscriber.callback(event);
        if (result instanceof Promise) {
          result.catch(error => {
            console.error(`Context subscriber ${subscriber.id} failed:`, error);
          });
        }
      } catch (error) {
        console.error(`Context subscriber ${subscriber.id} failed:`, error);
      }
    }

    // Clear validation cache on any update
    this.validationCache.clear();
  }

 public subscribe(subscriber: ContextSubscriber): () => void {
    const id = subscriber.id || this.generateId();
    this.subscribers.set(id, { ...subscriber, id });

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(id);
    };
  }

 public validate(): ValidationResult {
    const contextKey = `validation_${this.context.metadata.version}`;
    
    if (this.validationCache.has(contextKey)) {
      return this.validationCache.get(contextKey)!;
    }

    const errors: ContextValidationError[] = [];
    const warnings: ContextValidationWarning[] = [];

    // Check for required fields
    if (!this.context.prd || this.context.prd.trim() === '') {
      errors.push({
        type: 'MISSING_FIELD',
        message: 'PRD is required and cannot be empty',
        affectedFields: ['prd'],
      });
    }

    // Check for consistency between fields
    if (this.context.architecture && !this.context.specifications) {
      warnings.push({
        type: 'INCOMPLETE_INFORMATION',
        message: 'Architecture is defined but specifications are missing',
        affectedFields: ['architecture', 'specifications'],
      });
    }

    if (this.context.specifications && !this.context.architecture) {
      warnings.push({
        type: 'INCOMPLETE_INFORMATION',
        message: 'Specifications are defined but architecture is missing',
        affectedFields: ['architecture', 'specifications'],
      });
    }

    if (this.context.fileStructure && (!this.context.architecture || !this.context.specifications)) {
      warnings.push({
        type: 'INCOMPLETE_INFORMATION',
        message: 'File structure is defined but architecture or specifications are missing',
        affectedFields: ['architecture', 'specifications', 'fileStructure'],
      });
    }

    // Check for task consistency with architecture and file structure
    if (this.context.tasks.length > 0 && this.context.architecture) {
      const tasksWithoutArchitecture = this.context.tasks.filter(
        task => !task.details.toLowerCase().includes(this.context.architecture!.toLowerCase())
      );
      
      if (tasksWithoutArchitecture.length > 0) {
        warnings.push({
          type: 'INCONSISTENT_DATA',
          message: `${tasksWithoutArchitecture.length} tasks may not align with the defined architecture`,
          affectedFields: ['architecture', 'tasks'],
        });
      }
    }

    if (this.context.tasks.length > 0 && this.context.fileStructure) {
      const fileTree = JSON.parse(this.context.fileStructure);
      const tasksReferencingMissingFiles: string[] = [];

      this.context.tasks.forEach(task => {
        // Simple heuristic - check if task mentions file operations
        const detailsLower = task.details.toLowerCase();
        if (detailsLower.includes('create') || detailsLower.includes('modify')) {
          // This is a simplified check - in reality, you'd parse the file structure
          // and task details to find actual mismatches
        }
      });

      if (tasksReferencingMissingFiles.length > 0) {
        warnings.push({
          type: 'INCONSISTENT_DATA',
          message: `${tasksReferencingMissingFiles.length} tasks may reference files not in the file structure`,
          affectedFields: ['fileStructure', 'tasks'],
        });
      }
    }

    const result = {
      isValid: errors.length === 0,
      errors,
      warnings,
    };

    this.validationCache.set(contextKey, result);
    return result;
  }

 public getConsistencyReport(): string {
    const validation = this.validate();
    
    let report = `Project Context Consistency Report\n`;
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `Context ID: ${this.context.id}\n\n`;

    if (validation.isValid) {
      report += `✅ Context is valid with ${this.context.tasks.length} tasks\n`;
    } else {
      report += `❌ Context has ${validation.errors.length} errors and ${validation.warnings.length} warnings\n\n`;
      
      if (validation.errors.length > 0) {
        report += `Errors:\n`;
        validation.errors.forEach(error => {
          report += `  - ${error.message}\n`;
        });
      }

      if (validation.warnings.length > 0) {
        report += `Warnings:\n`;
        validation.warnings.forEach(warning => {
          report += `  - ${warning.message}\n`;
        });
      }
    }

    return report;
  }

 public exportContext(): string {
    const context = this.getContext();
    return JSON.stringify(context, null, 2);
  }

 public static importContext(jsonData: string): ProjectContextManager {
    try {
      const data = JSON.parse(jsonData);
      
      // Validate imported data structure
      if (!data.prd) {
        throw new Error('Imported context must include PRD');
      }

      return new ProjectContextManager(data);
    } catch (error) {
      throw new Error(`Failed to import context: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
    }
  }

 public getContextSummary(): {
   hasPRD: boolean;
   hasArchitecture: boolean;
   hasSpecifications: boolean;
   hasFileStructure: boolean;
   taskCount: number;
   lastUpdated: Date;
 } {
    return {
      hasPRD: !!this.context.prd && this.context.prd.trim() !== '',
      hasArchitecture: !!this.context.architecture,
      hasSpecifications: !!this.context.specifications,
      hasFileStructure: !!this.context.fileStructure,
      taskCount: this.context.tasks.length,
      lastUpdated: this.context.metadata.updatedAt,
    };
  }
}

// Factory function to create context manager from individual components
export async function createProjectContext(
  prd: string,
  architecture?: string,
  specifications?: string,
  fileStructure?: string
): Promise<ProjectContextManager> {
  return new ProjectContextManager({
    prd,
    architecture,
    specifications,
    fileStructure,
  });
}

// Zod schemas for API usage
export const CreateContextInputSchema = z.object({
  prd: z.string().min(1, 'PRD is required'),
  architecture: z.string().optional(),
  specifications: z.string().optional(),
  fileStructure: z.string().optional(),
});

export type CreateContextInput = z.infer<typeof CreateContextInputSchema>;

export const UpdateContextInputSchema = z.object({
  field: z.enum(['prd', 'architecture', 'specifications', 'fileStructure']),
  value: z.string(),
});

export type UpdateContextInput = z.infer<typeof UpdateContextInputSchema>;

