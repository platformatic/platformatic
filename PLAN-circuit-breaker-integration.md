# Circuit Breaker Integration Plan

## Overview

Integrate the `canAccept` hook and load shedding feature from [undici-thread-interceptor PR #141](https://github.com/platformatic/undici-thread-interceptor/pull/141) into the Platformatic runtime module to provide main-thread-governed circuit breaker functionality that prevents requests from reaching busy workers.

## PR Summary

The PR adds:
- **`canAccept` hook**: Runs before routing to check if workers can accept requests
- **`LoadSheddingError`**: Returns 503 when all workers reject requests
- **Metadata support**: `route(url, worker, meta)` to identify workers
- **Early rejection**: Requests are shed before any MessageChannel creation

## Current Architecture

### Main Thread (runtime.js)
```javascript
this.#meshInterceptor = createThreadInterceptor({
  domain: '.plt.local',
  timeout: this.#config.applicationTimeout,
  onChannelCreation: this.#channelCreationHook
})

// Currently routes WITHOUT metadata:
worker[kInterceptorReadyPromise] = this.#meshInterceptor.route(applicationId, worker)
```

### Health Metrics Already Available
- ELU collected every 1 second via `getWorkerHealth()`
- Heap statistics (used/total) collected every 60 checks
- Health signals from workers via ITC

---

## Integration Plan

### Phase 1: Update Dependencies

**File**: `packages/runtime/package.json`

Use git branch dependency to test before PR merge:

```json
{
  "dependencies": {
    "undici-thread-interceptor": "github:platformatic/undici-thread-interceptor#feat/load-shedding"
  }
}
```

Run `pnpm install` to fetch the branch.

---

### Phase 2: Configuration Schema

**Files**:
- `packages/foundation/lib/schema-components.js` (base schema)
- `packages/runtime/lib/schema.js` (runtime-specific)

Add circuit breaker configuration schema:

```javascript
loadShedding: {
  type: 'object',
  properties: {
    enabled: { type: 'boolean', default: false },
    maxELU: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      default: 0.9,
      description: 'Maximum ELU threshold before worker rejects requests'
    },
    maxHeapUsedRatio: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      default: 0.95,
      description: 'Maximum heap used ratio before worker rejects requests'
    },
    applications: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          maxELU: { type: 'number', minimum: 0, maximum: 1 },
          maxHeapUsedRatio: { type: 'number', minimum: 0, maximum: 1 },
          enabled: { type: 'boolean' }
        }
      }
    }
  },
  additionalProperties: false
}
```

---

### Phase 3: Worker Load Tracking

**File**: `packages/runtime/lib/runtime.js`

Create a load tracking data structure in the Runtime class:

```javascript
// New private fields
#workerLoadMap = new Map()  // workerId -> { elu, heapRatio, accepting, timestamp }
#loadSheddingConfig

// New symbol
const kWorkerMeta = Symbol('plt.runtime.worker.meta')
```

Update health metrics collection to populate load map:

```javascript
// In #startHealthMetricsCollection() collectHealthMetrics callback
// After existing health collection, add:

const loadSheddingConfig = this.#getLoadSheddingConfigForApp(id)
if (loadSheddingConfig?.enabled !== false && this.#loadSheddingConfig?.enabled) {
  const heapRatio = health.heapTotal > 0 ? health.heapUsed / health.heapTotal : 0
  const maxELU = loadSheddingConfig?.maxELU ?? this.#loadSheddingConfig.maxELU ?? 0.9
  const maxHeapRatio = loadSheddingConfig?.maxHeapUsedRatio ?? this.#loadSheddingConfig.maxHeapUsedRatio ?? 0.95

  const accepting = health.elu < maxELU && heapRatio < maxHeapRatio

  this.#workerLoadMap.set(worker[kId], {
    elu: health.elu,
    heapRatio,
    accepting,
    timestamp: Date.now()
  })
}
```

---

### Phase 4: Modify Thread Interceptor Creation

**File**: `packages/runtime/lib/runtime.js`

Update constructor to pass `canAccept` hook:

```javascript
constructor (config, context) {
  // ... existing code ...

  this.#loadSheddingConfig = config.loadShedding

  this.#meshInterceptor = createThreadInterceptor({
    domain: '.plt.local',
    timeout: this.#config.applicationTimeout,
    onChannelCreation: this.#channelCreationHook,
    // NEW: Add canAccept hook when load shedding enabled
    canAccept: this.#loadSheddingConfig?.enabled
      ? this.#canAcceptRequest.bind(this)
      : undefined
  })
}
```

Implement the `canAccept` callback method:

```javascript
#canAcceptRequest (ctx) {
  // ctx: { hostname, method, path, headers, port, meta }
  const { meta } = ctx

  if (!meta?.workerId) {
    return true // No metadata, allow request
  }

  const loadInfo = this.#workerLoadMap.get(meta.workerId)

  if (!loadInfo) {
    return true // No load info yet, allow request (startup grace period)
  }

  // Stale data check (> 2 seconds old)
  if (Date.now() - loadInfo.timestamp > 2000) {
    return true
  }

  return loadInfo.accepting
}

#getLoadSheddingConfigForApp (applicationId) {
  return this.#loadSheddingConfig?.applications?.[applicationId]
}
```

---

### Phase 5: Add Metadata to Worker Routing

**File**: `packages/runtime/lib/runtime.js`

Update the `route()` call in `#setupWorker()` (~line 1835):

```javascript
// Current:
worker[kInterceptorReadyPromise] = this.#meshInterceptor.route(applicationId, worker)

// New:
const workerMeta = {
  workerId: worker[kId],
  applicationId,
  workerIndex: index
}
worker[kWorkerMeta] = workerMeta

worker[kInterceptorReadyPromise] = this.#meshInterceptor.route(
  applicationId,
  worker,
  workerMeta  // Pass metadata for canAccept hook
)
```

---

### Phase 6: Enable Health Metrics Collection

**File**: `packages/runtime/lib/runtime.js`

Modify `#startHealthMetricsCollectionIfNeeded()` to also start when load shedding is enabled:

```javascript
#startHealthMetricsCollectionIfNeeded () {
  let needsHealthMetrics = !!this.#dynamicWorkersScaler

  // NEW: Also need health metrics for load shedding
  if (this.#loadSheddingConfig?.enabled) {
    needsHealthMetrics = true
  }

  if (!needsHealthMetrics) {
    // ... existing health check enabled logic ...
  }

  if (needsHealthMetrics) {
    this.#startHealthMetricsCollection()
  }
}
```

---

### Phase 7: Management API Endpoints (Optional)

**File**: `packages/runtime/lib/management-api.js`

Add endpoint for monitoring load shedding status:

```javascript
// GET /api/v1/load-shedding/status
{
  enabled: true,
  workers: {
    'service-a:0': { elu: 0.45, heapRatio: 0.32, accepting: true },
    'service-a:1': { elu: 0.92, heapRatio: 0.78, accepting: false }
  }
}
```

---

### Phase 8: Testing

**File**: `packages/runtime/test/load-shedding.test.js`

Test cases:
1. Load shedding disabled by default
2. 503 returned when all workers over threshold
3. Requests succeed when at least one worker healthy
4. Per-application config overrides work
5. Graceful handling of missing/stale load data

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/runtime/package.json` | Modify | Git branch dependency |
| `packages/foundation/lib/schema-components.js` | Add | loadShedding schema |
| `packages/runtime/lib/runtime.js` | Modify | canAccept hook, metadata, load tracking |
| `packages/runtime/lib/management-api.js` | Add | Status endpoint |
| `packages/runtime/test/load-shedding.test.js` | New | Tests |

---

## Configuration Example

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/runtime/2.66.0.json",
  "autoload": {
    "path": "services"
  },
  "loadShedding": {
    "enabled": true,
    "maxELU": 0.9,
    "maxHeapUsedRatio": 0.95,
    "applications": {
      "critical-service": {
        "maxELU": 0.95
      },
      "background-service": {
        "maxELU": 0.7
      }
    }
  }
}
```

---

## Key Design Decisions

1. **Fail-open**: Missing/stale load data allows requests through
2. **Main-thread only**: No worker-side ITC overhead for checking load
3. **Reuses existing health collection**: 1-second interval already in place
4. **Per-app overrides**: Critical services can have higher thresholds
5. **Git branch dependency**: Enables testing before PR merge

---

## Implementation Steps

1. Update `packages/runtime/package.json` with git branch dependency
2. Run `pnpm install`
3. Add `loadShedding` to schema in foundation package
4. Implement load tracking and `canAccept` hook in runtime.js
5. Update `route()` call to pass worker metadata
6. Ensure health metrics collection starts when load shedding enabled
7. Add tests
8. Test manually with a high-load scenario
