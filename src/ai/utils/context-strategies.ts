'use server';

/**
 * @fileOverview Configurable context strategies for different project sizes and requirements
 * Provides 6 predefined configurations for optimal context management
 */

import { ChunkingOptions, ChunkingStrategy } from './chunking-infrastructure';
import { TruncationStrategy } from './intelligent-truncation';
import { UnifiedProjectContext } from '@/types/unified-context';

export interface ContextStrategy {
  name: StrategyName;
  description: string;
  targetProjectSize: ProjectSize;
  chunkingConfig: ChunkingOptions;
  compressionConfig: CompressionConfig;
  truncationConfig: TruncationConfig;
  performanceTargets: PerformanceTargets;
  fallbackStrategy?: StrategyName;
}

export type StrategyName = 'micro' | 'small' | 'medium' | 'large' | 'enterprise' | 'adaptive';
export type ProjectSize = 'micro' | 'small' | 'medium' | 'large' | 'enterprise';

export interface CompressionConfig {
  targetCompressionRatio: number; // 0.4 = 40% of original size
  preserveTechnicalDetails: boolean;
  preserveRequirements: boolean;
  preserveDependencies: boolean;
  aggressivenessLevel: 'low' | 'medium' | 'high';
}

export interface TruncationConfig {
  strategy: TruncationStrategy;
  maxContentLength: number;
  preserveCodeBlocks: boolean;
  preserveListItems: boolean;
  preserveHeaders: boolean;
  keywordPriority: 'low' | 'medium' | 'high';
}

export interface PerformanceTargets {
  maxTokensPerOperation: number;
  maxProcessingTimeMs: number;
  targetAccuracy: number;
  maxMemoryUsageMB: number;
  compressionRatio: number;
}

export interface ContextStrategySelector {
  selectStrategy: (context: UnifiedProjectContext) => ContextStrategy;
  getRecommendedStrategy: (projectMetrics: ProjectMetrics) => StrategyName;
  adaptStrategy: (currentStrategy: ContextStrategy, performance: PerformanceMetrics) => ContextStrategy;
}

export interface ProjectMetrics {
  taskCount: number;
  prdLength: number;
  architectureComplexity: number;
  dependencyCount: number;
  estimatedTokens: number;
}

export interface PerformanceMetrics {
  actualTokenUsage: number;
  processingTime: number;
  accuracy: number;
  memoryUsage: number;
  compressionRatio: number;
}

export class ContextStrategyManager {
  
  private strategies: Map<StrategyName, ContextStrategy>;
  
  constructor() {
    this.strategies = new Map();
    this.initializePredefinedStrategies();
  }

