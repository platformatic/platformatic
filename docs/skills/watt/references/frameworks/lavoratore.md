# Lavoratore on Watt 3

Use `@platformatic/lavoratore` for a Worker using the `export default { fetch }` handler
interface or a class extending `WorkerEntrypoint`, compatible with Cloudflare Workers.
Detect a `wrangler` dependency and a `wrangler.json`, `wrangler.jsonc` or `wrangler.toml` file.

```json
{
  "module": "@platformatic/lavoratore",
  "runtime": {
    "server": { "hostname": "0.0.0.0", "port": "{PORT}" }
  }
}
```

The Wrangler file is optional: when present, keep it as the source of truth for `main`,
`vars`, `triggers.crons` and service bindings; otherwise use `lavoratore.main`, `vars`,
`services` and `crons`. The Worker runs in the Watt thread on Node.js: KV, D1, R2, Durable
Objects and Queues bindings are not supported, so do not migrate Workers depending on them.

Service bindings map to Watt applications with the same ID. Cron triggers become Watt
scheduler jobs. Test internal mesh calls, the public listener and scheduled handlers.
See [integration](../integration.md).
