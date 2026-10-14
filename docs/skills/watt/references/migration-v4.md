# Migrate Watt 3 projects to Watt 4

Use this reference to identify migration work and navigate the existing documentation.
The [Watt 4 migration guide](https://docs.platformatic.dev/docs/guides/migrate-v4)
contains the detailed contracts, before/after examples, and codemod limitations.
Read the relevant sections before editing; this checklist is not a replacement for them.

## Inspect and agree on the scope

1. Read the project's instructions, installed versions, manifests, configuration,
   application entrypoints, environment examples, and deployment files. Watt 4 requires
   Node.js 24.20.0 or newer; check CI and production images as well as the local runtime.
2. Inventory legacy configuration, listeners, framework factories, custom startup
   commands, runtime API consumers, globals, tracing, interceptors, and cleanup hooks.
3. Explain the affected files and dependencies. Preserve topology, authentication,
   database settings, environment semantics, and unrelated code. Do not silently mix
   Watt 3 and Watt 4 packages or convert a project without authorization.

## What changed and where to read

| Area | Watt 4 change and agent action | Migration guide section |
| --- | --- | --- |
| Configuration format | Replace legacy JSON configuration with an exported program. Do not merely rename JSON or leave competing legacy and module configurations. | [Choosing the filename](https://docs.platformatic.dev/docs/guides/migrate-v4#choosing-the-filename) |
| Module system | Choose among `.ts`, `.mts`, `.cts`, `.js`, `.mjs`, and `.cjs` using the package's module system. Native TypeScript stripping accepts erasable syntax only. | [Choosing the filename](https://docs.platformatic.dev/docs/guides/migrate-v4#choosing-the-filename) |
| Environment values | Replace `{PLT_X}` interpolation with expressions. Preserve missing/empty behavior and numeric conversions; boolean positions require individual review rather than one universal conversion. | [Placeholders become expressions](https://docs.platformatic.dev/docs/guides/migrate-v4#placeholders-become-expressions) |
| Tracing | Rename configuration `telemetry` to `tracing` and the package to `@platformatic/tracing`. Check imports as well as dependencies; do not infer that every exported symbol was renamed. | [Rename tracing configuration and package](https://docs.platformatic.dev/docs/guides/migrate-v4#rename-tracing-configuration-and-package) |
| Runtime globals | Replace `globalThis.platformatic` access with typed getters and setters from `@platformatic/globals`. | [Replace the legacy runtime global](https://docs.platformatic.dev/docs/guides/migrate-v4#replace-the-legacy-runtime-global) |
| Managed listeners | Remove runtime `entrypoint` and root `server`. Move listener settings, including HTTPS and port assignment where supported, to the owning capability configuration, not the runtime application entry. Keep worker counts on runtime application entries. | [Move listener configuration to the capability](https://docs.platformatic.dev/docs/guides/migrate-v4#move-listener-configuration-to-the-capability) |
| Custom listeners | Applications that start their own servers choose their own addresses. The runtime observes them and no longer writes `PORT`. Distinguish these from factories returning a managed server. | [Let applications own custom listeners](https://docs.platformatic.dev/docs/guides/migrate-v4#let-applications-own-custom-listeners) |
| HTTP and WebSockets | Remove application-entry `useHttp` and `websocket` flags. Managed TCP listeners use capability `server.port`; mesh WebSocket proxying does not require a TCP listener. | [Removed application flags](https://docs.platformatic.dev/docs/guides/migrate-v4#the-usehttp-and-websocket-application-flags-are-gone) |
| Single application | A capability configuration can stand alone. Add a runtime root only for runtime options; the singular `application` key supports that case. Avoid unnecessary topology changes during migration. | [A single application needs no root](https://docs.platformatic.dev/docs/guides/migrate-v4#a-single-application-needs-no-root) |
| Programmatic startup | Update consumers of startup results: `runtime.start()` and `runtime.getUrls()` expose observed URLs keyed by `applicationId:workerId`. | [Update programmatic startup code](https://docs.platformatic.dev/docs/guides/migrate-v4#update-programmatic-startup-code) |
| Undici interceptors | Custom dispatcher handlers must implement the Undici 8 lifecycle and signatures, not just rename old callbacks. | [Update custom Undici interceptors](https://docs.platformatic.dev/docs/guides/migrate-v4#update-custom-undici-interceptors) |
| Shutdown | Replace legacy `getEvents().on('close', ...)` cleanup with `registerCloseCallback()`. Review reverse callback order, asynchronous cleanup, and custom-command child-process responsibilities. | [Update application shutdown](https://docs.platformatic.dev/docs/guides/migrate-v4#update-application-shutdown) |
| Scaffolding | Removed generators and import commands are replaced by the agent skill. The migration codemod is retained; it is not a scaffolder. | [Use Watt with AI agents](https://docs.platformatic.dev/docs/guides/use-watt-with-ai-agents) |

## Use the codemod deliberately

Read [Run the codemod first](https://docs.platformatic.dev/docs/guides/migrate-v4#run-the-codemod-first)
before proposing `wattpm-utils migrate`. Run it only with explicit authorization.
It writes new configuration and deletes validated legacy files; it does not create
backups. A clean, recoverable version-control state is a prerequisite, not permission
for the agent to commit, restore, or discard user work. Untracked or ignored legacy
configuration can also block the run; never commit secrets to satisfy that check.

Do not use `--force` to bypass unresolved safety checks. For an interrupted migration,
review its `.wattpm-migrate.json` manifest and the documented `--resume` workflow
before proceeding. Review warnings and generated output; do not assume the codemod
updates every application API, custom interceptor, cleanup hook, or deployment setting.

## Review and validate

- Confirm there is one recognized configuration per directory and no mixed legacy
  configuration. Review helpers and plain-object shapes against installed capability
  schemas; preserve dynamic exports, imports, functions, and comments.
- Verify public listeners, internal routing, WebSockets, worker settings, and environment
  values against the previous behavior. Report any change that needs a user decision.
- Update dependencies, lockfiles, scripts, CI, deployment files, and user documentation
  within the authorized scope and using the existing package manager.
- With permission, exercise development startup, build/production startup, relevant
  endpoints, interceptors, and graceful shutdown. Check missing and empty environment
  values, not only the successful path. Report checks performed and remaining gaps.

Use [Framework integration](frameworks.md), [Services and databases](services.md),
and [Operations](operations.md) for capability-specific work. The
[runtime shutdown reference](https://docs.platformatic.dev/docs/reference/runtime/shutdown)
defines cleanup sequencing and timeouts beyond the migration overview.
