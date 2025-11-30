import pLimit from 'p-limit';

export class RateLimiter {
  private limit: ReturnType<typeof pLimit>;
  private requestsPerSecond: number;
  private lastRequestTime: number = 0;

  constructor(requestsPerSecond: number) {
    this.requestsPerSecond = requestsPerSecond;
    this.limit = pLimit(requestsPerSecond);
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return this.limit(async () => {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      const minInterval = 1000 / this.requestsPerSecond;

      if (timeSinceLastRequest < minInterval) {
        await new Promise(resolve => 
          setTimeout(resolve, minInterval - timeSinceLastRequest)
        );
      }

      this.lastRequestTime = Date.now();
      return await fn();
    });
  }

  async executeBatch<T>(tasks: (() => Promise<T>)[]): Promise<T[]> {
    return Promise.all(tasks.map(task => this.execute(task)));
  }
}

