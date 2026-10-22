# Integrate an existing application

1. Identify the framework, entrypoint, existing scripts, output directory, package manager,
   and Node.js version. Watt 3 requires Node.js 22.19.0+.
2. Choose the [specific capability](frameworks.md) before falling back to `@platformatic/node`.
3. Add a `watt.json` identifying the capability through `module`. Preserve existing
   JSON5/YAML/TOML configuration rather than converting it to a v4 configuration module.
4. Keep application build commands separate from orchestration. Do not make a Watt
   build command recursively call itself through an overwritten `build` script.
5. Keep dependency versions compatible with the installed Watt 3 release. Install only
   when authorized and use the existing package manager and lockfile.
6. Review public listener ownership, path prefixes, static assets, environment loading,
   startup dependencies, and shutdown behavior.

## Generic Node.js application

```json
{
  "module": "@platformatic/node",
  "node": { "main": "./server.js" },
  "runtime": {
    "server": { "hostname": "0.0.0.0", "port": "{PORT}" }
  }
}
```

Prefer a `create()` export returning the supported server/framework instance, so Watt
can manage its lifecycle. Preserve a self-listening application only after checking
the Node capability's listener and shutdown contract. Do not add a second listener.

Use `application.commands.build` for a required compile step and point `node.main`
at its output. Native type stripping does not compile decorators or replace bundling.

## Adding to a workspace

Add an application entry to the existing root or use its existing autoload convention.
Keep IDs unique and paths relative to the owning configuration. The root's `entrypoint`
selects the publicly exposed app; internal callers use `http://<id>.plt.local`.

The v3 import/resolve commands still exist. They can modify configuration, clone
repositories, or install dependencies; inspect their help and use them deliberately.
See [CLI](wattpm-cli.md) and [enterprise](enterprise.md).

Test representative routes, assets, internal calls, production output, and shutdown
when authorized. Integrating a framework into Watt 3 is not a migration to Watt 4.
