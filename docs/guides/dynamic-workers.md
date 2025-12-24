# Dynamic Workers

## Overview

Dynamic Workers is an automatic resource allocation algorithm that dynamically adjusts the number of workers for applications based on their Event Loop Utilization (ELU) metrics. It intelligently balances computational resources across multiple applications while respecting system constraints.

## How It Works

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

