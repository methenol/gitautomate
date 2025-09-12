'use server';

/**
 * @fileOverview Iterative refinement system that continuously improves project consistency
 * Now includes hierarchical analysis, progressive refinement, performance monitoring, and configurable strategies
 */

import { UnifiedProjectContext, ValidationResult } from '@/types/unified-context';
import { ContextValidator } from '@/ai/validation/context-validator';
import { generateTasks } from '@/ai/flows/generate-tasks';
import { generateArchitecture } from '@/ai/flows/generate-architecture';
import { ai } from '@/ai/litellm';
import { z } from 'zod';
import { ContextCompressionUtils } from '@/ai/utils/context-compression';
import { IntelligentTruncation } from '@/ai/utils/intelligent-truncation';
import { ChunkingInfrastructure } from '@/ai/utils/chunking-infrastructure';
import { HierarchicalConsistencyAnalyzer, HierarchicalAnalysis } from '@/ai/utils/hierarchical-analysis';
import { ProgressiveRefinementEngine } from '@/ai/utils/progressive-refinement';
import { PerformanceMonitoringSystem } from '@/ai/utils/performance-monitoring';
import { ContextStrategyManager, ContextStrategy } from '@/ai/utils/context-strategies';

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
  
  private hierarchicalAnalyzer: HierarchicalConsistencyAnalyzer;
  private progressiveRefinement: ProgressiveRefinementEngine;
  private performanceMonitor: PerformanceMonitoringSystem;
  private strategyManager: ContextStrategyManager;
  private currentStrategy?: ContextStrategy;

  constructor() {
    this.hierarchicalAnalyzer = new HierarchicalConsistencyAnalyzer();
    this.progressiveRefinement = new ProgressiveRefinementEngine();
    this.performanceMonitor = new PerformanceMonitoringSystem();
    this.strategyManager = new ContextStrategyManager();
  }
  
  /**
   * Build consistency analysis prompt with intelligent context management
   */
  private buildConsistencyAnalysisPrompt(
    context: UnifiedProjectContext,
    validationResults: ValidationResult[]
  ): string[] {
    // Compress the context for consistency analysis
    const { compressedContext, compressionMetrics } = ContextCompressionUtils.compressProjectContext(context);
    
    const sections = [
      // Introduction section
      `PROJECT COMPONENTS (Compressed for Analysis):
===============================================
Compression Metrics: ${Math.round(compressionMetrics.overallRatio * 100)}% of original size`,

      // Compressed PRD section
      `PRD (Product Requirements Document):
${compressedContext.prd || 'No PRD available'}`,

      // Compressed Architecture section  
      `ARCHITECTURE:
${compressedContext.architecture || 'No architecture available'}`,

      // Compressed Specifications section with intelligent truncation
      `SPECIFICATIONS:
${this.truncateSpecificationsIntelligently(compressedContext.specifications || '')}`,

      // File structure section (kept intact)
      `FILE STRUCTURE:
${context.fileStructure}`,

      // Compressed Tasks section with enhanced formatting
      `TASKS (${context.tasks.length} total):
${this.formatTasksForAnalysisWithCompression(compressedContext.tasks || [])}`,

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
   * Format tasks for analysis with intelligent compression
   */
  private formatTasksForAnalysisWithCompression(tasks: any[]): string {
    if (!tasks || tasks.length === 0) return 'No tasks available';

    return tasks.map(t => {
      // Use intelligent truncation for task descriptions
      const titleResult = IntelligentTruncation.truncateWithStructure(t.title || '', { maxLength: 80 });
      const detailsResult = IntelligentTruncation.truncateTaskDescription(t.description || '', 300);
      
      return `${t.id} (order: ${t.order}): ${titleResult.truncatedText}
Dependencies: [${(t.dependencies || []).join(', ') || 'none'}]
Details: ${detailsResult.truncatedText}`;
    }).join('\n\n');
  }

  /**
   * Intelligently truncate specifications preserving technical details
   */
  private truncateSpecificationsIntelligently(specifications: string): string {
    if (!specifications || specifications.length === 0) return 'No specifications available';
    
    const result = IntelligentTruncation.truncateSpecifications(specifications, 2000);
    return result.truncatedText;
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

  /**
   * Enhanced project consistency analysis with hierarchical validation
   */
  async analyzeProjectConsistency(
    context: UnifiedProjectContext,
    apiKey?: string,
    model?: string,
    apiBase?: string
  ): Promise<RefinementAnalysis & { hierarchicalAnalysis?: HierarchicalAnalysis }> {
    
    const sessionId = `refinement-${Date.now()}`;
    const monitor = this.performanceMonitor.startMonitoring(sessionId);
    
    try {
      // Select optimal context strategy
      this.currentStrategy = this.strategyManager.selectOptimalStrategy(context);
      
      // Perform hierarchical analysis (5-layer validation)
      const startTime = Date.now();
      const hierarchicalAnalysis = await this.hierarchicalAnalyzer.analyzeHierarchicalConsistency(
        context, apiKey, model, apiBase
      );
      
      this.performanceMonitor.recordProcessingTime(sessionId, 'hierarchical_analysis', Date.now() - startTime);
      
      // First run structural validation
      const validationResults = ContextValidator.validateFullContext(context);
      
      // Then perform AI-powered consistency analysis with compression
      const promptSections = this.buildConsistencyAnalysisPrompt(context, validationResults);
      const prompt = `You are an expert software architect conducting a comprehensive consistency analysis of a project plan. Analyze the following project components for logical consistency, completeness, and alignment.

${promptSections.join('\n\n')}

Provide your analysis as a JSON object conforming to the schema.`;

      if (!model) {
        throw new Error('Model is required. Please provide a model in "provider/model" format in settings.');
      }

      const tokensUsed = Math.ceil(prompt.length / 4); // Rough estimate
      this.performanceMonitor.recordTokenUsage(sessionId, 'consistency_analysis', tokensUsed);
      
      const analysisStart = Date.now();
      const { output } = await ai.generate({
        model,
        prompt: prompt,
        output: { schema: RefinementAnalysisSchema },
        config: { 
          ...(apiKey ? { apiKey } : {}),
          ...(apiBase ? { apiBase } : {})
        },
      });

      this.performanceMonitor.recordProcessingTime(sessionId, 'ai_analysis', Date.now() - analysisStart);

      if (!output) {
        throw new Error('Failed to generate refinement analysis');
      }

      // Combine traditional and hierarchical analysis
      const combinedAnalysis = this.combineAnalysisResults(
        output as typeof RefinementAnalysisSchema._type,
        hierarchicalAnalysis
      );

      // Record accuracy metrics
      this.performanceMonitor.recordAccuracy(sessionId, {
        refinementAccuracy: combinedAnalysis.overallConsistency,
        validationAccuracy: hierarchicalAnalysis.overallConsistency
      });

      return {
        ...combinedAnalysis,
        hierarchicalAnalysis
      };

    } finally {
      this.performanceMonitor.cleanup(sessionId);
    }
  }

  /**
   * Enhanced refinement application with progressive strategies
   */
  async applyRefinements(
    context: UnifiedProjectContext,
    analysis: RefinementAnalysis & { hierarchicalAnalysis?: HierarchicalAnalysis },
    apiKey?: string,
    model?: string,
    apiBase?: string
  ): Promise<UnifiedProjectContext> {
    
    const sessionId = `apply-refinement-${Date.now()}`;
    const monitor = this.performanceMonitor.startMonitoring(sessionId);
    
    try {
      // Use progressive refinement if hierarchical analysis is available
      if (analysis.hierarchicalAnalysis) {
        const progressiveResult = await this.progressiveRefinement.executeProgressiveRefinement(
          context,
          analysis.hierarchicalAnalysis,
          3 // Max iterations
        );
        
        // Record performance metrics
        const metrics = this.progressiveRefinement.getMetrics();
        this.performanceMonitor.recordAccuracy(sessionId, {
          refinementAccuracy: progressiveResult.finalAnalysis.overallConsistency,
          consistencyImprovement: progressiveResult.finalAnalysis.overallConsistency - analysis.hierarchicalAnalysis.overallConsistency
        });
        
        return progressiveResult.refinedContext;
      }
      
      // Fallback to traditional refinement
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

    } finally {
      this.performanceMonitor.cleanup(sessionId);
    }
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

  /**
   * Combine traditional and hierarchical analysis results
   */
  private combineAnalysisResults(
    traditional: RefinementAnalysis,
    hierarchical: HierarchicalAnalysis
  ): RefinementAnalysis {
    
    // Weight traditional and hierarchical scores
    const combinedConsistency = Math.round(
      (traditional.overallConsistency * 0.6) + (hierarchical.overallConsistency * 0.4)
    );

    // Combine critical issues
    const combinedCriticalIssues = [
      ...traditional.criticalIssues,
      ...hierarchical.criticalIssues
    ].filter((issue, index, array) => array.indexOf(issue) === index); // Remove duplicates

    // Enhanced suggestions with hierarchical insights
    const enhancedSuggestions = [
      ...traditional.suggestions,
      ...hierarchical.recommendations.map(rec => ({
        component: this.mapLayerToComponent(rec.layer),
        issue: `Layer ${rec.layer}: ${rec.action}`,
        suggestion: rec.impact,
        priority: rec.priority,
        reasoning: `Hierarchical analysis recommendation for ${rec.layer} layer`
      }))
    ];

    // Determine action based on combined analysis
    let recommendedAction = traditional.recommendedAction;
    if (hierarchical.metrics.criticalLayers > 2) {
      recommendedAction = 'major_revision';
    } else if (combinedConsistency < 70) {
      recommendedAction = 'refine_architecture';
    }

    return {
      overallConsistency: combinedConsistency,
      criticalIssues: combinedCriticalIssues,
      suggestions: enhancedSuggestions,
      recommendedAction
    };
  }

  /**
   * Map hierarchical layer to refinement component
   */
  private mapLayerToComponent(layer: string): 'architecture' | 'fileStructure' | 'specifications' | 'tasks' | 'dependencies' {
    switch (layer) {
      case 'requirements': return 'specifications';
      case 'architecture': return 'architecture';
      case 'design': return 'specifications';
      case 'implementation': return 'tasks';
      case 'integration': return 'dependencies';
      default: return 'architecture';
    }
  }

  /**
   * Get performance dashboard for monitoring
   */
  getPerformanceDashboard() {
    return this.performanceMonitor.getRealTimeDashboard();
  }

  /**
   * Get current context strategy
   */
  getCurrentStrategy(): ContextStrategy | undefined {
    return this.currentStrategy;
  }

  /**
   * Get strategy recommendations for a context
   */
  getStrategyRecommendations(context: UnifiedProjectContext) {
    return this.strategyManager.getStrategyRecommendations(context);
  }

  /**
   * Set custom context strategy
   */
  setStrategy(strategyName: string) {
    const strategy = this.strategyManager.getStrategy(strategyName as any);
    if (strategy) {
      this.currentStrategy = strategy;
    }
  }
}