  /**
   * Initialize 6 predefined context strategies
   */
  private initializePredefinedStrategies(): void {
    
    // 1. Micro Strategy - For very small projects (1-10 tasks)
    this.strategies.set('micro', {
      name: 'micro',
      description: 'Optimized for micro projects with minimal complexity',
      targetProjectSize: 'micro',
      chunkingConfig: {
        strategy: 'semantic',
        maxTokensPerChunk: 1000,
        overlapPercentage: 5,
        prioritizeByImportance: false,
        groupByDependencies: false
      },
      compressionConfig: {
        targetCompressionRatio: 0.8, // Light compression
        preserveTechnicalDetails: true,
        preserveRequirements: true,
        preserveDependencies: true,
        aggressivenessLevel: 'low'
      },
      truncationConfig: {
        strategy: 'conservative',
        maxContentLength: 500,
        preserveCodeBlocks: true,
        preserveListItems: true,
        preserveHeaders: true,
        keywordPriority: 'medium'
      },
      performanceTargets: {
        maxTokensPerOperation: 2000,
        maxProcessingTimeMs: 5000,
        targetAccuracy: 95,
        maxMemoryUsageMB: 100,
        compressionRatio: 0.8
      }
    });

    // 2. Small Strategy - For small projects (10-30 tasks)
    this.strategies.set('small', {
      name: 'small',
      description: 'Balanced approach for small to medium projects',
      targetProjectSize: 'small',
      chunkingConfig: {
        strategy: 'semantic',
        maxTokensPerChunk: 1500,
        overlapPercentage: 10,
        prioritizeByImportance: true,
        groupByDependencies: true
      },
      compressionConfig: {
        targetCompressionRatio: 0.6,
        preserveTechnicalDetails: true,
        preserveRequirements: true,
        preserveDependencies: true,
        aggressivenessLevel: 'medium'
      },
      truncationConfig: {
        strategy: 'balanced',
        maxContentLength: 800,
        preserveCodeBlocks: true,
        preserveListItems: true,
        preserveHeaders: true,
        keywordPriority: 'high'
      },
      performanceTargets: {
        maxTokensPerOperation: 4000,
        maxProcessingTimeMs: 10000,
        targetAccuracy: 90,
        maxMemoryUsageMB: 200,
        compressionRatio: 0.6
      }
    });

    // 3. Medium Strategy - For medium projects (30-80 tasks)
    this.strategies.set('medium', {
      name: 'medium',
      description: 'Comprehensive strategy for medium-sized projects',
      targetProjectSize: 'medium',
      chunkingConfig: {
        strategy: 'hybrid',
        maxTokensPerChunk: 2500,
        overlapPercentage: 15,
        prioritizeByImportance: true,
        groupByDependencies: true
      },
      compressionConfig: {
        targetCompressionRatio: 0.5,
        preserveTechnicalDetails: true,
        preserveRequirements: true,
        preserveDependencies: true,
        aggressivenessLevel: 'medium'
      },
      truncationConfig: {
        strategy: 'balanced',
        maxContentLength: 1200,
        preserveCodeBlocks: true,
        preserveListItems: true,
        preserveHeaders: true,
        keywordPriority: 'high'
      },
      performanceTargets: {
        maxTokensPerOperation: 8000,
        maxProcessingTimeMs: 20000,
        targetAccuracy: 85,
        maxMemoryUsageMB: 400,
        compressionRatio: 0.5
      }
    });

    // 4. Large Strategy - For large projects (80-200 tasks)
    this.strategies.set('large', {
      name: 'large',
      description: 'Optimized for large-scale projects with complex dependencies',
      targetProjectSize: 'large',
      chunkingConfig: {
        strategy: 'dependency-aware',
        maxTokensPerChunk: 3000,
        overlapPercentage: 20,
        prioritizeByImportance: true,
        groupByDependencies: true
      },
      compressionConfig: {
        targetCompressionRatio: 0.4,
        preserveTechnicalDetails: true,
        preserveRequirements: true,
        preserveDependencies: true,
        aggressivenessLevel: 'high'
      },
      truncationConfig: {
        strategy: 'aggressive',
        maxContentLength: 1000,
        preserveCodeBlocks: true,
        preserveListItems: true,
        preserveHeaders: true,
        keywordPriority: 'high'
      },
      performanceTargets: {
        maxTokensPerOperation: 15000,
        maxProcessingTimeMs: 45000,
        targetAccuracy: 80,
        maxMemoryUsageMB: 800,
        compressionRatio: 0.4
      },
      fallbackStrategy: 'medium'
    });

    // 5. Enterprise Strategy - For enterprise projects (200+ tasks)
    this.strategies.set('enterprise', {
      name: 'enterprise',
      description: 'Maximum optimization for enterprise-scale projects',
      targetProjectSize: 'enterprise',
      chunkingConfig: {
        strategy: 'hybrid',
        maxTokensPerChunk: 4000,
        overlapPercentage: 25,
        prioritizeByImportance: true,
        groupByDependencies: true
      },
      compressionConfig: {
        targetCompressionRatio: 0.3,
        preserveTechnicalDetails: true,
        preserveRequirements: true,
        preserveDependencies: true,
        aggressivenessLevel: 'high'
      },
      truncationConfig: {
        strategy: 'aggressive',
        maxContentLength: 800,
        preserveCodeBlocks: true,
        preserveListItems: false,
        preserveHeaders: true,
        keywordPriority: 'high'
      },
      performanceTargets: {
        maxTokensPerOperation: 25000,
        maxProcessingTimeMs: 90000,
        targetAccuracy: 75,
        maxMemoryUsageMB: 1500,
        compressionRatio: 0.3
      },
      fallbackStrategy: 'large'
    });

    // 6. Adaptive Strategy - Dynamically adjusts based on performance
    this.strategies.set('adaptive', {
      name: 'adaptive',
      description: 'Dynamically adapts strategy based on real-time performance',
      targetProjectSize: 'medium', // Starting point
      chunkingConfig: {
        strategy: 'hybrid',
        maxTokensPerChunk: 2000,
        overlapPercentage: 15,
        prioritizeByImportance: true,
        groupByDependencies: true
      },
      compressionConfig: {
        targetCompressionRatio: 0.5,
        preserveTechnicalDetails: true,
        preserveRequirements: true,
        preserveDependencies: true,
        aggressivenessLevel: 'medium'
      },
      truncationConfig: {
        strategy: 'balanced',
        maxContentLength: 1000,
        preserveCodeBlocks: true,
        preserveListItems: true,
        preserveHeaders: true,
        keywordPriority: 'high'
      },
      performanceTargets: {
        maxTokensPerOperation: 10000,
        maxProcessingTimeMs: 30000,
        targetAccuracy: 85,
        maxMemoryUsageMB: 600,
        compressionRatio: 0.5
      }
    });
  }

