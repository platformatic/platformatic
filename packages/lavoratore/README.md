# @platformatic/lavoratore

Platformatic capability for running Workers inside Watt. It is compatible with the handler interface and the Wrangler configuration of [Cloudflare Workers](https://developers.cloudflare.com/workers/).

Workers using the `export default { fetch, scheduled }` interface, or a class extending `WorkerEntrypoint`, run inside the Watt thread on Node.js. The entrypoint, variables, cron triggers and service bindings can be set in the application configuration file or in an optional Wrangler configuration file. Service bindings are mapped to other Watt applications.

## Install

```bash
npm install @platformatic/lavoratore
```

## Configuration

See the [documentation](https://docs.platformatic.dev/docs/reference/lavoratore/overview) for all options.

## License

Apache 2.0
