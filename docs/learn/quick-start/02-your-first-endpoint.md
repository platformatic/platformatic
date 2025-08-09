# Your First API Endpoint

Build your first custom API endpoint and experience Watt's unified development environment.

## What You'll Learn

By the end of this guide, you'll have:
- Created your first custom API route
- Understood how Watt organizes application code
- Seen Watt's unified logging in action
- Built a working "Hello, World!" API that responds to HTTP requests

## Prerequisites

You should have completed the previous guide: **[Install and Initialize Watt](01-install-and-init.md)**

Make sure you have:
- A Watt application created with `watt init my-app`
- Your development server running with `watt start`

## Step 1: Understanding Your Application Structure

In your `my-app` directory, you'll see a `web/` folder. This is where your application code lives.

```
my-app/
├── watt.json           # Watt configuration
├── web/               # Your application folder
│   ├── package.json   # Dependencies for this service (with "type": "module")
│   └── index.js       # Main application entry point
```

Watt automatically discovers and loads applications from the `web/` folder, giving you a unified development experience across multiple services.

## Step 2: Configure Package.json for ES Modules

First, we need to update your `web/package.json` to use ES Modules. Open the file and add `"type": "module"`:

```json
{
  "name": "web",
  "type": "module",
  "dependencies": {
    "fastify": "^4.0.0"
  }
}
```

The `"type": "module"` tells Node.js to treat `.js` files as ES Modules, allowing us to use modern `import` and `export` syntax.

## Step 3: Examine the Default Application

Let's look at what's already in your `web/index.js` file:

```bash
cat web/index.js
```

You'll see a basic Fastify application that's already set up with Watt's logging system. This is your starting point.

## Step 4: Add Your First Custom Route

Open `web/index.js` in your favorite editor and add a new route. Here's what to add:

```javascript
import fastify from 'fastify'

const app = fastify({
  loggerInstance: globalThis.platformatic?.logger?.child({}, { level: 'trace' })
})

// Default route (already exists)
app.get('/', async () => {
  return {
    message: 'Welcome to your Watt application!',
    timestamp: new Date().toISOString()
  }
})

// Add your first custom endpoint here
app.get('/hello', async (request, reply) => {
  const name = request.query.name || 'World'
  
  // Log the request - you'll see this in your unified console
  app.log.info(`Saying hello to ${name}`)
  
  return {
    message: `Hello, ${name}!`,
    endpoint: '/hello',
    method: 'GET',
    timestamp: new Date().toISOString()
  }
})

// Add a POST endpoint to handle data
app.post('/hello', async (request, reply) => {
  const { name, message } = request.body || {}
  
  // Log the incoming data
  app.log.info('Received POST request', { name, message })
  
  return {
    response: `Hello ${name || 'Anonymous'}!`,
    yourMessage: message || 'No message provided',
    endpoint: '/hello',
    method: 'POST',
    timestamp: new Date().toISOString()
  }
})

app.listen({ port: 1 }).then(() => {
  app.log.info('Hello API service ready!')
})
```

## Step 5: Watch Watt Auto-Reload Your Changes

If your development server is still running, Watt will automatically detect your changes and reload the application. You'll see something like this in your terminal:

```
[15:32:15.123] INFO: File change detected, reloading...
[15:32:15.456] INFO: Hello API service ready!
[15:32:15.457] INFO: Server listening at http://127.0.0.1:3042
```

This is Watt's unified development experience in action - no manual restarts needed!

## Step 6: Test Your New Endpoints

Now let's test your new API endpoints:

### Test the GET endpoint with browser or curl:

**Basic request:**
```bash
curl http://localhost:3042/hello
```

**With a name parameter:**
```bash
curl "http://localhost:3042/hello?name=Developer"
```

Expected response:
```json
{
  "message": "Hello, Developer!",
  "endpoint": "/hello",
  "method": "GET",
  "timestamp": "2024-01-15T15:32:45.123Z"
}
```

### Test the POST endpoint:

```bash
curl -X POST http://localhost:3042/hello \
  -H "Content-Type: application/json" \
  -d '{"name": "API Tester", "message": "Building something awesome!"}'
```

Expected response:
```json
{
  "response": "Hello API Tester!",
  "yourMessage": "Building something awesome!",
  "endpoint": "/hello",
  "method": "POST",
  "timestamp": "2024-01-15T15:32:45.123Z"
}
```

## Step 7: Experience Unified Logging

While testing your endpoints, watch your terminal where `watt start` is running. You'll see:

```
[15:32:45.123] INFO: Saying hello to Developer
[15:32:45.125] INFO: Received POST request {"name":"API Tester","message":"Building something awesome!"}
```

This unified logging shows you exactly what's happening across your entire application, making debugging and monitoring effortless.

## Understanding What You Built

Congratulations! You've just:

- **Created custom API endpoints** that handle both GET and POST requests
- **Used query parameters and request bodies** to make your API dynamic
- **Experienced hot reloading** - Watt automatically restarted your app when you made changes
- **Seen unified logging** - all your application logs appear in one place
- **Built a working API** that you can extend for real applications

### Key Watt Features You Used:

1. **Automatic Service Discovery**: Watt found your `web/index.js` and loaded it automatically
2. **Hot Reloading**: Changes were picked up instantly without manual restarts  
3. **Unified Logging**: All services log to the same console with consistent formatting
4. **Zero Configuration**: No complex setup - just write your Fastify code

## Next Steps

Your API is now ready to grow! You can:

- Add more routes and HTTP methods
- Connect to databases
- Add more services to the `web/` folder
- Deploy your application to production

In the next guide, you'll learn about:
- Structuring larger applications
- Adding multiple services
- Working with databases
- Deployment options

## Troubleshooting

### Changes Not Reflecting?
Make sure your `watt start` process is still running. If it crashed, restart it:
```bash
watt start
```

### Port Issues?
If you see port conflicts, check your terminal for the actual port Watt is using. It might auto-select a different port.

### JSON Parsing Errors?
Make sure you're sending proper JSON with the correct `Content-Type: application/json` header for POST requests.

## Summary

You now have a working API with custom endpoints! You've experienced Watt's core developer experience: automatic reloading, unified logging, and zero-configuration service discovery.

Your `hello` endpoint demonstrates how easy it is to build APIs with Watt - just write standard Fastify code and let Watt handle the development workflow.

Ready to build something bigger? Let's explore what else you can do with your new Watt application!

## Alternative Pattern: The Create Function

While the example above uses the direct application pattern with `app.listen()`, Platformatic also supports a `module.exports.create` pattern for more advanced use cases.

This alternative pattern is useful when you need:
- Async initialization before the app starts
- To return the app instance for testing or external management
- More control over the application lifecycle

Here's an example of the create function pattern:

```javascript
export async function create() {
  const app = fastify({
    loggerInstance: globalThis.platformatic?.logger?.child({}, { level: 'trace' })
  })
  
  // Configure your routes
  app.get('/', async () => {
    return { message: 'Hello from create pattern!' }
  })
  
  // Return the configured app instance
  return app
}
```

**When to use each pattern:**
- For simple applications and learning, the direct `export default async function (app)` pattern shown in the main example is preferred as it's easier to understand
- The `export async function create()` pattern is better suited for complex applications that need async setup or when you want more control over the app instance
- The create function pattern is documented in more detail in the advanced guides

Both patterns work seamlessly with Watt's development features like hot reloading and unified logging.