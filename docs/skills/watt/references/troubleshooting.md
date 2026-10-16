# Troubleshooting Watt 4

Inspect versions/configuration before changing anything. Do not silently upgrade Watt 3,
install packages through an unpinned `npx`, kill unrelated processes, delete lockfiles,
or disclose secrets. Explain findings and request authorization for corrective operations.

## Node.js and major versions

Watt 4.0.0 requires **Node.js 24.20.0+** in development, CI, build images, and production.
Check `node --version` with permission and inspect package engines. Use the project's
existing version manager (on this host, installed `tj/n`) rather than assuming nvm/fnm.
Align runtime/capability majors; external PHP/addons require separate compatibility checks.

## Missing, competing, or invalid configuration

Recognized files are `watt.config.ts`, `.mts`, `.cts`, `.js`, `.mjs`, `.cjs`. Keep one per
directory. Legacy JSON beside a module is not merged. Missing config can be valid for an
inferred application; do not automatically create a file or invoke removed generators.

- `.ts`/`.js` follow package `type`; `.mjs`/`.mts` force ESM; `.cjs`/`.cts` force CommonJS.
- JSON parsing is not module validation. Static reading does not prove schema validity.
- Importing the config executes code, including async/dynamic exports; obtain permission.
- Helpers must match installed exports; plain objects need `module` and actual nested shape.
- Inspect the loader's strict schema, not only legacy properties in exported schema files.

Use [scaffolding](scaffolding.md), [frameworks](frameworks.md), or [migration](migration-v4.md)
as appropriate. Never JSON-round-trip modules containing expressions/functions/comments.

## CLI missing or removed commands

Inspect local manifests/lockfiles and binary availability. If missing, propose compatible
dependencies with the existing manager; do not automatically download via `npx --version`.
Core Watt handles dev/build/start/management. Utilities `install`, `update`, `resolve`,
`migrate` use `wattpm-utils`. Generators/import and CLI `config`/`patch-config` are removed.
See [CLI](wattpm-cli.md) for replacements and exact-help requirements.

## Ports, hostnames, and container reachability

Root `entrypoint`/`server` are gone. Managed listener settings belong to the owning
capability; custom commands/self-listening apps choose their own addresses. Watt observes
them and does not write `PORT` or try the next free port.

- Identify the listener/process owning a port before proposing termination.
- Choose an explicit different port or `0` for a supported ephemeral listener.
- Bind public container listeners to `0.0.0.0`; preserve internal-only services.
- Multiple workers on a fixed port need supported sharing/port assignment for that OS.
- Mesh addresses use configured application IDs, not necessarily directory names.

For local diagnostics, use platform-appropriate tools such as `lsof -i :3000` on macOS.
Do not default to `kill -9`. Stop only authorized processes gracefully.

## TypeScript and framework builds

Native stripping accepts erasable types; it does not handle enums, parameter properties,
decorators, path aliases, TSX builds, or type checking. Preserve framework compilation and
point `main` at source/build output as appropriate. Use `import type` and respect ESM/CJS.
Nest production may bypass `main.ts`; preserve setup through the dedicated capability.

In CI, set a Node version **at least 24.20.0**, not an unverified older `24` image/runtime.
Inspect dependencies, output paths, workspace manifests, and lockfile before retrying builds.
Do not “fix” failures by deleting `node_modules` and the user's lockfile or forcing cache cleanup.

## Health checks and CrashLoopBackOff

Probe implemented application routes or explicitly configured runtime health endpoints.
`/health` is not automatically present. Prefixes and readiness dependency checks matter.
Readiness should reflect serving ability; liveness should not kill healthy pods during
temporary remote DB/API failures. Tune startup probes to the real build/start behavior.

With permission, inspect container logs, `kubectl describe pod`, previous logs, resource
limits, missing env names, and network/DB access. Do not apply/rollback manifests automatically.
Check writable cache/temp directories before enforcing a read-only root filesystem.

## Environment and migration semantics

Use `process.env` expressions in Watt 4, not `{VAR_NAME}` interpolation. Explicitly convert
numeric/boolean values; review absent and empty values individually. Existing variable names
can remain if explicitly read. `.env` is optional when CI/deployment injects values.

Inspect the installed env-file merge/mode behavior; load required env before configuration
evaluation. Loading dotenv later in an application cannot fix earlier config reads. Preserve
framework env conventions and never overwrite secrets or dump a complete env/config object.

## Gateway routing and mesh

Use `@platformatic/gateway` and `gateway.applications`. Internal targets can be identified
by application ID without Composer's `internal://` origin requirement. Match target IDs,
prefix/rewritePrefix, framework base paths, redirects, assets, and WebSocket behavior.
Do not assume catch-all ordering guarantees precedence; test overlapping routes.

```sh
wattpm ps
wattpm applications my-app
wattpm inject my-app api --path /health
```

Use actual IDs/routes and obtain permission before requests. In multi-app runtimes,
injection needs an explicit application. Vite development may need `.plt.local` in
allowed hosts. Browser code cannot directly resolve internal mesh hostnames.

## Next.js, ISR, and CMS

- Standalone: configure both Next output and capability standalone mode only when required.
- Turbopack: inspect supported versions rather than disabling it globally.
- Static exports: use a deliberate static-hosting path instead of assuming SSR capability support.
- Cache: verify adapter, URL, namespace, TTL, ISR vs Cache Components, and tag propagation.
- Revalidation: use the installed Next API, authenticated allowlisted tags, and the
  required freshness mode; `revalidateTag(tag, 'max')` is stale-while-revalidate.
- Preview: await current `draftMode()` APIs and validate auth/local redirect targets.

See [Next](frameworks/nextjs.md) and [CMS](cms-integration.md). Do not claim invalidation
reaches every worker/replica without testing the chosen shared cache setup.

## Plugins, memory, and shutdown

Fastify registration needs actual imported functions, not package-name strings. Preserve
encapsulation and decorator dependencies. For memory growth, measure worker count/heap
and capture authorized CPU/heap diagnostics instead of blindly changing child-process flags.
See [performance](performance.md).

Use `registerCloseCallback()` for asynchronous Watt-owned cleanup; legacy close events
are not emitted. Managed factories close framework/server first. Custom commands must
close child-process resources themselves; exports alone are insufficient. Avoid duplicate
callbacks and register before shutdown starts. Review [shutdown](https://docs.platformatic.dev/docs/reference/runtime/shutdown).

## Scheduler and external compatibility

Use application tasks in the examined Watt 4 contract, not an unverified root callback
array. Check retry total-attempt semantics, job IDs, replicas, pause/run behavior, and
idempotency. See [scheduler](scheduler.md).

PHP/Watt-Extra/hosting integrations are external contracts. Report compatibility blockers;
do not mechanically convert their schemas or claim Vercel framework hosting runs Watt.

## Getting help

Report version, configuration mode, sanitized symptoms/errors, checks performed, and
remaining gaps. Links: [Platformatic docs](https://docs.platformatic.dev),
[issues](https://github.com/platformatic/platformatic/issues),
[community](https://discord.gg/platformatic). Do not file reports without permission.
