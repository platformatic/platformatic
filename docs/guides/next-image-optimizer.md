# Run Next.js Image Optimizer as a Dedicated Service

In this guide, you will configure Platformatic Next to run in **Image Optimizer mode** as a standalone service.

Instead of running a full Next.js application in the same process, you expose only the `/_next/image` endpoint and delegate image optimization to a dedicated component.

![Architecture diagram](./next-image-optimizer/architecture-diagram.png)

## Why this architecture

Using a dedicated optimizer service behind Gateway has practical advantages:

- **Scalability**: image transformations are CPU-intensive and can be scaled independently from frontend rendering.
- **Operational isolation**: spikes on image traffic do not starve your frontend workers.
- **Centralized behavior**: width/quality validation, retry policy, timeout, and cache/storage settings are configured once.
- **Flexible storage backends**: in-memory for local dev, filesystem for simple deployments, Redis/Valkey for multi-instance environments.
- **Runtime-native service discovery**: relative image paths are fetched from a sibling application (for example `http://fallback.plt.local`) without hardcoding external URLs.

---

## Prerequisites

Before starting, make sure you have:

- npm available on your machine
- `wattpm` available through `npx wattpm` (or installed globally)

## What you will build

You will create a runtime with three applications:

1. **gateway** (entrypoint)
   - runs `@platformatic/gateway`
   - routes only `GET /_next/image` to `optimizer` using `proxy.routes`
2. **optimizer**
   - runs `@platformatic/next` in Image Optimizer mode
   - exposes only `/_next/image`
3. **fallback**
   - runs your regular Next.js app (pages, APIs, and static assets)
   - serves static files (for example `public/platformatic.png`)
   - provides original assets for relative image URLs

At the end, you will test:

- optimization of a relative URL (`/platformatic.png`) resolved through local service discovery
- optimization of an absolute URL (`https://...`) fetched directly

---

## 1) Create a runtime with three applications

Create this structure:

```text
my-runtime/
  watt.json
  web/
    gateway/
      watt.json
      package.json
    optimizer/
      watt.json
      package.json
      next.config.js
    fallback/
      watt.json
      package.json
      next.config.js
      public/
        platformatic.png
      src/
        app/
          page.jsx
```

In this setup:

- `gateway` is the external-facing entrypoint
- `optimizer` handles only `/_next/image`
- `fallback` is where relative assets are fetched from

## 2) Configure the runtime

Create `my-runtime/watt.json`:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/runtime/3.0.0.json",
  "entrypoint": "gateway",
  "applications": [
    {
      "id": "gateway",
      "path": "./web/gateway"
    },
    {
      "id": "optimizer",
      "path": "./web/optimizer"
    },
    {
      "id": "fallback",
      "path": "./web/fallback"
    }
  ]
}
```

### Why this configuration?

- `entrypoint: "gateway"` means incoming runtime traffic goes first to Gateway.
- Gateway routes by method + path (via `proxy.methods` and `proxy.routes`).
- `optimizer` and `fallback` are in the same runtime, so service discovery works automatically.
- `fallback` is reachable from `optimizer` as `http://fallback.plt.local`.

## 3) Configure Gateway with route-based proxying

Create `my-runtime/web/gateway/watt.json`:

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
          "prefix": "/",
          "routes": ["/*"]
        }
      }
    ]
  }
}
```

### Why use `proxy.routes`?

- `/_next/image` requests are routed to `optimizer` only.
- all other requests are routed to `fallback`.
- this keeps image optimization isolated while the fallback app serves regular pages/assets.

## 4) Configure the optimizer application

Create `my-runtime/web/optimizer/watt.json`:

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

### What these options mean

- `enabled: true` enables dedicated Image Optimizer mode.
- `fallback: "fallback"` resolves relative URLs against `http://fallback.plt.local`.
- `timeout: 30000` sets a 30-second timeout budget for fetch/optimization jobs.
- `maxAttempts: 3` retries failed jobs up to 3 times.

## 5) Configure the fallback application

Create `my-runtime/web/fallback/watt.json`:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/next/3.38.1.json"
}
```

Then place a test image here:

- `my-runtime/web/fallback/public/platformatic.png`

This makes `/platformatic.png` available from the fallback application.

### Keep fallback as a standard Next.js app

`fallback` should be your full frontend application, not a stripped-down placeholder. Keep the same pages, route handlers, API routes, middleware, and static assets you would normally ship.

Minimal example (`my-runtime/web/fallback/src/app/page.jsx`):

```jsx
import Image from 'next/image'

