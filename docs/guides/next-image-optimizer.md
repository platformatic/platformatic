# Run Next.js Image Optimizer as a Dedicated Service

In this guide, you will configure Platformatic Next to run in **Image Optimizer mode** as a standalone service.

Instead of running a full Next.js application in that service, you expose only the `/_next/image` endpoint and delegate image optimization to a dedicated component.

This architecture is useful when you want to:

- offload CPU-intensive image transformations from frontend services
- centralize optimization behavior (sizes, quality validation, retries, timeouts)
- centralize queue and storage configuration for image processing jobs
- fetch relative image paths from another local Platformatic service through service discovery

## Prerequisites

Before starting, make sure you have:

- npm available on your machine
- `wattpm` available through `npx wattpm` (or installed globally)

## What you will build

You will create a small runtime composed of two services:

1. **optimizer** (entrypoint)
   - runs `@platformatic/next` in Image Optimizer mode
   - exposes only `/_next/image`
2. **fallback**
   - runs a regular Next.js app
   - serves static files (for example `public/platformatic.png`)
   - acts as source for relative image URLs

At the end, you will test:

- optimization of a relative URL (`/platformatic.png`) resolved through local service discovery
- optimization of an absolute URL (`https://...`) fetched directly

---

## 1) Create a runtime with two services

Create this structure:

```text
my-runtime/
  platformatic.runtime.json
  services/
    optimizer/
      platformatic.json
      next.config.js
    fallback/
      platformatic.json
      next.config.js
      src/
        app
        ...
```

In this setup:

- `optimizer` is your external-facing image endpoint
- `fallback` is where relative assets are fetched from

## 2) Configure the runtime

Create `my-runtime/platformatic.runtime.json`:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/runtime/3.0.0.json",
  "entrypoint": "optimizer",
  "services": [
    {
      "id": "optimizer",
      "path": "./services/optimizer"
    },
    {
      "id": "fallback",
      "path": "./services/fallback"
    }
  ]
}
```

### Why this configuration?

- `entrypoint: "optimizer"` means incoming runtime traffic goes first to the optimizer service.
- Both services are in the same runtime, so service discovery works automatically.
- The service id `fallback` becomes reachable as `http://fallback.plt.local` from sibling services.

## 3) Configure the optimizer service

Create `my-runtime/services/optimizer/platformatic.json`:

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
- `fallback: "fallback"` means relative URLs are resolved against the local service `fallback`, i.e. `http://fallback.plt.local`.
- `timeout: 30000` sets a 30-second timeout budget for fetch/optimization jobs.
- `maxAttempts: 3` retries failed jobs up to 3 times.

## 4) Configure the fallback service

Create `my-runtime/services/fallback/platformatic.json`:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/next/3.38.1.json"
}
```

Then place a test image here:

- `my-runtime/services/fallback/public/platformatic.png`

This makes `/platformatic.png` available from the fallback service.

## 5) Install dependencies

For this setup, define framework/capability dependencies in each application folder (service), not as a single root dependency bundle.

### 5.1) Optimizer service `package.json`

Create or update `my-runtime/services/optimizer/package.json`:

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

### 5.2) Fallback service `package.json`

Create or update `my-runtime/services/fallback/package.json`:

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

### 5.3) Install workspace/runtime dependencies in one pass (optional but recommended)

From `my-runtime/`, run:

```bash
npx wattpm-utils install
```

This command installs dependencies for the runtime and all configured applications/services according to their own `package.json` files.

## 6) Start the runtime

From `my-runtime/` run:

```bash
npx wattpm start
```

By default, the runtime listens on `http://127.0.0.1:3042` unless you configure a different host/port.

## 7) Test the optimizer endpoint

### Test A: optimize an internal image (relative URL)

```bash
curl -i "http://127.0.0.1:3042/_next/image?url=/platformatic.png&w=1024&q=75"
```

This request flow is:

1. optimizer receives the request
2. sees `url=/platformatic.png` is relative
3. resolves source to `http://fallback.plt.local/platformatic.png`
4. fetches and optimizes the image
5. returns optimized bytes

### Test B: optimize an external image (absolute URL)

```bash
curl -i "http://127.0.0.1:3042/_next/image?url=https%3A%2F%2Fexample.com%2Fimage.png&w=1024&q=75"
```

This request is fetched directly from the absolute URL.

### Expected result

For valid requests, you should receive:

- `HTTP/1.1 200 OK`
- an image `content-type` (for example `image/png`)

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

**Characteristics:**

- fastest to set up
- no external dependency
- data is lost on restart

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

**Characteristics:**

- persists across process restarts (if disk/volume is persistent)
- no Redis/Valkey dependency
- should be used with shared/persistent volumes in containerized environments

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

#### Redis/Valkey fields

- `url`: connection string for your Redis/Valkey instance
- `prefix`: key namespace prefix (helps isolate environments/apps)
- `db`: logical database index (`0`, `1`, `2`, ...)

#### Practical advice

- Use a unique `prefix` per app/environment (example: `myapp:prod:img:`)
- Use `db` only if your Redis/Valkey policy allows multiple logical DBs
- Prefer dedicated instances and access controls for production workloads

## Next steps

- Add this optimizer service in front of one or more frontend services.
- Configure Redis/Valkey storage for production.
- Tune `timeout` and `maxAttempts` based on traffic profile and upstream reliability.

For full option details and behavior, see the [Next.js Image Optimizer reference](../reference/next/image-optimizer.md).
