## Runtime settings for a single application

v3 let an application's own configuration file carry a `runtime` block, which was hoisted when that
application was started on its own. There is no such block in v4, and no hoisting step: orchestration
is written at the top level, in exactly the place a multi-application project writes it.

A single application with orchestration to express is a runtime configuration with the singular
`application` shorthand, whose `config` is the same factory call the file would otherwise export:

```ts config
import { defineConfig } from 'wattpm'
import { next } from '@platformatic/next'

export default defineConfig({
  logger: { level: 'debug' },
  workers: { dynamic: true, minimum: 1, maximum: 4 },
  application: {
    execArgv: ['--max-old-space-size=4096'],
    config: next({
      server: { port: Number(process.env.PORT ?? 3042) }
    })
  }
})
```

The example uses `@platformatic/next`; the same shape applies to every capability.

Where each v3 property went:

- What was directly under `runtime` — [`preload`](./runtime/configuration.md#preload),
  [`workers`](./runtime/configuration.md#workers), [`logger`](./runtime/configuration.md#logger),
  [`watch`](./runtime/configuration.md#watch), [`health`](./runtime/configuration.md#health),
  [`telemetry`](./runtime/configuration.md#telemetry), [`undici`](./runtime/configuration.md#undici),
  [`httpCache`](./runtime/configuration.md#httpcache), [`metrics`](./runtime/configuration.md#metrics),
  [`gracefulShutdown`](./runtime/configuration.md#gracefulshutdown),
  [`startTimeout`](./runtime/configuration.md#starttimeout),
  [`restartOnError`](./runtime/configuration.md#restartonerror) and
  [`compileCache`](./runtime/configuration.md#compilecache) — is top-level.
- What was under `runtime.application` — `workers`, `health`, `env`, `envfile`, `sourceMaps`,
  `preload`, `nodeOptions`, `execArgv`, `permissions`, `telemetry` and `compileCache` — belongs to the
  [`application`](./runtime/configuration.md#applications) entry, beside `config`.
- `runtime.server` has nowhere to go, because v4 has no runtime-level listener: the address is the
  application's own `server` block, inside the capability configuration.

A configuration that still declares `runtime` is refused by name rather than accepted and ignored.
[`wattpm-utils migrate`](../guides/migrate-runtime-v4.md) writes the form above for any v3 file that had
a non-default block.