export default function Page () {
  return (
    <main>
      <h1>Frontend app served by fallback</h1>
      <Image src="/platformatic.png" alt="Platformatic logo" width={512} height={512} />
    </main>
  )
}
```

The optimizer service remains dedicated to `/_next/image`; all other application behavior continues to live in `fallback`.

## 6) Install dependencies

Define dependencies in each application folder.

### 6.1) Gateway `package.json`

Create or update `my-runtime/web/gateway/package.json`:

```json
{
  "name": "gateway",
  "private": true,
  "dependencies": {
    "@platformatic/gateway": "^3.0.0"
  }
}
```

### 6.2) Optimizer `package.json`

Create or update `my-runtime/web/optimizer/package.json`:

```json
{
  "name": "optimizer",
  "private": true,
  "dependencies": {
    "@platformatic/next": "^3.38.1",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

### 6.3) Fallback `package.json`

Create or update `my-runtime/web/fallback/package.json`:

```json
{
  "name": "fallback",
  "private": true,
  "dependencies": {
    "@platformatic/next": "^3.38.1",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

### 6.4) Install in one pass (recommended)

From `my-runtime/`, run:

```bash
npx wattpm-utils install
```

## 7) Start the runtime

From `my-runtime/`, run:

```bash
npx wattpm start
```

By default, Runtime listens on `http://127.0.0.1:3042` unless you configure a different host/port.

## 8) Test the optimizer endpoint

### Test A: optimize an internal image (relative URL)

```bash
curl -i "http://127.0.0.1:3042/_next/image?url=/platformatic.png&w=1024&q=75"
```

Request flow:

1. Gateway receives the request.
2. `proxy.routes` matches `/_next/image` and forwards to `optimizer`.
3. `optimizer` detects `url=/platformatic.png` is relative.
4. Source is resolved to `http://fallback.plt.local/platformatic.png`.
5. The image is fetched and optimized.
6. Gateway returns the optimized bytes.

### Test B: optimize an external image (absolute URL)

```bash
curl -i "http://127.0.0.1:3042/_next/image?url=https%3A%2F%2Fexample.com%2Fimage.png&w=1024&q=75"
```

This request is forwarded by Gateway to `optimizer`, then fetched directly from the absolute URL.

### Expected result

For valid requests, you should receive:

- `HTTP/1.1 200 OK`
- an image `content-type` (for example `image/png`)

---

## 9) Production topology: Gateway in front of your main Next.js app + optimizer

A common production setup is:

- one **frontend** Next.js application for pages and APIs
- one dedicated **optimizer** application
- one **gateway** entrypoint routing traffic between them

Example Gateway routing:

- `GET /_next/image` -> `optimizer`
- `/*` -> `frontend`

`web/gateway/watt.json`:

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
        "id": "frontend",
        "proxy": {
          "prefix": "/",
          "routes": ["/*"]
        }
      }
    ]
  }
}
```

`web/optimizer/watt.json`:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/next/3.38.1.json",
  "next": {
    "imageOptimizer": {
      "enabled": true,
      "fallback": "frontend"
    }
  }
}
```

In this model, relative image URLs are fetched from `frontend.plt.local`, while optimization workloads are isolated in the dedicated optimizer application.

---

## Storage options

Image optimization jobs run through a queue. You can control queue persistence with `next.imageOptimizer.storage`.

If you do not set `storage`, the default is in-memory storage.

### 1) Memory storage (default)

Best for local development or simple deployments where persistence across restarts is not required.

```json
{
  "next": {
    "imageOptimizer": {
      "enabled": true,
      "fallback": "fallback",
      "storage": {
        "type": "memory"
      }
    }
  }
}
```

### 2) Filesystem storage

Useful when you want persistence on local disk (single node/container with writable volume).

```json
{
  "next": {
    "imageOptimizer": {
      "enabled": true,
      "fallback": "fallback",
      "storage": {
        "type": "filesystem",
        "path": "./.next/cache/image-optimizer"
      }
    }
  }
}
```

### 3) Redis/Valkey storage

Recommended for distributed/multi-instance deployments.

```json
{
  "next": {
    "imageOptimizer": {
      "enabled": true,
      "fallback": "fallback",
      "storage": {
        "type": "valkey",
        "url": "redis://localhost:6379",
        "prefix": "next-image:",
        "db": 0
      }
    }
  }
}
```

You can also use `"type": "redis"`.

## Next steps

- Put this optimizer pattern in front of one or more frontend applications.
- Configure Redis/Valkey storage for production.
- Tune `timeout` and `maxAttempts` based on traffic profile and upstream reliability.

For full option details, see the [Next.js Image Optimizer reference](../reference/next/image-optimizer.md).
