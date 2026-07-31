'use server';

/**
 * @fileOverview Hierarchical consistency analysis with 5-layer validation
 * Provides comprehensive project validation across multiple abstraction levels
 */

import { UnifiedProjectContext } from '@/types/unified-context';
import { ai } from '@/ai/litellm';
import { z } from 'zod';

export interface HierarchicalAnalysis {
  layers: AnalysisLayer[];
  overallConsistency: number;
  criticalIssues: string[];
  recommendations: LayerRecommendation[];
  metrics: HierarchicalMetrics;
}

export interface AnalysisLayer {
  level: number;
  name: LayerName;
  consistency: number;
  issues: string[];
  dependencies: string[];
  status: LayerStatus;
}

export type LayerName = 'requirements' | 'architecture' | 'design' | 'implementation' | 'integration';
export type LayerStatus = 'valid' | 'warning' | 'error' | 'critical';

export interface LayerRecommendation {
  layer: LayerName;
  priority: 'high' | 'medium' | 'low';
  action: string;
  impact: string;
}

export interface HierarchicalMetrics {
  totalLayers: number;
  validLayers: number;
  criticalLayers: number;
  averageConsistency: number;
  dependencyViolations: number;
}

const LayerAnalysisSchema = z.object({
  consistency: z.number().min(0).max(100),
  issues: z.array(z.string()),
  dependencies: z.array(z.string()),
  status: z.enum(['valid', 'warning', 'error', 'critical']),
});

export class HierarchicalConsistencyAnalyzer {
  
  /**
   * Perform 5-layer hierarchical consistency analysis
   */
  async analyzeHierarchicalConsistency(
    context: UnifiedProjectContext,
    apiKey?: string,
    model?: string,
    apiBase?: string
  ): Promise<HierarchicalAnalysis> {
    
    const layers: AnalysisLayer[] = [];
    
    // Layer 1: Requirements Analysis
    const requirementsAnalysis = await this.analyzeRequirementsLayer(context, apiKey, model, apiBase);
    layers.push({
      level: 1,
      name: 'requirements',
      ...requirementsAnalysis
    });

    // Layer 2: Architecture Analysis
    const architectureAnalysis = await this.analyzeArchitectureLayer(context, apiKey, model, apiBase);
    layers.push({
      level: 2,
      name: 'architecture',
      ...architectureAnalysis
    });

    // Layer 3: Design Analysis
    const designAnalysis = await this.analyzeDesignLayer(context, apiKey, model, apiBase);
    layers.push({
      level: 3,
      name: 'design',
      ...designAnalysis
    });

    // Layer 4: Implementation Analysis
    const implementationAnalysis = await this.analyzeImplementationLayer(context, apiKey, model, apiBase);
    layers.push({
      level: 4,
      name: 'implementation',
      ...implementationAnalysis
    });

    // Layer 5: Integration Analysis
    const integrationAnalysis = await this.analyzeIntegrationLayer(context, apiKey, model, apiBase);
    layers.push({
      level: 5,
      name: 'integration',
      ...integrationAnalysis
    });

    // Calculate overall metrics
    const overallConsistency = this.calculateOverallConsistency(layers);
    const criticalIssues = this.extractCriticalIssues(layers);
    const recommendations = this.generateLayerRecommendations(layers);
    const metrics = this.calculateHierarchicalMetrics(layers);

    return {
      layers,
      overallConsistency,
      criticalIssues,
      recommendations,
      metrics
    };
  }

  /**
   * Layer 1: Requirements Analysis - PRD coverage and completeness
   */
  private async analyzeRequirementsLayer(
    context: UnifiedProjectContext,
    apiKey?: string,
    model?: string,
    apiBase?: string
  ): Promise<Omit<AnalysisLayer, 'level' | 'name'>> {
    
    const prompt = `Analyze the requirements coverage and completeness of this project:

PRD (Product Requirements Document):
${context.prd}

ARCHITECTURE:
${context.architecture.substring(0, 1000)}...

Evaluate:
1. Are all PRD requirements addressed in the architecture?
2. Are requirements clear and unambiguous?
3. Are there missing functional requirements?
4. Are non-functional requirements (performance, security) specified?
5. Is the scope well-defined?

Provide analysis as JSON conforming to the schema.`;

    if (!model) {
      throw new Error('Model is required for hierarchical analysis');
    }

    const { output } = await ai.generate({
      model,
      prompt,
      output: { schema: LayerAnalysisSchema },
      config: { 
        ...(apiKey ? { apiKey } : {}),
        ...(apiBase ? { apiBase } : {})
      },
    });

    return output as typeof LayerAnalysisSchema._type;
  }

