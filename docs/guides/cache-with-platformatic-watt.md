# How to Setup HTTP Caching with Watt

## Problem

You need to improve your application's performance by caching HTTP responses, but you want:

- Intelligent cache invalidation when data changes
- Fine-grained control over what gets cached and for how long
- Ability to invalidate cache by specific tags or routes
- Built-in caching without external dependencies like Redis

**When to use this solution:**

- Your API serves data that doesn't change frequently (anything that can work with potentially 'stale' data for up to 1s is ok)
- You want to reduce database load and improve response times
- You need cache invalidation when specific resources are updated
- You're building high-traffic applications that need performance optimization

## Solution Overview

Watt provides built-in HTTP caching with tag-based invalidation that works with any Node.js web framework including Express, Fastify, Koa, and others. The caching layer operates at the HTTP level, making it framework-agnostic - you can use the same caching APIs regardless of your underlying web framework choice.

This guide shows you how to:

1. Setup Fastify (if needed) and enable HTTP caching in your Watt application
2. Tag responses for intelligent cache invalidation
3. Invalidate cache by specific routes or tags
4. Test your caching implementation

## Why the cache lives on the client side

Most HTTP caches are **server-side**: a reverse proxy, a CDN, or middleware sitting in front of your
application, caching what the outside world asks for. Watt caches on the **client** side instead —
the cache intercepts outgoing requests, not incoming ones. That choice follows directly from how
applications talk to each other inside Watt.

In a Watt application, the applications call each other over the internal mesh, using ordinary
`fetch()` against `*.plt.local` addresses. A single external request often fans out into several
internal hops:

```
External request → gateway → api.plt.local → data-service.plt.local
```

A server-side cache placed in front of the entrypoint can only cache the outermost response. It sees
nothing of the hops behind it, so if two different endpoints both call `data-service.plt.local`, that
work is repeated every time. Worse, the entrypoint's response is often the *least* cacheable thing in
the chain — it is personalised, or aggregates several upstreams with different lifetimes — while the
inner calls it depends on are highly cacheable.

Caching on the client side inverts this. Because the cache sits on the request path of every
application, it works at **every hop**, and gives you three properties that a reverse proxy in front
of the entrypoint cannot:

- **Internal calls are cached.** `api` calling `data-service` is a cache lookup, not a repeated
  computation, even when the outer response cannot be cached at all.
- **External APIs are cached too.** The same interceptor covers calls leaving your application to
  third-party services, with no extra setup.
- **It is framework-agnostic.** The cache sits below `fetch()`, so Express, Fastify, Koa, Next.js and
  plain `node:http` all get it without changing application code. You control it with standard
  response headers — `Cache-Control`, `Age` — rather than a proprietary caching API.

## How it works underneath

Watt's HTTP cache is an [undici](https://undici.nodejs.org/) dispatcher interceptor, built on
undici's built-in `interceptors.cache()`. When a worker thread starts, Watt composes the interceptor
into that thread's global undici dispatcher, and mirrors it onto the global dispatcher used by
built-in `fetch()`. From that point every outgoing HTTP request made by the application — whatever
library or framework issued it — passes through the cache.

The part specific to Watt is **where the cached data lives**. The cache store inside a worker thread
holds no data of its own. It is a proxy that forwards every read, write and delete over Watt's
inter-thread communication channel (ITC) to the **main runtime thread**, which owns the single real
store:

```
worker thread (api)      worker thread (data-service)
   undici dispatcher         undici dispatcher
   └─ cache interceptor      └─ cache interceptor
      └─ proxy store            └─ proxy store
            │                         │
            └─────────ITC─────────────┘
                       │
             main thread: shared store
```

This is why the cache is genuinely unified rather than merely present everywhere. Watt runs your
applications across multiple worker threads, and each application can run several workers. With a
per-thread cache, every thread would keep its own copy of the same entry and every new thread would
start cold. Because the store is shared, a response cached by one thread is immediately served to all
of them, and memory is not multiplied by the worker count.

The shared store defaults to an in-memory implementation
(`@platformatic/undici-cache-memory`) bounded by the `maxSize`, `maxEntrySize` and `maxCount` options.
Setting `httpCache.store` to a module path swaps in your own implementation — for example one backed
by Redis or Valkey when you need the cache to survive restarts or be shared across containers.

A few consequences worth knowing:

- **Freshness is standard HTTP.** Entries are stored and revalidated according to the response's
  `Cache-Control` directives. `cacheByDefault` supplies a fallback lifetime, in seconds, for
  upstreams that send no expiration headers at all.
