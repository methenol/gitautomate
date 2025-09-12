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
   * Build consistency analysis prompt with intelligent context compression
   */
  private buildConsistencyAnalysisPrompt(
    context: UnifiedProjectContext,
    validationResults: ValidationResult[]
  ): string[] {
    
    const sections = [
      // Introduction section
      `PROJECT COMPONENTS:
==================`,

      // PRD section with intelligent compression
      `PRD (Product Requirements Document):
${this.compressContextSection(context.prd, 1000, 'PRD')}`,

      // Architecture section with compression
      `ARCHITECTURE:
${this.compressContextSection(context.architecture, 800, 'Architecture')}`,

      // Specifications section with compression
      `SPECIFICATIONS:
${this.compressContextSection(context.specifications, 800, 'Specifications')}`,

      // File structure section with compression
      `FILE STRUCTURE:
${this.compressContextSection(context.fileStructure, 400, 'File Structure')}`,

      // Tasks section with optimized formatting
      `TASKS (${context.tasks.length} total):
${this.formatTasksForAnalysisOptimized(context.tasks)}`,

      // Validation issues section
      `VALIDATION ISSUES FOUND:
========================
${this.formatValidationResults(validationResults)}`,

      // Analysis requirements section
      `ANALYSIS REQUIREMENTS:
=====================`,

      // Consistency scoring sub-section
      this.buildConsistencyScoringSection(),

      // Critical issues section  
      `2. CRITICAL ISSUES: Identify issues that would prevent successful implementation:
   - Missing essential components
   - Logical contradictions
   - Impossible dependencies
   - Architecture-implementation mismatches`,

      // Refinement suggestions section
      `3. REFINEMENT SUGGESTIONS: For each identified issue, provide:
   - Specific component to modify
   - Clear description of the problem
   - Actionable suggestion for improvement
   - Priority level and reasoning`,

      // Recommended action section
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
   * Compress context sections intelligently while preserving critical information
   */
  private compressContextSection(content: string, maxTokens: number, sectionType: string): string {
    if (!content || content.length <= maxTokens * 4) { // Rough token estimation: 1 token ≈ 4 chars
      return content;
    }

    // Extract key information based on section type
    switch (sectionType) {
      case 'PRD':
        return this.compressPRD(content, maxTokens);
      case 'Architecture':
        return this.compressArchitecture(content, maxTokens);
      case 'Specifications':
        return this.compressSpecifications(content, maxTokens);
      case 'File Structure':
        return this.compressFileStructure(content, maxTokens);
      default:
        return this.genericCompress(content, maxTokens);
    }
  }

  /**
   * Compress PRD while preserving core requirements
   */
  private compressPRD(content: string, maxTokens: number): string {
    const lines = content.split('\n');
    const keyLines: string[] = [];
    const maxChars = maxTokens * 4;

    // Prioritize lines with requirements, features, and goals
    const priorityKeywords = ['requirement', 'feature', 'goal', 'objective', 'user', 'function', 'must', 'should', 'will'];
    const importantLines = lines.filter(line => 
      priorityKeywords.some(keyword => line.toLowerCase().includes(keyword))
    );

    let totalChars = 0;
    // Add important lines first
    for (const line of importantLines) {
      if (totalChars + line.length > maxChars) break;
      keyLines.push(line);
      totalChars += line.length;
    }

    // Fill remaining space with other content
    for (const line of lines) {
      if (keyLines.includes(line)) continue;
      if (totalChars + line.length > maxChars) break;
      keyLines.push(line);
      totalChars += line.length;
    }

    const compressed = keyLines.join('\n');
    return compressed.length < content.length 
      ? compressed + '\n\n[Content compressed to preserve essential requirements]'
      : content;
  }

  /**
   * Compress architecture while preserving system design and technology choices
   */
  private compressArchitecture(content: string, maxTokens: number): string {
    const lines = content.split('\n');
    const keyLines: string[] = [];
    const maxChars = maxTokens * 4;

    // Prioritize architectural decisions, technology stack, and patterns
    const priorityKeywords = ['technology', 'stack', 'pattern', 'component', 'service', 'database', 'api', 'security', 'scalability'];
    const importantLines = lines.filter(line => 
      priorityKeywords.some(keyword => line.toLowerCase().includes(keyword)) ||
      line.includes('##') || line.includes('#') // Keep headers
    );

    let totalChars = 0;
    for (const line of importantLines) {
      if (totalChars + line.length > maxChars) break;
      keyLines.push(line);
      totalChars += line.length;
    }

    const compressed = keyLines.join('\n');
    return compressed.length < content.length
      ? compressed + '\n\n[Architecture details compressed to focus on key decisions]'
      : content;
  }

  /**
   * Compress specifications while preserving functional requirements
   */
  private compressSpecifications(content: string, maxTokens: number): string {
    const lines = content.split('\n');
    const keyLines: string[] = [];
    const maxChars = maxTokens * 4;

    // Prioritize functional requirements, APIs, and business logic
    const priorityKeywords = ['endpoint', 'api', 'function', 'business', 'logic', 'workflow', 'validation', 'rule'];
    const importantLines = lines.filter(line => 
      priorityKeywords.some(keyword => line.toLowerCase().includes(keyword)) ||
      line.includes('##') || line.includes('#') || // Keep headers
      line.trim().startsWith('-') || line.trim().startsWith('*') // Keep bullet points
    );

    let totalChars = 0;
    for (const line of importantLines) {
      if (totalChars + line.length > maxChars) break;
      keyLines.push(line);
      totalChars += line.length;
    }

    const compressed = keyLines.join('\n');
    return compressed.length < content.length
      ? compressed + '\n\n[Specifications compressed to focus on functional requirements]'
      : content;
  }

  /**
   * Compress file structure while preserving directory organization
   */
  private compressFileStructure(content: string, maxTokens: number): string {
    const lines = content.split('\n').filter(line => line.trim());
    const maxLines = Math.max(10, Math.floor(maxTokens / 10)); // Rough estimate: 10 tokens per line

    if (lines.length <= maxLines) return content;

    // Keep directory structure and key files
    const keyLines = lines.filter(line => 
      line.includes('/') || // Directory paths
      line.includes('.ts') || line.includes('.js') || line.includes('.tsx') || // Important files
      line.includes('package.json') || line.includes('README') ||
      line.includes('config') || line.includes('test')
    );

    const result = keyLines.slice(0, maxLines).join('\n');
    return result + '\n\n[File structure compressed to show key directories and files]';
  }

  /**
   * Generic compression that preserves structure and key content
   */
  private genericCompress(content: string, maxTokens: number): string {
    const maxChars = maxTokens * 4;
    if (content.length <= maxChars) return content;

    const lines = content.split('\n');
    const keyLines: string[] = [];
    let totalChars = 0;

    // Prioritize headers and structured content
    for (const line of lines) {
      if (line.includes('#') || line.trim().startsWith('-') || line.trim().startsWith('*')) {
        if (totalChars + line.length <= maxChars) {
          keyLines.push(line);
          totalChars += line.length;
        }
      }
    }

    // Fill remaining space with other content
    for (const line of lines) {
      if (keyLines.includes(line)) continue;
      if (totalChars + line.length > maxChars) break;
      keyLines.push(line);
      totalChars += line.length;
    }

    const compressed = keyLines.join('\n');
    return compressed + '\n\n[Content compressed while preserving key information]';
  }

  /**
   * Optimized task formatting for analysis with better context management
   */
  private formatTasksForAnalysisOptimized(tasks: UnifiedProjectContext['tasks']): string {
    if (tasks.length === 0) return 'No tasks defined.';

    // For large task lists, show summary + critical tasks
    if (tasks.length > 20) {
      const criticalTasks = tasks.slice(0, 10); // First 10 tasks
      const summary = `Showing first 10 of ${tasks.length} tasks. Remaining tasks follow similar patterns.`;
      
      const taskDetails = criticalTasks.map(t => 
        `${t.id} (order: ${t.order}): ${this.truncateText(t.title, 50)}
Dependencies: [${t.dependencies.join(', ') || 'none'}]
Details: ${this.truncateText(t.details, 150)}...`
      ).join('\n\n');

      return `${summary}\n\n${taskDetails}`;
    }

    // For smaller task lists, use regular formatting with slight optimization
    return tasks.map(t => 
      `${t.id} (order: ${t.order}): ${this.truncateText(t.title, 60)}
Dependencies: [${t.dependencies.join(', ') || 'none'}]
Details: ${this.truncateText(t.details, 200)}...`
    ).join('\n\n');
  }

  /**
   * Format tasks for analysis display
   */
  private formatTasksForAnalysis(tasks: UnifiedProjectContext['tasks']): string {
    return tasks.map(t => 
      `${t.id} (order: ${t.order}): ${this.truncateText(t.title, 50)}
Dependencies: [${t.dependencies.join(', ') || 'none'}]
Details: ${this.truncateText(t.details, 200)}...`
    ).join('\n\n');
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
      config: (apiKey || apiBase) ? { 
        ...(apiKey && { apiKey }),
        ...(apiBase && { apiBase })
      } : undefined,
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
      config: (apiKey || apiBase) ? {
        ...(apiKey && { apiKey }),
        ...(apiBase && { apiBase })
      } : undefined,
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
      config: (apiKey || apiBase) ? {
        ...(apiKey && { apiKey }),
        ...(apiBase && { apiBase })
      } : undefined,
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