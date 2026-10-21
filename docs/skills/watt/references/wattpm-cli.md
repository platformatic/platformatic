# Watt 3 CLI

Use the project's local installation consistently. These examples assume that
`wattpm` resolves to that installation; use its explicit binary path when necessary.
Do not fall back to a global binary or an implicit `npx` download.

## Bundled instructions

Available from 3.74.0:

```sh
wattpm skill
wattpm skill references/frameworks/nextjs.md
wattpm help skill
```

The command prints release-matched Markdown verbatim and works offline without a
project configuration. Paths are relative to the bundle root. Resolve Markdown links
relative to the document containing them, not the shell working directory.

Invalid paths, non-Markdown targets, and escaping symlinks fail with
`PLT_INVALID_SKILL_FILE`. Missing documents fail with `PLT_SKILL_FILE_NOT_FOUND`.
The CLI exits unsuccessfully for these errors or extra positional arguments.

## Help and lifecycle

```sh
wattpm help
wattpm help start
wattpm --version
wattpm dev
wattpm build
wattpm start
```

Check help for the installed release's config, environment, and inspector options.
Build before production startup. Preserve original framework scripts when introducing
Watt scripts so a custom build does not recursively invoke `wattpm build`.

```sh
wattpm ps
wattpm applications my-app
wattpm stop my-app
wattpm restart my-app
wattpm reload my-app
```

Use runtime and application IDs returned by discovery. Restart/reload have different
scope; inspect help and the configuration change before choosing either operation.

## Existing scaffolding and dependency workflows

Watt 3 retains `create`, `init`, and `add`. These are distinct from runtime
`applications:add` / `applications:remove`, which manage applications in a running instance.

```sh
wattpm help create
wattpm create
wattpm init
wattpm add
```

Use generators only when requested and preserve existing files. Avoid `--latest` when
the goal is to stay on major 3. See [scaffolding](scaffolding.md) for direct file creation.

Import, resolve, install, update, and patch-config workflows remain available through
the v3 runtime/application command integration. They can change files, checkouts, and
dependencies. Inspect their help in the target project before execution; do not use
forced updates to bypass version constraints during routine v3 maintenance.

## Diagnostics

```sh
wattpm logs my-app api
wattpm inject my-app api --path /health
wattpm inject my-app api --method POST --path /users \
  --header 'Content-Type: application/json' --data '{"name":"Alice"}'
wattpm metrics my-app
wattpm pprof start my-app api
wattpm pprof stop my-app api
wattpm heap-snapshot my-app api
```

Only use routes known to exist. `env` and `config` expose runtime information that may
contain secrets; inspect it locally and redact values in reports. `repl` evaluates code
in the running application, so it needs the same care as executing project code.

## Scheduling and administration

```sh
wattpm scheduler my-app
wattpm scheduler:pause my-app job-name
wattpm scheduler:resume my-app job-name
wattpm scheduler:run my-app job-name
wattpm admin
```

Confirm scheduler argument syntax with help and remember that manually running a job
can modify external state. The admin command can invoke an external tool; it is not
needed to read bundled skills.

See [operations](operations.md), [scheduler](scheduler.md), and [performance](performance.md).
