# Watt MCP Server Tutorial

A step-by-step guide to using the Watt MCP Server with Claude Code to transform Node.js applications into Watt runtime applications and manage multi-service architectures.

## Prerequisites

- Node.js 20+ installed
- Claude Code CLI installed and configured
- An existing Node.js application (or ready to create one)

## Installation

### Option 1: Install from npm (Recommended)

Install the MCP server globally:

```bash
npm install -g @platformatic/watt-mcp-server
```

Then configure Claude Code by creating or editing `~/.claude.json`:

**Linux/macOS**:
```json
{
  "mcpServers": {
    "watt": {
      "command": "watt-mcp-server"
    }
  }
}
```

**Important**: The configuration file is `~/.claude.json` (in your home directory), not `~/.claude/config.json`. If the file already exists with other settings, just add the `mcpServers` section to it.

### Option 2: Install from Source (For Development)

If you're working on the Platformatic repository:

```bash
cd packages/watt-mcp-server
pnpm install
npm link
```

Then configure Claude Code the same way:

```json
{
  "mcpServers": {
    "watt": {
      "command": "watt-mcp-server"
    }
  }
}
```

The `npm link` command makes `watt-mcp-server` available globally from your local source code.

### Restart Claude Code

After adding the configuration, restart Claude Code to load the MCP server.

### Verify Installation

```
You: What Watt configuration tools are available?
```

Claude Code should list 7 tools including `get_configuration_guide`, `generate_watt_config`, `add_service_to_runtime`, etc.

### Important: Understanding Watt Configurations

Before working with Watt configurations, Claude Code can read a comprehensive guide:

```
You: Show me the Watt configuration guide
```

This gives Claude complete knowledge about:
- All application types and their requirements
- When to use server configuration vs when not to
- Architecture patterns (standalone, gateway with services, etc.)
- Best practices and troubleshooting

## Tutorial 1: Transform a Node.js Application to Use Watt Runtime

Let's transform an existing Node.js application to run under the Watt runtime.

### Scenario: You Have a Simple Fastify App

**Initial Structure**:
```
my-app/
├── index.js        (Fastify app)
├── package.json
└── routes/
    └── api.js
```

**Your `index.js`**:
```javascript
import Fastify from 'fastify'

export function create() {
  const app = Fastify({ logger: true })

  app.get('/', async (request, reply) => {
    return { message: 'Hello World' }
  })

  return app
}
```

**Note**: With Watt, you export a `create()` function that returns the Fastify instance. Watt handles starting the server.

### Step 1: Create a Watt Configuration for Your Node App

```
You: I have a Node.js Fastify application in index.js that exports a create() function. Generate a Watt node configuration that will run this application.
```

**Claude Code will**:
1. Use `generate_watt_config` to create a node-type configuration (default type for HTTP services)
2. Show you the configuration:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/node/3.11.0.json",
  "node": {
    "main": "index.js"
  },
  "logger": {
    "level": "info"
  }
}
```

**Important**: The configuration uses `@platformatic/node` type (not `@platformatic/service`) for standard Fastify applications.

### Step 2: Save the Configuration

```
You: Save this configuration to watt.json in the root of my project
```

**Claude Code will**:
- Use `write_watt_config` to save the file
- Confirm the file was created

**Your Structure Now**:
```
my-app/
├── index.js
├── package.json
├── watt.json       (NEW)
└── routes/
    └── api.js
```

### Step 3: Install Watt and Run Your Application

```bash
# Install wattpm
npm install wattpm

# Run with Watt
npx watt
```

Your Fastify app now runs under the Watt runtime with:
- Centralized logging
- Better process management
- Ready for multi-service architecture

### Step 4: Optional - Add Development Configuration

```
You: Update my watt.json to use debug logging for development
```

**Claude Code will**:
1. Read your current configuration
2. Update the logger level to 'debug'
3. Save the updated configuration

## Tutorial 2: Adding Services to a Watt Runtime

Now let's expand your application by adding additional services.

### Scenario: Add a Fastify API Service

You want to add a separate Fastify microservice alongside your Express app.

### Step 1: Create the Fastify Service

First, create the service directory and code:

```bash
mkdir -p services/api
cd services/api
npm init -y
npm install fastify
```

**Create `services/api/index.js`**:
```javascript
import Fastify from 'fastify'