  /**
   * Layer 2: Architecture Analysis - System design and patterns
   */
  private async analyzeArchitectureLayer(
    context: UnifiedProjectContext,
    apiKey?: string,
    model?: string,
    apiBase?: string
  ): Promise<Omit<AnalysisLayer, 'level' | 'name'>> {
    
    const prompt = `Analyze the architecture design and patterns:

ARCHITECTURE:
${context.architecture}

SPECIFICATIONS:
${context.specifications.substring(0, 1000)}...

FILE STRUCTURE:
${context.fileStructure.substring(0, 500)}...

Evaluate:
1. Is the architecture appropriate for the requirements?
2. Are architectural patterns consistently applied?
3. Is the system properly modularized?
4. Are there potential scalability issues?
5. Is the technology stack coherent?

Provide analysis as JSON conforming to the schema.`;

    if (!model) {
      throw new Error('Model is required for hierarchical analysis');
    }

    const { output } = await ai.generate({
      model,
      prompt,
      output: { schema: LayerAnalysisSchema },
      config: { 
        ...(apiKey ? { apiKey } : {}),
        ...(apiBase ? { apiBase } : {})
      },
    });

    return output as typeof LayerAnalysisSchema._type;
  }

  /**
   * Layer 3: Design Analysis - Component interfaces and data flow
   */
  private async analyzeDesignLayer(
    context: UnifiedProjectContext,
    apiKey?: string,
    model?: string,
    apiBase?: string
  ): Promise<Omit<AnalysisLayer, 'level' | 'name'>> {
    
    const prompt = `Analyze the detailed design and component interfaces:

SPECIFICATIONS:
${context.specifications}

FILE STRUCTURE:
${context.fileStructure}

SAMPLE TASKS:
${context.tasks.slice(0, 5).map(t => `${t.title}: ${t.details.substring(0, 200)}...`).join('\n')}

Evaluate:
1. Are component interfaces well-defined?
2. Is data flow logical and efficient?
3. Are design patterns appropriately used?
4. Is error handling considered?
5. Are APIs consistent and RESTful (if applicable)?

Provide analysis as JSON conforming to the schema.`;

    if (!model) {
      throw new Error('Model is required for hierarchical analysis');
    }

    const { output } = await ai.generate({
      model,
      prompt,
      output: { schema: LayerAnalysisSchema },
      config: { 
        ...(apiKey ? { apiKey } : {}),
        ...(apiBase ? { apiBase } : {})
      },
    });

    return output as typeof LayerAnalysisSchema._type;
  }

  /**
   * Layer 4: Implementation Analysis - Task feasibility and dependencies
   */
  private async analyzeImplementationLayer(
    context: UnifiedProjectContext,
    apiKey?: string,
    model?: string,
    apiBase?: string
  ): Promise<Omit<AnalysisLayer, 'level' | 'name'>> {
    
    const tasksSample = context.tasks.map(t => 
      `${t.id}: ${t.title} (Dependencies: [${t.dependencies.join(', ')}])`
    ).join('\n');

    const prompt = `Analyze implementation feasibility and task structure:

TASKS (${context.tasks.length} total):
${tasksSample}

ARCHITECTURE CONTEXT:
${context.architecture.substring(0, 500)}...

Evaluate:
1. Are all tasks implementable with given architecture?
2. Are task dependencies logical and achievable?
3. Is task granularity appropriate?
4. Are there missing implementation steps?
5. Is the task ordering optimal for development?

Provide analysis as JSON conforming to the schema.`;

    if (!model) {
      throw new Error('Model is required for hierarchical analysis');
    }

    const { output } = await ai.generate({
      model,
      prompt,
      output: { schema: LayerAnalysisSchema },
      config: { 
        ...(apiKey ? { apiKey } : {}),
        ...(apiBase ? { apiBase } : {})
      },
    });

    return output as typeof LayerAnalysisSchema._type;
  }

