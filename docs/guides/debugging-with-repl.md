# Debugging Applications with the REPL

Interactive debugging is essential for understanding application behavior, inspecting state, and troubleshooting issues at runtime. Watt provides a built-in REPL (Read-Eval-Print Loop) command that lets you connect directly to a running application's worker thread and execute JavaScript code interactively.

This guide will walk you through using the REPL for debugging, from basic usage to advanced techniques for inspecting your application's internals.

## Overview

The `wattpm repl` command starts an interactive Node.js REPL session inside a running application's worker thread. This gives you direct access to:

- The Fastify application instance (`app`) - for service-based applications
- The application capability object (`capability`) - configuration and methods
- The global Platformatic object (`platformatic`) - messaging, events, shared context
- The application configuration (`config`)
- The application logger (`logger`)
- All modules and variables in the worker's scope

### Key Features

- **Live inspection**: Examine application state while it's running
- **Execute code**: Run arbitrary JavaScript in the application context
- **Access Fastify**: Interact with routes, plugins, decorators, and the server
- **Debug issues**: Inspect variables, test functions, and trace problems
- **Zero configuration**: Works out of the box with any Watt application
- **Remote debugging**: Connect to applications running in any environment

## Prerequisites

Before using the REPL, ensure that:

1. **Watt is installed**: You need `wattpm` CLI installed globally or in your project
2. **Application is running**: Your Watt application must be running in development or production mode
3. **Applications are operational**: The applications you want to debug should be started

```bash
# Install wattpm globally
npm install -g wattpm

# Verify wattpm installation
wattpm version
```

## Basic Usage

### Starting a REPL Session

To start a REPL session in your application:

```bash
# Auto-connect if single application, or list available applications
wattpm repl

# Connect to a specific application
wattpm repl api-service

# Connect with explicit runtime name
wattpm repl my-app api-service

# Connect using runtime PID
wattpm repl 12345 api-service
```

When the REPL connects successfully, you'll see a prompt with the application name:

```
api-service>
```

### Exiting the REPL

To exit the REPL session:

```javascript
api-service> .exit
```

Or press `Ctrl+D` (EOF) or `Ctrl+C` twice.

## Exploring the Application Context

### The `app` Object

The `app` variable provides access to the Fastify application instance:

```javascript
// Get server address
api-service> app.server.address()
{ address: '::', family: 'IPv6', port: 3000 }

// List registered routes
api-service> app.printRoutes()
└── /
    ├── api (GET, HEAD)
    │   └── /health (GET, HEAD)
    └── users (GET, HEAD, POST)

// Access registered plugins
api-service> app.pluginName
'my-plugin'

// Check if a decorator exists
api-service> app.hasDecorator('myDecorator')
true
```

### The `platformatic` Object

The `platformatic` variable provides access to the global Platformatic context:

```javascript
// See what's available
api-service> Object.keys(platformatic)
[ 'logger', 'events', 'messaging', 'config', 'sharedContext' ]

// Access the logger
api-service> platformatic.logger.info('Hello from REPL!')

// Access shared context
api-service> platformatic.sharedContext.get()
{ someKey: 'someValue' }
```

### The `config` Object

The `config` variable contains the application's configuration:

```javascript
// Get application ID
api-service> config.id
'api-service'

// Inspect configuration
api-service> config.server
{ hostname: '0.0.0.0', port: 3000 }

// Check environment
api-service> config.isProduction
false
```

### The `capability` Object

The `capability` variable provides access to the application's capability with its configuration and methods:

```javascript
// Check capability type
api-service> capability.type
'service'

// Get application root directory
api-service> capability.root
'/path/to/my-app/services/api-service'

// Check if this is the entrypoint
api-service> capability.isEntrypoint
true

// Access runtime configuration
api-service> capability.runtimeConfig
{ ... }

// Get application URL (if listening)
api-service> capability.url
'http://127.0.0.1:3000'

// Access the capability's logger
api-service> capability.logger.info('Debug message')
```

### The `logger` Object

The `logger` variable provides access to the application's Pino logger:

```javascript
// Log at different levels
api-service> logger.info('Information message')
api-service> logger.debug({ data: 'object' }, 'Debug with data')
api-service> logger.warn('Warning message')
api-service> logger.error(new Error('test'), 'Error occurred')

// Check current log level
api-service> logger.level
'info'
```

