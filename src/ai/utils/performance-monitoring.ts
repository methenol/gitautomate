'use server';

/**
 * @fileOverview Performance monitoring with real-time metrics
 * Tracks token usage, processing time, accuracy, and system performance
 */

export interface PerformanceMonitor {
  sessionId: string;
  startTime: number;
  metrics: PerformanceMetrics;
  realTimeData: RealTimeMetrics;
  alerts: PerformanceAlert[];
}

export interface PerformanceMetrics {
  tokenUsage: TokenMetrics;
  processing: ProcessingMetrics;
  accuracy: AccuracyMetrics;
  system: SystemMetrics;
  efficiency: EfficiencyMetrics;
}

export interface TokenMetrics {
  totalTokensUsed: number;
  tokensByOperation: Map<string, number>;
  tokenEfficiency: number;
  compressionRatio: number;
  averageTokensPerTask: number;
  tokenBudgetUtilization: number;
}

export interface ProcessingMetrics {
  totalProcessingTime: number;
  averageProcessingTime: number;
  processingTimeByOperation: Map<string, number>;
  throughput: number; // Tasks per minute
  bottlenecks: string[];
  parallelizationEfficiency: number;
}

export interface AccuracyMetrics {
  consistencyImprovement: number;
  errorReduction: number;
  refinementAccuracy: number;
  validationAccuracy: number;
  predictionAccuracy: number;
}

export interface SystemMetrics {
  memoryUsage: number;
  cpuUtilization: number;
  networkLatency: number;
  cacheHitRate: number;
  errorRate: number;
  availability: number;
}

export interface EfficiencyMetrics {
  overallEfficiency: number;
  timeToValue: number;
  resourceUtilization: number;
  convergenceRate: number;
  automationLevel: number;
}

export interface RealTimeMetrics {
  currentOperation: string;
  tokensUsedThisMinute: number;
  processingRate: number;
  queueSize: number;
  activeConnections: number;
  lastUpdate: number;
}

export interface PerformanceAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  timestamp: number;
  threshold: number;
  currentValue: number;
  recommendation: string;
}

export type AlertType = 'token_limit' | 'processing_slow' | 'memory_high' | 'accuracy_low' | 'error_rate_high';
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface PerformanceThresholds {
  tokenBudget: number;
  maxProcessingTime: number;
  minAccuracy: number;
  maxMemoryUsage: number;
  maxErrorRate: number;
}

export class PerformanceMonitoringSystem {
  
  private monitors: Map<string, PerformanceMonitor> = new Map();
  private globalMetrics: PerformanceMetrics;
  private thresholds: PerformanceThresholds;

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    this.thresholds = {
      tokenBudget: 100000,
      maxProcessingTime: 30000, // 30 seconds
      minAccuracy: 80,
      maxMemoryUsage: 1024, // MB
      maxErrorRate: 5, // 5%
      ...thresholds
    };
    
