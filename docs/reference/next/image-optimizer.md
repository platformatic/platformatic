---
title: Image Optimizer
---

# Next.js Image Optimizer

Platformatic Next can run in **Image Optimizer mode**, where the service exposes only the Next.js image endpoint (`/_next/image`) instead of starting the full Next.js application.

For a step-by-step setup, see [Run Next.js Image Optimizer as a Dedicated Service](../../guides/next-image-optimizer.md).

## When to use it

Use this mode when you want a dedicated image optimization service in your runtime, for example:

- to offload image transformations from frontend services
- to centralize image optimization and caching behavior
- to fetch originals from a local Platformatic service via service discovery

## Architecture

When `next.imageOptimizer.enabled` is `true`, Platformatic Next:

1. loads Next.js image parameter validation logic and Next.js configuration
2. starts a lightweight HTTP server exposing `GET /_next/image` (or `<basePath>/_next/image`)
3. validates query parameters using Next.js internal rules
4. resolves the source URL:
   - absolute `url` query values are used as-is
   - relative `url` query values are resolved against `fallback`
5. fetches and optimizes the image through a queue-backed optimizer
6. returns optimized bytes with content type and cache headers

The queue storage backend can be in-memory, filesystem-based, or Valkey/Redis-based.

## Queueing model

Every image request is processed through a queue-driven pipeline:

1. a `GET /_next/image` request is validated by Next.js parameter rules
2. the optimizer creates queue work for fetch + transform
3. a worker executes optimization with a timeout budget (`timeout`)
4. failures are retried up to `maxAttempts`
5. the result is returned to the client or a `502` is returned when retries are exhausted

Why this matters:

- it avoids tying optimization throughput directly to frontend request spikes
- it gives you explicit retry/timeout controls for unstable upstream sources
- it lets you choose storage based on runtime topology:
  - `memory` for local/dev or single-instance setups
  - `filesystem` for single-node persistence on disk
  - `redis`/`valkey` for multi-instance and shared queue state

## Configuration

Enable Image Optimizer mode in `watt.json` (or `platformatic.json`):

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/next/3.38.1.json",
  "next": {
    "imageOptimizer": {
      "enabled": true,
      "fallback": "fallback",
      "timeout": 30000,
      "maxAttempts": 3
    }
  }
}
```

In this example:

- `enabled: true` turns on Image Optimizer mode, so this service only serves the image endpoint.
- `fallback: "fallback"` means relative `url` values (for example `/images/photo.jpg`) are fetched from `http://fallback.plt.local/images/photo.jpg` through Platformatic service discovery.
- `timeout: 30000` sets a 30 second timeout for fetch/optimization jobs.
- `maxAttempts: 3` retries failed optimization jobs up to 3 times before returning an error.

If you do not set `storage`, Platformatic uses in-memory queue storage by default.

### Exposing Image Optimizer through Gateway (`proxy.routes`)

A common production setup is to keep Gateway as runtime entrypoint and route only `/_next/image` traffic to the optimizer service.

`services/gateway/platformatic.json`:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/gateway/3.0.0.json",
  "gateway": {
    "applications": [
      {
        "id": "optimizer",
        "proxy": {
          "prefix": "/",
          "routes": ["/_next/image"],
          "methods": ["GET"]
        }
      },
      {
        "id": "fallback",
        "proxy": {
          "prefix": "/"
        }
      }
    ]
  }
}
```

This routes image optimization requests to `optimizer`, while all other requests are handled by `fallback`.

### Configuration options

- **`enabled`**: Boolean flag to enable Image Optimizer mode. Default: `false`.
- **`fallback`**: Source used to fetch original images when the request URL is relative:
  - A full URL (for example, `https://cdn.example.com`)
  - A local service name (for example, `fallback`), resolved as `http://fallback.plt.local`
- **`storage`**: Queue storage backend:
  - `{ "type": "memory" }` (default)
  - `{ "type": "filesystem", "path": "./.next/cache/image-optimizer" }`
  - `{ "type": "valkey", "url": "redis://localhost:6379", "prefix": "my-app:", "db": 0 }` (or `redis`)
    - `prefix` maps to the Redis/Valkey key prefix used by the queue storage.
    - `db` selects the Redis/Valkey logical database index.
- **`timeout`** (`number` or `string`): Request/job timeout in milliseconds. Default: `30000`.
- **`maxAttempts`** (`number` or `string`): Maximum retry attempts for optimization jobs. Default: `3`.

## Endpoint

The service exposes the standard Next.js image endpoint:

```
GET /_next/image?url={imageUrl}&w={width}&q={quality}
```

If `application.basePath` is configured, the endpoint is prefixed accordingly (for example `/frontend/_next/image`).

### Query parameters

- **`url`**: Image URL to optimize:
  - Absolute URL for external images (for example, `https://example.com/image.png`)
  - Relative path for internal images (for example, `/images/photo.jpg`)
- **`w`**: Desired width in pixels
- **`q`**: Quality value accepted by Next.js optimizer (as validated by Next.js)

## Error handling

The optimizer returns **`502 Bad Gateway`** for optimization failures, including upstream fetch errors and invalid optimization parameters.

Example response:

```json
{
  "error": "Bad Gateway",
  "message": "An error occurred while optimizing the image.",
  "statusCode": 502,
  "cause": {
    "message": "Invalid optimization parameters.",
    "reason": "\"q\" parameter (quality) of 10 is not allowed"
  }
}
```
