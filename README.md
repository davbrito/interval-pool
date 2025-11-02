# interval-pool

A simple interval pool library for managing and reusing intervals efficiently in JavaScript/TypeScript.

## 📦 Installation

```bash
npm install interval-pool
```

```bash
pnpm add interval-pool
```

```bash
yarn add interval-pool
```

## 🚀 Features

- **Efficient Interval Management**: Pool and reuse `setInterval` calls to optimize performance
- **TypeScript Support**: Fully typed for better developer experience
- **Async Iterator Support**: Modern `for await...of` syntax
- **Custom Interval Implementation**: Inject custom setInterval/clearInterval for testing
- **Lightweight**: Minimal dependencies and small bundle size
- **Modern ESM**: Built with modern JavaScript modules

## 📖 Usage

### Basic Example

```typescript
import { IntervalPool } from "interval-pool";

const pool = new IntervalPool();

// Run a callback every second
const unsubscribe = pool.run(1000, () => {
  console.log("This runs every second");
});

// Later, stop the execution
unsubscribe();
```

### Async Iterator

```typescript
import { IntervalPool } from "interval-pool";

const pool = new IntervalPool();

// Use for-await-of for modern async patterns
for await (const _ of pool.iterate(2000)) {
  console.log("This runs every 2 seconds");

  // Break to stop the iteration
  if (someCondition) break;
}
```

### Multiple Callbacks with Same Interval

One of the main benefits is that multiple callbacks with the same interval duration share a single underlying `setInterval`:

```typescript
import { IntervalPool } from "interval-pool";

const pool = new IntervalPool();

// All three callbacks share the same setInterval internally
const unsubscribe1 = pool.run(1000, () => console.log("Callback 1"));
const unsubscribe2 = pool.run(1000, () => console.log("Callback 2"));
const unsubscribe3 = pool.run(1000, () => console.log("Callback 3"));

// Unsubscribe individually
unsubscribe1();
unsubscribe2();
unsubscribe3();
```

### One-Time Execution

```typescript
import { IntervalPool } from "interval-pool";

const pool = new IntervalPool();

// Execute callback only on the next interval tick
pool.once(1000, () => {
  console.log("This runs only once on the next tick");
});
```

**Note**: `once()` doesn't guarantee execution after exactly `delay` milliseconds, but rather on the next tick of the interval pool for the specified delay.

### Pool Management

```typescript
import { IntervalPool } from "interval-pool";

const pool = new IntervalPool();

// Create some subscriptions
pool.run(1000, () => console.log("1s"));
pool.run(1000, () => console.log("1s"));
pool.run(2000, () => console.log("2s"));

// Check how many pools are active
console.log(pool.getActiveIntervalCount()); // 2 (one for 1000ms, one for 2000ms)

// Check subscriptions for specific interval
console.log(pool.getSubscriptionCount(1000)); // 2

// Get detailed statistics
console.log(pool.getStats());
// [
//   { delay: 1000, subscriptionCount: 2 },
//   { delay: 2000, subscriptionCount: 1 }
// ]

// Clear all intervals (useful for cleanup)
pool.clear();
```

### Custom Interval Implementation

Use custom interval implementations for scenarios like handling intervals longer than JavaScript's maximum timeout (2,147,483,647 ms / ~24.8 days):

```typescript
import { IntervalPool } from "interval-pool";
import lt from "long-timeout";

const pool = new IntervalPool({
  interval: {
    set: lt.setInterval,
    clear: clearInterval,
  },
});

// Now you can use very long intervals (e.g., monthly tasks)
pool.run(30 * 24 * 60 * 60 * 1000, () => {
  console.log("This runs every 30 days");
});
```

### React Example

```typescript
import { useEffect } from 'react';
import { IntervalPool } from 'interval-pool';

// Create pool outside component to reuse across instances
const pool = new IntervalPool();

function MyComponent() {
  useEffect(() => {
    const unsubscribe = pool.run(5000, () => {
      console.log('Polling data...');
    });

    // Cleanup on unmount
    return () => unsubscribe();
  }, []);

  return <div>My Component</div>;
}
```

### Error Handling

Errors in one callback won't affect other callbacks in the same pool:

```typescript
import { IntervalPool } from "interval-pool";

const pool = new IntervalPool();

pool.run(1000, () => {
  throw new Error("This will be caught and logged");
});

pool.run(1000, () => {
  console.log("This still executes despite the error above");
});
```

