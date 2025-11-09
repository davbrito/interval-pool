import type { IntervalPoolOptions } from "../src";

// do this to ensure we are always using the mocked timers
export const testIntervalImpl = {
  get set() {
    return setInterval;
  },
  get clear() {
    return clearInterval;
  },
};

export const testPoolOptions: IntervalPoolOptions = {
  interval: testIntervalImpl,
};
