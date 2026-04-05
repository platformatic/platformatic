# Dynamic Workers

## Overview

Dynamic Workers is an automatic resource allocation system that dynamically adjusts the number of workers for applications based on health metrics. It intelligently balances computational resources across multiple applications while respecting system constraints.

Two scaling algorithms are available:

- **v1** (default) — Threshold-based scaling using averaged ELU metrics over time windows
- **v2** — Predictive scaling using Holt-Winters trend forecasting for proactive capacity management

Select the algorithm using the `version` field in the `workers` configuration:

```json
{
  "workers": {
    "dynamic": true,
    "version": "v2"
  }
}
```

---

## v1: Threshold-Based Scaling (Default)

### How It Works

### Health Metrics

The algorithm uses two primary health metrics:

#### Event Loop Utilization (ELU)
ELU measures how busy the Node.js event loop is:
- **0.0** = Event loop is completely idle
- **1.0** = Event loop is fully saturated

ELU values are collected continuously from all workers and averaged over a configurable time window to smooth out temporary spikes and make stable scaling decisions.

#### Memory Usage
The algorithm tracks heap memory usage (`heapUsed` and `heapTotal`) for each worker. When making scaling decisions, it considers:
- **Total memory limit**: A configured maximum total memory (`maxTotalMemory`), defaulting to 90% of the system's total memory
- **Available memory**: Calculated as `maxTotalMemory - currently used memory`
- **Average heap usage**: The average memory consumed by workers of each application

The system memory information is obtained from cgroup files when running in containerized environments (Docker, Kubernetes), or from the operating system otherwise. This ensures that new workers are only started when there's sufficient memory available to accommodate them based on the application's average heap usage.

#### Time Windows
The algorithm uses different time windows for scale-up and scale-down decisions:
- **Scale-up time window** (`timeWindowSec`): A shorter window (default: 10 seconds) for detecting high utilization and scaling up quickly
- **Scale-down time window** (`scaleDownTimeWindowSec`): A longer window (default: 60 seconds) for detecting sustained low utilization before scaling down, preventing premature worker removal

### Scaling Logic

The algorithm operates in two modes:

1. **Reactive Mode**: Triggers immediately when any worker's ELU exceeds the scale-up threshold
2. **Periodic Mode**: Runs at regular intervals (default: every 60 seconds) regardless of metrics

Both modes analyze all applications and generate scaling recommendations:

#### 1. Metric Collection
- Collects ELU and heap memory metrics from all active workers every second
- Only collects metrics from workers that have been running for at least the grace period (default: 30 seconds)
- Maintains a rolling time window of metrics for both scale-up (default: 10 seconds) and scale-down (default: 60 seconds) decisions
- Calculates average ELU and heap usage per application across all its workers using the appropriate time window
- Checks available memory by calculating `maxTotalMemory - currently used memory`

#### 2. Application Prioritization
Applications are prioritized based on:
- Primary: ELU value (lower ELU = higher priority for scaling down)
- Secondary: Worker count (more workers = higher priority for scaling down when ELU is equal)

#### 3. Scaling Decisions

The algorithm makes decisions in this order:

**Scale Down (Low Utilization)**
- Any application with ELU below the scale-down threshold (averaged over the longer `scaleDownTimeWindowSec` window) is reduced by 1 worker
- Applications must have more workers than their configured minimum (default: 1 worker)
- Multiple applications can scale down in the same cycle

**Scale Up (High Utilization)**
- Among applications that haven't been scaled in this cycle, find the best candidate for scaling up
- The candidate selection prioritizes:
  - Primary: Highest ELU value (apps with higher load get priority)
  - Secondary: Fewest workers (smaller apps get priority when ELU is equal)