## Advanced Debugging Techniques

### Inspecting Routes

You can examine registered routes and their handlers:

```javascript
// Get all routes with details
api-service> app.printRoutes({ includeHooks: true, includeMeta: true })

// Access route schemas
api-service> app.getSchemas()
```

### Testing Endpoints

Use `app.inject()` to make test requests without going through the network:

```javascript
// Make a GET request
api-service> await app.inject({ method: 'GET', url: '/api/health' })
{
  statusCode: 200,
  headers: { 'content-type': 'application/json' },
  body: '{"status":"ok"}'
}

// Make a POST request with body
api-service> await app.inject({
  method: 'POST',
  url: '/api/users',
  payload: { name: 'Test User', email: 'test@example.com' },
  headers: { 'content-type': 'application/json' }
})
```

### Accessing Decorators

If your application uses Fastify decorators:

```javascript
// Access a decorated property
api-service> app.db
[Database Connection Object]

// Call a decorated method
api-service> await app.authenticate({ token: 'test-token' })
```

### Inspecting Plugins

Examine registered plugins:

```javascript
// List all plugins
api-service> app.printPlugins()

// Access plugin-specific data
api-service> app.swagger
[Swagger Plugin Object]
```

### Working with Environment Variables

```javascript
// Access environment variables
api-service> process.env.DATABASE_URL
'postgres://localhost:5432/mydb'

// Check NODE_ENV
api-service> process.env.NODE_ENV
'development'
```

### Inter-Service Communication

Test communication between applications:

```javascript
// Send a message to another application
api-service> await platformatic.messaging.send('other-service', 'ping', { data: 'test' })

// Check messaging capabilities
api-service> typeof platformatic.messaging.send
'function'
```

## Common Debugging Scenarios

### Debugging a 500 Error

When an endpoint returns a 500 error:

```javascript
// Test the endpoint directly
api-service> const result = await app.inject({ method: 'GET', url: '/api/problematic' })

// Check the error
api-service> JSON.parse(result.body)
{ statusCode: 500, error: 'Internal Server Error', message: 'Cannot read property x of undefined' }

// Inspect the route handler (if accessible)
api-service> app.routes
```

### Checking Database Connections

```javascript
// If using @platformatic/sql-mapper
api-service> app.platformatic.entities
{ User: [Entity], Post: [Entity] }

// Test a query
api-service> await app.platformatic.entities.User.find({ limit: 1 })
```

### Memory Inspection

```javascript
// Get memory usage
api-service> process.memoryUsage()
{
  rss: 85622784,
  heapTotal: 52031488,
  heapUsed: 45123456,
  external: 1234567
}

// Force garbage collection (if --expose-gc is enabled)
api-service> global.gc && global.gc()
```

### Checking Event Listeners

```javascript
// List event listeners
api-service> app.server.eventNames()
[ 'connection', 'request', 'close' ]

// Check listener count
api-service> app.server.listenerCount('request')
1
```

## Best Practices

### Do's

- **Use for debugging**: The REPL is ideal for investigating issues in development
- **Test hypotheses**: Try out fixes before implementing them in code
- **Inspect state**: Examine application state at specific points in time
- **Learn the API**: Explore Fastify and Platformatic APIs interactively

### Don'ts

- **Avoid in production**: Be cautious using REPL in production environments
- **Don't modify critical state**: Changing application state can cause instability
- **Don't expose secrets**: Be careful when inspecting environment variables
- **Don't leave sessions open**: Exit the REPL when you're done debugging

## Troubleshooting

### "Cannot find a matching runtime"

Make sure your application is running:

```bash
# Check running applications
wattpm ps

# Start your application
wattpm start
```

### "Cannot find a matching application"

Verify the application name:

```bash
# List applications in the runtime
wattpm applications

# Use the correct application name
wattpm repl correct-service-name
```

### REPL Session Disconnects

The REPL session may disconnect if:

- The application restarts
- The worker thread crashes
- Network issues occur (for remote applications)

Simply reconnect with `wattpm repl` after the application is running again.

## Related Documentation

- [CLI Commands Reference](../reference/wattpm/cli-commands.md) - Complete CLI documentation
- [Profiling with Watt](./profiling-with-watt.md) - CPU and heap profiling
- [Logging Guide](./logging.md) - Application logging
- [Metrics Guide](./metrics.md) - Application metrics and monitoring