  /**
   * Get a strategy by name
   */
  getStrategy(name: StrategyName): ContextStrategy | null {
    return this.strategies.get(name) || null;
  }

  /**
   * Select optimal strategy based on project context
   */
  selectOptimalStrategy(context: UnifiedProjectContext): ContextStrategy {
    const metrics = this.analyzeProjectMetrics(context);
    const recommendedStrategy = this.getRecommendedStrategyName(metrics);
    
    return this.strategies.get(recommendedStrategy) || this.strategies.get('medium')!;
  }

  /**
   * Analyze project to determine metrics
   */
  private analyzeProjectMetrics(context: UnifiedProjectContext): ProjectMetrics {
    const taskCount = context.tasks.length;
    const prdLength = context.prd.length;
    const dependencyCount = context.dependencyGraph.length;
    
    // Calculate architecture complexity (simplified)
    const architectureComplexity = this.calculateArchitectureComplexity(context.architecture);
    
    // Estimate total tokens
    const estimatedTokens = Math.ceil(
      (prdLength + context.architecture.length + context.specifications.length + 
       JSON.stringify(context.tasks).length) / 4
    );

    return {
      taskCount,
      prdLength,
      architectureComplexity,
      dependencyCount,
      estimatedTokens
    };
  }

  /**
   * Calculate architecture complexity score
   */
  private calculateArchitectureComplexity(architecture: string): number {
    let complexity = 0;
    const lowerArch = architecture.toLowerCase();
    
    // Add complexity for architectural patterns
    const patterns = ['microservice', 'service mesh', 'event-driven', 'cqrs', 'saga'];
    patterns.forEach(pattern => {
      if (lowerArch.includes(pattern)) complexity += 2;
    });
    
    // Add complexity for technologies
    const technologies = ['docker', 'kubernetes', 'redis', 'mongodb', 'postgresql', 'elasticsearch'];
    technologies.forEach(tech => {
      if (lowerArch.includes(tech)) complexity += 1;
    });
    
    // Add complexity based on length (more detailed = more complex)
    complexity += Math.min(5, Math.floor(architecture.length / 1000));
    
    return complexity;
  }

  /**
   * Get recommended strategy name based on project metrics
   */
  private getRecommendedStrategyName(metrics: ProjectMetrics): StrategyName {
    // Primary decision based on task count
    if (metrics.taskCount <= 10) {
      return 'micro';
    } else if (metrics.taskCount <= 30) {
      return 'small';
    } else if (metrics.taskCount <= 80) {
      return 'medium';
    } else if (metrics.taskCount <= 200) {
      return 'large';
    } else {
      return 'enterprise';
    }
  }

  /**
   * Adapt strategy based on performance feedback
   */
  adaptStrategy(
    currentStrategy: ContextStrategy, 
    performance: PerformanceMetrics
  ): ContextStrategy {
    
    const adaptedStrategy = { ...currentStrategy };
    
    // Adjust based on token usage
    if (performance.actualTokenUsage > currentStrategy.performanceTargets.maxTokensPerOperation) {
      // Increase compression if token usage is high
      adaptedStrategy.compressionConfig.targetCompressionRatio *= 0.9;
      adaptedStrategy.chunkingConfig.maxTokensPerChunk *= 0.8;
    } else if (performance.actualTokenUsage < currentStrategy.performanceTargets.maxTokensPerOperation * 0.5) {
      // Reduce compression if we have token budget
      adaptedStrategy.compressionConfig.targetCompressionRatio *= 1.1;
      adaptedStrategy.chunkingConfig.maxTokensPerChunk *= 1.2;
    }

    // Adjust based on processing time
    if (performance.processingTime > currentStrategy.performanceTargets.maxProcessingTimeMs) {
      // Reduce chunk size for faster processing
      adaptedStrategy.chunkingConfig.maxTokensPerChunk *= 0.8;
      adaptedStrategy.truncationConfig.maxContentLength *= 0.9;
    }

    // Adjust based on accuracy
    if (performance.accuracy < currentStrategy.performanceTargets.targetAccuracy) {
      // Preserve more context for better accuracy
      adaptedStrategy.compressionConfig.targetCompressionRatio *= 1.1;
      adaptedStrategy.truncationConfig.strategy = 'conservative';
    }

    // Ensure bounds
    adaptedStrategy.compressionConfig.targetCompressionRatio = Math.max(0.2, Math.min(0.9, adaptedStrategy.compressionConfig.targetCompressionRatio));
    adaptedStrategy.chunkingConfig.maxTokensPerChunk = Math.max(500, Math.min(5000, adaptedStrategy.chunkingConfig.maxTokensPerChunk));

    return adaptedStrategy;
  }

