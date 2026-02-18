# Load Shedding

## Overview

Load shedding is a mechanism that automatically stops routing requests to workers that are overloaded. When a worker's Event Loop Utilization (ELU) or heap memory usage exceeds configured thresholds, the runtime pauses that worker in the mesh network so it stops receiving new requests. Once the worker recovers, routing resumes automatically.

This prevents cascading failures where an overloaded worker processes requests slowly, backing up callers and degrading the entire system.

## How It Works

The runtime already collects health metrics from every worker once per second (ELU, heap usage). When load shedding is enabled, the runtime compares each worker's metrics against the configured thresholds after every collection cycle.

When a worker transitions from healthy to overloaded:

1. The runtime calls `pauseWorker()` on the mesh interceptor.
2. The worker is marked as not-ready in the round-robin routing table.
3. This state is propagated to all other workers in the mesh network.
4. Subsequent requests to that service skip the paused worker.

When a worker transitions from overloaded back to healthy:

1. The runtime calls `resumeWorker()` on the mesh interceptor.
2. The worker is marked as ready and starts receiving requests again.
3. The state change is propagated across the mesh.

If all workers for a service are paused, requests to that service will fail with a "No target found" error.

### Relationship to Dynamic Workers

Load shedding and [dynamic workers](./dynamic-workers.md) are independent, complementary features:

- **Dynamic workers** adjusts capacity over time by spawning or terminating worker threads based on sustained ELU trends.
- **Load shedding** provides immediate protection by stopping traffic to workers that are already overloaded.

Both can be enabled simultaneously. The dynamic worker scaler will add more workers when load is consistently high, while load shedding prevents overloaded workers from receiving requests in the meantime.

## Configuration

Add a `loadShedding` property to your runtime configuration (`watt.json` or `platformatic.json`):

```json
{
  "loadShedding": {
    "enabled": true,
    "maxELU": 0.9,
    "maxHeapUsedRatio": 0.95
  }
}
```

### Global Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable load shedding |
| `maxELU` | `number` (0-1) | `0.9` | ELU threshold above which a worker is paused |
| `maxHeapUsedRatio` | `number` (0-1) | `0.95` | Heap used/total ratio threshold above which a worker is paused |

### Per-Application Overrides

You can override thresholds for individual applications using the `applications` property. Keys are application IDs:

```json
{
  "loadShedding": {
    "enabled": true,
    "maxELU": 0.9,
    "applications": {
      "critical-api": {
        "maxELU": 0.95
      },
      "background-jobs": {
        "maxELU": 0.7
      },
      "static-assets": {
        "enabled": false
      }
    }
  }
}
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `enabled` | `boolean` | global value | Set to `false` to disable load shedding for this application |
| `maxELU` | `number` (0-1) | global value | Override the ELU threshold for this application |
| `maxHeapUsedRatio` | `number` (0-1) | global value | Override the heap ratio threshold for this application |

## Behavior

### Fail-Open

Load shedding is designed to fail open. If no health data is available yet (during startup) or data is missing for a worker, the worker is treated as accepting requests. The system never blocks traffic without evidence of overload.

### Detection Latency

Health metrics are collected every 1 second. This means there is up to a 1-second delay between a worker becoming overloaded and being paused. During this window, the worker continues to receive requests.

### Recovery

Once a worker's ELU drops below `maxELU` and heap usage drops below `maxHeapUsedRatio`, it is automatically resumed on the next health check cycle. No manual intervention is required.

## Example

A runtime with two services, where the API has stricter thresholds than the frontend:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/runtime/2.0.0.json",
  "entrypoint": "frontend",
  "autoload": {
    "path": "services"
  },
  "loadShedding": {
    "enabled": true,
    "maxELU": 0.9,
    "maxHeapUsedRatio": 0.95,
    "applications": {
      "api": {
        "maxELU": 0.85
      }
    }
  }
}
```

When the `api` service workers hit 85% ELU, they stop receiving requests. Requests to `frontend` continue as normal unless its workers also exceed the default 90% threshold.
