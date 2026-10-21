# Migrate Watt 3 to Watt 4

Read the relevant sections of the [Watt 4 migration guide](https://docs.platformatic.dev/docs/guides/migrate-v4)
before editing. This checklist does not replace its detailed contracts and limitations.

## Inspect and agree on scope

These are destination-version instructions. Select the intended Watt 4 release
explicitly; the project's local Watt 3 CLI returns v3 guidance. If using a separate
authorized installation of the target CLI, keep all migration reference reads on that
installation. Reading this guide is not authorization to upgrade project dependencies.

Inspect installed versions, manifests, configuration, entrypoints, env examples, CI,
and deployment. Watt 4.0.0 requires Node.js 24.20.0+. Inventory listeners, factories,
custom commands, runtime API consumers, globals, tracing, interceptors, and shutdown.
Preserve topology, authentication, database behavior, and unrelated code. Do not mix
major versions or convert a project without permission.

## Changes and documentation

| Area | Required review | Migration guide section |
| --- | --- | --- |
| Format/module system | Export configuration from one `watt.config.*` per directory; choose extension using package module type. Native TS accepts erasable syntax only. | [Filename](https://docs.platformatic.dev/docs/guides/migrate-v4#choosing-the-filename) |
| Environment | Replace placeholders with expressions, preserving missing/empty behavior and numeric conversion. Review boolean positions individually. | [Expressions](https://docs.platformatic.dev/docs/guides/migrate-v4#placeholders-become-expressions) |
| Tracing | `telemetry` configuration becomes `tracing`; package becomes `@platformatic/tracing`. Do not assume every exported symbol changed name. | [Tracing](https://docs.platformatic.dev/docs/guides/migrate-v4#rename-tracing-configuration-and-package) |
| Globals | Replace `globalThis.platformatic` with typed getters/setters from `@platformatic/globals`. | [Globals](https://docs.platformatic.dev/docs/guides/migrate-v4#replace-the-legacy-runtime-global) |
| Managed listener | Remove root `server` and `entrypoint`; move listener/HTTPS/port assignment into the owning capability, not its runtime entry. Keep workers on orchestration entries. | [Listener](https://docs.platformatic.dev/docs/guides/migrate-v4#move-listener-configuration-to-the-capability) |
| Custom listener | Self-listening apps/custom commands choose their own addresses. Runtime observes listeners and no longer writes `PORT`. | [Custom listener](https://docs.platformatic.dev/docs/guides/migrate-v4#let-applications-own-custom-listeners) |
| HTTP/WebSocket flags | Remove runtime entry `useHttp`/`websocket`; managed TCP uses capability `server.port`, mesh WebSockets need no extra TCP listener flag. | [Flags](https://docs.platformatic.dev/docs/guides/migrate-v4#the-usehttp-and-websocket-application-flags-are-gone) |
| Single application | A capability can stand alone; use singular runtime `application` when runtime options are needed. Avoid gratuitous topology changes. | [Single app](https://docs.platformatic.dev/docs/guides/migrate-v4#a-single-application-needs-no-root) |
| Startup results | `runtime.start()` and `getUrls()` expose observed URLs keyed by `applicationId:workerId`. | [Startup API](https://docs.platformatic.dev/docs/guides/migrate-v4#update-programmatic-startup-code) |
| Undici | Implement Undici 8 handler lifecycle/signatures; callback renaming alone is insufficient. | [Interceptors](https://docs.platformatic.dev/docs/guides/migrate-v4#update-custom-undici-interceptors) |
| Cleanup | Replace legacy close events with `registerCloseCallback()`. Review async cleanup, reverse callback order, and child-process responsibilities. | [Shutdown](https://docs.platformatic.dev/docs/guides/migrate-v4#update-application-shutdown) |
| Scaffolding | Generators/import commands are removed; write files with this skill. The migration codemod remains. | [Agent workflow](https://docs.platformatic.dev/docs/guides/use-watt-with-ai-agents) |

### Before/after: legacy configuration

This is a **Watt 3 example for migration only**, not a new-project template:

```json
{
  "entrypoint": "api",
  "server": { "port": "{PORT}" },
  "applications": [{ "id": "api", "path": "./api" }]
}
```

Watt 4 root `watt.config.js`, in an ESM package:

```js
import { createWattConfig } from 'wattpm'

export default createWattConfig({
  applications: [{ id: 'api', path: './api' }]
})
```

`api/watt.config.js` owns its listener:

```js
import { createServiceConfig } from '@platformatic/service'

export default createServiceConfig({
  server: { port: Number(process.env.PORT || 3042) }
})
```

The fallback above is a new explicit choice; migrations must preserve prior missing/empty
semantics rather than adding defaults indiscriminately. Retain valid capability `runtime`
wrapping when supported; remove obsolete listener/topology properties, not every block
with that name.

## Codemod safety

Read [codemod behavior](https://docs.platformatic.dev/docs/guides/migrate-v4#run-the-codemod-first)
before proposing `wattpm-utils migrate`. Run only with explicit authorization. It writes
new config and deletes validated legacy files without backups. A clean, recoverable
version-control state is required, not permission to commit/restore/discard user work.
Untracked/ignored config can block migration; never commit secrets to satisfy this check.

Do not use `--force` to bypass unresolved safety checks. For interruptions, review
`.wattpm-migrate.json` and the documented `--resume` flow. Review warnings and output;
the codemod does not update every API consumer, interceptor, cleanup hook, or deployment.

## Validation

- Confirm one configuration per directory, no competing legacy files, and correct helper/plain-object shapes.
- Compare listeners, routing, WebSockets, workers, auth, and missing/empty environment values.
- Update dependencies/lockfiles/scripts/CI/deployment within the authorized scope.
- With permission, exercise dev/build/start, endpoints, interceptors, and shutdown.
- Report checks performed and remaining gaps, especially external capability compatibility.

See [frameworks](frameworks.md), [services](services.md), [operations](operations.md),
and [shutdown sequencing](https://docs.platformatic.dev/docs/reference/runtime/shutdown).
