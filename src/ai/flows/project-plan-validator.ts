


'use server';

/**
 * @fileOverview Project Plan Validator - Cross-validates architecture, file structure, and task consistency.
 *
 * - ProjectPlanValidator - Main validation class for cross-component consistency checks
 * - ValidationResult - Comprehensive result with error categorization and suggestions  
 */

import { UnifiedProjectContext } from './unified-project-context';
import { DependencyGraph, ValidationResult as DependencyValidationResult } from './task-dependency-graph';
import { Task } from '@/types';

export interface CrossValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: Suggestion[];
  consistencyScore: number; // 0-100
}

export interface ValidationError {
  type: 'ARCHITECTURE_TASK_MISMATCH' | 
        'FILE_STRUCTURE_REFERENCE' |
        'TASK_DEPENDENCY_VIOLATION' |
        'SPECIFICATION_CONTRADICTION';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  message: string;
  affectedComponents: (string | symbol)[];
  suggestion?: string;
}

export interface ValidationWarning {
  type: 'INCOMPLETE_INFORMATION' | 
        'POTENTIAL_ISSUE' |
        'OPTIMIZATION_OPPORTUNITY';
  message: string;
  affectedComponents: (string | symbol)[];
}

export interface Suggestion {
  type: 'TASK_ORDERING' | 
        'CONTEXT_UPDATE' |
        'DEPENDENCY_ADDITION';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  action?: () => Promise<void>;
}

export class ProjectPlanValidator {
 private context: UnifiedProjectContext;
 private dependencyGraph?: DependencyGraph;

 constructor(context: UnifiedProjectContext, dependencyGraph?: DependencyGraph) {
    this.context = context;
    this.dependencyGraph = dependencyGraph;
  }

 public async validateCompleteWorkflow(): Promise<CrossValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: Suggestion[] = [];

    // Architecture-Task Consistency
    await this.validateArchitectureTasksConsistency(errors, warnings);

    // File Structure-Task Consistency  
    await this.validateFileStructureTasksConsistency(errors, warnings);

    // Specification-Task Consistency
    await this.validateSpecificationTasksConsistency(errors, warnings);

    // Dependency Validation (if available)
    if (this.dependencyGraph) {
      await this.validateDependencyConsistency(errors, warnings);
    }

    // Cross-references Validation
    await this.validateCrossReferences(errors);

    // Completeness Check
    await this.validateCompleteness(warnings, suggestions);

    // Calculate consistency score
    const consistencyScore = this.calculateConsistencyScore(errors.length, warnings.length);

    // Generate suggestions for improvement
    await this.generateImprovementSuggestions(suggestions);

