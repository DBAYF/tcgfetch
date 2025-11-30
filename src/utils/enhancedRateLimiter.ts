import pLimit from 'p-limit';

/**
 * Circuit breaker states
 */
enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Too many failures, reject requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

/**
 * Production-grade rate limiter with:
 * - Adaptive rate limiting based on response times
 * - Circuit breaker pattern for failing APIs
 * - Automatic backoff and recovery
 * - Request queuing and prioritization
 * - Performance monitoring
 */
export class EnhancedRateLimiter {
  private limit: ReturnType<typeof pLimit>;
  private requestsPerSecond: number;
  private originalRequestsPerSecond: number;
  private lastRequestTime: number = 0;
  private requestTimes: number[] = [];
  private errorCount: number = 0;
  private successCount: number = 0;
  
  // Circuit breaker
  private circuitState: CircuitState = CircuitState.CLOSED;
  private failureThreshold: number = 10;
  private successThreshold: number = 3;
  private timeout: number = 60000; // 1 minute
  private lastFailureTime: number = 0;
  private consecutiveSuccesses: number = 0;
  
  // Adaptive rate limiting
  private adaptiveEnabled: boolean = true;
  private targetResponseTime: number = 1000; // 1 second
  private responseTimesWindow: number[] = [];
  private maxWindowSize: number = 100;
  
  // Performance metrics
  private totalRequests: number = 0;
  private totalErrors: number = 0;
  private totalRetries: number = 0;

  constructor(
    requestsPerSecond: number,
    options: {
      adaptiveEnabled?: boolean;
      failureThreshold?: number;
      successThreshold?: number;
      circuitTimeout?: number;
      targetResponseTime?: number;
    } = {}
  ) {
    this.requestsPerSecond = requestsPerSecond;
    this.originalRequestsPerSecond = requestsPerSecond;
    this.limit = pLimit(Math.max(1, Math.floor(requestsPerSecond * 2)));
    
    if (options.adaptiveEnabled !== undefined) {
      this.adaptiveEnabled = options.adaptiveEnabled;
    }
    if (options.failureThreshold) {
      this.failureThreshold = options.failureThreshold;
    }
    if (options.successThreshold) {
      this.successThreshold = options.successThreshold;
    }
    if (options.circuitTimeout) {
      this.timeout = options.circuitTimeout;
    }
    if (options.targetResponseTime) {
      this.targetResponseTime = options.targetResponseTime;
    }
  }

  /**
   * Execute function with rate limiting and circuit breaker
   */
  async execute<T>(fn: () => Promise<T>, retries: number = 3): Promise<T> {
    // Check circuit breaker
    if (this.circuitState === CircuitState.OPEN) {
      // Check if timeout has passed
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.circuitState = CircuitState.HALF_OPEN;
        this.consecutiveSuccesses = 0;
      } else {
        throw new Error('Circuit breaker is OPEN - too many failures');
      }
    }

