# Nitro on Watt 3

Use `@platformatic/nitro` for a Nitro application and `@platformatic/nuxt` for Nuxt.
Detect `nitro`/`nitropack` dependencies and Nitro configuration before selecting Vite.

```json
{
  "module": "@platformatic/nitro",
  "runtime": {
    "server": { "hostname": "0.0.0.0", "port": "{PORT}" }
  }
}
```

Install `wattpm@^3.74.0` and a matching major 3 Nitro capability with authorization.
Preserve Nitro's configuration, plugins, server routes, and target preset. Prefer the
capability's lifecycle defaults over custom commands unless the project needs them.

Build before production startup and deploy the complete output, including server,
public assets, and bundled dependencies. Inspect the installed capability's expected
output directory and entrypoint when using a custom Nitro preset.

Test internal mesh calls, the public listener, static assets, and production shutdown.
See [Nuxt](nuxt.md) and [integration](../integration.md).