    return {
      isValid: errors.length === 0,
      errors,
      warnings, 
      suggestions,
      consistencyScore,
    };
  }

 private async validateArchitectureTasksConsistency(
   errors: ValidationError[],
   warnings: ValidationWarning[]
 ): Promise<void> {
    if (!this.context.architecture) return;

    const architectureKeywords = this.extractKeywords(this.context.architecture);
    
    for (const task of this.context.tasks) {
      const taskKeywords = this.extractKeywords(task.details);
      
      // Check if task details reference the architecture
      const hasArchitectureAlignment = this.hasTextOverlap(taskKeywords, architectureKeywords);
      
      if (!hasArchitectureAlignment && task.details.length > 0) {
        const warning: ValidationWarning = {
          type: 'POTENTIAL_ISSUE',
          message: `Task "${task.title}" may not align with the defined architecture`,
          affectedComponents: ['architecture', task],
        };
        warnings.push(warning);
      }

      // Check for architectural contradictions
      const contradiction = this.findArchitecturalContradiction(task, architectureKeywords);
      if (contradiction) {
        const error: ValidationError = {
          type: 'ARCHITECTURE_TASK_MISMATCH',
          severity: 'HIGH',
          message: `Task "${task.title}" contradicts the architecture by ${contradiction}`,
          affectedComponents: ['architecture', task],
          suggestion: 'Review the task implementation steps to ensure they align with the architectural decisions',
        };
        errors.push(error);
      }
    }

    // Check if architecture covers all major components
    const missingArchCoverage = this.findMissingArchitectureCoverage();
    if (missingArchCoverage.length > 0) {
      const warning: ValidationWarning = {
        type: 'INCOMPLETE_INFORMATION',
        message: `Architecture may not cover these components mentioned in tasks: ${missingArchCoverage.join(', ')}`,
        affectedComponents: ['architecture', 'tasks'],
      };
      warnings.push(warning);
    }
  }

 private async validateFileStructureTasksConsistency(
   errors: ValidationError[],
   warnings: ValidationWarning[]
 ): Promise<void> {
    if (!this.context.fileStructure) return;

    try {
      const fileTree = this.parseFileStructure(this.context.fileStructure);
      
      for (const task of this.context.tasks) {
        const referencedFiles = this.extractFileReferences(task.details);
        
        for (const fileRef of referencedFiles) {
          if (!this.fileExistsInTree(fileRef, fileTree)) {
            const error: ValidationError = {
              type: 'FILE_STRUCTURE_REFERENCE',
              severity: 'MEDIUM',
              message: `Task "${task.title}" references file "${fileRef}" that doesn't exist in the file structure`,
              affectedComponents: ['fileStructure', task],
              suggestion: 'Add this file to the file structure or update the task description',
            };
            errors.push(error);
          }
        }

        // Check if task creates/modifies files that should be in the structure
        const fileCreations = this.extractFileCreations(task.details);
        for (const createdFile of fileCreations) {
          if (!this.fileExistsInTree(createdFile, fileTree)) {
            const warning: ValidationWarning = {
              type: 'OPTIMIZATION_OPPORTUNITY',
              message: `Task "${task.title}" creates file "${createdFile}" that should be added to the file structure`,
              affectedComponents: ['fileStructure', task],
            };
            warnings.push(warning);
          }
        }
      }

    } catch (parseError) {
      console.warn('Could not parse file structure for validation:', parseError);
    }
  }

 private async validateSpecificationTasksConsistency(
   errors: ValidationError[],
   warnings: ValidationWarning[]
 ): Promise<void> {
    if (!this.context.specifications) return;

    const specificationRequirements = this.extractSpecificationRequirements(this.context.specifications);
    
    for (const task of this.context.tasks) {
      // Check if task addresses any specification requirements
      const addressedRequirements = this.findAddressedRequirements(task.details, specificationRequirements);
      
      if (addressedRequirements.length === 0 && task.details.length > 100) {
        // Only warn for substantial tasks that should address requirements
        const warning: ValidationWarning = {
          type: 'POTENTIAL_ISSUE',
          message: `Task "${task.title}" doesn't clearly address any specific requirements`,
          affectedComponents: ['specifications', task],
        };
        warnings.push(warning);
      }

      // Check for specification contradictions
      const contradiction = this.findSpecificationContradiction(task, specificationRequirements);
      if (contradiction) {
        const error: ValidationError = {
          type: 'SPECIFICATION_CONTRADICTION',
          severity: 'HIGH',
          message: `Task "${task.title}" contradicts specification requirements by ${contradiction}`,
          affectedComponents: ['specifications', task],
          suggestion: 'Update the implementation steps to meet the specification requirements',
        };
        errors.push(error);
      }
    }

    // Check if all major requirements are addressed by some task
    const unaddressedRequirements = this.findUnaddressedRequirements(specificationRequirements, this.context.tasks);
    if (unaddressedRequirements.length > 0) {
      const error: ValidationError = {
        type: 'SPECIFICATION_CONTRADICTION',
        severity: 'CRITICAL',
        message: `${unaddressedRequirements.length} specification requirements are not addressed by any task`,
        affectedComponents: ['specifications', 'tasks'],
        suggestion: `Create tasks to address these requirements: ${unaddressedRequirements.join(', ')}`,
      };
      errors.push(error);
    }
  }

 private async validateDependencyConsistency(
   errors: ValidationError[],
   warnings: ValidationWarning[]
 ): Promise<void> {
    if (!this.dependencyGraph) return;

    const dependencyValidation = this.dependencyGraph.validateDependencies();
    
    // Convert dependency validation errors to our format
    for (const error of dependencyValidation.errors) {
      const convertedError: ValidationError = {
        type: 'TASK_DEPENDENCY_VIOLATION',
        severity: error.type === 'CIRCULAR_DEPENDENCY' ? 'CRITICAL' : 'HIGH',
        message: error.message,
        affectedComponents: ['dependencies'],
      };
      errors.push(convertedError);
    }

    // Convert warnings
    for (const warning of dependencyValidation.warnings) {
      const convertedWarning: ValidationWarning = {
        type: 'POTENTIAL_ISSUE',
        message: warning.message,
        affectedComponents: ['dependencies'],
      };
      warnings.push(convertedWarning);
    }
  }

 private async validateCrossReferences(errors: ValidationError[]): Promise<void> {
    // Check for consistent terminology across components
    const terms = this.extractKeyTerms();
    
    for (const term of terms) {
      const consistencyScore = this.checkTermConsistency(term);
      
      if (consistencyScore < 0.5) {
        const error: ValidationError = {
          type: 'SPECIFICATION_CONTRADICTION',
          severity: 'MEDIUM',
          message: `Term "${term}" is used inconsistently across project components`,
          affectedComponents: ['architecture', 'specifications', 'tasks'],
          suggestion: `Standardize the terminology for "${term}" across all project documents`,
        };
        errors.push(error);
      }
    }

    // Check for logical flow between components
    const flowIssues = this.checkLogicalFlow();
    if (flowIssues.length > 0) {
      const error: ValidationError = {
        type: 'ARCHITECTURE_TASK_MISMATCH',
        severity: 'HIGH', 
        message: `Logical flow issues detected: ${flowIssues.join('; ')}`,
        affectedComponents: ['architecture', 'tasks'],
      };
      errors.push(error);
    }
  }

 private async validateCompleteness(
   warnings: ValidationWarning[],
   suggestions: Suggestion[]
 ): Promise<void> {
    const contextSummary = this.getContextSummary();
    
    // Check for missing critical information
    if (!contextSummary.hasArchitecture) {
      warnings.push({
        type: 'INCOMPLETE_INFORMATION',
        message: 'No architecture defined - tasks may lack guidance',
        affectedComponents: ['architecture'],
      });
    }

    if (!contextSummary.hasFileStructure) {
      suggestions.push({
        type: 'CONTEXT_UPDATE',
        priority: 'HIGH',
        message: 'Consider generating a file structure to guide task implementation',
      });
    }

    if (contextSummary.taskCount === 0) {
      warnings.push({
        type: 'INCOMPLETE_INFORMATION',
        message: 'No tasks defined - cannot validate implementation plan',
        affectedComponents: ['tasks'],
      });
    }

    // Check task coverage
    const uncoveredAreas = this.findUncoveredProjectAreas();
    if (uncoveredAreas.length > 0) {
      suggestions.push({
        type: 'TASK_ORDERING',
        priority: 'MEDIUM',
        message: `Consider adding tasks to cover these areas: ${uncoveredAreas.join(', ')}`,
      });
    }
  }

 private generateImprovementSuggestions(suggestions: Suggestion[]): Promise<void> {
    return new Promise((resolve) => {
      // Task ordering suggestions
      const outOfOrderTasks = this.findOutOfOrderTasks();
      if (outOfOrderTasks.length > 0) {
        suggestions.push({
          type: 'TASK_ORDERING',
          priority: 'HIGH',
          message: `These tasks may need reordering based on dependencies: ${outOfOrderTasks.join(', ')}`,
        });
      }

      // Context update suggestions
      const outdatedContext = this.findOutdatedContext();
      if (outdatedContext.length > 0) {
        suggestions.push({
          type: 'CONTEXT_UPDATE',
          priority: 'MEDIUM', 
          message: `Consider updating these context areas based on task research: ${outdatedContext.join(', ')}`,
        });
      }

      // Dependency addition suggestions
      const missingDeps = this.findMissingDependencies();
      if (missingDeps.length > 0) {
        suggestions.push({
          type: 'DEPENDENCY_ADDITION',
          priority: 'MEDIUM',
          message: `Consider adding these dependencies: ${missingDeps.join(', ')}`,
        });
      }

      resolve();
    });
  }

 // Helper methods for validation logic
 private extractKeywords(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);
  }

 private hasTextOverlap(words1: string[], words2: string[]): boolean {
    return words1.some(word => 
      words2.some(otherWord => word.includes(otherWord) || otherWord.includes(word))
    );
  }

 private findArchitecturalContradiction(task: Task, architectureKeywords: string[]): string {
    // Simplified contradiction detection
    const taskDetails = task.details.toLowerCase();
    
    if (taskDetails.includes('monolithic') && architectureKeywords.some(k => k.includes('microservice'))) {
      return 'using monolithic patterns in a microservices architecture';
    }
    
    if (taskDetails.includes('relational') && architectureKeywords.some(k => k.includes('nosql'))) {
      return 'using relational database with NoSQL architecture';
    }

    return '';
  }

 private findMissingArchitectureCoverage(): string[] {
    // Simplified coverage check
    return [];
  }

 private parseFileStructure(structure: string): any {
    // Simplified file structure parsing
    try {
      return JSON.parse(structure);
    } catch {
      // Return a basic structure if not JSON
      return { files: [], directories: [] };
    }
  }

 private extractFileReferences(text: string): string[] {
    // Extract potential file references from text
    const matches = text.match(/["']([^"']*?\.(ts|tsx|js|jsx|py|java|cpp|h))["']/g) || [];
    return matches.map(match => match.replace(/['"]/g, ''));
  }

 private extractFileCreations(text: string): string[] {
    // Extract potential file creations from text
    const matches = text.match(/create.*?["']([^"']*?\.(ts|tsx|js|jsx|py|java|cpp|h))["']/gi) || [];
    return matches.map(match => {
      const pathMatch = match.match(/["']([^"']*?\.(ts|tsx|js|jsx|py|java|cpp|h))["']/);
      return pathMatch ? pathMatch[1] : '';
    }).filter(Boolean);
  }

 private fileExistsInTree(filename: string, tree: any): boolean {
    // Simplified file existence check
    return false; // Would need proper tree traversal implementation
  }

 private extractSpecificationRequirements(specifications: string): string[] {
    return this.extractKeywords(specifications);
  }

 private findAddressedRequirements(taskDetails: string, requirements: string[]): string[] {
    return requirements.filter(req => 
      taskDetails.toLowerCase().includes(req)
    );
  }

 private findSpecificationContradiction(task: Task, requirements: string[]): string {
    // Simplified contradiction detection
    return '';
  }

 private findUnaddressedRequirements(requirements: string[], tasks: Task[]): string[] {
    return requirements.filter(req =>
      !tasks.some(task => task.details.toLowerCase().includes(req))
    );
  }

 private extractKeyTerms(): string[] {
    // Extract key terms from all components
    const allText = [
      this.context.architecture || '',
      this.context.specifications || '', 
      this.context.fileStructure || '',
      ...this.context.tasks.map(t => t.details)
    ].join(' ').toLowerCase();

    const words = allText.split(/\s+/).filter(word => word.length > 4);
    return [...new Set(words)];
  }

 private checkTermConsistency(term: string): number {
    // Simplified consistency checking
    return 0.8; // Placeholder implementation
  }

 private checkLogicalFlow(): string[] {
    // Simplified logical flow checking
    return [];
  }

 private getContextSummary() {
    const context = this.context;
    return {
      hasArchitecture: !!context.architecture,
      hasSpecifications: !!context.specifications, 
      hasFileStructure: !!context.fileStructure,
      taskCount: context.tasks.length,
    };
  }

 private findUncoveredProjectAreas(): string[] {
    // Simplified area detection
    return [];
  }

 private findOutOfOrderTasks(): string[] {
    // Simplified out-of-order detection
    return [];
  }

 private findOutdatedContext(): string[] {
    // Simplified outdated context detection
    return [];
  }

 private findMissingDependencies(): string[] {
    // Simplified missing dependency detection
    return [];
  }

 private calculateConsistencyScore(errorCount: number, warningCount: number): number {
    const maxErrors = 10; // Normalize to reasonable scale
    const maxWarnings = 20;
    
    const errorPenalty = Math.min(errorCount / maxErrors, 1) * 50;
    const warningPenalty = Math.min(warningCount / maxWarnings, 1) * 30;
    
    return Math.max(0, 100 - errorPenalty - warningPenalty);
  }
}

// High-level validation function
export async function validateProjectPlan(
  context: UnifiedProjectContext,
  dependencyGraph?: DependencyGraph
): Promise<CrossValidationResult> {
  const validator = new ProjectPlanValidator(context, dependencyGraph);
  
  try {
    return await validator.validateCompleteWorkflow();
  } catch (error) {
    console.error('Validation failed:', error);
    
    // Return basic result with known errors
    return {
      isValid: false,
      errors: [{
        type: 'SPECIFICATION_CONTRADICTION',
        severity: 'CRITICAL',
        message: `Validation failed due to error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        affectedComponents: ['validation'],
      }],
      warnings: [],
      suggestions: [],
      consistencyScore: 0,
    };
  }
}

// Zod schema for API usage
export const ProjectPlanValidationInputSchema = z.object({
  context: z.any(), // Would need proper schema for UnifiedProjectContext
  dependencyGraph: z.any().optional(),
});

export type ProjectPlanValidationInput = z.infer<typeof ProjectPlanValidationInputSchema>;