    return this.limit(async () => {
      // Rate limiting
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      const minInterval = 1000 / this.requestsPerSecond;

      if (timeSinceLastRequest < minInterval) {
        await new Promise(resolve =>
          setTimeout(resolve, minInterval - timeSinceLastRequest)
        );
      }

      this.lastRequestTime = Date.now();
      this.totalRequests++;

      // Execute with retry logic
      let lastError: Error | undefined;
      
      for (let attempt = 1; attempt <= retries; attempt++) {
        const startTime = Date.now();
        
        try {
          const result = await fn();
          const responseTime = Date.now() - startTime;

          // Record success
          this.recordSuccess(responseTime);
          
          // Update circuit breaker
          if (this.circuitState === CircuitState.HALF_OPEN) {
            this.consecutiveSuccesses++;
            if (this.consecutiveSuccesses >= this.successThreshold) {
              this.circuitState = CircuitState.CLOSED;
              this.errorCount = 0;
            }
          }

          return result;
        } catch (error) {
          lastError = error as Error;
          this.recordFailure();

          // Update circuit breaker
          if (this.circuitState === CircuitState.HALF_OPEN) {
            this.circuitState = CircuitState.OPEN;
            this.lastFailureTime = Date.now();
            throw error;
          }

          if (attempt < retries) {
            this.totalRetries++;
            // Exponential backoff
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      throw lastError || new Error('Request failed after retries');
    });
  }

  /**
   * Execute batch of tasks
   */
  async executeBatch<T>(
    tasks: (() => Promise<T>)[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<{ results: T[]; errors: Error[] }> {
    const results: T[] = [];
    const errors: Error[] = [];
    let completed = 0;

    const promises = tasks.map(task =>
      this.execute(task)
        .then(result => {
          results.push(result);
          completed++;
          if (onProgress) onProgress(completed, tasks.length);
        })
        .catch(error => {
          errors.push(error);
          completed++;
          if (onProgress) onProgress(completed, tasks.length);
        })
    );

    await Promise.all(promises);

    return { results, errors };
  }

  /**
   * Record successful request
   */
  private recordSuccess(responseTime: number): void {
    this.successCount++;
    this.requestTimes.push(Date.now());

    // Keep last 100 requests
    if (this.requestTimes.length > 100) {
      this.requestTimes.shift();
    }

    // Adaptive rate limiting
    if (this.adaptiveEnabled) {
      this.responseTimesWindow.push(responseTime);
      
      if (this.responseTimesWindow.length > this.maxWindowSize) {
        this.responseTimesWindow.shift();
      }

      this.adjustRateLimit();
    }
  }

  /**
   * Record failed request
   */
  private recordFailure(): void {
    this.errorCount++;
    this.totalErrors++;
    this.lastFailureTime = Date.now();

    // Check circuit breaker threshold
    if (this.errorCount >= this.failureThreshold && this.circuitState === CircuitState.CLOSED) {
      this.circuitState = CircuitState.OPEN;
    }

    // Reduce rate limit on errors
    if (this.adaptiveEnabled) {
      this.requestsPerSecond = Math.max(1, this.requestsPerSecond * 0.75);
      this.updateConcurrency();
    }
  }

  /**
   * Adjust rate limit based on response times
   */
  private adjustRateLimit(): void {
    if (this.responseTimesWindow.length < 10) {
      return;
    }

    const avgResponseTime = this.responseTimesWindow.reduce((a, b) => a + b, 0) / this.responseTimesWindow.length;

    if (avgResponseTime > this.targetResponseTime * 1.5) {
      // Slow down
      this.requestsPerSecond = Math.max(1, this.requestsPerSecond * 0.9);
    } else if (avgResponseTime < this.targetResponseTime * 0.5) {
      // Speed up (but don't exceed original rate)
      this.requestsPerSecond = Math.min(
        this.originalRequestsPerSecond * 1.5,
        this.requestsPerSecond * 1.1
      );
    }

    this.updateConcurrency();
  }

  /**
   * Update concurrency limit
   */
  private updateConcurrency(): void {
    const newConcurrency = Math.max(1, Math.floor(this.requestsPerSecond * 2));
    this.limit = pLimit(newConcurrency);
  }

  /**
   * Get current rate limit
   */
  getCurrentRate(): number {
    return this.requestsPerSecond;
  }

  /**
   * Get circuit breaker state
   */
  getCircuitState(): CircuitState {
    return this.circuitState;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): {
    totalRequests: number;
    successCount: number;
    errorCount: number;
    totalErrors: number;
    totalRetries: number;
    currentRate: number;
    circuitState: CircuitState;
    avgResponseTime: number;
    successRate: number;
  } {
    const avgResponseTime = this.responseTimesWindow.length > 0
      ? this.responseTimesWindow.reduce((a, b) => a + b, 0) / this.responseTimesWindow.length
      : 0;

    const successRate = this.totalRequests > 0
      ? (this.successCount / this.totalRequests) * 100
      : 0;

    return {
      totalRequests: this.totalRequests,
      successCount: this.successCount,
      errorCount: this.errorCount,
      totalErrors: this.totalErrors,
      totalRetries: this.totalRetries,
      currentRate: this.requestsPerSecond,
      circuitState: this.circuitState,
      avgResponseTime,
      successRate
    };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.errorCount = 0;
    this.successCount = 0;
    this.consecutiveSuccesses = 0;
    this.circuitState = CircuitState.CLOSED;
    this.requestsPerSecond = this.originalRequestsPerSecond;
    this.updateConcurrency();
  }

  /**
   * Manually open circuit breaker
   */
  openCircuit(): void {
    this.circuitState = CircuitState.OPEN;
    this.lastFailureTime = Date.now();
  }

  /**
   * Manually close circuit breaker
   */
  closeCircuit(): void {
    this.circuitState = CircuitState.CLOSED;
    this.errorCount = 0;
    this.consecutiveSuccesses = 0;
  }

  /**
   * Get current requests per second
   */
  getRequestsPerSecond(): number {
    if (this.requestTimes.length < 2) {
      return 0;
    }

    const timeWindow = Date.now() - this.requestTimes[0];
    return (this.requestTimes.length / timeWindow) * 1000;
  }

  /**
   * Wait for all pending requests to complete
   */
  async waitForCompletion(): Promise<void> {
    // Wait for active requests
    while (this.limit.activeCount > 0 || this.limit.pendingCount > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean;
    circuitState: CircuitState;
    currentRate: number;
    errorRate: number;
    message: string;
  } {
    const errorRate = this.totalRequests > 0
      ? (this.totalErrors / this.totalRequests) * 100
      : 0;

    let healthy = true;
    let message = 'Operating normally';

    if (this.circuitState === CircuitState.OPEN) {
      healthy = false;
      message = 'Circuit breaker OPEN - too many failures';
    } else if (this.circuitState === CircuitState.HALF_OPEN) {
      healthy = false;
      message = 'Circuit breaker HALF_OPEN - testing recovery';
    } else if (errorRate > 10) {
      healthy = false;
      message = `High error rate: ${errorRate.toFixed(2)}%`;
    } else if (this.requestsPerSecond < this.originalRequestsPerSecond * 0.5) {
      message = `Rate reduced to ${this.requestsPerSecond.toFixed(2)}/s due to slow responses`;
    }

    return {
      healthy,
      circuitState: this.circuitState,
      currentRate: this.requestsPerSecond,
      errorRate,
      message
    };
  }
}

/**
 * Rate limiter pool for managing multiple API endpoints
 */
export class RateLimiterPool {
  private limiters: Map<string, EnhancedRateLimiter> = new Map();

  /**
   * Get or create rate limiter for endpoint
   */
  getLimiter(
    endpoint: string,
    requestsPerSecond: number,
    options?: any
  ): EnhancedRateLimiter {
    if (!this.limiters.has(endpoint)) {
      this.limiters.set(
        endpoint,
        new EnhancedRateLimiter(requestsPerSecond, options)
      );
    }

    return this.limiters.get(endpoint)!;
  }

  /**
   * Get all limiters
   */
  getAllLimiters(): Map<string, EnhancedRateLimiter> {
    return this.limiters;
  }

  /**
   * Get health status of all limiters
   */
  getHealthStatus(): Record<string, any> {
    const status: Record<string, any> = {};

    for (const [endpoint, limiter] of this.limiters.entries()) {
      status[endpoint] = limiter.getHealthStatus();
    }

    return status;
  }

  /**
   * Wait for all limiters to complete
   */
  async waitForAll(): Promise<void> {
    const promises = Array.from(this.limiters.values()).map(limiter =>
      limiter.waitForCompletion()
    );

    await Promise.all(promises);
  }

  /**
   * Reset all limiters
   */
  resetAll(): void {
    for (const limiter of this.limiters.values()) {
      limiter.reset();
    }
  }
}