export function create() {
  const app = Fastify()

  app.get('/users', async (request, reply) => {
    return { users: ['alice', 'bob'] }
  })

  app.get('/products', async (request, reply) => {
    return { products: ['widget', 'gadget'] }
  })

  return app
}
```

### Step 2: Generate Configuration for the Fastify Service

```
You: Generate a Watt node configuration for a Fastify service at services/api on port 3001 with metrics enabled
```

**Claude Code will**:
1. Use `generate_watt_config` with type 'node' (default for Fastify)
2. Show you the configuration:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/node/3.11.0.json",
  "node": {
    "main": "index.js"
  },
  "server": {
    "hostname": "0.0.0.0",
    "port": 3001
  },
  "logger": {
    "level": "info"
  },
  "metrics": {
    "server": "hide",
    "defaultMetrics": {
      "enabled": true
    }
  }
}
```

**Important**: We use `@platformatic/node` type (not `@platformatic/service`) for standard Fastify applications.

### Step 3: Save the Service Configuration

```
You: Save this configuration to services/api/watt.json
```

**Your Structure Now**:
```
my-app/
├── index.js
├── package.json
├── watt.json
├── routes/
│   └── api.js
└── services/
    └── api/
        ├── index.js
        ├── package.json
        └── watt.json    (NEW)
```

### Step 4: Create Runtime Configuration

Now we need to update the root `watt.json` to include both the main Fastify app and the API service.

```
You: Transform my watt.json into a runtime configuration and add two services:
1. The main Fastify app at the root (id: "main")
2. The Fastify API service at ./services/api (id: "api")
```

**Claude Code will**:
1. Read your current `watt.json`
2. Transform it into a runtime configuration
3. Use `add_service_to_runtime` to add both services
4. Show you the new configuration:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/runtime/3.11.0.json",
  "applications": [
    {
      "id": "main",
      "path": ".",
      "config": "watt.json"
    },
    {
      "id": "api",
      "path": "./services/api"
    }
  ],
  "entrypoint": "main"
}
```

**Note**: Runtime configs use `applications` array (not `services`) and MUST specify an `entrypoint`.

### Step 5: Move Original Node Config

Since we're now using a runtime configuration, we need to rename the configs:

```
You: I need to:
1. Move the current watt.json to node-service.json
2. Create a new watt.json with the runtime configuration that references node-service.json for the main service
```

**Claude Code will help you**:
- Create the runtime configuration
- Update the service reference

**Final Structure**:
```
my-app/
├── index.js
├── package.json
├── watt.json              (Runtime config)
├── node-service.json      (Node app config)
├── routes/
│   └── api.js
└── services/
    └── api/
        ├── index.js
        ├── package.json
        └── watt.json      (Fastify service config)
```

**Final `watt.json`** (runtime):
```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/runtime/3.11.0.json",
  "applications": [
    {
      "id": "main",
      "path": ".",
      "config": "node-service.json"
    },
    {
      "id": "api",
      "path": "./services/api"
    }
  ],
  "entrypoint": "main",
  "server": {
    "hostname": "0.0.0.0",
    "port": 3000
  }
}
```

**Note**: Runtime uses `applications` array and requires an `entrypoint` field.

### Step 6: Run Your Multi-Service Application

```bash
npx watt
```

Now both services run together:
- Main Fastify app: `http://localhost:3000`
- Fastify API service: `http://localhost:3001`

### Step 7: Enable Service Mesh Communication

To allow services to communicate via the Watt mesh network:

```
You: Configure my services to communicate via the Watt service mesh
```

**Claude Code will**:
1. Explain that services can reference each other using their IDs
2. Show you how to make requests between services

**Example**: From your main Fastify app, you can call the API service:

```javascript
// In your main Fastify app (index.js)
// Inside the create() function, add:
app.get('/all-data', async (request, reply) => {
  // Call the api service via mesh network using service ID
  const response = await fetch('http://api/users')
  const users = await response.json()

  return { users }
})
```

**Important**: Service mesh URLs use `http://serviceId/path` format (no `.plt.local` suffix).

## Tutorial 3: Adding More Services

### Adding a Database Service

```
You: Add a Platformatic DB service at ./services/database with PostgreSQL
```

**Claude Code will**:
1. Generate a DB service configuration
2. Add it to your runtime configuration
3. Show you the complete setup

### Adding a Frontend Service

```
You: Add a Next.js frontend at ./web/frontend as the entrypoint for my application
```

**Claude Code will**:
1. Generate appropriate configuration for Next.js
2. Add it to the runtime as a web service
3. Set it as the entrypoint

The frontend can then call your Fastify services via the service mesh using URLs like `http://api/` or `http://main/`.

## Tutorial 4: Using Autoload for Monorepo Pattern (Recommended)

The autoload pattern automatically discovers services from a directory, making it easier to manage multiple services.

### Scenario: Convert to Autoload Pattern

Instead of manually listing services in the `applications` array, use autoload:

```
You: Convert my runtime configuration to use autoload from the ./services directory
```

**Claude Code will**:
1. Read your current runtime configuration
2. Transform it to use autoload
3. Show you the new configuration:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/runtime/3.11.0.json",
  "autoload": {
    "path": "./services"
  },
  "entrypoint": "gateway",
  "server": {
    "hostname": "0.0.0.0",
    "port": 3000
  },
  "logger": {
    "level": "info"
  }
}
```

**Directory Structure for Autoload**:
```
my-app/
├── watt.json              (Runtime config with autoload)
└── services/
    ├── gateway/           (Service ID: gateway)
    │   ├── index.js
    │   ├── package.json
    │   └── watt.json
    ├── api/               (Service ID: api)
    │   ├── index.js
    │   ├── package.json
    │   └── watt.json
    └── auth/              (Service ID: auth)
        ├── index.js
        ├── package.json
        └── watt.json
```

**Benefits of Autoload**:
- No need to manually add services to the runtime config
- Services are automatically discovered based on directory names
- Service IDs match directory names
- Easier to add/remove services

**Excluding Directories**:
```json
{
  "autoload": {
    "path": "./services",
    "exclude": ["common", "shared", "utils"]
  }
}
```

## Common Patterns

### Pattern 1: Development vs Production Configurations

```
You: Create separate watt.json files for development and production with different logging levels
```

### Pattern 2: Adding Service Dependencies

```
You: Configure the api service to start only after the database service is ready
```

### Pattern 3: Environment Variables

```
You: Add environment variable configuration to my services for database connection strings
```

## Troubleshooting

### Service Not Starting

```
You: My api service isn't starting. Read and validate its configuration at services/api/watt.json
```

### Port Conflicts

```
You: I'm getting a port conflict. Change the api service to use port 3002
```

### Configuration Errors

```
You: Validate all my Watt configurations and tell me if there are any errors
```

## Next Steps

After completing these tutorials, you can:

1. Add more services (microservices architecture)
2. Configure service mesh networking
3. Add monitoring and metrics
4. Set up OpenTelemetry tracing
5. Configure production deployments

## Reference

- [Watt Documentation](https://docs.platformatic.dev/docs/reference/wattpm/overview)
- [Platformatic Service](https://docs.platformatic.dev/docs/reference/service/overview)
- [Platformatic DB](https://docs.platformatic.dev/docs/reference/db/overview)

## Tips

1. **Start Simple**: Begin with a single service, then add more
2. **Validate Often**: Use `validate_watt_config` before running
3. **Use Service Mesh**: Reference services by ID for inter-service communication
4. **Centralized Config**: Keep your runtime configuration in the root `watt.json`
5. **Ask Claude Code**: If you're stuck, just describe what you want to achieve!