## 📚 API Reference

### `IntervalPool`

The main class for managing interval pools.

#### Constructor

```typescript
new IntervalPool(options?: IntervalPoolOptions)
```

**Options:**

- `interval?: CustomInterval` - Custom implementation of setInterval/clearInterval

#### Methods

##### `run(delay: number, callback: () => void): () => void`

Runs a callback at regular intervals.

**Parameters:**

- `delay` - The time in milliseconds between executions
- `callback` - The function to execute at each interval

**Returns:** An unsubscribe function to stop the execution

---

##### `once(delay: number, callback: () => void): () => void`

Executes a callback only once on the next interval tick.

**Parameters:**

- `delay` - The time in milliseconds for the interval pool
- `callback` - The function to execute once

**Returns:** An unsubscribe function (in case you want to cancel before execution)

---

##### `iterate(delay: number): AsyncGenerator<void>`

Creates an async iterable that yields at regular intervals.

**Parameters:**

- `delay` - The time in milliseconds between iterations

**Yields:** Void on each interval tick

---

##### `clear(): void`

Clears all intervals managed by this pool.

---

##### `getActiveIntervalCount(): number`

Gets the number of active interval pools (unique delays).

**Returns:** The number of unique interval durations currently being managed

---

##### `getSubscriptionCount(delay: number): number`

Gets the number of callbacks registered for a specific interval duration.

**Parameters:**

- `delay` - The interval duration in milliseconds

**Returns:** The number of callbacks registered for this delay

---

##### `getStats(): Array<{ delay: number; subscriptionCount: number }>`

Gets statistics about all active interval pools.

**Returns:** An array of objects containing delay and subscription count for each pool

### Types

```typescript
type IntervalCallback = () => void;
type UnsubscribeFunction = () => void;

interface CustomInterval<TId = any> {
  set: (handler: IntervalCallback, timeout: number) => TId;
  clear: (id: TId) => void;
}

interface IntervalPoolOptions {
  interval?: CustomInterval;
}
```

## 💡 Use Cases

### 1. API Polling & Data Fetching

When multiple components need to poll the same API endpoint, `interval-pool` prevents redundant timers.

```typescript
import { IntervalPool } from "interval-pool";

const pool = new IntervalPool();

// Multiple components polling user data
function UserProfile() {
  useEffect(() => {
    const unsubscribe = pool.run(5000, async () => {
      const user = await fetchUserData();
      setUserData(user);
    });
    return () => unsubscribe();
  }, []);
}

function UserStats() {
  useEffect(() => {
    const unsubscribe = pool.run(5000, async () => {
      const stats = await fetchUserStats();
      setStats(stats);
    });
    return () => unsubscribe();
  }, []);
}

// ✅ Both components share the same 5-second interval
// ❌ Without pool: 2 separate setInterval calls
```

**Benefits:**

- Reduced network overhead when requests can be batched
- Lower CPU usage from fewer timer checks
- Synchronized updates across components

### 2. Auto-save in Text Editors

Implement efficient auto-save functionality that doesn't create multiple timers.

```typescript
import { IntervalPool } from "interval-pool";

class DocumentEditor {
  private pool = new IntervalPool();
  private hasUnsavedChanges = false;

  constructor() {
    // Auto-save every 30 seconds
    this.pool.run(30000, () => {
      if (this.hasUnsavedChanges) {
        this.saveDocument();
        this.hasUnsavedChanges = false;
      }
    });
  }

  onTextChange() {
    this.hasUnsavedChanges = true;
  }

  async saveDocument() {
    await api.saveDocument(this.content);
    console.log("Document saved");
  }
}
```

**Benefits:**

- Consistent auto-save interval across all open documents
- Memory efficient for applications with multiple editors
- Easy to adjust save frequency globally

### 3. Real-time Dashboards & Monitoring

Update multiple dashboard widgets efficiently with synchronized intervals.

```typescript
import { IntervalPool } from "interval-pool";

const pool = new IntervalPool();

// All metrics update every 10 seconds
pool.run(10000, updateCPUMetrics);
pool.run(10000, updateMemoryMetrics);
pool.run(10000, updateNetworkMetrics);
pool.run(10000, updateDiskMetrics);

// Different intervals for different data freshness requirements
pool.run(1000, updateLiveUserCount); // Real-time
pool.run(60000, updateDailyStatistics); // Less frequent

// ✅ Only 3 timers total (1s, 10s, 60s)
// ❌ Without pool: 6 separate timers
```

