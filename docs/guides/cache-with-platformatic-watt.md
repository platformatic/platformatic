# How to Setup HTTP Caching with Watt

## Problem

You need to improve your application's performance by caching HTTP responses, but you want:
- Intelligent cache invalidation when data changes
- Fine-grained control over what gets cached and for how long
- Ability to invalidate cache by specific tags or routes
- Built-in caching without external dependencies like Redis

**When to use this solution:**
- Your API serves data that doesn't change frequently
- You want to reduce database load and improve response times  
- You need cache invalidation when specific resources are updated
- You're building high-traffic applications that need performance optimization

## Solution Overview

Watt provides built-in HTTP caching with tag-based invalidation. This guide shows you how to:
1. Enable HTTP caching in your Watt application
2. Tag responses for intelligent cache invalidation
3. Invalidate cache by specific routes or tags
4. Test your caching implementation

## Prerequisites 

Before starting, ensure you have:

- [Node.js](https://nodejs.org/) (v22.18.0+)
- [npm](https://docs.npmjs.com/cli/) (comes with Node.js)
- A Watt application ([setup guide](https://docs.platformatic.dev/docs/getting-started/quick-start-watt))
- Basic understanding of HTTP caching headers 

## Step 1: Enable HTTP Cache in Watt 

Add HTTP caching configuration to your `watt.json` file:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/runtime/3.0.0.json",
  "httpCache": {
    "cacheTagsHeader": "X-Cache-Tags"
  },
  "applications": [
    // your applications here
  ]
}
```

**What this does:**
- Enables Watt's built-in HTTP caching layer
- Sets up cache tag header for intelligent invalidation
- No external cache services needed (Redis, Memcached, etc.)

## Step 2: Add Cache Headers to Your Responses

In your application endpoints, add appropriate cache headers:

```js
// routes/products.js
module.exports = async function (fastify) {
  fastify.get('/cached-counter', async (req, reply) => {
    // Set cache duration (10 minutes)
    reply.header('Cache-Control', 'public, s-maxage=600')
    
    // Tag this response for invalidation
    reply.header('X-Cache-Tags', 'counter-data')
    
    const counter = await getCounterFromDatabase()
    return { counter, timestamp: new Date().toISOString() }
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

## Step 3: Implement Cache Invalidation

### Method 1: Invalidate by Specific Route

When you need to invalidate cache for a specific endpoint:

```js
// routes/admin.js  
module.exports = async function (fastify) {
  fastify.delete('/invalidate-counter-cache', async (req, reply) => {
    await globalThis.platformatic.invalidateHttpCache({
      keys: [
        {
          origin: 'http://internal.plt.local',
          path: '/cached-counter',
          method: 'GET'
        }
      ]
    })
    
    return { message: 'Cache invalidated for counter endpoint' }
  })
}
```

### Method 2: Invalidate by Cache Tags

For more flexible invalidation across multiple related endpoints:

```js
// routes/admin.js
module.exports = async function (fastify) {
  fastify.delete('/invalidate-by-tags', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          tags: { type: 'string' }
        },
        required: ['tags']
      }
    }
  }, async (req, reply) => {
    const tags = req.query.tags.split(',')
    
    await globalThis.platformatic.invalidateHttpCache({ tags })
    
    return { 
      message: `Cache invalidated for tags: ${tags.join(', ')}`,
      invalidatedTags: tags
    }
  })
}
```

### Automatic Invalidation on Data Updates

Invalidate cache automatically when data changes:

```js
// routes/products.js
module.exports = async function (fastify) {
  fastify.post('/products', async (req, reply) => {
    const newProduct = await createProduct(req.body)
    
    // Invalidate all product-related cache
    await globalThis.platformatic.invalidateHttpCache({ 
      tags: ['products', `product-${newProduct.id}`] 
    })
    
    return newProduct
  })
  
  fastify.put('/products/:id', async (req, reply) => {
    const updatedProduct = await updateProduct(req.params.id, req.body)
    
    // Invalidate specific product cache
    await globalThis.platformatic.invalidateHttpCache({ 
      tags: [`product-${req.params.id}`, 'products'] 
    })
    
    return updatedProduct
  })
}
```

## Step 4: Verification and Testing

### Test Cache Behavior

**1. Start your Watt application:**
```bash
npm run dev
```

**2. Test cached responses:**
```bash
# First request - cache miss (hits database)
curl -i http://localhost:3042/cached-counter

# Second request - cache hit (returns cached data)
curl -i http://localhost:3042/cached-counter
```

**What to verify:**
- First response includes `X-Cache-Tags: counter-data`
- Subsequent requests return identical data (counter doesn't increment)
- Response includes proper `Cache-Control` headers

**3. Test cache invalidation:**
```bash
# Invalidate by specific route
curl -X DELETE http://localhost:3042/invalidate-counter-cache

# Or invalidate by tags
curl -X DELETE "http://localhost:3042/invalidate-by-tags?tags=counter-data"

# Verify cache was invalidated
curl -i http://localhost:3042/cached-counter
```

**Expected behavior:**
- After invalidation, counter value should increment on next request
- Response should have fresh timestamp

### Complete Example Implementation

Here's a complete working example that demonstrates all caching concepts:

```js
// routes/cache-demo.js
module.exports = async function (fastify) {
  let counter = 0
  
  // Cached endpoint
  fastify.get('/cached-counter', {
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
  }, async (req, reply) => {
    counter++
    
    // Set caching headers
    reply.header('Cache-Control', 'public, s-maxage=600') // 10 minutes
    reply.header('X-Cache-Tags', 'counter-data,demo-data')
    
    return { 
      counter, 
      timestamp: new Date().toISOString(),
      cached: true
    }
  })
  
  // Invalidation endpoints
  fastify.delete('/invalidate-counter', async (req, reply) => {
    await globalThis.platformatic.invalidateHttpCache({
      keys: [{
        origin: 'http://localhost:3042',
        path: '/cached-counter',
        method: 'GET'
      }]
    })
    
    return { message: 'Counter cache invalidated' }
  })
  
  fastify.delete('/invalidate-tags', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          tags: { type: 'string' }
        },
        required: ['tags']
      }
    }
  }, async (req, reply) => {
    const tags = req.query.tags.split(',')
    await globalThis.platformatic.invalidateHttpCache({ tags })
    
    return { message: `Invalidated tags: ${tags.join(', ')}` }
  })
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

## Next Steps

Now that you have HTTP caching working:

- **[Monitor your cache](/docs/guides/monitoring)** - Track cache hit rates and performance
- **[Deploy with caching](/docs/guides/deployment/)** - Production considerations for cached applications  
- **[Database optimization](/docs/guides/databases/)** - Combine caching with database best practices
- **[Load testing](/docs/guides/performance/)** - Verify cache performance under load