- **`GET` and `HEAD` are cached by default**, configurable through `methods`. The `origins` option
  restricts caching to a whitelist of upstreams, and accepts regular expressions.
- **`type` selects the HTTP cache semantics**: `shared` behaves like a proxy cache and will not store
  responses marked `private`; `private` behaves like a browser cache.
- **Invalidation is exact, not time-based.** Because the main thread owns the store, it can delete
  entries directly, either by cache key or by the tags parsed from the header named in
  `cacheTagsHeader`. There is no default tag header — this guide configures `X-Cache-Tags` in
  [Step 5](#step-5-enable-http-cache-in-watt) and uses it in [Step 6](#step-6-implement-cache-invalidation).
- **Cache activity is observable.** Every cached response carries an `x-plt-http-cache-id` header, and
  when telemetry is enabled the client span records `http.cache.id` and `http.cache.hit`, so a cache
  hit is visible in a distributed trace rather than being an invisible absence of work.

## Prerequisites

Before starting, ensure you have:

- [Node.js](https://nodejs.org/) (v22.19.0+)
- [npm](https://docs.npmjs.com/cli/) (comes with Node.js)
- Basic understanding of HTTP caching headers

## Step 1: Setup Fastify and Enable HTTP Cache

### Setting up Fastify

Create your Watt application using the create command:

```bash
npm create wattpm
```

This will prompt you to create services. Choose `@platformatic/node` to create a Fastify-based service that will handle your cached endpoints.

Your application structure will look like:

```
my-cache-app/
├── watt.json                 # Watt configuration
├── package.json
└── web/
    └── api/                  # Your service
        ├── package.json
        ├── watt.json # Service configuration
        └── index.js          # Main service file
```

Watt automatically loads your services based on the `watt.json` configuration and handles the server lifecycle.
This is provided by the autoload feature.

Then execute:

```bash
cd web/api; npm install fastify @fastify/autoload; mkdir -p routes; cd ..
```

Then replace the `web/api/index.js` file with:

```js
import { getLogger } from '@platformatic/globals'
import fastify from 'fastify'
import autoload from '@fastify/autoload'
import { join } from 'node:path'

export async function create () {
  const app = fastify({
    loggerIntance: getLogger()
  })

  app.register(autoload, {
    dir: join(import.meta.dirname, 'routes')
  })

  app.get('/', () => 'hello world')

  return app
}
```

This created a Fastify app that will autoload the routes.

## Step 2: Add Multiple Services for Demonstration

Let's create a more realistic example with multiple services to show how caching works with Watt's internal service mesh. Add a gateway and a data service:

```bash
npx create wattpm
```

Choose `@platformatic/gateway` to create an API gateway, and then create another `@platformatic/node` service for your data backend. Your structure should look like:

```
my-cache-app/
├── watt.json
├── package.json
└── web/
    ├── gateway/            # Public API gateway
    ├── api/                # Your main API service
    └── data-service/       # Backend data service
```

Follow the same steps to create the `data-service` that you used for `api`.

By default, this setup will expose the `api` service as `/api` and `data-service` as `data-service`.

**Key Watt Concepts:**

- Internal Service Mesh: Services communicate using `.plt.local` domains (e.g., `http://api.plt.local`, `http://data-service.plt.local`)
- Zero Network Overhead: Internal calls don't go through the network stack
- Reverse-Proxy: the `@platformatic/gateway` provide a reverse proxy layer that can enable caching, load-balancing, OpenAPI and GraphQL Composition.

## Step 3: Add Cache Headers to Your Responses

First, let's create a backend data service that will be cached:

```js
// web/data-service/routes/data.js
export default async function  (fastify) {
  let counter = 0

  fastify.get('/counter', async (req, reply) => {
    counter++

    // Set cache headers
    reply.header('Cache-Control', 'public, s-maxage=600') // 10 minutes
    reply.header('X-Cache-Tags', 'counter-data')

    console.log(`Data service: returning counter ${counter}`)
    return {
      counter,
      timestamp: new Date().toISOString(),
      source: 'data-service'
    }
  })

  fastify.get('/products/:id', async (req, reply) => {
    const productId = req.params.id

    // Cache individual products for 5 minutes
    reply.header('Cache-Control', 'public, s-maxage=300')
    reply.header('X-Cache-Tags', `product-${productId},products`)

    return {
      id: productId,
      name: `Product ${productId}`,
      price: Math.floor(Math.random() * 100),
      timestamp: new Date().toISOString()
    }
  })
}
```

Note: this approach will work with any HTTP framework that supports HTTP response headers.

Next, create an API service that calls the data service using Watt's internal mesh:

```js
// web/api/routes/api.js
export default async function  (fastify) {
  fastify.get('/cached-counter', async (req, reply) => {
    // Call the data service using internal mesh
    const response = await fetch('http://data-service.plt.local/counter')
    const data = await response.json()

    // The cache headers from data-service are automatically preserved
    // Watt's caching layer will cache this entire request chain

    return {
      ...data,
      processedBy: 'api-service',
      cachedResponse: true
    }
  })

  fastify.get('/products/:id', async (req, reply) => {
    // Fetch product data from backend service
    const response = await fetch(`http://data-service.plt.local/products/${req.params.id}`)
    const product = await response.json()

    // Add computed fields while preserving cache behavior
    return {
      ...product,
      computed: {
        discountPrice: product.price * 0.9,
        category: 'electronics'
      },
      processedBy: 'api-service'
    }
  })
}
```

**Cache header explanation:**

- `Cache-Control: public, s-maxage=600` - Cache for 600 seconds (10 minutes)
- `X-Cache-Tags: counter-data` - Tag for targeted invalidation

### Understanding Cache Tags

Cache tags are unique identifiers that let you invalidate related cache entries:

- **Resource-based tags**: `product-42`, `user-123`, `order-456`
- **Category-based tags**: `products`, `users`, `orders`
- **UUID tags**: `550e8400-e29b-41d4-a716-446655440000`

**Best practices:**

- Use descriptive, consistent tag names
- Tag by both specific resource and category
- Consider using UUIDs for guaranteed uniqueness

## Step 4: Configure the Gateway

The gateway acts as your API gateway, routing external requests to internal services and managing the unified cache layer:

```js
// web/gateway/watt.json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/gateway/4.0.0.json",
  "gateway": {
    "applications": [
      {
        "id": "api",
        "proxy": {
          "prefix": "/api"
        }
      },
      {
        "id": "data-service",
        "proxy": {
          "prefix": "/data"
        }
      }
    ]
  },
  "server": {
    "port": 3042
  }
}
```

**How Gateway + Caching Works:**

- External requests go to gateway (e.g., `GET /api/cached-counter`)
- Gateway forwards to internal service (`http://api.plt.local/cached-counter`)
- API service calls data service (`http://data-service.plt.local/counter`)
- Watt caches the entire response chain at the gateway level
- Subsequent requests return cached data without hitting any services
- **Unified Caching**: All services share the same HTTP cache layer

