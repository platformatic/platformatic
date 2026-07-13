# Capture Flamegraphs on Health Events

When a production application misbehaves — event loop utilization spikes, memory grows, latency climbs — the profile you need is the one you did not capture. This guide shows how to use a [runtime extension](../reference/runtime/configuration.md#extensions) to automatically capture a CPU profile when a worker becomes unhealthy and upload it to Amazon S3, so a flamegraph of the incident is always waiting for you.

Everything runs in the runtime main thread: the extension observes health metrics for all workers, triggers the built-in pprof profiler, and ships the resulting profile with the AWS SDK from your own `node_modules`.

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
        "maxELU": 0.9,
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
    maxELU = 0.9,
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

  // Triggered by the runtime: health metrics are collected every second
  // for every worker as soon as an extension subscribes to this event.
  runtime.on('application:worker:health:metrics', ({ application, worker, currentHealth }) => {
    if (currentHealth?.elu > maxELU) {
      captureAndUpload(application, worker, `elu above ${maxELU}`)
    }
  })

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

The extension reacts to two triggers:

- **Health metrics** - Once an extension subscribes to [`application:worker:health:metrics`](../reference/runtime/programmatic.md#applicationworkerhealthmetrics) during its setup, the runtime collects health data (event loop utilization, heap usage and custom health signals) for every worker each second and emits this event, even when health checks are not configured.
- **Custom commands** - Applications can request a capture themselves through the custom `flamegraph:capture` command. For example, from any application:

```js
import { getApplicationId, getITC, getWorkerId } from '@platformatic/globals'

const itc = getITC()

await itc.send('flamegraph:capture', {
  application: getApplicationId(),
  worker: getWorkerId(),
  reason: 'slow request detected'
})
```

## Analyze the flamegraphs

The uploaded files are standard [pprof](https://github.com/google/pprof) profiles. Download one and turn it into a flamegraph:

```bash
aws s3 cp s3://my-bucket/flamegraphs/api/0/2026-07-13T10:00:00.000Z.pb profile.pb
npx flame profile.pb
```

See [Profiling with Watt](./profiling-with-watt.md) for more details on reading flamegraphs and on the other profiling workflows (heap profiles, manual captures via the CLI, and continuous profiling).

## Beyond S3

The same pattern works for any destination or trigger: upload to Google Cloud Storage or Azure Blob Storage, notify a Slack channel with a link to the profile, or capture a [heap snapshot](./heap-snapshots.md) instead of a CPU profile when memory is the concern. The extension has full access to the [Runtime API](../reference/runtime/programmatic.md), so anything the runtime can do, an extension can automate.
