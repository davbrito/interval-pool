import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomInterval } from "../src";
import { IntervalBucket, type IntervalSubscription } from "../src/bucket";
import { testIntervalImpl } from "./helpers";

describe("IntervalBucket", () => {
  const DELAY = 100;
  const mockInterval: CustomInterval = testIntervalImpl;
  let onStopMock: () => void;
  let bucket: IntervalBucket;

  beforeEach(() => {
    vi.useFakeTimers();
    onStopMock = vi.fn();
    bucket = new IntervalBucket(mockInterval, DELAY, onStopMock);
  });

  afterEach(() => {
    bucket.dispose();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should start interval when first subscription is added", () => {
    const callback = vi.fn();
    const subscription: IntervalSubscription = { callback };

    bucket.add(subscription);

    expect(vi.getTimerCount()).toBe(1);
  });

  it("should not start interval twice when multiple subscriptions are added", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    bucket.add({ callback: callback1 });
    bucket.add({ callback: callback2 });

    expect(vi.getTimerCount()).toBe(1);
  });

  it("should execute all callbacks on interval tick", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    bucket.add({ callback: callback1 });
    bucket.add({ callback: callback2 });

    vi.advanceTimersByTime(DELAY);

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(DELAY);

    expect(callback1).toHaveBeenCalledTimes(2);
    expect(callback2).toHaveBeenCalledTimes(2);
  });

  it("should stop interval when all subscriptions are removed", () => {
    const callback = vi.fn();
    const subscription: IntervalSubscription = { callback };

    bucket.add(subscription);

    expect(vi.getTimerCount()).toBe(1);
    expect(callback).not.toHaveBeenCalled();

    bucket.delete(subscription);

    expect(vi.getTimerCount()).toBe(0);
    expect(onStopMock).toHaveBeenCalledTimes(1);
  });

  it("should not stop interval if subscriptions remain", () => {
    const subscription1: IntervalSubscription = { callback: vi.fn() };
    const subscription2: IntervalSubscription = { callback: vi.fn() };

    bucket.add(subscription1);
    bucket.add(subscription2);
    bucket.delete(subscription1);

    expect(vi.getTimerCount()).toBe(1);
    expect(onStopMock).not.toHaveBeenCalled();
  });

  it("should handle once subscriptions correctly", () => {
    const callback = vi.fn();

    bucket.add({ callback, once: true });

    vi.advanceTimersByTime(DELAY);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(bucket.subscriptionCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("should catch and log errors in callbacks without stopping other callbacks", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const errorCallback = vi.fn(() => {
      throw new Error("Test error");
    });
    const normalCallback = vi.fn();

    bucket.add({ callback: errorCallback });
    bucket.add({ callback: normalCallback });

    vi.advanceTimersByTime(DELAY);

    expect(errorCallback).toHaveBeenCalledTimes(1);
    expect(normalCallback).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("should remove once subscription even if callback throws error", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const errorCallback = vi.fn(() => {
      throw new Error("Test error");
    });
    const subscription: IntervalSubscription = {
      callback: errorCallback,
      once: true,
    };

    bucket.add(subscription);

    vi.advanceTimersByTime(DELAY);

    expect(bucket.subscriptionCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("should clear all subscriptions on dispose", () => {
    bucket.add({ callback: vi.fn() });
    bucket.add({ callback: vi.fn() });

    expect(bucket.subscriptionCount).toBe(2);

    bucket.dispose();

    expect(bucket.subscriptionCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("should return correct subscription count", () => {
    expect(bucket.subscriptionCount).toBe(0);

    const sub1: IntervalSubscription = { callback: vi.fn() };
    const sub2: IntervalSubscription = { callback: vi.fn() };

    bucket.add(sub1);
    expect(bucket.subscriptionCount).toBe(1);

    bucket.add(sub2);
    expect(bucket.subscriptionCount).toBe(2);

    bucket.delete(sub1);
    expect(bucket.subscriptionCount).toBe(1);
  });
});
