# Request Deduplication

Platformatic Gateway can deduplicate concurrent proxied requests that resolve to the same key. The first request is sent to the upstream application, while concurrent matching requests wait for that response and replay it.

This is useful for reducing request stampedes when many clients ask for the same resource at the same time, such as framework prefetch requests or cache revalidation bursts.

Deduplication is best-effort. Duplicate upstream requests can still happen, for example if the in-flight lock expires before the upstream response completes, if a request exhausts its retry attempts, or if an instance fails while handling the leader request.

## Enable Deduplication

Configure deduplication globally under `gateway.deduplication`:

```json
{
  "gateway": {
    "deduplication": {
      "enabled": true
    },
    "applications": [
      {
        "id": "frontend",
        "proxy": {
          "prefix": "/"
        }
      }
    ]
  }
}
```

By default, deduplication applies to `GET` and `HEAD` requests and uses `memory` storage.

## Per-Application Configuration

You can override the global configuration for a single proxied application with `gateway.applications[].proxy.deduplication`:

```json
{
  "gateway": {
    "deduplication": {
      "enabled": true,
      "methods": ["GET"]
    },
    "applications": [
      {
        "id": "frontend",
        "proxy": {
          "prefix": "/",
          "deduplication": {
            "enabled": true,
            "routes": [{ "method": "GET", "path": "/blog/*" }]
          }
        }
      }
    ]
  }
}
```

Application-level options override the global options.

## Key Computation

The default deduplication key is computed from:

- The configured application `origin`.
- The HTTP method.
- The rewritten proxy URL, including the query string.
- The configured request headers.

The default headers are:

```json
["authorization", "cookie", "accept", "accept-language"]
```

Customize the headers included in the key with `headers`:

```json
{
  "gateway": {
    "deduplication": {
      "enabled": true,
      "headers": ["authorization", "cookie", "x-tenant-id"]
    }
  }
}
```

## Custom Key Function

For full control, provide a module that exports a synchronous `computeDeduplicationKey` function:

```json
{
  "gateway": {
    "deduplication": {
      "enabled": true,
      "key": "./deduplication-key.js"
    }
  }
}
```

```js
export function computeDeduplicationKey (request, context) {
  return `${context.origin}:${context.method}:${context.url}`
}
```

The function must return the key directly and must not be async. The `context` object contains:

- `origin`: the configured application origin.
- `method`: the request method.
- `url`: the rewritten proxy URL, including query string.
- `query`: the parsed Fastify request query.
- `headers`: the configured request headers selected for the key.
- `application`: the gateway application configuration.

## Route Whitelist

Use `routes` to restrict where deduplication applies. Routes use `find-my-way` syntax.

```json
{
  "gateway": {
    "deduplication": {
      "enabled": true,
      "routes": [
        { "method": "GET", "path": "/blog/*" },
        { "methods": ["GET", "HEAD"], "path": "/products/:id" }
      ]
    }
  }
}
```

When `routes` is configured, route matching decides whether deduplication applies. When `routes` is not configured, `methods` decides.

## Storage

Configure storage with the `storage` object.

Supported sub-options:

- `adapter` (`string`, default: `memory`): selects the storage backend.
- `url` (`string`, required when `adapter` is `valkey`): Redis-compatible Valkey connection URL.
- `prefix` (`string`, optional, only used when `adapter` is `valkey`): prefix prepended to every gateway deduplication key stored in Valkey.

### Memory Storage

The default storage adapter is `memory`. It deduplicates requests only within the current gateway instance.

Use this when:

- There is only a single instance of the gateway.
- Best-effort per-instance deduplication is enough.

Use [Valkey storage](#valkey-storage) when deduplication must coordinate requests across gateway workers, instances, or pods.

```json
{
  "gateway": {
    "deduplication": {
      "enabled": true,
      "storage": {
        "adapter": "memory"
      }
    }
  }
}
```

### Valkey Storage

Use the `valkey` storage adapter when deduplication must work across gateway workers or more than one gateway instance.

Use this when:

- The gateway runs with multiple workers.
- Multiple gateway instances receive traffic for the same upstream application.
- You need shared in-flight locks and response replay across workers or instances.

Valkey stores in-flight locks and replayable responses so waiters handled by another worker, instance, or pod can reuse the leader response. This includes deployments with multiple pods even if each pod runs a single gateway instance.

The `url` option is required and must be a Redis-compatible Valkey connection URL, for example `redis://127.0.0.1:6379`.

The optional `prefix` value is prepended to all gateway deduplication keys so multiple applications can share the same Valkey instance without key collisions.

```json
{
  "gateway": {
    "deduplication": {
      "enabled": true,
      "storage": {
        "adapter": "valkey",
        "url": "redis://127.0.0.1:6379",
        "prefix": "my-application"
      }
    }
  }
}
```

## Timeouts

Deduplication buffers the leader response so it can be replayed to waiting requests.

Important options:

- `timeout`: how long a duplicate request waits for the leader response before retrying lock acquisition.
- `retries`: how many additional deduplication attempts are made before the request falls back to normal proxying.
- `ttl`: how long stored responses remain available for waiting requests.
- `lockTtl`: how long an in-flight lock can live before it expires.

If an upstream response takes longer than `lockTtl`, another matching request can become a new leader. This is expected: gateway deduplication reduces duplicate work but does not guarantee exactly-once upstream requests.

Example:

```json
{
  "gateway": {
    "deduplication": {
      "enabled": true,
      "timeout": 1000,
      "retries": 3,
      "ttl": 10000,
      "lockTtl": 500
    }
  }
}
```

If all retry attempts are exhausted, the request bypasses deduplication and is proxied normally. This keeps deduplication as an optimization instead of a source of request hangs.

Gateway deduplication buffers the leader response before replaying it to waiters. For streamed or chunked responses, the final response size might not be known before the response has been read. Enforcing a hard size limit after the response starts would make duplicate requests wait and then receive no replayable result, so deduplication does not impose a response size cutoff.

Enable deduplication only on controlled routes whose response sizes are bounded or roughly predictable. Large responses increase gateway memory usage and, when using Valkey storage, serialization and storage cost.

## Custom Gateway Handlers

Deduplication composes with custom gateway handlers.

When both `gateway.handler` and `gateway.deduplication` are configured, deduplication runs first. The winning request is delegated to the custom handler, and duplicate requests replay the winning response.

Custom handlers that call `reply.from(dest, options)` do not need any special handling. The `reply.from()` method is added by `@fastify/reply-from`, which Platformatic Gateway ultimately uses to proxy upstream requests.

```js
export function handler (request, reply, dest, options) {
  return reply.from(dest, options)
}
```

If a custom handler overrides `onResponse`, it can still opt into response replay by calling `options.deduplicateResponse(request, reply, res)`:

```js
export function handler (request, reply, dest, options) {
  return reply.from(dest, {
    ...options,
    async onResponse (request, reply, res) {
      reply.header('x-custom-handler', 'true')
      return options.deduplicateResponse(request, reply, res)
    }
  })
}
```

If a custom handler overrides `onError`, it can notify waiting duplicate requests by calling `options.deduplicateError(reply, error)`:

```js
export function handler (request, reply, dest, options) {
  return reply.from(dest, {
    ...options,
    async onError (reply, error) {
      return options.deduplicateError(reply, error)
    }
  })
}
```

Handlers that send a response directly without using `reply.from()` cannot be replayed by gateway deduplication.
