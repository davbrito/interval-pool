import type { CustomInterval } from ".";

/** Represents a callback function that will be executed at regular intervals. */
export type IntervalCallback = () => void;

/** Represents an unsubscribe function that stops the execution of a callback. */
export type UnsubscribeFunction = () => void;

export interface IntervalSubscription {
  callback: IntervalCallback;
  once?: boolean;
}

/** Internal structure to manage callbacks for a specific interval duration. */
export class IntervalBucket {
  #disposed = false;
  #intervalId: unknown;
  #onEmpty: ((bucket: IntervalBucket) => void) | undefined;

  readonly delay: number;
  readonly #interval: CustomInterval;
  readonly #subscriptions = new Set<IntervalSubscription>();

  constructor(
    interval: CustomInterval,
    delay: number,
    onEmpty: (bucket: IntervalBucket) => void,
  ) {
    this.#interval = interval;
    this.delay = delay;
    this.#onEmpty = onEmpty;
  }

  add(subscription: IntervalSubscription) {
    if (this.#disposed) {
      throw new Error("Cannot add subscription to a disposed bucket");
    }

    this.#subscriptions.add(subscription);
    this.#tryStart();
  }

  remove(subscription: IntervalSubscription) {
    if (this.#disposed) {
      throw new Error("Cannot remove subscription from a disposed bucket");
    }

    this.#subscriptions.delete(subscription);

    if (this.#subscriptions.size === 0) {
      this.stop();
      this.#onEmpty?.(this);
    }
  }

  stop() {
    if (this.#disposed) {
      throw new Error("Cannot stop a disposed bucket");
    }

    if (this.#intervalId) {
      this.#interval.clear(this.#intervalId);
      this.#intervalId = undefined;
    }
  }

  dispose() {
    if (this.#disposed) return;
    this.#subscriptions.clear();
    this.stop();
    this.#onEmpty = undefined;
    this.#disposed = true;
  }

  #tryStart() {
    if (this.#intervalId) return;

    this.#intervalId = this.#interval.set(
      this.#handleIntervalTick.bind(this),
      this.delay,
    );
  }

  #notifySubscription(subscription: IntervalSubscription) {
    const { callback, once } = subscription;
    try {
      callback();
    } catch (error) {
      // Catch errors to prevent one callback from breaking others
      console.error("Error in interval callback:", error);
    } finally {
      if (once) {
        this.remove(subscription);
      }
    }
  }

  #handleIntervalTick() {
    // Execute all callbacks registered for this interval
    this.#subscriptions.forEach(this.#notifySubscription, this);
  }

  get subscriptionCount(): number {
    return this.#subscriptions.size;
  }
}