  /**
   * Layer 5: Integration Analysis - System cohesion and end-to-end flow
   */
  private async analyzeIntegrationLayer(
    context: UnifiedProjectContext,
    apiKey?: string,
    model?: string,
    apiBase?: string
  ): Promise<Omit<AnalysisLayer, 'level' | 'name'>> {
    
    const prompt = `Analyze system integration and end-to-end coherence:

FULL PROJECT CONTEXT:
PRD: ${context.prd.substring(0, 300)}...
Architecture: ${context.architecture.substring(0, 300)}...
File Structure: ${context.fileStructure.substring(0, 200)}...
Total Tasks: ${context.tasks.length}

Evaluate:
1. Do all components integrate properly?
2. Is the end-to-end user flow complete?
3. Are there integration gaps or missing connections?
4. Will the implemented system meet the original requirements?
5. Is the system testable and deployable?

Provide analysis as JSON conforming to the schema.`;

    if (!model) {
      throw new Error('Model is required for hierarchical analysis');
    }

    const { output } = await ai.generate({
      model,
      prompt,
      output: { schema: LayerAnalysisSchema },
      config: { 
        ...(apiKey ? { apiKey } : {}),
        ...(apiBase ? { apiBase } : {})
      },
    });

    return output as typeof LayerAnalysisSchema._type;
  }

  /**
   * Calculate overall consistency across all layers
   */
  private calculateOverallConsistency(layers: AnalysisLayer[]): number {
    const weights = [0.25, 0.25, 0.20, 0.20, 0.10]; // Higher weight for requirements and architecture
    let weightedSum = 0;
    
    layers.forEach((layer, index) => {
      weightedSum += layer.consistency * weights[index];
    });
    
    return Math.round(weightedSum);
  }

  /**
   * Extract critical issues that block progress
   */
  private extractCriticalIssues(layers: AnalysisLayer[]): string[] {
    const criticalIssues: string[] = [];
    
    layers.forEach(layer => {
      if (layer.status === 'critical' || layer.status === 'error') {
        criticalIssues.push(...layer.issues.map(issue => `${layer.name}: ${issue}`));
      }
    });
    
    return criticalIssues;
  }

  /**
   * Generate actionable recommendations for each layer
   */
  private generateLayerRecommendations(layers: AnalysisLayer[]): LayerRecommendation[] {
    const recommendations: LayerRecommendation[] = [];
    
    layers.forEach(layer => {
      if (layer.consistency < 70) {
        let priority: 'high' | 'medium' | 'low' = 'medium';
        if (layer.status === 'critical') priority = 'high';
        if (layer.consistency > 50) priority = 'low';
        
        recommendations.push({
          layer: layer.name,
          priority,
          action: this.getLayerRecommendation(layer),
          impact: this.getLayerImpact(layer)
        });
      }
    });
    
    return recommendations;
  }

  /**
   * Get specific recommendation for a layer
   */
  private getLayerRecommendation(layer: AnalysisLayer): string {
    switch (layer.name) {
      case 'requirements':
        return 'Clarify and complete PRD requirements. Add missing functional and non-functional requirements.';
      case 'architecture':
        return 'Refine system architecture. Ensure proper separation of concerns and scalability patterns.';
      case 'design':
        return 'Improve component interfaces and data flow design. Add detailed API specifications.';
      case 'implementation':
        return 'Refactor task breakdown. Ensure proper dependencies and implementation feasibility.';
      case 'integration':
        return 'Address integration gaps. Ensure end-to-end functionality and system coherence.';
    }
  }

  /**
   * Get impact description for layer improvement
   */
  private getLayerImpact(layer: AnalysisLayer): string {
    switch (layer.name) {
      case 'requirements':
        return 'Foundation for all subsequent layers. Critical for project success.';
      case 'architecture':
        return 'Affects scalability, maintainability, and technical debt.';
      case 'design':
        return 'Impacts development efficiency and code quality.';
      case 'implementation':
        return 'Determines development timeline and resource allocation.';
      case 'integration':
        return 'Ensures system functionality and user experience quality.';
    }
  }

  /**
   * Calculate comprehensive metrics for hierarchical analysis
   */
  private calculateHierarchicalMetrics(layers: AnalysisLayer[]): HierarchicalMetrics {
    const totalLayers = layers.length;
    const validLayers = layers.filter(l => l.status === 'valid').length;
    const criticalLayers = layers.filter(l => l.status === 'critical' || l.status === 'error').length;
    const averageConsistency = layers.reduce((sum, l) => sum + l.consistency, 0) / totalLayers;
    const dependencyViolations = layers.reduce((sum, l) => sum + l.dependencies.length, 0);
    
    return {
      totalLayers,
      validLayers,
      criticalLayers,
      averageConsistency: Math.round(averageConsistency),
      dependencyViolations
    };
  }
}