**Benefits:**

- Synchronized data updates for consistent UI state
- Reduced render cycles when updates happen simultaneously
- Easy to manage different refresh rates

### 4. WebSocket Heartbeat / Keep-Alive

Maintain connection health with periodic ping messages.

```typescript
import { IntervalPool } from "interval-pool";

class WebSocketManager {
  private pool = new IntervalPool();
  private connections = new Map<string, WebSocket>();

  addConnection(id: string, ws: WebSocket) {
    this.connections.set(id, ws);

    // All connections share the same heartbeat interval
    const unsubscribe = this.pool.run(30000, () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      } else {
        unsubscribe();
        this.connections.delete(id);
      }
    });
  }
}
```

**Benefits:**

- All connections ping simultaneously (easier server-side handling)
- Scales efficiently to hundreds of connections
- Single timer manages all heartbeats

### 5. Game Loops & Animations

Synchronize multiple game systems or animation loops.

```typescript
import { IntervalPool } from "interval-pool";

class Game {
  private pool = new IntervalPool();

  start() {
    // 60 FPS game loop (16.67ms)
    this.pool.run(16, () => this.update());
    this.pool.run(16, () => this.render());

    // AI updates at 10 FPS (100ms)
    this.pool.run(100, () => this.updateAI());

    // Auto-save every 5 minutes
    this.pool.run(300000, () => this.saveGameState());

    // Spawn enemies every 30 seconds
    this.pool.run(30000, () => this.spawnEnemies());
  }

  update() {
    /* physics, collisions */
  }
  render() {
    /* draw sprites */
  }
  updateAI() {
    /* enemy AI logic */
  }
  saveGameState() {
    /* persist to localStorage */
  }
  spawnEnemies() {
    /* add new enemies */
  }
}
```

**Benefits:**

- Frame-perfect synchronization of update and render
- Different systems can run at optimal frequencies
- Easy to pause/resume entire game loop

### 6. Background Tasks & Maintenance

Schedule periodic maintenance tasks efficiently.

```typescript
import { IntervalPool } from "interval-pool";
import lt from "long-timeout";

const pool = new IntervalPool({
  interval: {
    set: (cb, delay) => lt.setInterval(cb, delay),
    clear: (id) => lt.clearInterval(id),
  },
});

// Various maintenance schedules
pool.run(5 * 60 * 1000, () => {
  // Every 5 minutes: Clear temporary files
  cleanupTempFiles();
});

pool.run(60 * 60 * 1000, () => {
  // Every hour: Compact database
  compactDatabase();
});

pool.run(24 * 60 * 60 * 1000, () => {
  // Every day: Generate daily reports
  generateDailyReport();
});

pool.run(7 * 24 * 60 * 60 * 1000, () => {
  // Every week: Backup data
  performWeeklyBackup();
});
```

**Benefits:**

- Centralized task scheduling
- Support for very long intervals with custom implementation
- Easy to add/remove scheduled tasks

### 7. Session Management & Token Refresh

Automatically refresh authentication tokens before expiration.

```typescript
import { IntervalPool } from "interval-pool";

class AuthManager {
  private pool = new IntervalPool();
  private tokenExpiresIn = 15 * 60 * 1000; // 15 minutes

  async login(credentials: Credentials) {
    const { token, expiresIn } = await api.login(credentials);
    this.tokenExpiresIn = expiresIn;

    // Refresh token at 80% of expiration time
    const refreshInterval = expiresIn * 0.8;

    this.pool.run(refreshInterval, async () => {
      try {
        const newToken = await api.refreshToken(token);
        this.updateToken(newToken);
      } catch (error) {
        console.error("Token refresh failed:", error);
        this.logout();
      }
    });
  }

  logout() {
    this.pool.clear(); // Stop all refresh attempts
  }
}
```

**Benefits:**

- Prevents token expiration without user action
- Multiple auth tokens can share refresh intervals
- Clean cleanup on logout

### 8. Rate Limiting & Throttling

Process queued items with rate limits.

