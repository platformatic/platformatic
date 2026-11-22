# Watt 4 CLI reference

Use the installed version's `wattpm help` / `wattpm help <command>` for exact flags.
Prefer the existing local binary/package scripts; `npx` can download and execute packages
and is not a read-only installation check. Preserve package manager and major versions.
All installs, startup, mutations, profiling, remote fetching, and deployments need authorization.

## Scaffolding and integration

Watt 4 removes `create-wattpm`, `create-platformatic`, `wattpm create`/`init`/`add`,
and import generators/commands. Use [scaffolding](scaffolding.md) and
[integration](integration.md) to write configuration and files directly. Runtime
`applications:add`/`remove` are not project generators.

## Development, build, and production

```sh
wattpm dev
wattpm build
wattpm start
wattpm dev ./my-project --config watt.config.mjs
wattpm start --env .env.prod
```

These commands use a project root and support explicit config/env selection where documented.
Recognized config names: `.ts`, `.mts`, `.cts`, `.js`, `.mjs`, `.cjs` under `watt.config`.
Keep one per directory. A command in an app's directory can boot that app standalone,
not its parent workspace. Use an explicit root config when intending the full project.
Recognized applications may use inferred zero-config startup.

Dynamic config evaluation can differ by `command` (`dev`, `build`, `start`, `exec`),
`mode`, and production context. Importing configuration executes code; do not evaluate
untrusted modules just to inspect them. Build before production startup. Check installed
help for `--mode`, `--inspect`, and env-file merging behavior.

## Dependency and remote utilities

These operations belong to **`wattpm-utils`**, not core Watt commands:

| Command | Purpose and safety |
| --- | --- |
| `wattpm-utils install` | Install project/application dependencies with the existing manager; inspect production/manager flags. |
| `wattpm-utils update` | Update capability/runtime dependencies only in authorized ranges; do not bypass constraints with `--force` casually. |
| `wattpm-utils resolve --for start` | Fetch declared Git/npm apps and normally install; use `--skip-dependencies` if install is not authorized. |
| `wattpm-utils migrate` | Convert Watt 3 configuration; deletes validated legacy files and needs explicit migration authorization. |

`resolve --for dev`, `build`, or `all` chooses evaluation contexts. Remote projects must
already have compatible Watt 4 config/dependencies. Avoid password CLI flags, credentials
in URLs, and config/`.env` rewrites merely to record resolved paths. Read lifecycle scripts.
See [migration](migration-v4.md) for clean/recoverable state, manifest/resume, and refusal checks.

## Runtime and application management

```sh
wattpm ps
wattpm applications my-app
wattpm stop my-app
wattpm restart my-app
wattpm reload my-app
```

Use runtime PID/name and actual application IDs. `restart` refreshes applications;
`reload` can pick up main config changes. Inspect release help for the exact lifecycle.
Do not stop a process or reload production without permission.

`applications:add`/`applications:remove` change a running runtime. Inspect accepted
paths/IDs and `--save` behavior before persisting configuration; dynamic modules must not
be JSON-round-tripped or overwritten. Distinguish a live change from adding source/workspaces.

## Logs, environment, metrics, and REPL

```sh
wattpm logs my-app
wattpm logs my-app api
wattpm env my-app api --table
wattpm metrics my-app
wattpm repl my-app api
```

Inspect help for metrics/REPL options before use. Environment output and REPL/config
objects can contain secrets. Redact before reporting; REPL evaluation is not read-only.
Do not recommend removed `wattpm config` or dump exported configuration as a status check.

## Endpoint injection

```sh
wattpm inject my-app api --path /health
wattpm inject my-app api --method POST --path /users \
  --header 'Content-Type: application/json' --data '{"name":"Alice"}'
wattpm inject my-app api --method POST --path /upload \
  --data-file payload.json --output response.json
wattpm inject my-app api --path /health --full-output
```

Common flags: `--method` (`-m`), `--path` (`-p`), repeatable `--header` (`-H`), `--data`
(`-d`), `--data-file` (`-D`), `--output` (`-o`), `--full-output` (`-f`). Select an app
explicitly when a runtime has multiple applications; there is no default runtime entrypoint.
Requests can have real side effects and output can contain secrets; obtain permission.

## Scheduler

```sh
wattpm scheduler my-app
wattpm scheduler:pause my-app <name>
wattpm scheduler:resume my-app <name>
wattpm scheduler:run my-app <name>
```

Use returned job names. Pause does not cancel an in-progress execution. See
[scheduler](scheduler.md) for application-defined tasks, cron, retries, and coordination.

## Profiling

```sh
wattpm pprof start my-app api
wattpm pprof stop my-app api
wattpm heap-snapshot my-app api
```

Request permission, select the correct IDs/workload, keep the window short, and stop
collection. Inspect returned paths. Heap snapshots are expensive and may contain secrets.
Read [performance](performance.md) before Flame rendering or memory diagnostics.

## Configuration management

There is no Watt 4 CLI `patch-config` command. Edit configuration source minimally,
preserving expressions/functions/comments. Programmatic integration tooling can use
the documented `runtime.setApplicationConfigPatch()` for live application overrides;
that is not permission to rewrite persistent configuration or a general scaffolding tool.

## Admin and skill documentation

```sh
wattpm admin
wattpm skill
wattpm skill references/scaffolding.md
wattpm --version
wattpm help inject
```

Admin UI may download/start external tooling; require permission and compatible versions.
Keep admin/control endpoints private. `wattpm skill [FILE]` reads the release-matched
skill and all its Markdown references from the installed package, offline. Use the same
project-local installation for every read. Resolve relative links against the current
document and pass their normalized bundle-relative paths to the CLI.

## Documentation

- [Watt CLI](https://docs.platformatic.dev/docs/reference/wattpm/cli-commands)
- [Configuration patch API](https://docs.platformatic.dev/docs/reference/runtime/programmatic#runtimesetapplicationconfigpatchid-ops)