- The selected application receives 1 additional worker if:
  - Its ELU is at or above the scale-up threshold (averaged over the shorter `timeWindowSec` window)
  - It hasn't reached its configured maximum workers
  - Total workers across all apps is below `maxTotalWorkers`
  - There is sufficient available system memory (based on the application's average heap usage)
- Only one application scales up per cycle

**Important Note on Scaling Limits**
Unlike previous versions, the current algorithm does **not** perform worker reallocation between applications. If the maximum worker limit (`maxTotalWorkers`) is reached or there is insufficient memory, scaling up will not occur even if some applications have low utilization. Applications must be manually configured with appropriate min/max worker limits to ensure critical applications can scale when needed.

### Cooldown Period

After each scaling operation, the algorithm enters a cooldown period to prevent rapid oscillations. No scaling decisions are executed during cooldown, even if triggers occur.

## Configuration

### Global Workers Configuration

Add a `workers` property to your runtime configuration (`platformatic.json` or `watt.json`):

| Parameter | Description | Default |
|-----------|-------------|---------|
| **dynamic** | Enable dynamic worker scaling | `false` |
| **total** | Maximum total workers across all applications | `os.availableParallelism()` |
| **maxMemory** | Maximum total memory that can be used by all workers (bytes) | 90% of system total memory |
| **cooldown** | Cooldown period between scaling operations (milliseconds) | 20000 |
| **gracePeriod** | Delay after worker startup before collecting metrics (milliseconds) | 30000 |
| **scaleUpELU** | ELU threshold to trigger scaling up (0-1) | 0.8 |
| **scaleDownELU** | ELU threshold to trigger scaling down (0-1) | 0.2 |

Example:
```json
{
  "workers": {
    "dynamic": true,
    "total": 10,
    "gracePeriod": 30000
  }
}
```

### Per-Application Configuration

Individual applications can configure their worker limits using the `workers` property in the application config or the `runtime` section:

| Parameter | Description | Default |
|-----------|-------------|---------|
| **dynamic** | Enable dynamic worker scaling for this application | Global setting |
| **minimum** | Minimum workers for this application | 1 |
| **maximum** | Maximum workers for this application | Global total |

Example (in application's `platformatic.json`):
```json
{
  "runtime": {
    "workers": {
      "dynamic": true,
      "minimum": 2,
      "maximum": 6
    }
  }
}
```

## Behavior Examples

### Example 1: Scale Up (Under Limit, Sufficient Memory)

**Initial State:**
- App A: 2 workers, ELU = 0.85, avg heap = 500MB
- App B: 1 worker, ELU = 0.3, avg heap = 300MB
- Total: 3 workers, Max: 10
- Available memory: 4GB

**Analysis:**
- App A exceeds scale-up threshold (0.85 > 0.8)
- Under max worker limit (3 < 10)
- Sufficient memory available (4GB > 500MB needed for new worker)

**Decision:** Scale up App A to 3 workers

**Result:**
- App A: 3 workers
- App B: 1 worker

---

### Example 2: At Worker Limit - No Scaling

**Initial State:**
- App A: 2 workers, ELU = 0.9, avg heap = 600MB
- App B: 2 workers, ELU = 0.3, avg heap = 400MB
- Total: 4 workers, Max: 4
- Available memory: 2GB

**Analysis:**
- App A needs scaling (ELU = 0.9 > 0.8)
- At max worker limit (4 = 4)
- App B is below scale-down threshold (0.3 > 0.2)

**Decision:** No scaling (at max worker limit)

**Result:**
- App A: 2 workers (unchanged)
- App B: 2 workers (unchanged)

---

### Example 3: Scale Down Only

**Initial State:**
- App A: 2 workers, ELU = 0.5
- App B: 3 workers, ELU = 0.1
- Total: 5 workers, Max: 10

**Decision:** Scale down App B to 2 workers (ELU below threshold)

**Result:**
- App A: 2 workers (unchanged)
- App B: 2 workers

---

### Example 4: Multiple Scale Downs

**Initial State:**
- App A: 3 workers, ELU = 0.15
- App B: 2 workers, ELU = 0.18
- App C: 2 workers, ELU = 0.6

**Decision:** Scale down both App A and App B

**Result:**
- App A: 2 workers
- App B: 1 worker
- App C: 2 workers

---


### Example 5: No Action (Insufficient Memory)

**Initial State:**
- App A: 2 workers, ELU = 0.85, avg heap = 1.5GB
- App B: 1 worker, ELU = 0.3, avg heap = 500MB
- Total: 3 workers, Max: 10
- maxTotalMemory: 10GB
- Currently used memory: 9GB
- Available memory: 1GB (10GB - 9GB)

**Analysis:**
- App A needs scaling (ELU = 0.85 > 0.8)
- Under max worker limit (3 < 10)
- Insufficient memory for new worker (1GB available < 1.5GB needed for new worker)
- App B cannot be scaled down (already at minWorkers = 1)

**Decision:** No scaling (insufficient memory and no workers to reallocate)

---

## v2: Predictive Scaling

### The Problem with Reactive Scaling

Threshold-based scalers react when a metric crosses a limit — but by the time a new worker starts and begins absorbing traffic, the system may already be degraded. The scaler has no memory of prior state and no understanding of whether the metric is rising, falling, or stable. It cannot distinguish a sustained rise from a momentary spike, and it cannot right-size the response because it doesn't know how fast the metric is changing.

### The Core Idea

The predictive scaler uses time-series forecasting to estimate where the load will be in the near future — specifically, by the time a new worker would start and absorb its share of the traffic. If the predicted load at that future point exceeds the capacity of the current workers, the scaler adds workers *now*, so they are ready exactly when the extra capacity is needed.

This shifts the scaling decision from "we are overloaded, add capacity" to "we will be overloaded in T seconds, add capacity now so it's ready in time."

The algorithm tracks the **total load across all workers** (a sum, not a per-worker average). This is critical: a per-worker metric is corrupted by the algorithm's own scaling actions — adding a worker redistributes load and changes every worker's metric, even if external traffic is unchanged. The cluster-wide sum remains approximately invariant under scaling, allowing the algorithm to distinguish real traffic changes from internal redistribution artifacts.

### How It Works

The algorithm takes per-worker metric samples, combines them into a cluster-wide aggregate, smooths the signal to separate trend from noise, predicts where the aggregate is heading, and converts the prediction back into a worker count.

Key properties:
- **Asymmetric response** — reacts aggressively to rising load (fast smoothing) while remaining conservative on drops (slow smoothing), because the cost of being late on scale-up is higher than the cost of being late on scale-down
- **Redistribution awareness** — newly added workers haven't absorbed their share of load yet; the algorithm gradually includes them to avoid prediction artifacts during the transition period
- **Adaptive horizon** — the prediction look-ahead is tied to observed worker startup times, so the algorithm automatically adjusts how far ahead it looks based on the actual environment
- **Hysteresis** — scale-down requires a larger margin than scale-up, preventing oscillation near the threshold

Each metric (ELU, heap) is processed independently. When multiple metrics are used, the highest target worker count wins.

### Global Arbitration

When multiple applications are managed, the orchestrator coordinates scaling:

- **Scale-downs** are applied freely — all applications that need fewer workers are scaled down in the same cycle
- **Scale-ups** are limited to one per processing cycle across all applications
- When multiple applications need to scale up, the one with the **highest relative need** is chosen: `(desiredTarget - currentTarget) / currentTarget`. This favors applications with fewer workers relative to demand (scaling 1→2 has more impact than 4→5)
- Scale-ups are gated by:
  - Total worker count limit (`total`)
  - Available system memory (`maxMemory`, defaults to 90% of system memory)

### Configuration

#### Global Configuration

```json
{
  "workers": {
    "dynamic": true,
    "version": "v2",
    "minimum": 1,
    "maximum": 4,
    "total": 8,
    "eluThreshold": 0.8,
    "heapThresholdMb": 500,
    "processIntervalMs": 10000,
    "scaleUpMargin": 0.1,
    "scaleDownMargin": 0.3,
    "redistributionMs": 30000,

    "alphaUp": 0.2,
    "alphaDown": 0.1,
    "betaUp": 0.2,
    "betaDown": 0.1,
    "cooldowns": {
      "scaleUpAfterScaleUpMs": 5000,
      "scaleUpAfterScaleDownMs": 5000,
      "scaleDownAfterScaleUpMs": 30000,
      "scaleDownAfterScaleDownMs": 20000
    }
  }
}
```

**Metric thresholds:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `eluThreshold` | `0.8` | The per-worker ELU value above which a worker is considered overloaded. The algorithm uses this as the capacity limit when converting its load forecast into a worker count |
| `heapThresholdMb` | — | Per-worker heap overload threshold in MB. When set, heap is tracked as an independent metric alongside ELU — the highest worker count across all metrics wins. Disabled if absent |

**Prediction tuning:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `processIntervalMs` | `10000` | How often the algorithm runs. Samples that arrive between runs are accumulated and processed together |

| `scaleUpMargin` | `0.1` | When the predicted load requires a fractional worker (e.g. 2.08 workers), the algorithm only provisions the extra worker if the fractional part exceeds this margin. Below the margin, the evidence for the extra worker is weak — the trend may not materialize — so the algorithm waits for the next cycle to confirm |
| `scaleDownMargin` | `0.3` | After removing a worker, load redistributes across fewer workers, raising per-worker metrics. This margin ensures enough headroom to absorb that increase plus a safety buffer that prevents the removal from immediately triggering a scale-up |
| `redistributionMs` | `30000` | Expected time for a new worker to fully absorb its share of traffic. During this period, the new worker's contribution is gradually weighted from 0 to 1 in the aggregate, preventing its initially low metrics from distorting the load signal |

The algorithm uses Holt-Winters exponential smoothing with separate parameters for upward and downward movements. This asymmetry lets the algorithm react quickly to rising load while requiring sustained evidence before acting on drops.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `alphaUp` | `0.2` | Controls how much each data point moves the smoothed level when load is rising. Higher values track spikes faster but are more sensitive to noise |
| `alphaDown` | `0.1` | Same as `alphaUp` but for falling load. A lower value means the algorithm requires several ticks of sustained decrease before the level drops significantly |
| `betaUp` | `0.2` | Controls how quickly the trend changes direction when load is rising. Higher values pivot the trend immediately on reversal; lower values keep extrapolating until sustained change accumulates |
| `betaDown` | `0.1` | Same as `betaUp` but for falling trends. A lower value means the algorithm is slow to conclude that a downward trend is real |

**Cooldowns:**

Cooldowns are optional safety guards. The core algorithm already prevents cascading scale-ups by tracking pending workers that have been requested but haven't started yet. Cooldowns add additional spacing between decisions.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `cooldowns.scaleUpAfterScaleUpMs` | `5000` | Minimum time since the last scale-up decision before another scale-up is allowed |
| `cooldowns.scaleUpAfterScaleDownMs` | `5000` | Minimum time since the last scale-down decision before a scale-up. Prevents rapid back-and-forth oscillation |
| `cooldowns.scaleDownAfterScaleUpMs` | `30000` | Minimum time since a worker actually started (not since the decision). The clock starts when the worker registers, not when the decision was made — what matters is how long the worker has been running and absorbing load |
| `cooldowns.scaleDownAfterScaleDownMs` | `20000` | Minimum time since the last scale-down decision. Limits how quickly capacity is removed |

#### Per-Application Overrides

Most v2 parameters can be overridden per application. Global values act as defaults; per-app values take precedence when specified:

```json
{
  "runtime": {
    "workers": {
      "minimum": 2,
      "maximum": 8,
      "eluThreshold": 0.7,
      "scaleUpMargin": 0.05
    }
  }
}
```

The following properties are **global-only** and cannot be overridden per application: `version`, `processIntervalMs`, `dynamic`, `total`, `maxMemory`.

