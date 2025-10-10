# Vertical Scaler

## Overview

The Vertical Scaler is an automatic resource allocation algorithm that dynamically adjusts the number of workers for applications based on their Event Loop Utilization (ELU) metrics. It intelligently balances computational resources across multiple applications while respecting system constraints.

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

### Scaling Logic

The algorithm operates in two modes:

1. **Reactive Mode**: Triggers immediately when any worker's ELU exceeds the scale-up threshold
2. **Periodic Mode**: Runs at regular intervals (default: every 60 seconds) regardless of metrics

Both modes analyze all applications and generate scaling recommendations:

#### 1. Metric Collection
- Collects ELU and heap memory metrics from all active workers every second
- Only collects metrics from workers that have been running for at least the grace period (default: 30 seconds)
- Maintains a rolling time window of metrics (default: 60 seconds)
- Calculates average ELU and heap usage per application across all its workers
- Checks available memory by calculating `maxTotalMemory - currently used memory`

#### 2. Application Prioritization
Applications are prioritized based on:
- Primary: ELU value (lower ELU = higher priority for scaling down)
- Secondary: Worker count (more workers = higher priority for scaling down when ELU is equal)

#### 3. Scaling Decisions

The algorithm makes decisions in this order:

**Scale Down (Low Utilization)**
- Any application with ELU below the scale-down threshold is reduced by 1 worker
- Applications must have more workers than their configured minimum (default: 1 worker)
- Multiple applications can scale down in the same cycle

**Scale Up (High Utilization)**
- Applications are evaluated in descending order by ELU (highest first)
- The first application with ELU at or above the scale-up threshold is selected
- The selected application receives 1 additional worker if:
  - It hasn't reached its configured maximum workers
  - There is sufficient available system memory (based on the application's average heap usage)
- Only one application scales up per cycle

**Resource Reallocation**
When the maximum worker limit is reached:
- The algorithm can transfer workers from low-utilization apps to high-utilization apps
- Transfer occurs when:
  - The high-ELU app needs scaling (ELU ≥ scale-up threshold)
  - There is insufficient available system memory for a new worker
  - A low-ELU app has more workers than its configured minimum
  - Either:
    - ELU difference ≥ minimum ELU difference threshold (default: 0.2), OR
    - Worker count difference ≥ 2
- One worker is removed from the app with lowest ELU (that has spare workers) and added to the high-ELU app
- This reallocation also frees up memory that can be used by the new worker

### Cooldown Period

After each scaling operation, the algorithm enters a cooldown period to prevent rapid oscillations. No scaling decisions are executed during cooldown, even if triggers occur.

## Configuration

### Vertical scaler parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| **maxTotalWorkers** | Maximum total workers across all applications | `os.availableParallelism()` |
| **maxTotalMemory** | Maximum total memory that can be used by all workers (bytes) | 90% of system total memory |
| **minWorkers** | Minimum workers for each application | 1 |
| **maxWorkers** | Maximum workers for each application | `maxTotalWorkers` |
| **scaleUpELU** | ELU threshold to trigger scaling up (0-1) | 0.8 |
| **scaleDownELU** | ELU threshold to trigger scaling down (0-1) | 0.2 |
| **minELUDiff** | Minimum ELU difference required for worker reallocation | 0.2 |
| **timeWindowSec** | Time window for averaging ELU and memory metrics (seconds) | 60 |
| **cooldownSec** | Cooldown period between scaling operations (seconds) | 60 |
| **gracePeriod** | Delay after worker startup before collecting metrics (milliseconds) | 30000 |
| **scaleIntervalSec** | Interval for periodic scaling checks (seconds) | 60 |

### Per-Application Configuration

Individual applications can override global limits using the `applications` parameter:

| Parameter | Description | Default |
|-----------|-------------|---------|
| **minWorkers** | Minimum workers for this application | 1 |
| **maxWorkers** | Maximum workers for this application | Global maxWorkers |

Example:
```json
{
  "maxTotalWorkers": 10,
  "applications": {
    "api-service": {
      "minWorkers": 2,
      "maxWorkers": 6
    },
    "background-worker": {
      "minWorkers": 1,
      "maxWorkers": 4
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

### Example 2: Worker Reallocation (At Limit)

**Initial State:**
- App A: 2 workers, ELU = 0.9, avg heap = 600MB
- App B: 2 workers, ELU = 0.3, avg heap = 400MB
- Total: 4 workers, Max: 4
- Available memory: 500MB

**Analysis:**
- App A needs scaling (ELU = 0.9 > 0.8)
- At max worker limit
- Insufficient memory for new worker (500MB < 600MB)
- ELU difference = 0.6 (exceeds minELUDiff of 0.2)
- App B has spare workers (2 > minWorkers)

**Decision:** Transfer 1 worker from App B to App A (frees ~400MB, allows new worker)

**Result:**
- App A: 3 workers
- App B: 1 worker

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

### Example 5: No Action (Insufficient Difference)

**Initial State:**
- App A: 3 workers, ELU = 0.85, avg heap = 500MB
- App B: 3 workers, ELU = 0.7, avg heap = 400MB
- Total: 6 workers, Max: 6
- Available memory: 400MB

**Analysis:**
- App A needs scaling (ELU = 0.85 > 0.8)
- At max worker limit
- Insufficient memory for new worker (400MB < 500MB)
- ELU difference = 0.15 (below minELUDiff of 0.2)
- Worker difference = 0 (below minimum of 2)

**Decision:** No scaling (conditions not met for reallocation)

---

### Example 6: No Action (Insufficient Memory)

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

