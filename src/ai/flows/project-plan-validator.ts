


'use server';

/**
 * @fileOverview Project Plan Validator - Iterative validation system for cross-component consistency
 *
 * This module implements the validation pipeline that addresses Issue #7 by:
 * 1. Cross-validating architecture, file structure, and task consistency
 * 2. Providing iterative refinement loops between components  
 * 3. Ensuring generated workflows actually satisfy the original PRD
 * 4. Detecting and resolving inconsistencies between components
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { Task, UnifiedProjectContext } from './unified-context';

// Define validation types
export interface ValidationResult {
  id: string;
  type: 'architecture_consistency' | 'task_dependency_validation' | 'file_structure_alignment' | 'prd_coverage';
  status: 'passed' | 'failed' | 'warning';
  severity: 'low' | 'medium' | 'high';
  message: string;
  details?: Record<string, any>;
  recommendations: string[];
}

export interface ValidationReport {
  overallStatus: 'passed' | 'failed' | 'warning';
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  warningChecks: number;
  results: ValidationResult[];
  summary: string;
}

// Define validation input schema
const ValidationInputSchema = z.object({
  prd: z.string().describe('The Product Requirements Document (PRD) for the project.'),
  architecture: z.string().describe('The proposed software architecture for the project.'),
  specifications: z.string().describe('The detailed specifications for the project.'),
  fileStructure: z.string().describe('The proposed file/folder structure for the project.'),
  tasks: z.array(z.object({
    title: z.string(),
    details: z.string(),
    dependencies: z.array(z.string()),
  })).describe('The generated tasks for validation.'),
  
  // Validation options
  enableArchitectureValidation: z.boolean().optional().default(true),
  enableTaskDependencyValidation: z.boolean().optional().default(true),
  enableFileStructureAlignment: z.boolean().optional().default(true),
  enablePRDCoverageValidation: z.boolean().optional().default(true),
  
  // AI model options
  apiKey?: string,
  model?: string,
});

export type ValidationInput = z.infer<typeof ValidationInputSchema>;

// Project Plan Validator class
export class ProjectPlanValidator {
  private validationHistory: ValidationResult[] = [];

  async validateCompleteWorkflow(
    input: ValidationInput,
    apiKey?: string,
    model?: string
  ): Promise<ValidationReport> {
    const modelName = model ? `googleai/${model}` : 'googleai/gemini-1.5-pro-latest';
    
    const results: ValidationResult[] = [];
    
    // Run all enabled validation checks
    if (input.enableArchitectureValidation) {
      results.push(...await this.validateArchitectureConsistency(input, modelName, apiKey));
    }
    
    if (input.enableTaskDependencyValidation) {
      results.push(...await this.validateTaskDependencies(input, modelName, apiKey));
    }
    
    if (input.enableFileStructureAlignment) {
      results.push(...await this.validateFileStructureAlignment(input, modelName, apiKey));
    }
    
    if (input.enablePRDCoverageValidation) {
      results.push(...await this.validatePRDCoverage(input, modelName, apiKey));
    }

    // Generate comprehensive validation report
    const report = this.generateValidationReport(results);
    
    // Store in history for iterative improvement
    this.validationHistory.push(...results);

    return report;
  }

  private async validateArchitectureConsistency(
    input: ValidationInput,
    modelName: string,
    apiKey?: string
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    try {
      const prompt = `You are an expert software architect validating the consistency between project architecture, specifications, and generated tasks.

**Architecture:**
${input.architecture}

**Specifications:**  
${input.specifications}

**Tasks to Validate:**
${JSON.stringify(input.tasks, null, 2)}

## Validation Requirements

Check for consistency between the architecture/specifications and the generated tasks:

1. **Architecture-Task Alignment**: Do the tasks align with the proposed architecture?
2. **Specification Coverage**: Are all key requirements from specifications addressed in tasks?
3. **Technical Consistency**: Do the tasks use appropriate technologies and patterns mentioned in architecture?
4. **Scope Appropriateness**: Are the task scopes consistent with the architectural vision?

## Expected Output

Respond with ONLY a valid JSON object containing an array of "issues" where each issue has:
- type: "architecture_consistency"
- severity: "low", "medium", or "high"  
- message: Clear description of the inconsistency
- recommendations: Array of 1-3 specific suggestions to fix

Focus on identifying misalignments, omissions, or contradictions between the architecture and task generation.`;

      const { output } = await ai.generate({
        model: modelName,
        prompt: prompt,
        output: {
          schema: z.object({
            issues: z.array(z.object({
              severity: z.enum(['low', 'medium', 'high']),
              message: z.string(),
              recommendations: z.array(z.string()),
            }))
          })
        },
        config: apiKey ? { apiKey } : undefined,
      });

      const issues = output?.issues || [];
      
      for (const issue of issues) {
        results.push({
          id: `arch_cons_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'architecture_consistency',
          status: issue.severity === 'high' ? 'failed' : issue.severity === 'medium' ? 'warning' : 'passed',
          severity: issue.severity,
          message: issue.message,
          recommendations: issue.recommendations
        });
      }

    } catch (error) {
      console.error('Error in architecture validation:', error);
      
      // Fallback to basic consistency checks
      results.push({
        id: `arch_cons_fallback_${Date.now()}`,
        type: 'architecture_consistency',
        status: 'warning',
        severity: 'medium',
        message: 'AI-based architecture validation failed. Basic checks only.',
        recommendations: ['Verify that tasks align with the proposed architecture manually.']
      });
    }

    return results;
  }

  private async validateTaskDependencies(
    input: ValidationInput,
    modelName: string,
    apiKey?: string
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    try {
      const prompt = `You are an expert project manager validating task dependencies and logical sequencing.

**Generated Tasks:**
${JSON.stringify(input.tasks, null, 2)}

## Dependency Validation Requirements

Check the task dependencies and sequencing for:

1. **Circular Dependencies**: Are there any circular references that would block implementation?
2. **Logical Order**: Is the task sequence logical and dependency-aware?
3. **Missing Dependencies**: Are there prerequisites that should be dependencies but aren't listed?
4. **Dependency Accuracy**: Do the declared dependencies make sense for each task?

## Expected Output

Respond with ONLY a valid JSON object containing an array of "dependencyIssues" where each issue has:
- type: "task_dependency_validation"
- severity: "low", "medium", or "high"  
- message: Clear description of the dependency issue
- recommendations: Array of 1-3 specific suggestions to fix

Focus on identifying logical inconsistencies, missing dependencies, or circular references.`;

      const { output } = await ai.generate({
        model: modelName,
        prompt: prompt,
        output: {
          schema: z.object({
            dependencyIssues: z.array(z.object({
              severity: z.enum(['low', 'medium', 'high']),
              message: z.string(),
              recommendations: z.array(z.string()),
            }))
          })
        },
        config: apiKey ? { apiKey } : undefined,
      });

      const issues = output?.dependencyIssues || [];
      
      for (const issue of issues) {
        results.push({
          id: `dep_val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'task_dependency_validation',
          status: issue.severity === 'high' ? 'failed' : issue.severity === 'medium' ? 'warning' : 'passed',
          severity: issue.severity,
          message: issue.message,
          recommendations: issue.recommendations
        });
      }

    } catch (error) {
      console.error('Error in dependency validation:', error);
      
      // Fallback to basic dependency analysis
      const circularDeps = this.detectCircularDependencies(input.tasks);
      
      if (circularDeps.length > 0) {
        results.push({
          id: `dep_val_fallback_${Date.now()}`,
          type: 'task_dependency_validation',
          status: 'failed',
          severity: 'high',
          message: `Circular dependencies detected: ${circularDeps.join(', ')}`,
          recommendations: ['Resolve circular dependencies by reordering or breaking down tasks.']
        });
      } else {
        results.push({
          id: `dep_val_fallback_${Date.now()}`,
          type: 'task_dependency_validation',
          status: 'passed',
          severity: 'low',
          message: 'No circular dependencies detected in basic analysis.',
          recommendations: ['Consider running AI-powered dependency validation for deeper insights.']
        });
      }
    }

    return results;
  }

  private async validateFileStructureAlignment(
    input: ValidationInput,
    modelName: string,
    apiKey?: string
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    try {
      const prompt = `You are an expert software developer validating alignment between file structure and implementation tasks.

**File Structure:**
${input.fileStructure}

**Tasks to Validate Against File Structure:**
${JSON.stringify(input.tasks, null, 2)}

## File Structure Alignment Validation

Check for alignment between the proposed file structure and generated tasks:

1. **File-Task Consistency**: Do task implementations align with the proposed file locations?
2. **Missing Files/Components**: Are there files or components mentioned in tasks that aren't in the file structure?
3. **Excessive Files**: Are there files/structure elements that don't seem necessary for the generated tasks?
4. **Technology Stack Alignment**: Do file structure choices match the technologies implied in task descriptions?

## Expected Output

Respond with ONLY a valid JSON object containing an array of "alignmentIssues" where each issue has:
- type: "file_structure_alignment"
- severity: "low", "medium", or "high"  
- message: Clear description of the alignment issue
- recommendations: Array of 1-3 specific suggestions to fix

Focus on identifying mismatches between task requirements and file structure.`;

      const { output } = await ai.generate({
        model: modelName,
        prompt: prompt,
        output: {
          schema: z.object({
            alignmentIssues: z.array(z.object({
              severity: z.enum(['low', 'medium', 'high']),
              message: z.string(),
              recommendations: z.array(z.string()),
            }))
          })
        },
        config: apiKey ? { apiKey } : undefined,
      });

      const issues = output?.alignmentIssues || [];
      
      for (const issue of issues) {
        results.push({
          id: `file_align_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'file_structure_alignment',
          status: issue.severity === 'high' ? 'failed' : issue.severity === 'medium' ? 'warning' : 'passed',
          severity: issue.severity,
          message: issue.message,
          recommendations: issue.recommendations
        });
      }

    } catch (error) {
      console.error('Error in file structure validation:', error);
      
      // Fallback to basic alignment checks
      results.push({
        id: `file_align_fallback_${Date.now()}`,
        type: 'file_structure_alignment',
        status: 'warning',
        severity: 'medium',
        message: 'AI-based file structure validation failed. Basic checks only.',
        recommendations: ['Verify that task implementations align with the proposed file structure manually.']
      });
    }

    return results;
  }

  private async validatePRDCoverage(
    input: ValidationInput,
    modelName: string,
    apiKey?: string
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    try {
      const prompt = `You are a product requirements analyst validating that generated tasks fully cover the PRD.

**PRD:**
${input.prd}

**Generated Tasks and Implementation Details:**
${JSON.stringify(input.tasks, null, 2)}

## PRD Coverage Validation

Check that the generated tasks comprehensively address all aspects of the PRD:

1. **Feature Coverage**: Do all major features from the PRD have corresponding implementation tasks?
2. **Requirement Fulfillment**: Are all stated requirements addressed in the task breakdown?
3. **User Stories Coverage**: Do user stories translate into appropriate implementation tasks?
4. **Edge Cases and Error Handling**: Are error scenarios, validation, and edge cases addressed?

## Expected Output

Respond with ONLY a valid JSON object containing an array of "coverageGaps" where each gap has:
- type: "prd_coverage"
- severity: "low", "medium", or "high"  
- message: Clear description of what's missing from PRD coverage
- recommendations: Array of 1-3 specific suggestions to add or modify tasks

Focus on identifying gaps between PRD requirements and task coverage.`;

      const { output } = await ai.generate({
        model: modelName,
        prompt: prompt,
        output: {
          schema: z.object({
            coverageGaps: z.array(z.object({
              severity: z.enum(['low', 'medium', 'high']),
              message: z.string(),
              recommendations: z.array(z.string()),
            }))
          })
        },
        config: apiKey ? { apiKey } : undefined,
      });

      const gaps = output?.coverageGaps || [];
      
      for (const gap of gaps) {
        results.push({
          id: `prd_coverage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'prd_coverage',
          status: gap.severity === 'high' ? 'failed' : gap.severity === 'medium' ? 'warning' : 'passed',
          severity: gap.severity,
          message: gap.message,
          recommendations: gap.recommendations
        });
      }

    } catch (error) {
      console.error('Error in PRD coverage validation:', error);
      
      // Fallback to basic keyword-based analysis
      const prdKeywords = this.extractPRDKeywords(input.prd);
      const taskCoverage = this.analyzeTaskKeywordCoverage(prdKeywords, input.tasks);
      
      if (taskCoverage.missingKeywords.length > 0) {
        results.push({
          id: `prd_coverage_fallback_${Date.now()}`,
          type: 'prd_coverage',
          status: 'warning',
          severity: taskCoverage.missingKeywords.length > 3 ? 'high' : 'medium',
          message: `PRD coverage incomplete. Missing keywords: ${taskCoverage.missingKeywords.slice(0, 5).join(', ')}${taskCoverage.missingKeywords.length > 5 ? '...' : ''}`,
          recommendations: ['Review PRD and add tasks for uncovered requirements.']
        });
      } else {
        results.push({
          id: `prd_coverage_fallback_${Date.now()}`,
          type: 'prd_coverage',
          status: 'passed',
          severity: 'low',
          message: 'Basic PRD keyword coverage analysis passed.',
          recommendations: ['Consider running AI-powered validation for comprehensive requirement coverage.']
        });
      }
    }

    return results;
  }

  private detectCircularDependencies(tasks: Task[]): string[] {
    const graph = new Map<string, Set<string>>();
    
    // Build dependency graph
    for (const task of tasks) {
      if (!graph.has(task.title)) {
        graph.set(task.title, new Set());
      }
      
      for (const dep of task.dependencies) {
        if (!graph.has(dep)) {
          graph.set(dep, new Set());
        }
        graph.get(task.title)!.add(dep);
      }
    }

    // Detect cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[] = [];

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        this.dfsDetectCycles(node, visited, recursionStack, graph, cycles);
      }
    }

    return cycles;
  }

  private dfsDetectCycles(
    node: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    graph: Map<string, Set<string>>,
    cycles: string[]
  ): void {
    visited.add(node);
    recursionStack.add(node);

    const neighbors = graph.get(node) || new Set();
    
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        this.dfsDetectCycles(neighbor, visited, recursionStack, graph, cycles);
      } else if (recursionStack.has(neighbor)) {
        // Cycle detected
        cycles.push(`Cycle: ${neighbor} → ... → ${node}`);
      }
    }

    recursionStack.delete(node);
  }

  private extractPRDKeywords(prd: string): Set<string> {
    // Extract meaningful keywords from PRD
    const words = prd.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    return new Set(words.filter(word => 
      !['this', 'that', 'with', 'from', 'they', 'have', 'will'].includes(word)
    ));
  }

  private analyzeTaskKeywordCoverage(prdKeywords: Set<string>, tasks: Task[]): { missingKeywords: string[]; coveredRatio: number } {
    const taskText = tasks.map(task => `${task.title} ${task.details}`).join(' ').toLowerCase();
    const coveredKeywords = new Set<string>();
    
    for (const keyword of prdKeywords) {
      if (taskText.includes(keyword)) {
        coveredKeywords.add(keyword);
      }
    }

    const missingKeywords = Array.from(prdKeywords).filter(k => !coveredKeywords.has(k));
    
    return {
      missingKeywords,
      coveredRatio: prdKeywords.size > 0 ? coveredKeywords.size / prdKeywords.size : 0
    };
  }

  private generateValidationReport(results: ValidationResult[]): ValidationReport {
    const totalChecks = results.length;
    
    if (totalChecks === 0) {
      return {
        overallStatus: 'passed',
        totalChecks: 0,
        passedChecks: 0,
        failedChecks: 0,
        warningChecks: 0,
        results: [],
        summary: 'No validation checks performed.'
      };
    }

    const passedChecks = results.filter(r => r.status === 'passed').length;
    const failedChecks = results.filter(r => r.status === 'failed').length;
    const warningChecks = results.filter(r => r.status === 'warning').length;

    let overallStatus: ValidationReport['overallStatus'] = 'passed';
    
    if (failedChecks > 0) {
      overallStatus = 'failed';
    } else if (warningChecks > 0) {
      overallStatus = 'warning';
    }

    // Generate summary
    const criticalIssues = results.filter(r => r.severity === 'high' && r.status !== 'passed');
    const summary = this.generateSummary(results, criticalIssues);

    return {
      overallStatus,
      totalChecks,
      passedChecks,
      failedChecks,
      warningChecks,
      results,
      summary
    };
  }

  private generateSummary(results: ValidationResult[], criticalIssues: ValidationResult[]): string {
    if (criticalIssues.length > 0) {
      return `⚠️ Critical issues detected: ${criticalIssues.map(i => i.message).join('; ')}`;
    }

    const failedChecks = results.filter(r => r.status === 'failed').length;
    if (failedChecks > 0) {
      return `❌ ${failedChecks} validation checks failed. Review recommendations for fixes.`;
    }

    const warningChecks = results.filter(r => r.status === 'warning').length;
    if (warningChecks > 0) {
      return `⚠️ ${warningChecks} validation warnings. Consider addressing these for optimal project planning.`;
    }

    return '✅ All validation checks passed. The project plan appears consistent and complete.';
  }
}

// Export the main validation function
export async function validateProjectPlan(
  input: ValidationInput,
  apiKey?: string,
  model?: string
): Promise<ValidationReport> {
  const validator = new ProjectPlanValidator();
  
  try {
    return await validator.validateCompleteWorkflow(input, apiKey, model);
  } catch (error) {
    console.error('Error in project plan validation:', error);
    
    // Return a basic report with the error
    return {
      overallStatus: 'warning',
      totalChecks: 1,
      passedChecks: 0,
      failedChecks: 0,
      warningChecks: 1,
      results: [{
        id: `validation_error_${Date.now()}`,
        type: 'architecture_consistency',
        status: 'warning',
        severity: 'medium',
        message: `Validation failed: ${(error as Error).message}`,
        recommendations: ['Try running validation again with different parameters or check your API configuration.']
      }],
      summary: 'Validation encountered an error. See results for details.'
    };
  }
}

