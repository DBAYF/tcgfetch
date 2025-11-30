import { DownloadDatabase } from './database';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Production-grade monitoring and health check system
 */
export class DownloadMonitor {
  private db: DownloadDatabase;
  private sessionId: number | null = null;
  private startTime: number = 0;
  private checkpoints: Map<string, number> = new Map();
  private metricsInterval: NodeJS.Timeout | null = null;
  
  // Real-time metrics
  private metrics = {
    cardsProcessed: 0,
    imagesDownloaded: 0,
    bytesDownloaded: 0,
    errors: 0,
    retries: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  constructor(db: DownloadDatabase) {
    this.db = db;
  }

  /**
   * Start monitoring session
   */
  startSession(gameId: string, metadata?: any): number {
    this.startTime = Date.now();
    this.sessionId = this.db.startSession(gameId, metadata);
    
    // Start periodic metrics collection
    this.metricsInterval = setInterval(() => {
      this.recordPeriodicMetrics();
    }, 10000); // Every 10 seconds

    return this.sessionId;
  }

  /**
   * Record checkpoint
   */
  checkpoint(name: string): void {
    this.checkpoints.set(name, Date.now());
  }

  /**
   * Get time since checkpoint
   */
  timeSinceCheckpoint(name: string): number {
    const time = this.checkpoints.get(name);
    return time ? Date.now() - time : 0;
  }

  /**
   * Record card processed
   */
  recordCard(isNew: boolean = true): void {
    this.metrics.cardsProcessed++;
    if (this.sessionId) {
      this.db.updateSession(this.sessionId, { cardsDownloaded: isNew ? 1 : 0 });
    }
  }

  /**
   * Record image downloaded
   */
  recordImage(bytes: number): void {
    this.metrics.imagesDownloaded++;
    this.metrics.bytesDownloaded += bytes;
    if (this.sessionId) {
      this.db.updateSession(this.sessionId, { imagesDownloaded: 1 });
    }
  }

  /**
   * Record error
   */
  recordError(errorType: string, message: string, context?: any): void {
    this.metrics.errors++;
    if (this.sessionId) {
      this.db.logError(this.sessionId, errorType, message, context);
      this.db.updateSession(this.sessionId, { errors: 1 });
    }
  }

  /**
   * Record retry attempt
   */
  recordRetry(): void {
    this.metrics.retries++;
  }

  /**
   * Record cache hit/miss
   */
  recordCache(hit: boolean): void {
    if (hit) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }
  }

  /**
   * Record performance metric
   */
  recordMetric(metricType: string, value: number): void {
    if (this.sessionId) {
      this.db.recordMetric(this.sessionId, metricType, value);
    }
  }

  /**
   * Record periodic metrics
   */
  private recordPeriodicMetrics(): void {
    if (!this.sessionId) return;

    const elapsed = Date.now() - this.startTime;
    const cardsPerSecond = this.metrics.cardsProcessed / (elapsed / 1000);
    const imagesPerSecond = this.metrics.imagesDownloaded / (elapsed / 1000);
    const mbPerSecond = (this.metrics.bytesDownloaded / 1024 / 1024) / (elapsed / 1000);

    this.recordMetric('cards_per_second', cardsPerSecond);
    this.recordMetric('images_per_second', imagesPerSecond);
    this.recordMetric('mb_per_second', mbPerSecond);
    this.recordMetric('error_rate', this.metrics.errors / Math.max(1, this.metrics.cardsProcessed));
  }

  /**
   * Get current statistics
   */
  getStats(): {
    sessionId: number | null;
    elapsed: number;
    cardsProcessed: number;
    imagesDownloaded: number;
    bytesDownloaded: number;
    errors: number;
    retries: number;
    cacheHits: number;
    cacheMisses: number;
    cardsPerSecond: number;
    imagesPerSecond: number;
    mbPerSecond: number;
    errorRate: number;
    cacheHitRate: number;
  } {
    const elapsed = Date.now() - this.startTime;
    const elapsedSeconds = elapsed / 1000;

    const totalCacheRequests = this.metrics.cacheHits + this.metrics.cacheMisses;

    return {
      sessionId: this.sessionId,
      elapsed,
      ...this.metrics,
      cardsPerSecond: this.metrics.cardsProcessed / elapsedSeconds,
      imagesPerSecond: this.metrics.imagesDownloaded / elapsedSeconds,
      mbPerSecond: (this.metrics.bytesDownloaded / 1024 / 1024) / elapsedSeconds,
      errorRate: this.metrics.errors / Math.max(1, this.metrics.cardsProcessed),
      cacheHitRate: totalCacheRequests > 0 ? (this.metrics.cacheHits / totalCacheRequests) * 100 : 0
    };
  }

