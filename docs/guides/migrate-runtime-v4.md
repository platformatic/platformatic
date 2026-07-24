---
title: Migrate Runtime Configuration to v4
---

# Migrate Runtime Configuration to v4

Runtime v4 removes the runtime-level HTTP listener. Each capability owns its listener configuration, while the runtime application descriptor controls whether that listener is exposed.

## Move listener configuration to the capability

Remove `server` and `entrypoint` from the Runtime or Watt configuration. Configure the listening address in the configuration file of the application that owns the HTTP endpoint.

Before:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/runtime/3.0.0.json",
  "entrypoint": "api",
  "server": {
    "hostname": "127.0.0.1",
    "port": 3042
  },
  "applications": [{ "id": "api", "path": "./api" }]
}
```

After, in `platformatic.runtime.json`:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/runtime/4.0.0.json",
  "applications": [{ "id": "api", "path": "./api", "exposed": true }]
}
```

Add a capability-level `server` configuration only when you need to preserve the previous listener address or settings. Otherwise, it is optional. To preserve the v3 listener in this example, configure `platformatic.service.json`, `platformatic.db.json`, or the configuration file for the relevant capability:

```json
{
  "server": {
    "hostname": "127.0.0.1",
    "port": 3042
  }
}
```

Do not add `server` to an `applications` entry. It belongs to the capability configuration. Settings such as HTTPS, `backlog`, and `portAssignment` move with it.

`exposed` defaults to `true`. Set it to `false` for runtime-managed applications that should communicate only through ITC. If an application was intentionally internal before the migration, set `exposed: false` explicitly. This does not prevent an external or black-box application from opening its own listener.

The v4 configuration upgrade removes root `entrypoint` and `server`. Review the result and add the required capability-level `server` configuration; a root listener cannot be assigned automatically when multiple applications exist.

## Use a custom port environment variable

Use `portEnv` on the application descriptor when the capability does not set `server.port` and reads a port from an environment variable other than `PORT`.

```json
{
  "applications": [
    {
      "id": "api",
      "path": "./api",
      "portEnv": "API_PORT",
      "workers": 2
    }
  ]
}
```

`portEnv` defaults to `PORT`. The runtime resolves the capability `server.port` first, then `process.env[portEnv]`, and finally uses an ephemeral port. Each worker receives its resolved port in its own `process.env[portEnv]`. When `server.portAssignment` uses `perWorkerIncrement`, the worker offset is applied after resolving a positive base port from `server.port` or `portEnv`; a missing or zero base port is invalid.

## Update programmatic startup code

`runtime.start()` and `runtime.getUrls()` return URLs keyed by worker ID. The key format is `applicationId:workerId`.

Before:

```js
await runtime.start()
const { url } = await runtime.getApplicationDetails('api')
```

After:

```js
const { 'api:0': url } = await runtime.start()
```

For every running exposed worker:

```js
const urls = runtime.getUrls()
// { 'api:0': 'http://127.0.0.1:3042', 'api:1': 'http://127.0.0.1:3043' }
```

Pass an application ID to select only its workers:

```js
const apiUrls = runtime.getUrls('api')
```
