/** Represents a callback function that will be executed at regular intervals. */
export type IntervalCallback = () => void;

/** Represents an unsubscribe function that stops the execution of a callback. */
export type UnsubscribeFunction = () => void;

interface IntervalSubscription {
  callback: IntervalCallback;
  once?: boolean;
}

/** Internal structure to manage callbacks for a specific interval duration. */
interface IntervalBucket {
  intervalId: unknown;
  subscriptions: Set<IntervalSubscription>;
}

/** For custom interval */
export interface CustomInterval<TId = any> {
  set: (handler: IntervalCallback, timeout: number) => TId;
  clear: (id: TId) => void;
}

export interface IntervalPoolOptions {
  /** Custom implementation of `setInterval`, `clearInterval` */
  interval?: CustomInterval;
}

/**
 * IntervalPool manages and reuses intervals efficiently. Multiple callbacks
 * with the same interval duration share the same underlying `setInterval`.
 *
 * @example
 *   ```typescript
 *   const pool = new IntervalPool();
 *
 *   // Run a callback every second
 *   const unsubscribe = pool.run(1000, () => {
 *     console.log('Executed every second');
 *   });
 *
 *   // Later, stop the execution
 *   unsubscribe();
 *
 *   // Or use async iteration
 *   for await (const _ of pool.iterate(2000)) {
 *     console.log('Every 2 seconds');
 *     break; // Stop the iteration
 *   }
 *   ```;
 */
export class IntervalPool {
  /** Map of interval durations to their corresponding subscription buckets */
  #buckets = new Map<number, IntervalBucket>();
  #interval: CustomInterval;

  constructor(options?: IntervalPoolOptions) {
    this.#interval = options?.interval ?? {
      set: setInterval,
      clear: clearInterval,
    };
  }

  /**
   * Runs a callback at regular intervals. Multiple callbacks with the same
   * delay share the same underlying interval.
   *
   * @example
   *   ```typescript
   *   const pool = new IntervalPool();
   *   const unsubscribe = pool.run(1000, () => {
   *     console.log('Running every second');
   *   });
   *
   *   // Stop after 5 seconds
   *   setTimeout(unsubscribe, 5000);
   *   ```;
   *
   * @param delay - The time in milliseconds between executions
   * @param callback - The function to execute at each interval
   * @returns An unsubscribe function to stop the execution
   */
  run(delay: number, callback: IntervalCallback): UnsubscribeFunction {
    const subscription: IntervalSubscription = { callback };
    this.#addsubscription(delay, subscription);

    return () => this.#removeSubscription(delay, subscription);
  }

  /**
   * Hooks a callback to be executed only once the next interval execution.
   *
   * IMPORTANT: This does not guarantee execution after exactly `delay`
   * milliseconds, but rather on the next tick of the interval pool for the
   * specified delay.
   */
  once(delay: number, callback: IntervalCallback): UnsubscribeFunction {
    const subscription: IntervalSubscription = { callback, once: true };
    this.#addsubscription(delay, subscription);

    return () => this.#removeSubscription(delay, subscription);
  }

  #addsubscription(delay: number, subscription: IntervalSubscription): void {
    let bucket = this.#buckets.get(delay);

    // Create a new bucket if one doesn't exist for this delay
    if (!bucket) {
      const subscriptions = new Set<IntervalSubscription>();
      const intervalId = this.#interval.set(() => {
        // Execute all callbacks registered for this interval
        subscriptions.forEach((subscription) => {
          try {
            const { callback, once } = subscription;
            callback();

            if (once) {
              this.#removeSubscription(delay, subscription);
            }
          } catch (error) {
            // Catch errors to prevent one callback from breaking others
            console.error("Error in interval callback:", error);
          }
        });
      }, delay);

      bucket = { intervalId, subscriptions };
      this.#buckets.set(delay, bucket);
    }

    bucket.subscriptions.add(subscription);
  }

  #removeSubscription(delay: number, subscription: IntervalSubscription) {
    const bucket = this.#buckets.get(delay);
    if (!bucket) return;

    bucket.subscriptions.delete(subscription);

    if (bucket.subscriptions.size === 0) {
      this.#interval.clear(bucket.intervalId);
      this.#buckets.delete(delay);
    }
  }

  /**
   * Creates an async iterable that yields at regular intervals. Useful for
   * async/await patterns with for-await-of loops.
   *
   * @example
   *   ```typescript
   *   const pool = new IntervalPool();
   *
   *   for await (const _ of pool.iterate(2000)) {
   *     console.log('This runs every 2 seconds');
   *
   *     // Break to stop the iteration
   *     if (someCondition) break;
   *   }
   *   ```;
   *
   * @param delay - The time in milliseconds between iterations
   * @yields Void on each interval tick
   */
  async *iterate(delay: number): AsyncGenerator<void, void, unknown> {
    let resolve: (() => void) | null = null;
    let stopped = false;

    const callback = () => {
      if (resolve) {
        resolve();
        resolve = null;
      }
    };

    const unsubscribe = this.run(delay, callback);

    try {
      while (!stopped) {
        await new Promise<void>((res) => {
          resolve = res;
        });
        yield;
      }
    } finally {
      stopped = true;
      unsubscribe();
    }
  }

  /**
   * Clears all intervals managed by this pool. Useful for cleanup, especially
   * in testing environments.
   *
   * @example
   *   ```typescript
   *   const pool = new IntervalPool();
   *   // ... register some callbacks
   *   pool.clear(); // Stop all intervals
   *   ```;
   */
  clear(): void {
    this.#buckets.forEach((bucket) => {
      this.#interval.clear(bucket.intervalId);
      bucket.subscriptions.clear();
    });
    this.#buckets.clear();
  }

  /**
   * Gets the number of active interval pools.
   *
   * @example
   *   ```typescript
   *   const pool = new IntervalPool();
   *   pool.run(1000, () => {});
   *   pool.run(2000, () => {});
   *   console.log(pool.getActivePoolCount()); // 2
   *   ```;
   *
   * @returns The number of unique interval durations currently being managed
   */
  getActivePoolCount(): number {
    return this.#buckets.size;
  }

  /**
   * Gets the number of callbacks registered for a specific interval duration.
   *
   * @example
   *   ```typescript
   *   const pool = new IntervalPool();
   *   pool.run(1000, () => {});
   *   pool.run(1000, () => {});
   *   console.log(pool.getSubscriptionCount(1000)); // 2
   *   ```;
   *
   * @param delay - The interval duration in milliseconds
   * @returns The number of callbacks registered for this delay, or 0 if no pool
   *   exists
   */
  getSubscriptionCount(delay: number): number {
    const pool = this.#buckets.get(delay);
    return pool ? pool.subscriptions.size : 0;
  }

  /**
   * Gets statistics about all active interval pools.
   *
   * @example
   *   ```typescript
   *   const pool = new IntervalPool();
   *   pool.run(1000, () => {});
   *   pool.run(1000, () => {});
   *   pool.run(2000, () => {});
   *   console.log(pool.getStats());
   *   // [
   *   //   { delay: 1000, subscriptionCount: 2 },
   *   //   { delay: 2000, subscriptionCount: 1 }
   *   // ]
   *   ```;
   *
   * @returns An array of objects containing delay and callback count for each
   *   pool
   */
  getStats(): Array<{ delay: number; subscriptionCount: number }> {
    return Array.from(this.#buckets.entries()).map(([delay, pool]) => ({
      delay,
      subscriptionCount: pool.subscriptions.size,
    }));
  }
}
