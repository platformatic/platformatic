# Dynamic Workers

A fixed worker count has to cover both quiet periods and busy ones. Too few workers leave requests waiting as traffic grows; keeping enough workers for peak traffic uses memory even when most of them are idle. Dynamic scaling adjusts the worker count of each application inside a WATT as its load changes.

To decide when another worker would help, the scaler needs to understand where the application is running out of capacity. For Node.js, two useful signals are event loop utilization (ELU) and JavaScript heap usage.

## Why event loop utilization matters

We’ll start with a quick review of some Node.js and JavaScript basics. The heart of Node.js is the event loop, which runs JavaScript callbacks one at a time on a single thread. It cycles through different phases, picking up ready callbacks and running them in order.

A typical HTTP request shows how this works. When a request comes in, the event loop runs the handler callback, which parses data, checks the input, and runs business logic. This part is synchronous, so nothing else can happen in the loop at the same time. If the handler needs to access a database or call an external API, Node.js hands off that work to the operating system or a background thread pool, and the event loop moves on to other callbacks. When the I/O finishes, a new callback is added to the queue, and the event loop picks it up later to finish processing, like reading the database result and sending the response.

This design is what makes Node.js efficient. At any time, an app might have hundreds of requests in progress, but most are just waiting for I/O and not using the event loop. One thread can handle thousands of connections with little overhead, since there's no context switching or lock contention. This efficiency relies on the event loop having some idle time between callbacks.

As traffic grows, the synchronous parts of handling requests—like parsing bodies, serializing JSON, running business logic, or rendering server-side React—start to use up more of the idle time. While this code runs, nothing else can happen. Eventually, those idle gaps disappear.