  /**
   * Get all available strategy names
   */
  getAvailableStrategies(): StrategyName[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Create a custom strategy based on requirements
   */
  createCustomStrategy(
    name: string,
    requirements: Partial<ContextStrategy>
  ): ContextStrategy {
    
    const baseStrategy = this.strategies.get('medium')!;
    
    const customStrategy: ContextStrategy = {
      name: name as StrategyName,
      description: requirements.description || `Custom strategy: ${name}`,
      targetProjectSize: requirements.targetProjectSize || 'medium',
      chunkingConfig: { ...baseStrategy.chunkingConfig, ...requirements.chunkingConfig },
      compressionConfig: { ...baseStrategy.compressionConfig, ...requirements.compressionConfig },
      truncationConfig: { ...baseStrategy.truncationConfig, ...requirements.truncationConfig },
      performanceTargets: { ...baseStrategy.performanceTargets, ...requirements.performanceTargets },
      fallbackStrategy: requirements.fallbackStrategy
    };

    return customStrategy;
  }

  /**
   * Get strategy recommendations based on project characteristics
   */
  getStrategyRecommendations(context: UnifiedProjectContext): {
    recommended: StrategyName;
    alternatives: StrategyName[];
    reasoning: string;
  } {
    
    const metrics = this.analyzeProjectMetrics(context);
    const recommended = this.getRecommendedStrategyName(metrics);
    
    const alternatives: StrategyName[] = [];
    const reasoning = this.generateReasoningForStrategy(metrics, recommended);

    // Add alternatives based on project characteristics
    if (metrics.architectureComplexity > 5) {
      alternatives.push('enterprise', 'large');
    }
    
    if (metrics.estimatedTokens > 50000) {
      alternatives.push('large', 'enterprise');
    }
    
    if (metrics.dependencyCount > metrics.taskCount * 0.3) {
      alternatives.push('dependency-aware' as StrategyName); // This would need to be added as a strategy
    }

    // Always suggest adaptive as an alternative
    if (recommended !== 'adaptive') {
      alternatives.push('adaptive');
    }

    return {
      recommended,
      alternatives: [...new Set(alternatives)].filter(alt => alt !== recommended),
      reasoning
    };
  }

  /**
   * Generate reasoning for strategy selection
   */
  private generateReasoningForStrategy(metrics: ProjectMetrics, strategy: StrategyName): string {
    const reasons: string[] = [];
    
    reasons.push(`Project has ${metrics.taskCount} tasks`);
    
    if (metrics.architectureComplexity > 3) {
      reasons.push('Complex architecture detected');
    }
    
    if (metrics.estimatedTokens > 20000) {
      reasons.push('Large context size requires aggressive compression');
    }
    
    if (metrics.dependencyCount > metrics.taskCount * 0.2) {
      reasons.push('High dependency count suggests need for dependency-aware processing');
    }

    return `${strategy} strategy selected: ${reasons.join(', ')}.`;
  }

  /**
   * Validate strategy configuration
   */
  validateStrategy(strategy: ContextStrategy): {
    isValid: boolean;
    warnings: string[];
    errors: string[];
  } {
    
    const warnings: string[] = [];
    const errors: string[] = [];
    
    // Validate compression ratio
    if (strategy.compressionConfig.targetCompressionRatio < 0.1 || strategy.compressionConfig.targetCompressionRatio > 1) {
      errors.push('Compression ratio must be between 0.1 and 1.0');
    }
    
    // Validate chunk size
    if (strategy.chunkingConfig.maxTokensPerChunk < 100) {
      warnings.push('Very small chunk size may impact processing efficiency');
    }
    
    if (strategy.chunkingConfig.maxTokensPerChunk > 10000) {
      warnings.push('Large chunk size may exceed token limits');
    }
    
    // Validate overlap percentage
    if (strategy.chunkingConfig.overlapPercentage > 50) {
      warnings.push('High overlap percentage may impact efficiency');
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors
    };
  }
}