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
  #interval: CustomInterval;
  #delay: number;
  #intervalId: unknown;
  #subscriptions = new Set<IntervalSubscription>();
  #onStop: () => void;

  constructor(interval: CustomInterval, delay: number, onStop: () => void) {
    this.#interval = interval;
    this.#delay = delay;
    this.#onStop = onStop;
  }

  add(subscription: IntervalSubscription) {
    this.#subscriptions.add(subscription);
    this.#tryStart();
  }

  delete(subscription: IntervalSubscription) {
    this.#subscriptions.delete(subscription);
    this.#tryStop();
  }

  dispose() {
    this.#subscriptions.clear();
    this.#tryStop();
  }

  #tryStart() {
    if (this.#intervalId) return;

    this.#intervalId = this.#interval.set(
      this.#handleIntervalTick.bind(this),
      this.#delay,
    );
  }

  #tryStop() {
    if (this.#subscriptions.size > 0) return;
    if (!this.#intervalId) return;
    this.#interval.clear(this.#intervalId);
    this.#intervalId = undefined;
    this.#onStop();
  }

  #handleIntervalTick() {
    // Execute all callbacks registered for this interval
    this.#subscriptions.forEach((subscription) => {
      const { callback, once } = subscription;
      try {
        callback();
      } catch (error) {
        // Catch errors to prevent one callback from breaking others
        console.error("Error in interval callback:", error);
      } finally {
        if (once) {
          this.delete(subscription);
        }
      }
    });
  }

  get subscriptionCount(): number {
    return this.#subscriptions.size;
  }
}
