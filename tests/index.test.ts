import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { IntervalPool } from "../src/index";
import { testPoolOptions } from "./helpers";

describe("IntervalPool", () => {
  let pool: IntervalPool;

  beforeEach(() => {
    vi.useFakeTimers();
    pool = new IntervalPool(testPoolOptions);
  });

  afterEach(() => {
    pool.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("run", () => {
    test("should execute callback at specified interval", () => {
      const callback = vi.fn();
      pool.run(1000, callback);

      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(3);
    });

    test("should not execute callback before interval", () => {
      const callback = vi.fn();
      pool.run(2000, callback);

      vi.advanceTimersByTime(1000);
      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(999);
      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    test("should execute multiple callbacks with same interval", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      pool.run(1000, callback1);
      pool.run(1000, callback2);
      pool.run(1000, callback3);

      vi.advanceTimersByTime(1000);

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });

    test("should handle different interval durations separately", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      pool.run(1000, callback1);
      pool.run(2000, callback2);

      vi.advanceTimersByTime(1000);
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(callback1).toHaveBeenCalledTimes(2);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    test("should run callbacks on the order they were added", () => {
      const fn = vi.fn();

      pool.run(1000, () => fn("first"));
      pool.run(1000, () => fn("second"));
      pool.run(1000, () => fn("third"));

      vi.advanceTimersByTime(1000);

      expect(fn).toHaveBeenNthCalledWith(1, "first");
      expect(fn).toHaveBeenNthCalledWith(2, "second");
      expect(fn).toHaveBeenNthCalledWith(3, "third");
    });

    test("should not dedupe callbacks by reference equality", () => {
      const fn = vi.fn();
      const callback = () => fn("called");
      pool.run(1000, callback);
      pool.run(1000, callback);
      pool.run(1000, callback);
      vi.advanceTimersByTime(1000);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    test("should return an unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = pool.run(1000, callback);

      expect(typeof unsubscribe).toBe("function");
    });

    test("should catch and log errors in callbacks without affecting other callbacks", () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const errorCallback = vi.fn(() => {
        throw new Error("Test error");
      });
      const normalCallback1 = vi.fn();
      const normalCallback2 = vi.fn();

      pool.run(1000, normalCallback1);
      pool.run(1000, errorCallback);
      pool.run(1000, normalCallback2);

      vi.advanceTimersByTime(1000);

      expect(errorCallback).toHaveBeenCalledTimes(1);
      expect(normalCallback1).toHaveBeenCalledTimes(1);
      expect(normalCallback2).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    test("calling unsubscribe after clearing pool should be safe", () => {
      const callback = vi.fn();
      const unsubscribe = pool.run(1000, callback);

      pool.clear();

      vi.advanceTimersByTime(5000);

      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe("once", () => {
    test("should execute callback only once on next tick", () => {
      const cb = vi.fn();
      pool.once(1000, cb);

      expect(cb).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(cb).toHaveBeenCalledTimes(1);

      // Ensure it does not run again
      vi.advanceTimersByTime(2000);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    test("should not execute when unsubscribed before first tick", () => {
      const cb = vi.fn();
      const unsubscribe = pool.once(1000, cb);

      unsubscribe();

      vi.advanceTimersByTime(1000);
      expect(cb).not.toHaveBeenCalled();
    });

    test("should allow multiple once callbacks even with same reference", () => {
      const fn = vi.fn();
      const callback = () => fn("called");

      pool.once(1000, callback);
      pool.once(1000, callback);
      pool.once(1000, callback);

      vi.advanceTimersByTime(1000);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    test("should not affect regular interval callbacks", () => {
      const onceCb = vi.fn();
      const regularCb = vi.fn();

      pool.once(1000, onceCb);
      pool.run(1000, regularCb);

      vi.advanceTimersByTime(1000);
      expect(onceCb).toHaveBeenCalledTimes(1);
      expect(regularCb).toHaveBeenCalledTimes(1);

      // Regular callback continues, once callback does not
      vi.advanceTimersByTime(1000);
      expect(onceCb).toHaveBeenCalledTimes(1);
      expect(regularCb).toHaveBeenCalledTimes(2);
    });

    test("should stop after first tick even if callback throws", () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const errorCb = vi.fn(() => {
        throw new Error("Test error");
      });

      pool.once(1000, errorCb);

      vi.advanceTimersByTime(1000);
      expect(errorCb).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalled();

      // Ensure it does not run again
      vi.advanceTimersByTime(2000);
      expect(errorCb).toHaveBeenCalledTimes(1);
    });

    test("ensure subscription is removed even if callback throws", () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const errorCb = vi.fn(() => {
        throw new Error("Test error");
      });

      pool.once(1000, errorCb);

      expect(pool.getSubscriptionCount(1000)).toBe(1);

      vi.advanceTimersByTime(1000);
      expect(errorCb).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalled();

      expect(pool.getSubscriptionCount(1000)).toBe(0);
    });
  });

  describe("unsubscribe", () => {
    test("should stop executing callback after unsubscribe", () => {
      const callback = vi.fn();
      const unsubscribe = pool.run(1000, callback);

      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(1); // Should still be 1

      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(1); // Should still be 1
    });

    test("should only unsubscribe specific callback", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const unsubscribe1 = pool.run(1000, callback1);
      pool.run(1000, callback2);

      vi.advanceTimersByTime(1000);
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);

      unsubscribe1();

      vi.advanceTimersByTime(1000);
      expect(callback1).toHaveBeenCalledTimes(1); // Stopped
      expect(callback2).toHaveBeenCalledTimes(2); // Still running
    });

    test("should clear interval when last callback is unsubscribed", () => {
      const callback = vi.fn();
      const unsubscribe = pool.run(1000, callback);

      expect(pool.getActiveIntervalCount()).toBe(1);

      unsubscribe();

      expect(pool.getActiveIntervalCount()).toBe(0);
    });

    test("should handle multiple unsubscribe calls gracefully", () => {
      const callback = vi.fn();
      const unsubscribe = pool.run(1000, callback);

      unsubscribe();
      unsubscribe(); // Should not throw

      expect(pool.getActiveIntervalCount()).toBe(0);
    });
  });

  describe("iterate", () => {
    test("should yield at specified intervals", async () => {
      const cb = vi.fn();

      const iteratePromise = (async () => {
        let count = 0;
        for await (const _ of pool.iterate(1000)) {
          cb();
          count++;
          if (count >= 3) break;
        }
      })();

      // Advance timers and run microtasks
      vi.advanceTimersByTime(3000);

      await iteratePromise;

      expect(cb).toHaveBeenCalledTimes(3);
    });

    test("should stop iteration when breaking from loop", async () => {
      const callback = vi.fn();
      const MS = 1000;

      const iteratePromise = (async () => {
        let count = 0;
        for await (const _ of pool.iterate(MS)) {
          callback();
          count++;
          if (count >= 2) break;
        }
      })();

      expect(pool.getSubscriptionCount(MS)).toBe(1);

      vi.advanceTimersByTime(MS * 3);

      await iteratePromise;

      expect(callback).toHaveBeenCalledTimes(2);
      expect(pool.getSubscriptionCount(MS)).toBe(0);
    });

    test("should clean up interval after iteration ends", async () => {
      const iteratePromise = (async () => {
        for await (const _ of pool.iterate(1000)) {
          break; // Immediately break
        }
      })();

      vi.advanceTimersByTime(1000);
      await iteratePromise;

      expect(pool.getActiveIntervalCount()).toBe(0);
    });

    test("should handle multiple concurrent iterations", async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const iterate1 = (async () => {
        let count = 0;
        for await (const _ of pool.iterate(1000)) {
          callback1();
          if (++count >= 2) break;
        }
      })();

      const iterate2 = (async () => {
        let count = 0;
        for await (const _ of pool.iterate(1000)) {
          callback2();
          if (++count >= 2) break;
        }
      })();

      vi.advanceTimersByTime(2000);

      await Promise.all([iterate1, iterate2]);

      expect(callback1).toHaveBeenCalledTimes(2);
      expect(callback2).toHaveBeenCalledTimes(2);
    });

    test("should yield missed interval ticks", { timeout: 500 }, async () => {
      const MS = 1000;
      const iterator = pool.iterate(MS);

      iterator.next(); // Start the iterator

      // Advance 10 ticks
      vi.advanceTimersByTime(MS * 10);

      // If the promise hangs here, means we are not yielding missed ticks
      await Promise.all(
        Array.from({ length: 9 }, () =>
          expect(iterator.next()).resolves.toEqual({
            value: undefined,
            done: false,
          }),
        ),
      );

      await expect(iterator.return()).resolves.toEqual({
        value: undefined,
        done: true,
      });
    });
  });

  describe("clear", () => {
    test("should clear all interval pools", () => {
      pool.run(1000, vi.fn());
      pool.run(2000, vi.fn());
      pool.run(3000, vi.fn());

      expect(pool.getActiveIntervalCount()).toBe(3);

      pool.clear();

      expect(pool.getActiveIntervalCount()).toBe(0);
    });

    test("should stop all callbacks after clearing", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      pool.run(1000, callback1);
      pool.run(2000, callback2);

      pool.clear();

      vi.advanceTimersByTime(5000);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe("getActiveIntervalCount", () => {
    test("should return 0 when no pools exist", () => {
      expect(pool.getActiveIntervalCount()).toBe(0);
    });

    test("should return correct count of active pools", () => {
      pool.run(1000, vi.fn());
      expect(pool.getActiveIntervalCount()).toBe(1);

      pool.run(2000, vi.fn());
      expect(pool.getActiveIntervalCount()).toBe(2);

      pool.run(1000, vi.fn()); // Same delay, should not increase count
      expect(pool.getActiveIntervalCount()).toBe(2);
    });
  });

  describe("getSubscriptionCount", () => {
    test("should return 0 for non-existent pool", () => {
      expect(pool.getSubscriptionCount(1000)).toBe(0);
    });

    test("should return correct callback count for specific delay", () => {
      pool.run(1000, vi.fn());
      expect(pool.getSubscriptionCount(1000)).toBe(1);

      pool.run(1000, vi.fn());
      expect(pool.getSubscriptionCount(1000)).toBe(2);

      pool.run(2000, vi.fn());
      expect(pool.getSubscriptionCount(1000)).toBe(2); // Should not change
      expect(pool.getSubscriptionCount(2000)).toBe(1);
    });

    test("should return 0 after all callbacks unsubscribed", () => {
      const unsubscribe1 = pool.run(1000, vi.fn());
      const unsubscribe2 = pool.run(1000, vi.fn());

      expect(pool.getSubscriptionCount(1000)).toBe(2);

      unsubscribe1();
      expect(pool.getSubscriptionCount(1000)).toBe(1);

      unsubscribe2();
      expect(pool.getSubscriptionCount(1000)).toBe(0);
    });
  });

  describe("getStats", () => {
    test("should return empty array when no pools exist", () => {
      expect(pool.getStats()).toEqual([]);
    });

    test("should return stats for all active pools", () => {
      pool.run(1000, vi.fn());
      pool.run(1000, vi.fn());
      pool.run(2000, vi.fn());
      pool.run(3000, vi.fn());
      pool.run(3000, vi.fn());
      pool.run(3000, vi.fn());

      const stats = pool.getStats();

      expect(stats).toHaveLength(3);
      expect(stats).toContainEqual({ delay: 1000, subscriptionCount: 2 });
      expect(stats).toContainEqual({ delay: 2000, subscriptionCount: 1 });
      expect(stats).toContainEqual({ delay: 3000, subscriptionCount: 3 });
    });
  });

  describe("edge cases", () => {
    test("should handle many callbacks on same interval", () => {
      const A_SECOND = 1000;
      const callbacks = Array.from({ length: 100 }, () => vi.fn());
      callbacks.forEach((cb) => pool.run(A_SECOND, cb));

      expect(pool.getSubscriptionCount(A_SECOND)).toBe(100);

      vi.advanceTimersByTime(A_SECOND);

      callbacks.forEach((cb) => {
        expect(cb).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("memory management", () => {
    test("should not create multiple intervals for same delay", () => {
      const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

      pool.run(1000, vi.fn());
      pool.run(1000, vi.fn());
      pool.run(1000, vi.fn());

      // Should only call setInterval once for the same delay
      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    });

    test("should clean up interval when pool is empty", () => {
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");

      const unsubscribe1 = pool.run(1000, vi.fn());
      const unsubscribe2 = pool.run(1000, vi.fn());

      unsubscribe1();
      expect(clearIntervalSpy).not.toHaveBeenCalled();

      unsubscribe2();
      expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("multiple pool instances", () => {
    test("should manage intervals independently between instances", () => {
      const pool1 = new IntervalPool(testPoolOptions);
      const pool2 = new IntervalPool(testPoolOptions);

      const callback1 = vi.fn();
      const callback2 = vi.fn();

      pool1.run(1000, callback1);
      pool2.run(1000, callback2);

      expect(pool1.getActiveIntervalCount()).toBe(1);
      expect(pool2.getActiveIntervalCount()).toBe(1);

      pool1.clear();

      expect(pool1.getActiveIntervalCount()).toBe(0);
      expect(pool2.getActiveIntervalCount()).toBe(1);

      vi.advanceTimersByTime(1000);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);

      pool2.clear();
    });
  });
});
