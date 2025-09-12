'use server';

/**
 * @fileOverview Iterative refinement system that continuously improves project consistency
 */

import { UnifiedProjectContext, ValidationResult } from '@/types/unified-context';
import { ContextValidator } from '@/ai/validation/context-validator';
import { generateTasks } from '@/ai/flows/generate-tasks';
import { generateArchitecture } from '@/ai/flows/generate-architecture';
import { ai } from '@/ai/litellm';
import { z } from 'zod';

const RefinementSuggestionSchema = z.object({
  component: z.enum(['architecture', 'fileStructure', 'specifications', 'tasks', 'dependencies']),
  issue: z.string(),
  suggestion: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  reasoning: z.string(),
});

type RefinementSuggestion = z.infer<typeof RefinementSuggestionSchema>;

const RefinementAnalysisSchema = z.object({
  overallConsistency: z.number().min(0).max(100).describe('Overall consistency score 0-100'),
  criticalIssues: z.array(z.string()).describe('Critical issues that must be addressed'),
  suggestions: z.array(RefinementSuggestionSchema),
  recommendedAction: z.enum(['accept', 'refine_architecture', 'refine_tasks', 'refine_specifications', 'major_revision']),
});

export type RefinementAnalysis = z.infer<typeof RefinementAnalysisSchema>;

export class IterativeRefinementEngine {
  
  /**
   * Build consistency analysis prompt
   */
  private buildConsistencyAnalysisPrompt(
    context: UnifiedProjectContext,
    validationResults: ValidationResult[]
  ): string[] {
    const sections = [
      `PROJECT COMPONENTS:
===============================================`,

      `PRD (Product Requirements Document):
${context.prd || 'No PRD available'}`,

      `ARCHITECTURE:
${context.architecture || 'No architecture available'}`,

      `SPECIFICATIONS:
${context.specifications || 'No specifications available'}`,

      `FILE STRUCTURE:
${context.fileStructure}`,

      `TASKS (${context.tasks.length} total):
${this.formatTasksForAnalysis(context.tasks)}`,

      `VALIDATION ISSUES FOUND:
========================
${this.formatValidationResults(validationResults)}`,

      `ANALYSIS REQUIREMENTS:
=====================`,

      this.buildConsistencyScoringSection(),

      `2. CRITICAL ISSUES: Identify issues that would prevent successful implementation:
   - Missing essential components
   - Logical contradictions
   - Impossible dependencies
   - Architecture-implementation mismatches`,

      `3. REFINEMENT SUGGESTIONS: For each identified issue, provide:
   - Specific component to modify
   - Clear description of the problem
   - Actionable suggestion for improvement
   - Priority level and reasoning`,

      `4. RECOMMENDED ACTION: Choose the most appropriate next step:
   - accept: Project is sufficiently consistent
   - refine_architecture: Architecture needs revision
   - refine_tasks: Task breakdown needs improvement
   - refine_specifications: Specifications need clarification
   - major_revision: Fundamental issues require major changes`
    ];

    return sections;
  }

  /**
   * Format tasks for analysis
   */
  private formatTasksForAnalysis(tasks: any[]): string {
    if (!tasks || tasks.length === 0) return 'No tasks available';

    return tasks.map(t => {
      const title = (t.title || '').length > 50 ? (t.title || '').substring(0, 50) + '...' : (t.title || '');
      const details = (t.details || '').length > 200 ? (t.details || '').substring(0, 200) + '...' : (t.details || '');
      
      return `${t.id} (order: ${t.order}): ${title}
Dependencies: [${(t.dependencies || []).join(', ') || 'none'}]
Details: ${details}`;
    }).join('\n\n');
  }



  /**
   * Format validation results for analysis display
   */
  private formatValidationResults(results: ValidationResult[]): string {
    return results.map(v => 
      `${v.severity.toUpperCase()}: ${this.truncateText(v.issues.join(', '), 100)}`
    ).join('\n');
  }

  /**
   * Build consistency scoring section
   */
  private buildConsistencyScoringSection(): string {
    return `1. CONSISTENCY SCORING: Rate overall consistency 0-100 considering:
   - PRD requirements coverage in architecture
   - Architecture reflection in file structure  
   - Task completeness for implementing specifications
   - Logical task ordering and dependencies
   - Technical feasibility of the proposed solution`;
  }

