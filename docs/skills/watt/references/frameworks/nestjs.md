# NestJS on Watt 3

Detect `nest-cli.json` and `@nestjs/core`. Use `@platformatic/node` and preserve the
Nest compiler/build pipeline: decorators and metadata are not handled by native
Node.js type stripping alone.

```json
{
  "module": "@platformatic/node",
  "node": { "main": "./dist/main.js" },
  "application": {
    "commands": { "build": "npm run build:nest" }
  },
  "runtime": { "server": { "hostname": "0.0.0.0", "port": "{PORT}" } }
}
```

Keep `build:nest` as the existing Nest build, separate from a top-level `wattpm build`
script. Respect the output module format and actual output path.

Review whether the bootstrap returns a supported HTTP instance or owns its listener.
Do not blindly return a Nest application wrapper as though it were a Fastify instance.
Ensure shutdown calls Nest's close path so providers, database pools, and subscriptions
are released. Avoid duplicate signal handlers and duplicate listeners.

Preserve the selected Express/Fastify adapter, global prefixes, validation pipes,
authentication guards, exception filters, and Swagger configuration. Match gateway
prefix rewriting to the app's global prefix.

With authorization, compile, start in development and production, exercise health and
representative routes, then verify provider cleanup on shutdown.
See [integration](../integration.md).
