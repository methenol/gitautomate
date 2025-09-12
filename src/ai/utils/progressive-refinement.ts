'use server';

/**
 * @fileOverview Progressive refinement with adaptive strategies
 * Intelligently selects refinement approaches based on project state and issues
 */

import { UnifiedProjectContext } from '@/types/unified-context';
import { HierarchicalAnalysis, LayerName } from './hierarchical-analysis';
import { ContextCompressionUtils } from './context-compression';
import { ChunkingInfrastructure, ChunkingOptions } from './chunking-infrastructure';

export interface ProgressiveRefinementEngine {
  currentStrategy: RefinementStrategy;
  iterationHistory: RefinementIteration[];
  adaptiveMetrics: AdaptiveMetrics;
}

export interface RefinementStrategy {
  name: StrategyName;
  description: string;
  targetLayers: LayerName[];
  chunkingOptions: ChunkingOptions;
  maxIterations: number;
  convergenceThreshold: number;
}

export type StrategyName = 'focused' | 'comprehensive' | 'incremental' | 'emergency' | 'optimization';

export interface RefinementIteration {
  iterationNumber: number;
  strategy: StrategyName;
  targetLayers: LayerName[];
  consistencyBefore: number;
  consistencyAfter: number;
  improvement: number;
  duration: number;
  tokensUsed: number;
  issuesResolved: string[];
  newIssues: string[];
}

export interface AdaptiveMetrics {
  totalIterations: number;
  averageImprovement: number;
  convergenceRate: number;
  strategyEffectiveness: Map<StrategyName, number>;
  tokenEfficiency: number;
  timeEfficiency: number;
}

export class ProgressiveRefinementEngine {
  
  private iterationHistory: RefinementIteration[] = [];
  private currentStrategy: RefinementStrategy;
  private adaptiveMetrics: AdaptiveMetrics;

  constructor() {
    this.currentStrategy = this.getDefaultStrategy();
    this.adaptiveMetrics = this.initializeMetrics();
  }

  /**
   * Execute progressive refinement with adaptive strategy selection
   */
  async executeProgressiveRefinement(
    context: UnifiedProjectContext,
    hierarchicalAnalysis: HierarchicalAnalysis,
    maxIterations: number = 5
  ): Promise<{
    refinedContext: UnifiedProjectContext;
    finalAnalysis: HierarchicalAnalysis;
    refinementEngine: ProgressiveRefinementEngine;
  }> {
    
    let currentContext = { ...context };
    let currentAnalysis = hierarchicalAnalysis;
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;
      const startTime = Date.now();
      
      // Adapt strategy based on current state
      const strategy = this.selectAdaptiveStrategy(currentAnalysis, iteration);
      this.currentStrategy = strategy;
      
      // Execute refinement iteration
      const iterationResult = await this.executeRefinementIteration(
        currentContext,
        currentAnalysis,
        strategy,
        iteration
      );
      
      const duration = Date.now() - startTime;
      
      // Update context and analysis
      currentContext = iterationResult.refinedContext;
      currentAnalysis = iterationResult.updatedAnalysis;
      
      // Record iteration metrics
      this.recordIterationMetrics({
        iterationNumber: iteration,
        strategy: strategy.name,
        targetLayers: strategy.targetLayers,
        consistencyBefore: hierarchicalAnalysis.overallConsistency,
        consistencyAfter: currentAnalysis.overallConsistency,
        improvement: currentAnalysis.overallConsistency - hierarchicalAnalysis.overallConsistency,
        duration,
        tokensUsed: iterationResult.tokensUsed,
        issuesResolved: iterationResult.issuesResolved,
        newIssues: iterationResult.newIssues
      });

      // Check convergence
      if (this.hasConverged(currentAnalysis, strategy)) {
        break;
      }

      // Update metrics for adaptive learning
      this.updateAdaptiveMetrics();
    }