  /**
   * Truncate text to specified length
   */
  private truncateText(text: string, maxLength: number): string {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  async analyzeProjectConsistency(
    context: UnifiedProjectContext,
    apiKey?: string,
    model?: string,
    apiBase?: string
  ): Promise<RefinementAnalysis> {
    
    // First run structural validation
    const validationResults = ContextValidator.validateFullContext(context);
    
    // Then perform AI-powered consistency analysis
    const promptSections = this.buildConsistencyAnalysisPrompt(context, validationResults);
    
    // Combine all sections for the final prompt
    const prompt = `You are an expert software architect conducting a comprehensive consistency analysis of a project plan. Analyze the following project components for logical consistency, completeness, and alignment.

${promptSections.join('\n\n')}

Provide your analysis as a JSON object conforming to the schema.`;

    if (!model) {
      throw new Error('Model is required. Please provide a model in "provider/model" format in settings.');
    }
    const modelName = model;
    
    const { output } = await ai.generate({
      model: modelName,
      prompt: prompt,
      output: { schema: RefinementAnalysisSchema },
      config: { 
        ...(apiKey ? { apiKey } : {}),
        ...(apiBase ? { apiBase } : {})
      },
    });

    if (!output) {
      throw new Error('Failed to generate refinement analysis');
    }

    return output as typeof RefinementAnalysisSchema._type;
  }

  async applyRefinements(
    context: UnifiedProjectContext,
    analysis: RefinementAnalysis,
    apiKey?: string,
    model?: string,
    apiBase?: string
  ): Promise<UnifiedProjectContext> {
    
    let refinedContext = { ...context };
    
    // Apply refinements based on recommended action
    switch (analysis.recommendedAction) {
      case 'refine_architecture':
        refinedContext = await this.refineArchitecture(refinedContext, analysis.suggestions, apiKey, model, apiBase);
        break;
        
      case 'refine_tasks':
        refinedContext = await this.refineTasks(refinedContext, analysis.suggestions, apiKey, model, apiBase);
        break;
        
      case 'refine_specifications':
        refinedContext = await this.refineSpecifications(refinedContext, analysis.suggestions, apiKey, model, apiBase);
        break;
        
      case 'major_revision':
        refinedContext = await this.performMajorRevision(refinedContext, analysis, apiKey, model, apiBase);
        break;
        
      case 'accept':
        // No changes needed
        break;
    }
    
    // Update version and timestamp
    refinedContext.version += 1;
    refinedContext.lastUpdated = new Date().toISOString();
    
    // Add refinement to validation history
    refinedContext.validationHistory.push({
      isValid: analysis.overallConsistency >= 80,
      issues: analysis.criticalIssues,
      component: 'dependencies', // Represents overall project consistency
      severity: analysis.criticalIssues.length > 0 ? 'error' : 'info',
    });
    
    return refinedContext;
  }

  private async refineArchitecture(
    context: UnifiedProjectContext,
    suggestions: RefinementSuggestion[],
    apiKey?: string,
    model?: string,
    apiBase?: string
  ): Promise<UnifiedProjectContext> {
    
    const archSuggestions = suggestions.filter(s => s.component === 'architecture');
    if (archSuggestions.length === 0) return context;
    
    const refinementPrompt = `Refine the following architecture based on specific improvement suggestions:

CURRENT ARCHITECTURE:
${context.architecture}

PRD FOR CONTEXT:
${context.prd}

SPECIFIC IMPROVEMENTS NEEDED:
${archSuggestions.map(s => `- ${s.issue}: ${s.suggestion} (Priority: ${s.priority})`).join('\n')}

Provide a refined architecture that addresses these specific issues while maintaining the core design intent.`;

    if (!model) {
      throw new Error('Model is required. Please provide a model in "provider/model" format in settings.');
    }
    const modelName = model;
    
    const { output } = await ai.generate({
      model: modelName,
      prompt: refinementPrompt,
      config: { 
        ...(apiKey ? { apiKey } : {}),
        ...(apiBase ? { apiBase } : {})
      },
    });

    return {
      ...context,
      architecture: (output as string) || context.architecture,
    };
  }

  private async refineTasks(
    context: UnifiedProjectContext,
    suggestions: RefinementSuggestion[],
    apiKey?: string,
    model?: string,
    apiBase?: string
  ): Promise<UnifiedProjectContext> {
    
    const taskSuggestions = suggestions.filter(s => s.component === 'tasks' || s.component === 'dependencies');
    if (taskSuggestions.length === 0) return context;
    
    // Regenerate tasks with specific improvements
    const improvedTaskResult = await generateTasks(
      {
        architecture: context.architecture,
        specifications: context.specifications,
        fileStructure: context.fileStructure,
      },
      apiKey,
      model,
      apiBase
    );
    
    // Transform to unified format with better dependency inference
    const improvedTasks = improvedTaskResult.tasks.map((task, index) => ({
      ...task,
      id: `task-${index + 1}`,
      order: index + 1,
      dependencies: this.improvedDependencyInference(task.title, improvedTaskResult.tasks, index, suggestions),
      status: 'pending' as const,
    }));
    
    return {
      ...context,
      tasks: improvedTasks,
    };
  }

  private async refineSpecifications(
    context: UnifiedProjectContext,
    suggestions: RefinementSuggestion[],
    apiKey?: string,
    model?: string,
    apiBase?: string
  ): Promise<UnifiedProjectContext> {
    
    const specSuggestions = suggestions.filter(s => s.component === 'specifications');
    if (specSuggestions.length === 0) return context;
    
    const refinementPrompt = `Refine the following specifications based on improvement suggestions:

CURRENT SPECIFICATIONS:
${context.specifications}

ARCHITECTURE FOR CONTEXT:
${context.architecture}

IMPROVEMENTS NEEDED:
${specSuggestions.map(s => `- ${s.issue}: ${s.suggestion}`).join('\n')}

Provide refined specifications that address these issues.`;

    if (!model) {
      throw new Error('Model is required. Please provide a model in "provider/model" format in settings.');
    }
    const modelName = model;
    
    const { output } = await ai.generate({
      model: modelName,
      prompt: refinementPrompt,
      config: { 
        ...(apiKey ? { apiKey } : {}),
        ...(apiBase ? { apiBase } : {})
      },
    });

    return {
      ...context,
      specifications: (output as string) || context.specifications,
    };
  }

  private async performMajorRevision(
    context: UnifiedProjectContext,
    analysis: RefinementAnalysis,
    apiKey?: string,
    model?: string,
    apiBase?: string
  ): Promise<UnifiedProjectContext> {
    
    // Major revision: regenerate architecture and cascade changes
    const archResult = await generateArchitecture(
      { prd: context.prd },
      apiKey,
      model,
      apiBase
    );
    
    // This would trigger a complete regeneration workflow
    return {
      ...context,
      architecture: archResult.architecture,
      specifications: archResult.specifications,
      tasks: [], // Will be regenerated
    };
  }

  private improvedDependencyInference(
    taskTitle: string,
    allTasks: Array<{ title: string }>,
    currentIndex: number,
    suggestions: RefinementSuggestion[]
  ): string[] {
    
    const dependencies: string[] = [];
    const lowerTitle = taskTitle.toLowerCase();
    
    // Enhanced dependency logic based on suggestions
    const dependencySuggestions = suggestions.filter(s => 
      s.component === 'dependencies' && s.suggestion.toLowerCase().includes(taskTitle.toLowerCase())
    );
    
    // Apply specific dependency suggestions
    dependencySuggestions.forEach(suggestion => {
      const matches = suggestion.suggestion.match(/depends on (?:task )?(\d+)/i);
      if (matches) {
        dependencies.push(`task-${matches[1]}`);
      }
    });
    
    // Improved heuristics
    if (lowerTitle.includes('test') && !lowerTitle.includes('setup')) {
      // Testing tasks depend on the feature they test
      const featureTasks = allTasks.slice(0, currentIndex).filter((t) => 
        !t.title.toLowerCase().includes('test') && !t.title.toLowerCase().includes('setup')
      );
      if (featureTasks.length > 0) {
        dependencies.push(`task-${allTasks.indexOf(featureTasks[featureTasks.length - 1]) + 1}`);
      }
    }
    
    // Database tasks need setup
    if (lowerTitle.includes('database') || lowerTitle.includes('model')) {
      const setupTasks = allTasks.slice(0, currentIndex).filter(t => 
        t.title.toLowerCase().includes('setup') || t.title.toLowerCase().includes('configure')
      );
      if (setupTasks.length > 0) {
        dependencies.push(`task-${allTasks.indexOf(setupTasks[0]) + 1}`);
      }
    }
    
    return [...new Set(dependencies)]; // Remove duplicates
  }
}