# Capture Flamegraphs on Health Events

When a production application misbehaves — event loop utilization spikes, memory grows, latency climbs — the profile you need is the one you did not capture. This guide shows how to use a [runtime extension](../reference/runtime/configuration.md#extensions) to capture a CPU profile when an application detects a problem and upload it to Amazon S3, so a flamegraph of the incident is always waiting for you.

Everything runs in the runtime main thread: the extension triggers the built-in pprof profiler and ships the resulting profile with the AWS SDK from your own `node_modules`. For fully automatic captures based on event loop utilization, use [continuous profiling](#continuous-profiling) below: the profiler has its own built-in ELU gating.

## Prerequisites

1. A Watt application (see the [quick start](../getting-started/quick-start-watt.md))
2. The profiler preload package and the AWS SDK:

```bash
npm install @platformatic/wattpm-pprof-capture @aws-sdk/client-s3
```

`@platformatic/wattpm-pprof-capture` is automatically added to the runtime `preload` when it is installed, so no extra configuration is needed for profiling itself.

## Configure the extension

Register the extension in your `watt.json` (or `platformatic.json`) and pass its settings via `options`:

```json
{
  "extensions": [
    {
      "path": "./flamegraph-extension.js",
      "options": {
        "bucket": "{PLT_FLAMEGRAPHS_BUCKET}",
        "region": "{PLT_AWS_REGION}",
        "profileDurationMillis": 10000,
        "cooldownMillis": 300000
      }
    }
  ]
}
```

The environment variable placeholders are resolved from the runtime environment, so the bucket and region never need to be hardcoded.

## The extension

Create `flamegraph-extension.js` next to your configuration file:

```js
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

export default async function setup ({ runtime, itc, logger, options }) {
  const {
    bucket,
    region,
    profileDurationMillis = 10000,
    cooldownMillis = 300000
  } = options

  const s3 = new S3Client({ region })
  const capturing = new Set()
  const lastCapture = new Map()

  async function captureAndUpload (application, worker, reason) {
    const target = `${application}:${worker}`

    // Never run two captures for the same worker and honor the cooldown,
    // otherwise a sustained spike would trigger a capture every second.
    const last = lastCapture.get(target) ?? 0
    if (capturing.has(target) || Date.now() - last < cooldownMillis) {
      return
    }

    capturing.add(target)

    try {
      logger.warn({ application, worker, reason }, 'health event detected, capturing CPU profile')

      await runtime.startApplicationProfiling(target, { type: 'cpu' })
      await new Promise(resolve => setTimeout(resolve, profileDurationMillis))
      const profile = await runtime.stopApplicationProfiling(target, { type: 'cpu' })

      const key = `flamegraphs/${application}/${worker}/${new Date().toISOString()}.pb`

      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from(profile),
        ContentType: 'application/octet-stream'
      }))

      lastCapture.set(target, Date.now())
      logger.info({ application, worker, key }, 'CPU profile uploaded')
    } catch (err) {
      logger.error({ err, application, worker }, 'failed to capture or upload the CPU profile')
    } finally {
      capturing.delete(target)
    }
  }

  // Triggered by the applications: workers can explicitly request a capture,
  // for example when they detect slow requests.
  itc.handle('flamegraph:capture', async ({ application, worker, reason }) => {
    captureAndUpload(application, worker, reason)
    return { scheduled: true }
  })

  return {
    async close () {
      s3.destroy()
    }
  }
}
```

Applications request a capture through the custom `flamegraph:capture` command whenever they detect a problem — a slow request, a saturated queue, a failed health signal. For example, from any application:

```js
import { getApplicationId, getITC, getWorkerId } from '@platformatic/globals'

const itc = getITC()

await itc.send('flamegraph:capture', {
  application: getApplicationId(),
  worker: getWorkerId(),
  reason: 'slow request detected'
})
```

## Continuous profiling

Instead of capturing a profile only when something goes wrong, you can keep the profiler always on. When profiling is started with the `durationMillis` option, the profiler rotates the profile window at that interval and the runtime emits [`application:worker:profile:captured`](../reference/runtime/programmatic.md#applicationworkerprofilecaptured) every time a window completes. The event only carries metadata — profiles can be big, so the runtime never moves them around unless someone asks. Retrieve the profile on demand with `getApplicationLastProfile()`:

Profiling state lives inside each worker thread, so it must be enabled per worker and re-enabled whenever a worker is replaced. Subscribing to `application:worker:started` covers all the cases with a single handler: it fires for every worker after it has fully started, both on the initial runtime startup and every time a worker is restarted (after a crash, a reload or a scaling event).

```js
export default async function setup ({ runtime, logger, options }) {
  const { applications = ['api'], durationMillis = 60000 } = options

  // Ship each completed profile window
  runtime.on('application:worker:profile:captured', async ({ id, application, worker, type }) => {
    try {
      const { profile, timestamp } = await runtime.getApplicationLastProfile(id, { type })

      // Upload the profile, as shown above, or hand it to a continuous
      // profiling backend of your choice.
      await upload(`flamegraphs/${application}/${worker}/${new Date(timestamp).toISOString()}.pb`, profile)
    } catch (err) {
      logger.error({ err, id }, 'failed to collect the captured profile')
    }
  })

  // Enable continuous profiling on every worker as soon as it starts.
  // This also covers replacement workers, which start with a fresh profiler.
  runtime.on('application:worker:started', async ({ application, worker }) => {
    if (!applications.includes(application)) {
      return
    }

    try {
      await runtime.startApplicationProfiling(`${application}:${worker}`, {
        type: 'cpu',
        durationMillis
      })
    } catch (err) {
      logger.error({ err, application, worker }, 'failed to start continuous profiling')
    }
  })
}
```

To keep the overhead down when nothing is wrong, combine `durationMillis` with the `eluThreshold` option: the profiler only records while the worker's event loop utilization is above the threshold, and completed windows are still announced via the same event. The runtime measures each worker's ELU from the main thread as part of its health metrics cycle — a reading that stays accurate even when the worker's event loop is saturated — and resumes or pauses the in-worker profiler with hysteresis to avoid rapid toggling. Prefer this option over starting and stopping captures yourself based on ELU readings.

Continuous profiling also backs off automatically when a worker is overloaded: if the ELU rises above the worker's `health.maxELU` (0.99 by default), the current window still completes its full duration and is announced via the usual event — so your extension still ships the window that shows what saturated the worker — and then profiling pauses until the ELU recovers. The final profile stays available until profiling resumes, and an encoded copy is preserved in the runtime main thread — so `getApplicationLastProfile` can return it even while the worker's event loop is blocked, and it survives the worker being replaced by the health checks. Pass `maxELU` in the profiling options to change the cutoff, or `maxELU: false` to disable it.

## Analyze the flamegraphs

The uploaded files are standard [pprof](https://github.com/google/pprof) profiles. Download one and turn it into a flamegraph:

```bash
aws s3 cp s3://my-bucket/flamegraphs/api/0/2026-07-13T10:00:00.000Z.pb profile.pb
npx flame profile.pb
```

See [Profiling with Watt](./profiling-with-watt.md) for more details on reading flamegraphs and on the other profiling workflows (heap profiles, manual captures via the CLI, and continuous profiling).

## Beyond S3

The same pattern works for any destination or trigger: upload to Google Cloud Storage or Azure Blob Storage, notify a Slack channel with a link to the profile, or capture a [heap snapshot](./heap-snapshots.md) instead of a CPU profile when memory is the concern. The extension has full access to the [Runtime API](../reference/runtime/programmatic.md), so anything the runtime can do, an extension can automate.