    return {
      refinedContext: currentContext,
      finalAnalysis: currentAnalysis,
      refinementEngine: this
    };
  }

  /**
   * Select optimal refinement strategy based on current project state
   */
  private selectAdaptiveStrategy(
    analysis: HierarchicalAnalysis,
    iteration: number
  ): RefinementStrategy {
    
    // Emergency strategy for critical issues
    if (analysis.metrics.criticalLayers > 2) {
      return this.getEmergencyStrategy();
    }

    // Focused strategy for specific layer problems
    if (this.hasFocusedIssues(analysis)) {
      return this.getFocusedStrategy(analysis);
    }

    // Comprehensive strategy for widespread issues
    if (analysis.overallConsistency < 60) {
      return this.getComprehensiveStrategy();
    }

    // Incremental strategy for fine-tuning
    if (iteration > 3 || analysis.overallConsistency > 80) {
      return this.getIncrementalStrategy();
    }

    // Optimization strategy for final polish
    if (analysis.overallConsistency > 90) {
      return this.getOptimizationStrategy();
    }

    // Default to comprehensive for early iterations
    return this.getComprehensiveStrategy();
  }

  /**
   * Execute a single refinement iteration
   */
  private async executeRefinementIteration(
    context: UnifiedProjectContext,
    analysis: HierarchicalAnalysis,
    strategy: RefinementStrategy,
    iteration: number
  ): Promise<{
    refinedContext: UnifiedProjectContext;
    updatedAnalysis: HierarchicalAnalysis;
    tokensUsed: number;
    issuesResolved: string[];
    newIssues: string[];
  }> {
    
    let tokensUsed = 0;
    let refinedContext = { ...context };
    
    // Create processing chunks based on strategy
    const chunkingResult = ChunkingInfrastructure.createProcessingChunks(context, strategy.chunkingOptions);
    tokensUsed += chunkingResult.totalTokens;

    // Process chunks in priority order
    for (const chunkId of chunkingResult.processingOrder) {
      const chunk = chunkingResult.chunks.find(c => c.id === chunkId)!;
      
      // Skip chunks not targeted by current strategy
      if (!this.isChunkTargeted(chunk, strategy)) continue;

      // Apply targeted refinements to chunk
      const chunkRefinement = await this.refineChunk(chunk, analysis, strategy);
      tokensUsed += chunkRefinement.tokensUsed;
      
      // Merge chunk improvements back to context
      refinedContext = this.mergeChunkImprovements(refinedContext, chunkRefinement);
    }

    // Re-analyze after refinements (simplified for performance)
    const updatedAnalysis = this.quickAnalysisUpdate(analysis, refinedContext);
    
    // Track resolved and new issues
    const issuesResolved = this.identifyResolvedIssues(analysis, updatedAnalysis);
    const newIssues = this.identifyNewIssues(analysis, updatedAnalysis);

    return {
      refinedContext,
      updatedAnalysis,
      tokensUsed,
      issuesResolved,
      newIssues
    };
  }

  /**
   * Get focused strategy for specific layer issues
   */
  private getFocusedStrategy(analysis: HierarchicalAnalysis): RefinementStrategy {
    const problemLayers = analysis.layers
      .filter(l => l.consistency < 70)
      .map(l => l.name)
      .slice(0, 2); // Focus on top 2 problematic layers

    return {
      name: 'focused',
      description: `Focus on ${problemLayers.join(' and ')} layers`,
      targetLayers: problemLayers,
      chunkingOptions: {
        strategy: 'semantic',
        maxTokensPerChunk: 2000,
        overlapPercentage: 15,
        prioritizeByImportance: true,
        groupByDependencies: true
      },
      maxIterations: 3,
      convergenceThreshold: 75
    };
  }

  /**
   * Get comprehensive strategy for widespread issues
   */
  private getComprehensiveStrategy(): RefinementStrategy {
    return {
      name: 'comprehensive',
      description: 'Comprehensive analysis of all layers',
      targetLayers: ['requirements', 'architecture', 'design', 'implementation', 'integration'],
      chunkingOptions: {
        strategy: 'hybrid',
        maxTokensPerChunk: 3000,
        overlapPercentage: 20,
        prioritizeByImportance: true,
        groupByDependencies: true
      },
      maxIterations: 5,
      convergenceThreshold: 80
    };
  }

  /**
   * Get incremental strategy for fine-tuning
   */
  private getIncrementalStrategy(): RefinementStrategy {
    return {
      name: 'incremental',
      description: 'Incremental improvements and fine-tuning',
      targetLayers: ['design', 'implementation'],
      chunkingOptions: {
        strategy: 'sliding-window',
        maxTokensPerChunk: 1500,
        overlapPercentage: 10,
        prioritizeByImportance: false,
        groupByDependencies: false
      },
      maxIterations: 2,
      convergenceThreshold: 85
    };
  }

  /**
   * Get emergency strategy for critical issues
   */
  private getEmergencyStrategy(): RefinementStrategy {
    return {
      name: 'emergency',
      description: 'Emergency fixes for critical issues',
      targetLayers: ['requirements', 'architecture'],
      chunkingOptions: {
        strategy: 'dependency-aware',
        maxTokensPerChunk: 2500,
        overlapPercentage: 25,
        prioritizeByImportance: true,
        groupByDependencies: true
      },
      maxIterations: 4,
      convergenceThreshold: 70
    };
  }

  /**
   * Get optimization strategy for final polish
   */
  private getOptimizationStrategy(): RefinementStrategy {
    return {
      name: 'optimization',
      description: 'Final optimization and polish',
      targetLayers: ['integration', 'implementation'],
      chunkingOptions: {
        strategy: 'semantic',
        maxTokensPerChunk: 1000,
        overlapPercentage: 5,
        prioritizeByImportance: false,
        groupByDependencies: false
      },
      maxIterations: 1,
      convergenceThreshold: 95
    };
  }

  /**
   * Get default strategy
   */
  private getDefaultStrategy(): RefinementStrategy {
    return this.getComprehensiveStrategy();
  }

  /**
   * Check if analysis has focused issues in specific layers
   */
  private hasFocusedIssues(analysis: HierarchicalAnalysis): boolean {
    const layersWithIssues = analysis.layers.filter(l => l.consistency < 70);
    return layersWithIssues.length <= 2 && layersWithIssues.length > 0;
  }

  /**
   * Check if chunk should be targeted by current strategy
   */
  private isChunkTargeted(chunk: any, strategy: RefinementStrategy): boolean {
    // For now, target all chunks - can be refined based on chunk type and strategy
    return true;
  }

  /**
   * Refine a specific chunk
   */
  private async refineChunk(chunk: any, analysis: HierarchicalAnalysis, strategy: RefinementStrategy): Promise<{
    improvements: string[];
    tokensUsed: number;
  }> {
    // Simplified chunk refinement - in practice would use AI to generate improvements
    return {
      improvements: [`Refined ${chunk.type} chunk ${chunk.id}`],
      tokensUsed: chunk.tokenEstimate * 0.1 // Estimated tokens for refinement
    };
  }

  /**
   * Merge chunk improvements back to context
   */
  private mergeChunkImprovements(context: UnifiedProjectContext, chunkRefinement: any): UnifiedProjectContext {
    // Simplified merge - in practice would apply specific improvements
    return {
      ...context,
      version: context.version + 1,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Quick analysis update without full re-analysis
   */
  private quickAnalysisUpdate(analysis: HierarchicalAnalysis, context: UnifiedProjectContext): HierarchicalAnalysis {
    // Simplified update - estimate improvement based on refinements applied
    const improvementFactor = 1.05; // 5% improvement per iteration
    
    return {
      ...analysis,
      overallConsistency: Math.min(100, Math.round(analysis.overallConsistency * improvementFactor)),
      layers: analysis.layers.map(layer => ({
        ...layer,
        consistency: Math.min(100, Math.round(layer.consistency * improvementFactor))
      }))
    };
  }

  /**
   * Check if refinement has converged
   */
  private hasConverged(analysis: HierarchicalAnalysis, strategy: RefinementStrategy): boolean {
    return analysis.overallConsistency >= strategy.convergenceThreshold;
  }

  /**
   * Record metrics for a refinement iteration
   */
  private recordIterationMetrics(iteration: RefinementIteration): void {
    this.iterationHistory.push(iteration);
  }

  /**
   * Update adaptive metrics for learning
   */
  private updateAdaptiveMetrics(): void {
    const totalIterations = this.iterationHistory.length;
    const totalImprovement = this.iterationHistory.reduce((sum, it) => sum + it.improvement, 0);
    const averageImprovement = totalImprovement / totalIterations;
    
    this.adaptiveMetrics = {
      totalIterations,
      averageImprovement,
      convergenceRate: this.calculateConvergenceRate(),
      strategyEffectiveness: this.calculateStrategyEffectiveness(),
      tokenEfficiency: this.calculateTokenEfficiency(),
      timeEfficiency: this.calculateTimeEfficiency()
    };
  }

  /**
   * Initialize metrics tracking
   */
  private initializeMetrics(): AdaptiveMetrics {
    return {
      totalIterations: 0,
      averageImprovement: 0,
      convergenceRate: 0,
      strategyEffectiveness: new Map(),
      tokenEfficiency: 0,
      timeEfficiency: 0
    };
  }

  /**
   * Calculate convergence rate
   */
  private calculateConvergenceRate(): number {
    if (this.iterationHistory.length === 0) return 0;
    
    const improvements = this.iterationHistory.map(it => it.improvement);
    const recentImprovements = improvements.slice(-3); // Last 3 iterations
    
    return recentImprovements.reduce((sum, imp) => sum + imp, 0) / recentImprovements.length;
  }

  /**
   * Calculate strategy effectiveness
   */
  private calculateStrategyEffectiveness(): Map<StrategyName, number> {
    const effectiveness = new Map<StrategyName, number>();
    const strategies = ['focused', 'comprehensive', 'incremental', 'emergency', 'optimization'] as StrategyName[];
    
    strategies.forEach(strategy => {
      const strategyIterations = this.iterationHistory.filter(it => it.strategy === strategy);
      if (strategyIterations.length > 0) {
        const avgImprovement = strategyIterations.reduce((sum, it) => sum + it.improvement, 0) / strategyIterations.length;
        effectiveness.set(strategy, avgImprovement);
      }
    });
    
    return effectiveness;
  }

  /**
   * Calculate token efficiency
   */
  private calculateTokenEfficiency(): number {
    if (this.iterationHistory.length === 0) return 0;
    
    const totalTokens = this.iterationHistory.reduce((sum, it) => sum + it.tokensUsed, 0);
    const totalImprovement = this.iterationHistory.reduce((sum, it) => sum + it.improvement, 0);
    
    return totalImprovement / (totalTokens / 1000); // Improvement per 1K tokens
  }

  /**
   * Calculate time efficiency
   */
  private calculateTimeEfficiency(): number {
    if (this.iterationHistory.length === 0) return 0;
    
    const totalTime = this.iterationHistory.reduce((sum, it) => sum + it.duration, 0);
    const totalImprovement = this.iterationHistory.reduce((sum, it) => sum + it.improvement, 0);
    
    return totalImprovement / (totalTime / 1000); // Improvement per second
  }

  /**
   * Identify resolved issues between analyses
   */
  private identifyResolvedIssues(before: HierarchicalAnalysis, after: HierarchicalAnalysis): string[] {
    const beforeIssues = new Set(before.criticalIssues);
    const afterIssues = new Set(after.criticalIssues);
    
    return Array.from(beforeIssues).filter(issue => !afterIssues.has(issue));
  }

  /**
   * Identify new issues between analyses
   */
  private identifyNewIssues(before: HierarchicalAnalysis, after: HierarchicalAnalysis): string[] {
    const beforeIssues = new Set(before.criticalIssues);
    const afterIssues = new Set(after.criticalIssues);
    
    return Array.from(afterIssues).filter(issue => !beforeIssues.has(issue));
  }

  /**
   * Get current refinement metrics
   */
  getMetrics(): AdaptiveMetrics {
    return { ...this.adaptiveMetrics };
  }

  /**
   * Get iteration history
   */
  getIterationHistory(): RefinementIteration[] {
    return [...this.iterationHistory];
  }
}