


import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Import dependencies
import {
  ProjectContextManager,
  getGlobalContextManager
} from './context-manager-class';
import { TaskGenerationOutput } from './task-orchestrator-class';

/**
 * @fileOverview Project Plan Validator - Validates consistency across project components
 */

// Define input schema for validation
export const ValidationInputSchema = z.object({
  prd: z.string().describe('The Product Requirements Document (PRD) for the project.'),
  architecture: z.string(),
  specifications: z.string(), 
  fileStructure: z.string(),
  tasks: z.array(z.object({
    title: z.string(),
    details: z.string(),
    dependencies: z.array(z.string()),
    priority: z.enum(['low', 'medium', 'high']),
    estimatedDuration: z.number(),
    category: z.enum(['setup', 'infrastructure', 'feature', 'testing', 'documentation']),
    validationNotes: z.array(z.string()),
  })),
  
  // Validation flags
  enableArchitectureValidation: z.boolean().optional().default(true),
  enableTaskDependencyValidation: z.boolean().optional().default(true),
  enableFileStructureAlignment: z.boolean().optional().default(true),
  enablePRDCoverageValidation: z.boolean().optional().default(true)
});

export type ValidationInput = z.infer<typeof ValidationInputSchema>;

// Define the output schema
export const ValidationResultSchema = z.object({
  overallStatus: z.enum(['passed', 'failed', 'warning']),
  totalChecks: z.number(),
  passedChecks: z.number(),
  failedChecks: z.number(), 
  warningChecks: z.number(),
  results: z.array(z.object({
    id: z.string(),
    type: z.enum(['architecture_consistency', 'task_dependency_validation', 'file_structure_alignment', 'prd_coverage_validation']),
    status: z.enum(['passed', 'failed', 'warning']),
    severity: z.enum(['low', 'medium', 'high']),
    message: z.string(),
    recommendations: z.array(z.string()),
  })),
  summary: z.string()
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;

// Project Plan Validator class
export class ProjectPlanValidator {
    private contextManager: ProjectContextManager;

    constructor(contextManager?: ProjectContextManager) {
      this.contextManager = contextManager || getGlobalContextManager();
    }

    async validateProjectPlan(
      input: ValidationInput,
      apiKey?: string, 
      model?: string
    ): Promise<ValidationResult> {
      
      const results: ValidationResult['results'] = [];
      let passedChecks = 0;
      let failedChecks = 0; 
      let warningChecks = 0;

      // Architecture Consistency Validation
      if (input.enableArchitectureValidation) {
        const archResult = this.validateArchitectureConsistency(input);
        
        if (archResult.status === 'passed') passedChecks++;
        else if (archResult.status === 'failed') failedChecks++;
        else warningChecks++;

        results.push(archResult);
      }

      // Task Dependency Validation
      if (input.enableTaskDependencyValidation) {
        const depResult = this.validateTaskDependencies(input);
        
        if (depResult.status === 'passed') passedChecks++;
        else if (depResult.status === 'failed') failedChecks++;
        else warningChecks++;

        results.push(depResult);
      }

      // File Structure Alignment Validation
      if (input.enableFileStructureAlignment) {
        const fsResult = this.validateFileStructureAlignment(input);
        
        if (fsResult.status === 'passed') passedChecks++;
        else if (fsResult.status === 'failed') failedChecks++;
        else warningChecks++;

        results.push(fsResult);
      }

      // PRD Coverage Validation
      if (input.enablePRDCoverageValidation) {
        const prdResult = this.validatePRDCoverage(input);
        
        if (prdResult.status === 'passed') passedChecks++;
        else if (prdResult.status === 'failed') failedChecks++;
        else warningChecks++;

        results.push(prdResult);
      }

      // Determine overall status
      let overallStatus: ValidationResult['overallStatus'] = 'passed';
      if (failedChecks > 0) {
        overallStatus = 'failed';
      } else if (warningChecks > 0 || results.length === 0) {
        overallStatus = 'warning';
      }

      // Generate summary
      const summary = this.generateValidationSummary(
        overallStatus, 
        passedChecks, 
        failedChecks, 
        warningChecks,
        results.length
      );

      return {
        overallStatus,
        totalChecks: results.length,
        passedChecks,
        failedChecks, 
        warningChecks,
        results,
        summary
      };
    }

    private validateArchitectureConsistency(input: ValidationInput): ValidationResult['results'][0] {
      const issues: string[] = [];
      const recommendations: string[] = [];

      // Check if architecture covers key aspects mentioned in PRD
      const lowerPrd = (input.prd as string).toLowerCase();
      
      // Check for missing architectural components based on PRD keywords
      if (lowerPrd.includes('api') && !(input.architecture as string).toLowerCase().includes('endpoint')) {
        issues.push("PRD mentions APIs but architecture doesn't address API design");
      }

      if (lowerPrd.includes('database') && !(input.architecture as string).toLowerCase().includes('storage')) {
        issues.push("PRD mentions databases but architecture doesn't address data storage");
      }

      if (lowerPrd.includes('user') && !(input.architecture as string).toLowerCase().includes('interface')) {
        issues.push("PRD mentions users but architecture doesn't address user interface");
      }

      // Check if tasks align with architectural decisions
      const hasApiTasks = (input.tasks as any[]).some((task: any) => 
        task.title.toLowerCase().includes('api') || 
        task.details.toLowerCase().includes('endpoint')
      );

      const hasDatabaseTasks = (input.tasks as any[]).some((task: any) => 
        task.title.toLowerCase().includes('database') || 
        task.details.toLowerCase().includes('schema')
      );

      if ((input.architecture as string).toLowerCase().includes('api') && !hasApiTasks) {
        recommendations.push("Consider adding API implementation tasks to align with architecture");
      }

      if ((input.architecture as string).toLowerCase().includes('database') && !hasDatabaseTasks) {
        recommendations.push("Consider adding database setup tasks to align with architecture");
      }

      // Determine status based on issues
      let status: ValidationResult['results'][0]['status'] = 'passed';
      if (issues.length > 2) {
        status = 'failed';
      } else if (issues.length > 0 || recommendations.length > 2) {
        status = 'warning';
      }

      return {
        id: 'architecture_consistency',
        type: 'architecture_consistency' as const,
        status,
        severity: issues.length > 2 ? 'high' : (issues.length > 0 || recommendations.length > 2 ? 'medium' : 'low'),
        message: issues.length > 0 
          ? `Architecture consistency issues found: ${issues.join('; ')}`
          : 'Architecture validation passed with minor recommendations',
        recommendations
      };
    }

    private validateTaskDependencies(input: ValidationInput): ValidationResult['results'][0] {
      const issues: string[] = [];
      const recommendations: string[] = [];

      // Check for circular dependencies
      const taskTitles = new Set((input.tasks as any[]).map((t: any) => t.title));
      
      for (const task of input.tasks as any[]) {
        // Check if dependencies exist
        const missingDeps = (task.dependencies || []).filter((dep: any) => !taskTitles.has(dep));
        if (missingDeps.length > 0) {
          issues.push(`Task "${task.title}" references non-existent dependency: ${missingDeps.join(', ')}`);
        }

        // Check for self-dependencies
        if (task.dependencies?.includes(task.title)) {
          issues.push(`Task "${task.title}" has self-dependency`);
        }
      }

      // Check for setup tasks
      const setupTasks = (input.tasks as any[]).filter((t: any) => t.category === 'setup');
      if (setupTasks.length === 0) {
        recommendations.push("Consider adding setup tasks before implementation tasks");
      }

      // Check if high priority tasks have appropriate dependencies
      const highPriorityTasks = (input.tasks as any[]).filter((t: any) => t.priority === 'high');
      for (const task of highPriorityTasks as any[]) {
        if ((task.dependencies || []).length === 0 && 
            (task.category === 'infrastructure' || task.category === 'feature')) {
          recommendations.push(`High priority "${task.title}" should consider dependencies`);
        }
      }

      // Determine status
      let status: ValidationResult['results'][0]['status'] = 'passed';
      if (issues.length > 2) {
        status = 'failed';
      } else if (issues.length > 0 || recommendations.length > 3) {
        status = 'warning';
      }

      return {
        id: 'task_dependency_validation',
        type: 'task_dependency_validation' as const,
        status,
        severity: issues.length > 2 ? 'high' : (issues.length > 0 || recommendations.length > 3 ? 'medium' : 'low'),
        message: issues.length > 0 
          ? `Task dependency validation found ${issues.length} issue(s)`
          : 'Task dependencies are well-structured',
        recommendations
      };
    }

    private validateFileStructureAlignment(input: ValidationInput): ValidationResult['results'][0] {
      const issues: string[] = [];
      const recommendations: string[] = [];

      // Check if file structure matches tasks
      const hasFrontendTasks = (input.tasks as any[]).some((t: any) => 
        t.title.toLowerCase().includes('frontend') || 
        t.title.toLowerCase().includes('ui')
      );

      const hasBackendTasks = (input.tasks as any[]).some((t: any) => 
        t.title.toLowerCase().includes('backend') || 
        t.title.toLowerCase().includes('api')
      );

      const hasTestTasks = (input.tasks as any[]).some((t: any) => 
        t.title.toLowerCase().includes('test')
      );

      // Check file structure for corresponding directories
      const lowerFileStructure = (input.fileStructure as string).toLowerCase();

      if (hasFrontendTasks && !lowerFileStructure.includes('src')) {
        recommendations.push("Consider organizing frontend files in a src/ directory");
      }

      if (hasBackendTasks && !lowerFileStructure.includes('server') && !lowerFileStructure.includes('api')) {
        recommendations.push("Consider organizing backend files in a server/ or api/ directory");
      }

      if (hasTestTasks && !lowerFileStructure.includes('test')) {
        recommendations.push("Consider adding a tests/ directory for test files");
      }

      // Check if file structure follows common patterns
      const hasPackageJson = lowerFileStructure.includes('package.json');
      if (!hasPackageJson && input.tasks.length > 0) {
        recommendations.push("Add package.json for dependency management");
      }

      // Determine status
      let status: ValidationResult['results'][0]['status'] = 'passed';
      if (issues.length > 2) {
        status = 'failed';
      } else if (recommendations.length > 3) {
        status = 'warning';
      }

      return {
        id: 'file_structure_alignment',
        type: 'file_structure_alignment' as const,
        status,
        severity: recommendations.length > 3 ? 'medium' : 'low',
        message: recommendations.length > 0 
          ? `File structure alignment has ${recommendations.length} recommendation(s)`
          : 'File structure is well-aligned with project tasks',
        recommendations
      };
    }

    private validatePRDCoverage(input: ValidationInput): ValidationResult['results'][0] {
      const issues: string[] = [];
      const recommendations: string[] = [];

      // Extract key requirements from PRD
      const prdLines = (input.prd as string).split('\n').filter((line: any) => line.trim().length > 3);
      const prdKeywords = new Set(prdLines.map((line: any) => 
        line.toLowerCase().replace(/[^\w\s]/g, '').trim()
      ));

      // Check if tasks cover PRD requirements
      const taskText = (input.tasks as any[]).map((t: any) => 
        `${t.title} ${t.details}`.toLowerCase()
      ).join(' ');

      const coveredKeywords = new Set(
        prdLines.filter((line: any) => 
          taskText.includes(line.toLowerCase().replace(/[^\w\s]/g, ''))
        ).map((line: any) => 
          line.toLowerCase().replace(/[^\w\s]/g, '').trim()
        )
      );

      const coverageRatio = coveredKeywords.size / prdKeywords.size;

      if (coverageRatio < 0.5) {
        issues.push(`Tasks only cover ${Math.round(coverageRatio * 100)}% of PRD requirements`);
      } else if (coverageRatio < 0.8) {
        recommendations.push(`Tasks cover ${Math.round(coverageRatio * 100)}% of PRD requirements - consider adding more specific tasks`);
      }

      // Check for critical task categories based on PRD
      if ((input.prd as string).toLowerCase().includes('user')) {
        const userTasks = (input.tasks as any[]).filter((t: any) => 
          t.title.toLowerCase().includes('user') || 
          t.details.toLowerCase().includes('authentication')
        );
        
        if (userTasks.length === 0) {
          recommendations.push("Consider adding user-related tasks based on PRD requirements");
        }
      }

      // Determine status
      let status: ValidationResult['results'][0]['status'] = 'passed';
      if (issues.length > 1) {
        status = 'failed';
      } else if (issues.length > 0 || coverageRatio < 0.7) {
        status = 'warning';
      }

      return {
        id: 'prd_coverage_validation',
        type: 'prd_coverage_validation' as const,
        status,
        severity: issues.length > 1 ? 'high' : (issues.length > 0 || coverageRatio < 0.7 ? 'medium' : 'low'),
        message: issues.length > 0 
          ? `PRD coverage validation found ${issues.length} issue(s)`
          : 'Tasks adequately cover PRD requirements',
        recommendations
      };
    }

    private generateValidationSummary(
      overallStatus: ValidationResult['overallStatus'],
      passedChecks: number,
      failedChecks: number, 
      warningChecks: number,
      totalChecks: number
    ): string {
      
      if (overallStatus === 'passed') {
        return `All ${totalChecks} validation checks passed. The project plan is well-structured and ready for implementation.`;
      }

      if (overallStatus === 'failed') {
        return `${totalChecks} validation checks performed: ${passedChecks} passed, ${failedChecks} failed. Critical issues need to be addressed before proceeding.`;
      }

      return `${totalChecks} validation checks performed: ${passedChecks} passed, ${warningChecks} warnings. Review recommendations for improvements.`;
    }
}


