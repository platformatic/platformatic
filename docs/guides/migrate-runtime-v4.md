---
title: Migrate Runtime Configuration to v4
---

# Migrate Runtime Configuration to v4

Runtime v4 removes the runtime-level HTTP listener. Each capability or application owns whether it listens and all of its listener configuration. Runtime observes listening servers to report their URLs, but it does not select ports or rewrite listener options.

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
  "applications": [{ "id": "api", "path": "./api" }]
}
```

To preserve the v3 listener in this example, configure `platformatic.service.json`, `platformatic.db.json`, or the configuration file for the relevant capability:

```json
{
  "server": {
    "hostname": "127.0.0.1",
    "port": 3042
  }
}
```

Do not add `server` to an `applications` entry. It belongs to the capability configuration. Settings such as HTTPS move with it; `backlog` is applied when the capability's underlying server API supports that option.

The v4 configuration upgrade removes root `entrypoint` and `server` and emits a warning when a root server configuration is discarded. Runtime cannot move that configuration automatically because capability configuration is stored in a separate file.

## Let applications own custom listeners

Platformatic-managed capabilities start their own servers only when their capability-level configuration defines `server.port`. Omit `server.port` when the application should not open a managed listener, or set it to `0` to request an ephemeral port.

Node.js applications without a `create()` or `build()` factory, and applications started through custom commands, are responsible for calling `listen()` themselves. Runtime observes the address they select without changing it. A Node.js factory that returns a server keeps the existing managed lifecycle: `@platformatic/node` starts the returned server using its capability configuration.

Runtime no longer uses an application-level port environment setting and does not write `PORT`. Applications and capability configuration can still read environment variables directly:

```json
{
  "server": {
    "port": "{HTTP_PORT}"
  }
}
```

## Update programmatic startup code

`runtime.start()` and `runtime.getUrls()` return observed URLs keyed by worker ID. The key format is `applicationId:workerId`.

Before:

```js
await runtime.start()
const { url } = await runtime.getApplicationDetails('api')
```

After:

```js
const { 'api:0': url } = await runtime.start()
```

For every running worker with a listening server:

```js
const urls = runtime.getUrls()
// { 'api:0': 'http://127.0.0.1:3042', 'api:1': 'http://127.0.0.1:3042' }
```

Pass an application ID to select only its workers:

```js
const apiUrls = runtime.getUrls('api')
```

## Update custom Undici interceptors

Runtime v4 uses Undici 8 for the global dispatcher. Custom modules configured through `runtime.undici.interceptors`
must use the Undici 8 dispatcher handler lifecycle. The legacy handler callbacks are not supported:

| Undici 7 | Undici 8 |
| --- | --- |
| `onConnect` | `onRequestStart` |
| `onHeaders` | `onResponseStart` |
| `onData` | `onResponseData` |
| `onComplete` | `onResponseEnd` |
| `onError` | `onResponseError` |

For example, update a response handler from:

```js
class ResponseHandler {
  onHeaders (statusCode, headers) {
    // ...
  }
}
```

to the Undici 8 lifecycle:

```js
class ResponseHandler {
  onResponseStart (controller, statusCode, headers) {
    // ...
  }
}
```

See the [Undici Dispatcher documentation](https://undici.nodejs.org/#/docs/api/Dispatcher) for the complete handler
contract.