[Event Loop Utilization (ELU)](https://nodesource.com/blog/event-loop-utilization-nodejs) measures this effect. It's a value from 0 to 1 that shows how much time the event loop spends running code versus being idle. An ELU of 0.5 means the loop is active half the time, while 0.9 means there's almost no idle time left.

<img src="./images/event-loop-latency-cliff.png" alt="Traffic rises steadily while ELU reaches 100% and average response time increases sharply at saturation." style="zoom:33%;" />



## Predictive scaling

Starting a worker takes time: it must load the application and initialize its dependencies before handling requests. During that time, the existing workers continue to carry the traffic. Waiting until average ELU exceeds the configured limit can leave them overloaded before the new worker is ready.

Predictive scaling accounts for this delay by tracking the application's load and how quickly it changes. It estimates the capacity needed when a new worker is expected to be ready, so a rising trend can trigger a scale-up while current ELU is still below the threshold. The underlying method is described in the [algorithm whitepaper](https://arxiv.org/abs/2604.19705).

<img src="./images/predictive-scaling-forecast.png" alt="A rising metric is currently below the threshold, but its projected trend crosses it before the forecast horizon H." style="zoom:33%;" />

In the chart, ELU has risen to 73%, still below the 75% threshold. The threshold-based scaler would not request another worker yet. But the dashed purple line shows that, if the trend continues, ELU will reach 78% by the forecast horizon, `H`, when extra capacity is expected to be ready.

That forecast lets predictive scaling request workers before the measured load crosses the limit. Starting them earlier gives them a chance to take traffic before the existing workers become overloaded and requests begin to queue.

The rest of this section explains how the algorithm builds this prediction.

**The core idea.** The algorithm takes per-worker metric values, combines them into a single number for the application, predicts where that number is heading, and converts the prediction back into a per-worker value to compare against the threshold. Each application has its own forecast and worker recommendation.

**Why predict on an aggregate?** Per-worker metrics change for two reasons: incoming traffic changes and the scaler's own actions. When another worker starts handling requests, ELU on the existing workers drops, even though traffic has not changed. Predicting directly from those readings could make the algorithm interpret this as falling demand and delay further scaling when it is still needed.

Combining ELU across the application's workers gives a more stable view of demand. Once traffic has redistributed, roughly the same work is spread across more workers. Their individual readings change, but the combined load is less affected by the change in worker count.

**Cleaning the data.** Runtime collects worker measurements approximately once per second. Missing readings and the temporary changes caused by starting workers need to be accounted for before those measurements can support a forecast.

Alignment places samples onto a common one-second time grid, interpolating between readings so that workers can be compared at the same points in time.

Imputation fills gaps by carrying a live worker's last valid measurement forward. A worker contributes only after its first measurement, and runtime lifecycle events determine when it has exited. Processing moves forward from the current state; late readings do not cause past predictions to be recomputed.

Redistribution accounts for the transition after a scale-up. New workers' measurements are included gradually as they take on traffic. At the same time, the algorithm compensates for the drop on existing workers as they shed load. This reduces the distortion caused by scaling while still allowing increases in demand to pass through.

**Predicting the trend.** The resulting aggregate enters Holt's double exponential smoothing. This maintains two values: the level, a smoothed estimate of the current load, and the trend, an estimate of how quickly it is changing. Each new measurement updates both. Smoothing reduces the effect of individual noisy readings while allowing sustained changes to shape the forecast.

**Asymmetric reaction.** The algorithm can respond differently to measurements above and below its forecast. By default, the load level responds faster to higher readings and more slowly to lower ones. Missing a sustained increase can leave workers overloaded; reacting too quickly to a brief drop can cause unnecessary scaling down and then back up. Separate settings control how quickly the level and trend adjust in each direction.

**The prediction horizon.** The horizon, `H`, determines how far ahead the algorithm looks. It follows observed worker startup times, so an application that takes longer to initialize is given more time to prepare for rising traffic. The estimate adapts as workers start. A small safety buffer extends the forecast beyond the estimated startup time, and fixed lower and upper bounds keep it within a useful range.

**Handling metric saturation.** ELU cannot exceed 100%. Once the workers' event loops are saturated, more traffic can arrive without the metric increasing. Normally, a flat measurement would make the estimated trend fade toward zero. During saturation, the algorithm preserves that trend, allowing it to continue requesting capacity even though ELU cannot show how much demand has grown.

**The scaling decision.** The forecast estimates the application's total load at the horizon. Dividing it by the approved worker target, including workers already requested, gives the expected load per worker. If that exceeds the threshold, the algorithm calculates a higher worker count, with margins to avoid reacting to small differences. If the trend is flat or falling and current load fits, it considers scaling down while keeping spare capacity. Recommendations remain subject to application limits, cooldowns, and the runtime controller's resource checks.

### Coordinating applications

Applications share the WATT's CPU and memory. A recommendation from one application cannot assume that all spare resources are available to it. The runtime controller compares the desired worker counts and decides which updates to approve:

- It applies scale-down recommendations for all eligible applications before admitting scale-ups. Only capacity actually released by successful or partial stops is made available; failed stops remain counted and can be retried.
- For scale-up, it considers applications in order of relative increase: `(desiredTarget - approvedTarget) / approvedTarget`, selecting the first application with enough memory for at least one additional worker.
- It adds at most `maxScaleUpStep` workers to that application, limited by its requested count, the total worker budget, and the memory check.

For example, a request from two to four workers has a relative increase of 100%; a request from four to five has an increase of 25%. The first application gets priority if an additional worker fits in memory; otherwise the controller considers the next application. The controller uses worker counts, so this choice does not depend on whether ELU or heap produced the request.

The default is one extra worker per cycle. Starting workers can involve compilation, database connections, and memory allocation that compete with the other applications in the WATT. Increase `maxScaleUpStep` only when the workload and container have enough spare resources for several starts at once.

### Configuration

#### Global configuration

Enable predictive scaling by setting `dynamic` to `true` in the runtime-level `workers` object. This example scales on ELU; add `heapThresholdMb` when heap usage should also influence worker count. Durations are in milliseconds.

```ts config
import { createNodeConfig } from '@platformatic/node'
import { createWattConfig } from 'wattpm'

export default createWattConfig({
  application: {
    config: createNodeConfig({})
  },
  "workers": {
    "dynamic": true,
    "minimum": 1,
    "maximum": 4,
    "total": 8,
    "eluThreshold": 0.8,
    "processIntervalMs": 10000,
    "maxScaleUpStep": 1
  }
})
```

Keep `workers` at the top level of `watt.config.ts`, including for single-application projects using the `application` shorthand. Start through WATT with `wattpm start`; a framework's own start command does not run the scaler.

| Setting | Default | Meaning |
| --- | --- | --- |
| `static` | `1` | Fixed worker count when dynamic scaling is disabled |
| `dynamic` | `false` | Enable automatic worker scaling |
| `minimum` | `1` | Initial and minimum worker count for each dynamically scaled application |
| `maximum` | `total` | Default maximum workers per application |
| `total` | `os.availableParallelism()` | Runtime-wide worker limit for load-driven scale-ups, including fixed applications |
| `maxMemory` | 90% of detected total memory | Memory usage limit, in bytes, used when considering scale-ups |

Memory usage and capacity come from cgroup files when available, otherwise from the host operating system. On a host, the check therefore includes memory used outside this WATT. `maxMemory` is a scaling constraint; setting it does not impose an operating-system memory limit.

The predictive scaler always processes heap measurements, even without `heapThresholdMb`. It divides each application’s current smoothed heap level by its live worker count to estimate heap per additional worker. The available memory (`maxMemory` minus current usage) limits how many workers can be added in a cycle. An application without a positive heap measurement waits for data; an application that cannot fit one additional worker does not block other applications that can. This check uses the current level, not a forecast or the target worker count. Heap does not include every memory allocation, so allow headroom for startup and other memory usage.

`minimum` must not exceed `maximum` after application settings inherit the runtime defaults; conflicting bounds cause a configuration error. Neither bound is capped by `total`. Counts outside the effective application bounds are corrected independently of load predictions and available capacity.

Choose application minima and fixed counts that fit within `total` and the available memory. Provisioning the configured minimum is separate from the checks for load-driven scale-ups. A runtime can otherwise start above its intended budget.

On platforms without the required `reusePort` support, applications listening on a fixed port use one worker unless their capability configuration sets `server.portAssignment` to `perWorkerIncrement`. Ephemeral ports can use multiple workers.

#### Thresholds and decision timing

| Setting | Default | Meaning |
| --- | --- | --- |
| `eluThreshold` | `0.8` | Per-worker ELU capacity used to convert aggregate load into a worker count |
| `heapThresholdMb` | Not set | Per-worker heap capacity in MB, where 1 MB is 1,048,576 bytes. Enables an independent heap-based recommendation; heap is always measured for memory checks |
| `processIntervalMs` | `10000` | Time between processing runs. Samples arriving between runs are processed together |
| `maxScaleUpStep` | `1` | Maximum workers added to the selected application per run. Positive integer |
| `redistributionMs` | `10000` | Expected time for a new worker to absorb its share of traffic; controls how its contribution is introduced into the aggregate |

For example, an adjusted forecast requiring 2.08 workers does not pass a `0.1` scale-up margin by itself. Current overload can still justify rounding up. Scale-down uses the current smoothed load with additional headroom; it does not simply reverse the scale-up calculation.

#### Trend detecting

Holt smoothing maintains a load level and a trend. These parameters control how much new measurements change that state. Higher values respond more quickly but also follow noise more closely.

| Setting | Default | Applied when |
| --- | --- | --- |
| `alphaUp` | `0.2` | Updating the level when the measurement is above the one-step forecast |
| `alphaDown` | `0.1` | Updating the level when the measurement is at or below the one-step forecast |
| `betaUp` | `0.1` | Updating the trend when the measurement is above the one-step forecast |
| `betaDown` | `0.1` | Updating the trend when the measurement is at or below the one-step forecast |

The default level smoothing reacts more quickly to measurements above the forecast. ELU also has saturation handling: near 100% utilization, a flat measurement may mean that the event loop has reached its reporting limit, rather than that demand has stopped growing.

#### Cooldowns

Predictive scaling cooldowns apply independently to each application. They are enabled with the following defaults; set a duration to `0` to remove that particular delay. Processing intervals and pending-worker checks still apply.

| Setting | Default | What it delays |
| --- | --- | --- |
| `cooldowns.scaleUpAfterScaleUpMs` | `5000` | Another scale-up after the last approved scale-up |
| `cooldowns.scaleUpAfterScaleDownMs` | `5000` | A scale-up after the last approved scale-down |
| `cooldowns.scaleDownAfterScaleUpMs` | `30000` | A scale-down after the most recent worker start, including initial and replacement workers |
| `cooldowns.scaleDownAfterScaleDownMs` | `20000` | Another scale-down after the last approved scale-down |

The predictive scaler does not use the `cooldown` or `gracePeriod` settings of threshold-based scaling. It starts using a worker's valid measurements as they arrive and accounts for its startup through redistribution and pending-worker tracking.

#### Per-application configuration

In a multi-application runtime, set overrides in `applications[].workers`. Applications support `static`, `dynamic`, `minimum`, `maximum`, `eluThreshold`, and `heapThresholdMb`. All other worker settings are configured at the runtime level. Omitted values use the runtime-level settings.

An application inherits the runtime’s `dynamic` setting unless it explicitly overrides it. To keep an application at four workers, use `"workers": 4` or `"workers": { "static": 4, "dynamic": false }`. When dynamic scaling is enabled, the initial count comes from `minimum` (default `1`), regardless of `static`. Runtime-level `dynamic: true` enables the scaler; an application-level override alone does not enable it.

```ts config
import { createNodeConfig } from '@platformatic/node'
import { createWattConfig } from 'wattpm'

export default createWattConfig({
  "workers": {
    "dynamic": true,
    "minimum": 1,
    "maximum": 4,
    "total": 8
  },
  "applications": [
    {
      "id": "api",
      "path": "./services/api",
      config: createNodeConfig({}),
      "workers": {
        "minimum": 2,
        "maximum": 6,
        "eluThreshold": 0.7
      }
    },
    {
      "id": "jobs",
      "path": "./services/jobs",
      config: createNodeConfig({}),
      "workers": 1
    }
  ]
})
```

Here, `api` can scale between two and six workers using a 70% ELU threshold. `jobs` stays at one worker, which still counts toward `total`.

For a single-application project, keep `workers` at the root beside `application`.

## Migrating from Watt v3 to Watt v4

Watt v4 uses predictive scaling whenever `workers.dynamic` is `true`. Dynamic scaling remains disabled by default. There is no algorithm version selector.

- Remove `workers.version`. Both former version values are rejected.
- Replace `scaleUpELU` with `eluThreshold` as a starting point for tuning; forecasting changes when a scale-up happens. `scaleDownELU` has no direct equivalent: review the directional `cooldowns` instead.
- Replace the single `cooldown` with the directional `cooldowns` settings. Remove the scaler's `gracePeriod`; new worker measurements are handled through redistribution and startup tracking. The separate `health.gracePeriod` setting is unchanged.
- Replace `verticalScaler` with `workers`: `enabled` becomes `dynamic`, `minWorkers`/`maxWorkers` become `minimum`/`maximum`, and `maxTotalWorkers`/`maxTotalMemory` become `total`/`maxMemory`. Move application overrides to `applications[].workers`. Review obsolete timing settings rather than copying them unchanged.

Removed options are rejected during configuration validation. Predictive scaling can add capacity before an overload and uses different scale-down hysteresis, so validate the new settings against representative traffic before upgrading production.
