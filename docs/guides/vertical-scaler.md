# Vertical Scaler

## Overview

The Vertical Scaler is an automatic resource allocation algorithm that dynamically adjusts the number of workers for applications based on their Event Loop Utilization (ELU) metrics. It intelligently balances computational resources across multiple applications while respecting system constraints.

## How It Works

### Event Loop Utilization (ELU)

The algorithm uses ELU as its primary health metric. ELU measures how busy the Node.js event loop is:
- **0.0** = Event loop is completely idle
- **1.0** = Event loop is fully saturated

ELU values are collected continuously from all workers and averaged over a configurable time window to smooth out temporary spikes and make stable scaling decisions.

### Scaling Logic

The algorithm operates in cycles, analyzing all applications and generating scaling recommendations:

#### 1. Metric Collection
- Collects ELU metrics from all active workers
- Maintains a rolling time window of metrics (default: 60 seconds)
- Calculates average ELU per application across all its workers

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
- The selected application receives 1 additional worker if it hasn't reached its maximum
- Only one application scales up per cycle

**Resource Reallocation**
When the maximum worker limit is reached:
- The algorithm can transfer workers from low-utilization apps to high-utilization apps
- Transfer occurs when:
  - The high-ELU app needs scaling (ELU ≥ scale-up threshold)
  - A low-ELU app has more workers than its configured minimum
  - Either:
    - ELU difference ≥ minimum ELU difference threshold (default: 0.2), OR
    - Worker count difference ≥ 2
- One worker is removed from the app with lowest ELU (that has spare workers) and added to the high-ELU app

### Cooldown Period

After each scaling operation, the algorithm enters a cooldown period to prevent rapid oscillations. No scaling decisions are executed during cooldown, even if triggers occur.

## Configuration

### Vertical scaler parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| **maxTotalWorkers** | Maximum total workers across all applications | `CPU cores count` |
| **minWorkers** | Minimum workers for each application | 1 |
| **maxWorkers** | Maximum workers for each application | `maxTotalWorkers` |
| **scaleUpELU** | ELU threshold to trigger scaling up | 0.8 |
| **scaleDownELU** | ELU threshold to trigger scaling down | 0.2 |
| **minELUDiff** | Minimum ELU difference required for worker reallocation | 0.2 |
| **timeWindowSec** | Time window for averaging ELU metrics (seconds) | 60 |
| **cooldownSec** | Cooldown period between scaling operations (seconds) | 60 |
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

### Example 1: Scale Up (Under Limit)

**Initial State:**
- App A: 2 workers, ELU = 0.85
- App B: 1 worker, ELU = 0.3
- Total: 3 workers, Max: 10

**Decision:** Scale up App A to 3 workers (total under max limit)

**Result:**
- App A: 3 workers
- App B: 1 worker

---

### Example 2: Worker Reallocation (At Limit)

**Initial State:**
- App A: 2 workers, ELU = 0.9
- App B: 2 workers, ELU = 0.3
- Total: 4 workers, Max: 4

**Analysis:**
- App A needs scaling (ELU = 0.9 > 0.8)
- At max worker limit
- ELU difference = 0.6 (exceeds minELUDiff of 0.2)

**Decision:** Transfer 1 worker from App B to App A

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
- App A: 3 workers, ELU = 0.85
- App B: 3 workers, ELU = 0.7
- Total: 6 workers, Max: 6

**Analysis:**
- App A needs scaling (ELU = 0.85 > 0.8)
- At max worker limit
- ELU difference = 0.15 (below minELUDiff of 0.2)
- Worker difference = 0 (below minimum of 2)

**Decision:** No scaling (conditions not met for reallocation)