    this.globalMetrics = this.initializeMetrics();
  }

  /**
   * Start monitoring a new session
   */
  startMonitoring(sessionId: string): PerformanceMonitor {
    const monitor: PerformanceMonitor = {
      sessionId,
      startTime: Date.now(),
      metrics: this.initializeMetrics(),
      realTimeData: this.initializeRealTimeMetrics(),
      alerts: []
    };

    this.monitors.set(sessionId, monitor);
    return monitor;
  }

  /**
   * Record token usage for an operation
   */
  recordTokenUsage(sessionId: string, operation: string, tokens: number): void {
    const monitor = this.monitors.get(sessionId);
    if (!monitor) return;

    // Update session metrics
    monitor.metrics.tokenUsage.totalTokensUsed += tokens;
    
    const currentCount = monitor.metrics.tokenUsage.tokensByOperation.get(operation) || 0;
    monitor.metrics.tokenUsage.tokensByOperation.set(operation, currentCount + tokens);
    
    // Update real-time data
    monitor.realTimeData.tokensUsedThisMinute += tokens;
    monitor.realTimeData.lastUpdate = Date.now();

    // Calculate derived metrics
    this.calculateTokenMetrics(monitor);

    // Check for alerts
    this.checkTokenAlerts(monitor);

    // Update global metrics
    this.updateGlobalMetrics();
  }

  /**
   * Record processing time for an operation
   */
  recordProcessingTime(sessionId: string, operation: string, duration: number): void {
    const monitor = this.monitors.get(sessionId);
    if (!monitor) return;

    // Update session metrics
    monitor.metrics.processing.totalProcessingTime += duration;
    
    const currentTime = monitor.metrics.processing.processingTimeByOperation.get(operation) || 0;
    monitor.metrics.processing.processingTimeByOperation.set(operation, currentTime + duration);

    // Calculate derived metrics
    this.calculateProcessingMetrics(monitor);

    // Check for alerts
    this.checkProcessingAlerts(monitor, duration);

    // Update global metrics
    this.updateGlobalMetrics();
  }

  /**
   * Record accuracy metrics
   */
  recordAccuracy(sessionId: string, accuracyData: Partial<AccuracyMetrics>): void {
    const monitor = this.monitors.get(sessionId);
    if (!monitor) return;

    // Update accuracy metrics
    Object.assign(monitor.metrics.accuracy, accuracyData);

    // Check for alerts
    this.checkAccuracyAlerts(monitor);

    // Update global metrics
    this.updateGlobalMetrics();
  }

  /**
   * Record system metrics
   */
  recordSystemMetrics(sessionId: string, systemData: Partial<SystemMetrics>): void {
    const monitor = this.monitors.get(sessionId);
    if (!monitor) return;

    // Update system metrics
    Object.assign(monitor.metrics.system, systemData);

    // Check for alerts
    this.checkSystemAlerts(monitor);

    // Update global metrics
    this.updateGlobalMetrics();
  }

  /**
   * Get real-time performance dashboard data
   */
  getRealTimeDashboard(): {
    activeSessions: number;
    totalTokensUsed: number;
    averageProcessingTime: number;
    currentThroughput: number;
    activeAlerts: PerformanceAlert[];
    systemHealth: number;
  } {
    const activeMonitors = Array.from(this.monitors.values());
    const totalTokens = activeMonitors.reduce((sum, m) => sum + m.metrics.tokenUsage.totalTokensUsed, 0);
    const avgProcessingTime = activeMonitors.reduce((sum, m) => sum + m.metrics.processing.averageProcessingTime, 0) / activeMonitors.length;
    const currentThroughput = activeMonitors.reduce((sum, m) => sum + m.metrics.processing.throughput, 0);
    
    const allAlerts = activeMonitors.flatMap(m => m.alerts).filter(alert => 
      Date.now() - alert.timestamp < 300000 // Last 5 minutes
    );

    const systemHealth = this.calculateSystemHealth();

    return {
      activeSession: activeMonitors.length,
      totalTokensUsed: totalTokens,
      averageProcessingTime: avgProcessingTime || 0,
      currentThroughput: currentThroughput,
      activeAlerts: allAlerts,
      systemHealth
    };
  }

  /**
   * Get detailed metrics for a session
   */
  getSessionMetrics(sessionId: string): PerformanceMetrics | null {
    const monitor = this.monitors.get(sessionId);
    return monitor ? { ...monitor.metrics } : null;
  }

  /**
   * Get performance report for a session
   */
  generatePerformanceReport(sessionId: string): {
    summary: string;
    metrics: PerformanceMetrics;
    recommendations: string[];
    alerts: PerformanceAlert[];
  } | null {
    const monitor = this.monitors.get(sessionId);
    if (!monitor) return null;

    const recommendations = this.generateRecommendations(monitor);
    const summary = this.generateSummary(monitor);

    return {
      summary,
      metrics: monitor.metrics,
      recommendations,
      alerts: monitor.alerts
    };
  }

  /**
   * Initialize metrics structure
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      tokenUsage: {
        totalTokensUsed: 0,
        tokensByOperation: new Map(),
        tokenEfficiency: 0,
        compressionRatio: 0,
        averageTokensPerTask: 0,
        tokenBudgetUtilization: 0
      },
      processing: {
        totalProcessingTime: 0,
        averageProcessingTime: 0,
        processingTimeByOperation: new Map(),
        throughput: 0,
        bottlenecks: [],
        parallelizationEfficiency: 0
      },
      accuracy: {
        consistencyImprovement: 0,
        errorReduction: 0,
        refinementAccuracy: 0,
        validationAccuracy: 0,
        predictionAccuracy: 0
      },
      system: {
        memoryUsage: 0,
        cpuUtilization: 0,
        networkLatency: 0,
        cacheHitRate: 0,
        errorRate: 0,
        availability: 100
      },
      efficiency: {
        overallEfficiency: 0,
        timeToValue: 0,
        resourceUtilization: 0,
        convergenceRate: 0,
        automationLevel: 0
      }
    };
  }

  /**
   * Initialize real-time metrics
   */
  private initializeRealTimeMetrics(): RealTimeMetrics {
    return {
      currentOperation: '',
      tokensUsedThisMinute: 0,
      processingRate: 0,
      queueSize: 0,
      activeConnections: 0,
      lastUpdate: Date.now()
    };
  }

  /**
   * Calculate token-related metrics
   */
  private calculateTokenMetrics(monitor: PerformanceMonitor): void {
    const tokenMetrics = monitor.metrics.tokenUsage;
    
    // Token budget utilization
    tokenMetrics.tokenBudgetUtilization = (tokenMetrics.totalTokensUsed / this.thresholds.tokenBudget) * 100;
    
    // Token efficiency (assuming some baseline)
    tokenMetrics.tokenEfficiency = Math.max(0, 100 - (tokenMetrics.totalTokensUsed / 10000)); // Simplified calculation
  }

  /**
   * Calculate processing-related metrics
   */
  private calculateProcessingMetrics(monitor: PerformanceMonitor): void {
    const processingMetrics = monitor.metrics.processing;
    
    // Average processing time
    const operations = Array.from(processingMetrics.processingTimeByOperation.values());
    processingMetrics.averageProcessingTime = operations.length > 0 
      ? operations.reduce((sum, time) => sum + time, 0) / operations.length 
      : 0;
    
    // Throughput (tasks per minute)
    const sessionDuration = (Date.now() - monitor.startTime) / 60000; // minutes
    const totalOperations = operations.length;
    processingMetrics.throughput = sessionDuration > 0 ? totalOperations / sessionDuration : 0;
  }

  /**
   * Check for token-related alerts
   */
  private checkTokenAlerts(monitor: PerformanceMonitor): void {
    const tokenMetrics = monitor.metrics.tokenUsage;
    
    // Token budget alert
    if (tokenMetrics.tokenBudgetUtilization > 80) {
      this.addAlert(monitor, {
        type: 'token_limit',
        severity: tokenMetrics.tokenBudgetUtilization > 95 ? 'critical' : 'warning',
        message: `Token budget utilization at ${tokenMetrics.tokenBudgetUtilization.toFixed(1)}%`,
        threshold: 80,
        currentValue: tokenMetrics.tokenBudgetUtilization,
        recommendation: 'Consider optimizing context compression or increasing token budget'
      });
    }
  }

  /**
   * Check for processing-related alerts
   */
  private checkProcessingAlerts(monitor: PerformanceMonitor, duration: number): void {
    // Slow processing alert
    if (duration > this.thresholds.maxProcessingTime) {
      this.addAlert(monitor, {
        type: 'processing_slow',
        severity: duration > this.thresholds.maxProcessingTime * 2 ? 'error' : 'warning',
        message: `Processing time ${(duration/1000).toFixed(1)}s exceeds threshold`,
        threshold: this.thresholds.maxProcessingTime / 1000,
        currentValue: duration / 1000,
        recommendation: 'Consider chunking or optimizing the processing pipeline'
      });
    }
  }

  /**
   * Check for accuracy-related alerts
   */
  private checkAccuracyAlerts(monitor: PerformanceMonitor): void {
    const accuracyMetrics = monitor.metrics.accuracy;
    
    // Low accuracy alert
    if (accuracyMetrics.refinementAccuracy > 0 && accuracyMetrics.refinementAccuracy < this.thresholds.minAccuracy) {
      this.addAlert(monitor, {
        type: 'accuracy_low',
        severity: 'warning',
        message: `Refinement accuracy ${accuracyMetrics.refinementAccuracy.toFixed(1)}% below threshold`,
        threshold: this.thresholds.minAccuracy,
        currentValue: accuracyMetrics.refinementAccuracy,
        recommendation: 'Review refinement strategies and context quality'
      });
    }
  }

  /**
   * Check for system-related alerts
   */
  private checkSystemAlerts(monitor: PerformanceMonitor): void {
    const systemMetrics = monitor.metrics.system;
    
    // High memory usage alert
    if (systemMetrics.memoryUsage > this.thresholds.maxMemoryUsage) {
      this.addAlert(monitor, {
        type: 'memory_high',
        severity: 'warning',
        message: `Memory usage ${systemMetrics.memoryUsage}MB exceeds threshold`,
        threshold: this.thresholds.maxMemoryUsage,
        currentValue: systemMetrics.memoryUsage,
        recommendation: 'Consider implementing memory optimization or garbage collection'
      });
    }

    // High error rate alert
    if (systemMetrics.errorRate > this.thresholds.maxErrorRate) {
      this.addAlert(monitor, {
        type: 'error_rate_high',
        severity: 'error',
        message: `Error rate ${systemMetrics.errorRate.toFixed(1)}% exceeds threshold`,
        threshold: this.thresholds.maxErrorRate,
        currentValue: systemMetrics.errorRate,
        recommendation: 'Investigate error patterns and implement additional error handling'
      });
    }
  }

  /**
   * Add an alert to the monitor
   */
  private addAlert(monitor: PerformanceMonitor, alertData: Omit<PerformanceAlert, 'id' | 'timestamp'>): void {
    const alert: PerformanceAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...alertData
    };

    monitor.alerts.push(alert);

    // Keep only recent alerts (last hour)
    const oneHourAgo = Date.now() - 3600000;
    monitor.alerts = monitor.alerts.filter(a => a.timestamp > oneHourAgo);
  }

  /**
   * Update global metrics by aggregating all sessions
   */
  private updateGlobalMetrics(): void {
    // Simplified global metrics update
    const allMonitors = Array.from(this.monitors.values());
    
    if (allMonitors.length === 0) return;
    
    // Aggregate metrics across all sessions
    this.globalMetrics = allMonitors.reduce((global, monitor) => {
      global.tokenUsage.totalTokensUsed += monitor.metrics.tokenUsage.totalTokensUsed;
      global.processing.totalProcessingTime += monitor.metrics.processing.totalProcessingTime;
      return global;
    }, this.initializeMetrics());
  }

  /**
   * Calculate system health score
   */
  private calculateSystemHealth(): number {
    const activeMonitors = Array.from(this.monitors.values());
    if (activeMonitors.length === 0) return 100;
    
    let healthScore = 100;
    
    // Deduct points for active alerts
    const totalAlerts = activeMonitors.reduce((sum, m) => sum + m.alerts.length, 0);
    healthScore -= Math.min(50, totalAlerts * 5); // Max 50 point deduction
    
    // Deduct points for high resource utilization
    const avgMemoryUsage = activeMonitors.reduce((sum, m) => sum + m.metrics.system.memoryUsage, 0) / activeMonitors.length;
    if (avgMemoryUsage > this.thresholds.maxMemoryUsage * 0.8) {
      healthScore -= 20;
    }
    
    return Math.max(0, healthScore);
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(monitor: PerformanceMonitor): string[] {
    const recommendations: string[] = [];
    
    // Token usage recommendations
    if (monitor.metrics.tokenUsage.tokenBudgetUtilization > 70) {
      recommendations.push('Consider implementing more aggressive context compression');
    }
    
    // Processing time recommendations
    if (monitor.metrics.processing.averageProcessingTime > 10000) {
      recommendations.push('Implement parallel processing for better performance');
    }
    
    // Accuracy recommendations
    if (monitor.metrics.accuracy.refinementAccuracy < 85) {
      recommendations.push('Review and improve refinement strategies');
    }
    
    return recommendations;
  }

  /**
   * Generate performance summary
   */
  private generateSummary(monitor: PerformanceMonitor): string {
    const duration = (Date.now() - monitor.startTime) / 1000;
    const tokenMetrics = monitor.metrics.tokenUsage;
    const processingMetrics = monitor.metrics.processing;
    
    return `Session ${monitor.sessionId}: ${duration.toFixed(1)}s duration, ` +
           `${tokenMetrics.totalTokensUsed} tokens used, ` +
           `${processingMetrics.throughput.toFixed(1)} tasks/min throughput, ` +
           `${monitor.alerts.length} active alerts`;
  }

  /**
   * Clean up completed sessions
   */
  cleanup(sessionId: string): void {
    this.monitors.delete(sessionId);
    this.updateGlobalMetrics();
  }

  /**
   * Get all active session IDs
   */
  getActiveSessions(): string[] {
    return Array.from(this.monitors.keys());
  }
}