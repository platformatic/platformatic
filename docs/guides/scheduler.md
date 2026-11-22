# Scheduler

This guide explains how to configure and use Platformatic's built-in scheduler.
The scheduler allows applications to run periodic tasks at scheduled intervals
using cron expressions. Note that the scheduler is in-memory only, so no information is
persisted between restarts.

## Overview

The Platformatic scheduler runs application-defined tasks according to a specified schedule. This feature is useful for:

- Periodic data synchronization
- Scheduled maintenance tasks
- Recurring API calls
- Implementing workflows that need to run at specific times

## Cron Expression Format

The scheduler uses standard cron expressions with an optional seconds field.
Examples:

- `*/1 * * * * *` - Every second
- `0 */5 * * * *` - Every 5 minutes
- `0 0 * * * *` - Every hour
- `0 0 12 * * *` - Every day at noon
- `0 0 0 * * 1` - Every Monday at midnight

See [crontab.guru](https://crontab.guru/) for more examples.

## External coordination

Watt exposes its scheduler through the runtime management API. A coordinator can inspect jobs, pause Watt's local
trigger, and execute a job on demand:

| Operation | Management API |
| --- | --- |
| List jobs | `GET /api/v1/scheduler` |
| Pause a job | `POST /api/v1/scheduler/:name/pause` |
| Resume a job | `POST /api/v1/scheduler/:name/resume` |
| Run a job | `POST /api/v1/scheduler/:name/run` |

The same operations are available from the Watt CLI:

```bash
wattpm scheduler [runtime]
wattpm scheduler:pause [runtime] <name>
wattpm scheduler:resume [runtime] <name>
wattpm scheduler:run [runtime] <name>
```

See the [Watt CLI command reference](../reference/wattpm/cli-commands.md#scheduler-commands) for the command arguments and
output details.

`scheduler` lists the jobs and their current pause and next-run state. The other commands pause, resume, or execute a
job immediately. The runtime argument can be a process ID or runtime name and can be omitted when only one runtime is
available.

The runtime API exposes the same list as `getSchedulerJobs()`, returning `SchedulerJob[]`. The HTTP management API and
control client wrap that list as `{ jobs: RuntimeSchedulerJob[] }`.

Pausing a job stops future local triggers but does not cancel an execution that is already running. The coordinator
should pause a job before taking ownership and resume it when returning ownership to Watt.

Scheduler execution is at least once. HTTP retries, coordinator retries, or ownership changes around a cron tick can
run a job more than once, so scheduled handlers should be idempotent.

## Nuxt scheduled tasks

Nuxt applications can hand their Nitro schedules to Watt by adding the Platformatic scheduler module:

```ts
export default defineNuxtConfig({
  modules: ['@platformatic/nuxt/scheduler']
})
```

The module disables Nitro's in-process cron runner and reports the configured task groups to Watt. Watt registers
them as application scheduler jobs and invokes the tasks through its internal communication channel. It does not add
HTTP control routes to the Nuxt application.

Without an external coordinator, Watt executes these jobs locally. An external coordinator uses the same Watt
pause, resume, and run operations as it does for jobs from the runtime configuration.

## Nitro scheduled tasks

Nitro applications can use the same integration by adding the Platformatic scheduler module to `nitro.config`:

```js
import { defineNitroConfig } from 'nitropack/config'

export default defineNitroConfig({
  experimental: { tasks: true },
  modules: ['@platformatic/nitro/scheduler'],
  scheduledTasks: {
    '0 0 1 1 *': ['smoke']
  }
})
```

Define tasks in Nitro's `tasks` directory. The module disables Nitro's in-process cron runner, reports the configured
task groups to Watt, and writes a scheduler manifest to the production output. Watt registers the groups as application
scheduler jobs and invokes the tasks through its internal communication channel.

Nitro must have `experimental.tasks` enabled because Nitro scans task files before installing modules. The module also
enables this option for Nitro versions that scan modules later in the build lifecycle.

Without an external coordinator, Watt executes Nitro jobs locally. Coordinators can use Watt's pause, resume, and run
operations described above. Scheduled execution is at least once, so Nitro task handlers should be idempotent.

## Node scheduled tasks

Node applications export `scheduledTasks` and matching task handlers from their entrypoint's top level. Each cron
expression can run one or more named tasks:

```js
export const scheduledTasks = {
  '0 */5 * * * *': ['cleanup', 'syncUsers']
}

export const tasks = {
  async cleanup ({ scheduledTime, app }) {
    // ...
  },
  async syncUsers ({ scheduledTime }) {
    // ...
  }
}
```

Watt registers each schedule with its Runtime scheduler and invokes handlers with the scheduled timestamp. Task groups
run concurrently; a failed handler marks the group as failed and lets the Runtime apply its normal retry policy.

See the [Node.js scheduled tasks reference](../reference/node/overview.md#scheduled-tasks) for the complete handler
contract.