## Step 5: Enable HTTP Cache in Watt

Add HTTP caching configuration to your root-level `watt.json` file:

```json
{
  "$schema": "https://schemas.platformatic.dev/wattpm/4.0.0.json",
  "httpCache": {
    "cacheTagsHeader": "X-Cache-Tags"
  },
  "autoload": {
    "path": "web"
  }
}
```

**Understanding the configuration:**

- `httpCache`: Enables Watt's built-in HTTP caching layer
- `cacheTagsHeader`: Defines the header name for cache tags (used for targeted invalidation)
- `autoload`: Directory containing the applications that Watt loads and manages
- The gateway's application-local `server` configuration exposes it on port `3042`

**What this does:**

- Enables Watt's built-in HTTP caching layer
- Sets up cache tag header for intelligent invalidation
- No external cache services needed (Redis, Memcached, etc.)

### Advanced Cache Configuration

You can fine-tune the cache behavior with additional options:

```json
{
  "$schema": "https://schemas.platformatic.dev/wattpm/4.0.0.json",
  "httpCache": {
    "cacheTagsHeader": "X-Cache-Tags",
    "origins": [
      "http://api.plt.local",
      "/https:\\/\\/.*\\.trusted-api\\.com/"
    ],
    "cacheByDefault": 60000,
    "type": "shared",
    "maxSize": 104857600,
    "maxEntrySize": 5242880,
    "maxCount": 1024
  },
  "autoload": {
    "path": "web"
  }
}
```

**Additional configuration options:**

- **`origins`**: Whitelist of origins to cache. Only requests to these origins will be cached. Supports:
  - Exact strings: `"http://api.plt.local"`
  - Regex patterns (wrapped in `/`): `"/https:\\/\\/.*\\.trusted-api\\.com/"` matches any subdomain of `trusted-api.com`
