# Troubleshoot Watt 3

Start with the installed versions, exact failing command, application ID, configuration
mode, and first relevant error. Use the local CLI; do not download a newer major as a
diagnostic fallback. Preserve local changes and redact credentials from reports.

| Symptom | Check |
| --- | --- |
| `skill` is unknown | Requires Watt 3.74.0+; stop the skill workflow on older releases. |
| Configuration not found | Working directory, recognized filename, and explicit `--config`. |
| Schema rejects an option | Correct capability, installed schema/version, root versus capability wrapping. |
| Environment placeholder missing | Variable name and runtime environment; do not print secret values. |
| App does not listen | Runtime `entrypoint`, root `server`, capability listener contract, port conflicts. |
| Internal request fails | Application ID, startup state/dependencies, `.plt.local` URL, framework allowed hosts. |
| Works directly but not behind gateway | Base path, prefix rewriting, asset URLs, redirects, cookies, WebSockets. |
| Production entrypoint missing | Build step, output directory, deployment artifact contents. |
| TypeScript syntax fails | Native stripping limits, decorators, module format, missing framework compilation. |
| Shutdown times out | Duplicate listeners, pending timers, database/queue clients, capability close contract. |
| Memory grows | Worker count, connection pools, load pattern, retained heap objects. |

## Local diagnostics

```sh
wattpm ps
wattpm applications my-app
wattpm logs my-app api
wattpm inject my-app api --path /health
```

Use `wattpm help <command>` to confirm arguments. `env` and `config` can expose secrets;
inspect them locally only when necessary and redact values. Verify that an endpoint
exists before using it as a health probe.

## Isolate the cause

Compare development and production with the same dependencies. Check framework build
output and restart behavior. Test a direct application request and then the public
gateway path to separate application failures from proxy/routing failures.

Avoid deleting lockfiles, disabling authentication, automatically applying migrations,
or upgrading major versions to make a diagnostic command pass. Report findings and
the smallest supported correction.

See [CLI](wattpm-cli.md), [observability](observability.md), and [performance](performance.md).
