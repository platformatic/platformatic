# Scheduled tasks in Watt 4

Watt's scheduler is **in-memory**. State does not persist across restarts and missed
ticks are not a durable queue. Design idempotent handlers: retries and coordinator
ownership changes provide at-least-once execution, not exactly once.

## Application-defined Node tasks

Export schedules and named handlers from the Node entrypoint's top level:

```js
export const scheduledTasks = {
  '0 0 3 * * *': ['cleanup'],
  '0 */15 * * * *': ['syncInventory']
}

export const tasks = {
  async cleanup ({ scheduledTime }) {
    // Replace this callback with the application's idempotent cleanup operation.
    await performCleanup(scheduledTime)
  },
  async syncInventory ({ scheduledTime, app }) {
    await app.syncInventory(scheduledTime)
  }
}
```

These are fragments to merge into the existing entrypoint; supply the real operations
and supported `app` returned by its factory. Task groups run concurrently. A failing
handler rejects so the scheduler can apply its retry policy; do not swallow failures.

## Migrating callback jobs

Older guidance configured a root `scheduler` array with `callbackUrl`, `headers`, and
`body`. The examined Watt 4 runtime schema does not expose that array. Do not emit it
as a valid configuration simply because an older example or a generic overview says so.
Inspect the installed release's schema when preserving an existing scheduler integration.

For an HTTP task, move the call into a named application handler:

```js
import { request } from 'undici'

export const scheduledTasks = { '0 0 9 * * *': ['dailyReport'] }

export const tasks = {
  async dailyReport () {
    const response = await request('http://notification.plt.local/send-report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'daily-report' })
    })
    await response.body.dump()

    if (response.statusCode < 200 || response.statusCode >= 300) {
      const error = new Error('The daily report endpoint rejected the scheduled request.')
      error.code = 'APP_SCHEDULED_REQUEST_FAILED'
      throw error
    }
  }
}
```

Use the app's existing coded-error convention rather than copying the example code
into a package with another prefix. Install/use a compatible `undici` only when authorized.
Preserve internal auth from environment, request body/method, timeout, and retry semantics.
Keep sensitive job routes protected even when normally reached internally.

## Nuxt and Nitro tasks

Merge `modules: ['@platformatic/nuxt/scheduler']` into Nuxt configuration to hand
supported Nitro task groups to Watt. The module disables Nitro's local cron runner;
Watt invokes jobs through internal communication, not added HTTP control routes.

Standalone Nitro configuration can use:

```js
import { defineNitroConfig } from 'nitropack/config'

export default defineNitroConfig({
  experimental: { tasks: true },
  modules: ['@platformatic/nitro/scheduler'],
  scheduledTasks: { '0 0 1 1 *': ['smoke'] }
})
```

Define actual task files in Nitro's `tasks/`. The module writes a production scheduler
manifest; ship complete output. Verify installed Nitro module/task support before modifying it.

## Cron and retries

Cron supports five fields plus optional leading seconds. The examined scheduler uses UTC.
Examples:

| Expression | Schedule |
| --- | --- |
| `*/1 * * * * *` | Every second |
| `0 */5 * * * *` | Every five minutes |
| `0 0 * * * *` | Hourly |
| `0 0 12 * * *` | Daily noon |
| `0 0 0 * * 1` | Monday midnight |
| `0 0 9-17 * * 1-5` | Weekday business hours |
| `0 0 0 1 * *` | First of month |

Inspect installed retry behavior. In the examined implementation `maxRetries` defaults
to 3 and bounds **total attempts**, not three extra retries. Do not invent a root option
to configure it when the task integration does not expose one. Test failures and timing.

## Coordination and management

```sh
wattpm scheduler [runtime]
wattpm scheduler:pause [runtime] <name>
wattpm scheduler:resume [runtime] <name>
wattpm scheduler:run [runtime] <name>
```

Use returned job names, not a guessed task-group identifier. Equivalent protected
management operations are GET `/api/v1/scheduler` and POST
`/api/v1/scheduler/:name/{pause,resume,run}`. Pause stops future local triggers, not an
execution already running. An external coordinator should pause before taking ownership
and resume when handing it back. In replicated deployments, coordinate all runtimes or
use application-level deduplication; local pauses alone are not a global lock.

## Best practices

- Use descriptive names, bounded execution, idempotency keys, and durable storage when needed.
- Start with infrequent schedules; log outcomes without secrets and monitor latency/failures.
- Preserve authentication and stable application error codes; avoid leaking internal errors.
- Permission is required before pausing/resuming/running jobs or triggering real side effects.

See [scheduler guide](https://docs.platformatic.dev/docs/guides/scheduler) and
[Node scheduled tasks](https://docs.platformatic.dev/docs/reference/node/overview#scheduled-tasks).