```typescript
import { IntervalPool } from "interval-pool";

class RateLimitedQueue<T> {
  private pool = new IntervalPool();
  private queue: T[] = [];
  private processing = false;

  constructor(
    private processor: (item: T) => Promise<void>,
    private itemsPerSecond: number,
  ) {
    const interval = 1000 / itemsPerSecond;

    this.pool.run(interval, async () => {
      if (this.queue.length > 0 && !this.processing) {
        this.processing = true;
        const item = this.queue.shift()!;

        try {
          await this.processor(item);
        } catch (error) {
          console.error("Processing error:", error);
        } finally {
          this.processing = false;
        }
      }
    });
  }

  enqueue(item: T) {
    this.queue.push(item);
  }
}

// Usage: Process max 5 API requests per second
const apiQueue = new RateLimitedQueue(
  async (request) => await api.call(request),
  5,
);

apiQueue.enqueue(request1);
apiQueue.enqueue(request2);
// Requests processed at controlled rate
```

**Benefits:**

- Prevents API rate limit violations
- Smooth processing without bursts
- Multiple queues can share the same interval resolution

### 9. IoT & Sensor Data Collection

Efficiently collect data from multiple sensors.

```typescript
import { IntervalPool } from "interval-pool";

class SensorNetwork {
  private pool = new IntervalPool();

  constructor() {
    // High-frequency sensors (1 second)
    this.pool.run(1000, () => this.readTemperature());
    this.pool.run(1000, () => this.readHumidity());
    this.pool.run(1000, () => this.readAirQuality());

    // Medium-frequency sensors (5 seconds)
    this.pool.run(5000, () => this.readPressure());
    this.pool.run(5000, () => this.readLight());

    // Low-frequency sensors (30 seconds)
    this.pool.run(30000, () => this.readSoilMoisture());
    this.pool.run(30000, () => this.readBatteryLevel());
  }

  readTemperature() {
    const temp = sensor.getTemperature();
    this.sendData("temperature", temp);
  }

  // ... other sensor readings
}
```

**Benefits:**

- Synchronized sensor readings reduce power consumption
- Efficient bandwidth usage when data is transmitted together
- Easy to adjust sampling rates

### 10. Progressive Web App (PWA) Background Sync

Coordinate background sync tasks in PWAs.

```typescript
import { IntervalPool } from "interval-pool";

class BackgroundSyncManager {
  private pool = new IntervalPool();

  constructor() {
    // Check for offline actions every 30 seconds
    this.pool.run(30000, async () => {
      if (navigator.onLine) {
        await this.syncOfflineActions();
      }
    });

    // Update cached data every 5 minutes
    this.pool.run(300000, async () => {
      if (navigator.onLine) {
        await this.updateCache();
      }
    });

    // Clean old cache entries every hour
    this.pool.run(3600000, async () => {
      await this.cleanOldCacheEntries();
    });
  }

  async syncOfflineActions() {
    const actions = await db.getOfflineActions();
    for (const action of actions) {
      await api.sync(action);
      await db.removeAction(action.id);
    }
  }
}
```

**Benefits:**

- Coordinates multiple background tasks efficiently
- Respects network availability
- Optimizes battery usage on mobile devices

## 📊 Performance Benefits

**Without IntervalPool:**

```typescript
setInterval(callback1, 1000); // Timer 1
setInterval(callback2, 1000); // Timer 2
setInterval(callback3, 1000); // Timer 3
// = 3 system timers
```

**With IntervalPool:**

```typescript
pool.run(1000, callback1);
pool.run(1000, callback2);
pool.run(1000, callback3);
// = 1 shared system timer
```

## 🛠️ Development

### Prerequisites

- Node.js (latest LTS recommended)
- pnpm 10.20.0+ (managed via packageManager field)

### Setup

```bash
# Install dependencies
pnpm install

# Run in development mode (watch mode)
pnpm dev

# Run tests
pnpm test

# Type checking
pnpm typecheck

# Build the project
pnpm build
```

## 📝 Scripts

- `pnpm build` - Build the project using tsdown
- `pnpm dev` - Run tsdown in watch mode for development
- `pnpm test` - Run tests using Vitest
- `pnpm typecheck` - Run TypeScript type checking

## 🧪 Testing

This project uses [Vitest](https://vitest.dev/) for testing.

```bash
pnpm test
```

## 📄 License

MIT © David Brito

## 🐛 Issues

If you find any bugs or have feature requests, please [open an issue](https://github.com/davbrito/interval-pool/issues).

## 🤝 Contributing

Contributions are welcome! Feel free to submit a Pull Request.

---

**Repository**: [github.com/davbrito/interval-pool](https://github.com/davbrito/interval-pool)