- **`cacheByDefault`**: Default cache duration in milliseconds for responses without explicit `Cache-Control` headers. Useful for caching responses from APIs that don't set cache headers.
- **`type`**: Cache type - `"shared"` (default) or `"private"`. Shared caches honor `s-maxage`, while private caches are user-specific and only use `max-age`.
- **`maxSize`**: Maximum total cache size in bytes (default: 100MB)
- **`maxEntrySize`**: Maximum size of a single cache entry in bytes (default: 5MB)
- **`maxCount`**: Maximum number of cache entries (default: 1024)

## Step 6: Implement Cache Invalidation

### Method 1: Invalidate by Specific Route

When you need to invalidate cache for a specific endpoint:

**Note:** This cache invalidation approach works with any Node.js web framework, not just Fastify. The same function returned by [`getInvalidateHttpCache()`](../reference/runtime/globals.md#http-cache-and-client-metrics) can be used with Express, Koa, or any other framework.

```js
// web/api/routes/admin.js
import { getInvalidateHttpCache } from '@platformatic/globals'

export default async function  (fastify) {
  const invalidateHttpCache = getInvalidateHttpCache()

  fastify.delete('/invalidate-counter-cache', async (req, reply) => {
    await invalidateHttpCache({
      keys: [
        {
          origin: 'http://gateway.plt.local',
          path: '/api/cached-counter',
          method: 'GET'
        }
      ]
    })

    return { message: 'Cache invalidated for counter endpoint' }
  })

  // Invalidate internal service cache as well
  fastify.delete('/invalidate-data-cache', async (req, reply) => {
    await invalidateHttpCache({
      keys: [
        {
          origin: 'http://data-service.plt.local',
          path: '/counter',
          method: 'GET'
        }
      ]
    })

    return { message: 'Data service cache invalidated' }
  })
}
```

### Method 2: Invalidate by Cache Tags

For more flexible invalidation across multiple related endpoints:

```js
// routes/admin.js
import { getInvalidateHttpCache } from '@platformatic/globals'

export default async function  (fastify) {
  const invalidateHttpCache = getInvalidateHttpCache()

  fastify.delete(
    '/invalidate-by-tags',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            tags: { type: 'string' }
          },
          required: ['tags']
        }
      }
    },
    async (req, reply) => {
      const tags = req.query.tags.split(',')

      await invalidateHttpCache({ tags })

      return {
        message: `Cache invalidated for tags: ${tags.join(', ')}`,
        invalidatedTags: tags
      }
    }
  )
}
```

### Automatic Invalidation on Data Updates

Invalidate cache automatically when data changes:

```js
// routes/products.js
import { getInvalidateHttpCache } from '@platformatic/globals'
import { createProduct, updateProduct } from '../lib/database.js'

export default async function  (fastify) {
  const invalidateHttpCache = getInvalidateHttpCache()

  fastify.post('/products', async (req, reply) => {
    const newProduct = await createProduct(req.body)

    // Invalidate all product-related cache
    await invalidateHttpCache({
      tags: ['products', `product-${newProduct.id}`]
    })

    return newProduct
  })

  fastify.put('/products/:id', async (req, reply) => {
    const updatedProduct = await updateProduct(req.params.id, req.body)

    // Invalidate specific product cache
    await invalidateHttpCache({
      tags: [`product-${req.params.id}`, 'products']
    })

    return updatedProduct
  })
}
```

## Step 7: Verification and Testing

### Test Cache Behavior

**1. Start your Watt application:**

```bash
npm run dev
```

This starts all services (gateway, api, data-service) with Watt handling the service mesh and caching.

**2. Test cached responses through the gateway gateway:**

```bash
# First request - cache miss (hits data-service)
curl -i http://localhost:3042/api/cached-counter

# Second request - cache hit (returns cached data, no service calls)
curl -i http://localhost:3042/api/cached-counter

# Test direct access to data service through gateway
curl -i http://localhost:3042/data/counter
```

**What to verify:**

- First response includes `X-Cache-Tags: counter-data`
- Subsequent requests return identical data (counter doesn't increment)
- Response includes proper `Cache-Control` headers
- Console shows "Data service: returning counter X" only on cache misses

**3. Test internal service communication caching:**

```bash
# Test product caching across service boundaries
curl -i http://localhost:3042/api/products/123
curl -i http://localhost:3042/api/products/123  # Should be cached

# Test direct data service access
curl -i http://localhost:3042/data/products/123  # Should also be cached
```

**4. Test cache invalidation:**

```bash
# Invalidate specific routes
curl -X DELETE http://localhost:3042/api/invalidate-counter-cache
curl -X DELETE http://localhost:3042/api/invalidate-data-cache

# Or invalidate by tags
curl -X DELETE "http://localhost:3042/api/invalidate-by-tags?tags=counter-data"

# Verify cache was invalidated
curl -i http://localhost:3042/api/cached-counter
```

**Expected behavior:**

- After invalidation, counter value should increment on next request
- Response should have fresh timestamp
- Internal service calls resume after cache invalidation

### Complete Example Implementation

Here's a complete working example that demonstrates all caching concepts:

```js
// routes/cache-demo.js
import { getInvalidateHttpCache } from '@platformatic/globals'

export default async function  (fastify) {
  let counter = 0

  // Cached endpoint
  fastify.get(
    '/cached-counter',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              counter: { type: 'number' },
              timestamp: { type: 'string' },
              cached: { type: 'boolean' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      counter++

      // Set caching headers
      reply.header('Cache-Control', 'public, s-maxage=600') // 10 minutes
      reply.header('X-Cache-Tags', 'counter-data,demo-data')

      return {
        counter,
        timestamp: new Date().toISOString(),
        cached: true
      }
    }
  )

  // Invalidation endpoints
  const invalidateHttpCache = getInvalidateHttpCache()

  fastify.delete('/invalidate-counter', async (req, reply) => {
    await invalidateHttpCache({
      keys: [
        {
          origin: 'http://localhost:3042',
          path: '/cached-counter',
          method: 'GET'
        }
      ]
    })

    return { message: 'Counter cache invalidated' }
  })

  fastify.delete(
    '/invalidate-tags',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            tags: { type: 'string' }
          },
          required: ['tags']
        }
      }
    },
    async (req, reply) => {
      const tags = req.query.tags.split(',')
      await invalidateHttpCache({ tags })

      return { message: `Invalidated tags: ${tags.join(', ')}` }
    }
  )
}
```

## Troubleshooting

### Cache Not Working

**Problem:** Responses aren't being cached

**Solutions:**

- Verify `httpCache` is enabled in `watt.json`
- Check that `Cache-Control` headers are set correctly
- Ensure cache duration is greater than 0 (`s-maxage=600`)
- Confirm Watt version supports HTTP caching

### Cache Not Invalidating

**Problem:** Cache entries persist after invalidation

**Solutions:**

- Check that `X-Cache-Tags` header matches invalidation tags exactly
- Verify the `cacheTagsHeader` configuration in `watt.json`
- Ensure invalidation code runs without errors
- Confirm route/method/origin match exactly for key-based invalidation

### Performance Issues

**Problem:** Caching isn't improving performance

**Solutions:**

- Profile your application to identify bottlenecks
- Ensure cached endpoints are actually being called frequently
- Consider cache duration - too short defeats the purpose
- Monitor cache hit rates vs. miss rates

### Memory Usage

**Problem:** High memory usage with caching enabled

**Solutions:**

- Set appropriate cache TTL values
- Limit cacheable response sizes
- Monitor cache size and implement eviction policies if needed
- Consider external caching solutions for very large datasets

## Watt-Specific Caching Advantages

This guide demonstrated several unique advantages of Watt's HTTP caching approach:

### 1. **Unified Cache Layer Across Service Boundaries**

Traditional microservices require separate caching solutions for each service. Watt provides a single, shared cache layer that works across all your services automatically.

### 2. **Zero-Network Internal Communication**

Internal service calls using `.plt.local` domains don't hit the network stack - they're in-process calls with automatic caching applied.

### 3. **Automatic Cache Header Propagation**

When service A calls service B, cache headers from B are automatically preserved and applied to the entire request chain.

### 4. **Service Mesh + Caching Integration**

The gateway automatically handles routing and caching for complex multi-service requests without additional configuration.

### 5. **Framework Agnostic**

The same caching APIs work whether you're using Fastify, Express, Koa, or any other Node.js framework within your Watt application.

**Real-world Example:**

```
External Request → Gateway → API Service → Data Service
                     ↓
                 Single Cache Entry
```

Instead of 3 separate cache layers, you get 1 unified cache that handles the entire request flow.

## Next Steps

Now that you have HTTP caching working with Watt's service mesh:

- **[Monitor your cache](/docs/guides/metrics)** - Track cache hit rates and performance
- **[Deploy with caching](/docs/guides/deployment/dockerize-a-watt-app)** - Production considerations for cached applications
- **[Database optimization](/docs/reference/db/overview)** - Combine caching with database best practices
- **[Load testing](/docs/guides/profiling-with-watt)** - Verify cache performance under load