  /**
   * Get formatted status report
   */
  getStatusReport(): string {
    const stats = this.getStats();
    const elapsed = this.formatDuration(stats.elapsed);

    return `
╔═══════════════════════════════════════════════════════════════╗
║                    DOWNLOAD STATUS REPORT                      ║
╚═══════════════════════════════════════════════════════════════╝

⏱  Duration: ${elapsed}
📊 Session ID: ${stats.sessionId}

📈 PROGRESS
  • Cards Processed:    ${stats.cardsProcessed.toLocaleString()}
  • Images Downloaded:  ${stats.imagesDownloaded.toLocaleString()}
  • Data Downloaded:    ${this.formatBytes(stats.bytesDownloaded)}

⚡ PERFORMANCE
  • Cards/sec:          ${stats.cardsPerSecond.toFixed(2)}
  • Images/sec:         ${stats.imagesPerSecond.toFixed(2)}
  • Speed:              ${stats.mbPerSecond.toFixed(2)} MB/s

🔄 RELIABILITY
  • Errors:             ${stats.errors}
  • Retries:            ${stats.retries}
  • Error Rate:         ${(stats.errorRate * 100).toFixed(2)}%

💾 CACHE
  • Cache Hits:         ${stats.cacheHits}
  • Cache Misses:       ${stats.cacheMisses}
  • Hit Rate:           ${stats.cacheHitRate.toFixed(2)}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  }

  /**
   * Complete session
   */
  completeSession(status: 'completed' | 'failed' | 'cancelled' = 'completed'): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.sessionId) {
      this.recordPeriodicMetrics();
      this.db.completeSession(this.sessionId, status);
    }
  }

  /**
   * Save progress snapshot
   */
  async saveProgressSnapshot(gameId: string, data: any): Promise<void> {
    const snapshotPath = path.join('tcg-data', gameId, '.progress-snapshot.json');
    const snapshot = {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      metrics: this.metrics,
      checkpoints: Array.from(this.checkpoints.entries()),
      data
    };

    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  }

  /**
   * Load progress snapshot
   */
  async loadProgressSnapshot(gameId: string): Promise<any | null> {
    const snapshotPath = path.join('tcg-data', gameId, '.progress-snapshot.json');
    
    if (!fs.existsSync(snapshotPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(snapshotPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate health report
   */
  getHealthReport(): {
    healthy: boolean;
    issues: string[];
    warnings: string[];
    recommendations: string[];
  } {
    const stats = this.getStats();
    const issues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check error rate
    if (stats.errorRate > 0.1) {
      issues.push(`High error rate: ${(stats.errorRate * 100).toFixed(2)}%`);
      recommendations.push('Consider reducing concurrency or checking API status');
    } else if (stats.errorRate > 0.05) {
      warnings.push(`Elevated error rate: ${(stats.errorRate * 100).toFixed(2)}%`);
    }

    // Check performance
    if (stats.cardsPerSecond < 0.5 && stats.elapsed > 60000) {
      warnings.push(`Low throughput: ${stats.cardsPerSecond.toFixed(2)} cards/sec`);
      recommendations.push('Check network connection or increase concurrency');
    }

    // Check retries
    if (stats.retries > stats.cardsProcessed * 0.5) {
      warnings.push(`High retry rate: ${stats.retries} retries for ${stats.cardsProcessed} cards`);
      recommendations.push('API may be unstable, consider backing off');
    }

    // Check cache performance
    if (stats.cacheHitRate < 10 && stats.cacheHits + stats.cacheMisses > 100) {
      warnings.push(`Low cache hit rate: ${stats.cacheHitRate.toFixed(2)}%`);
    }

    return {
      healthy: issues.length === 0,
      issues,
      warnings,
      recommendations
    };
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Format duration to human readable
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Estimate time remaining
   */
  estimateTimeRemaining(totalItems: number): string {
    const stats = this.getStats();
    
    if (stats.cardsPerSecond === 0) {
      return 'Calculating...';
    }

    const remaining = totalItems - stats.cardsProcessed;
    const secondsRemaining = remaining / stats.cardsPerSecond;
    
    return this.formatDuration(secondsRemaining * 1000);
  }
}

/**
 * Real-time progress reporter
 */
export class ProgressReporter {
  private lastUpdate: number = 0;
  private updateInterval: number = 1000; // 1 second

  constructor(updateInterval?: number) {
    if (updateInterval) {
      this.updateInterval = updateInterval;
    }
  }

  /**
   * Update progress (throttled)
   */
  update(monitor: DownloadMonitor, force: boolean = false): void {
    const now = Date.now();
    
    if (!force && now - this.lastUpdate < this.updateInterval) {
      return;
    }

    this.lastUpdate = now;
    
    // Clear console and show status
    if (process.stdout.isTTY) {
      console.clear();
      console.log(monitor.getStatusReport());
      
      const health = monitor.getHealthReport();
      if (health.warnings.length > 0) {
        console.log('⚠️  WARNINGS:');
        health.warnings.forEach(w => console.log(`   ${w}`));
        console.log('');
      }
      
      if (health.issues.length > 0) {
        console.log('❌ ISSUES:');
        health.issues.forEach(i => console.log(`   ${i}`));
        console.log('');
      }
    }
  }

  /**
   * Final report
   */
  final(monitor: DownloadMonitor): void {
    console.log(monitor.getStatusReport());
    
    const health = monitor.getHealthReport();
    if (health.recommendations.length > 0) {
      console.log('💡 RECOMMENDATIONS:');
      health.recommendations.forEach(r => console.log(`   • ${r}`));
      console.log('');
    }
  }
}

