---
title: What is Watt?
label: What is Watt?
---

# What is Watt?

## 30-Second Overview

**Watt is a Node.js Application Server** that runs multiple Node.js applications, databases, and frontend frameworks as a single unified system. Instead of managing separate servers and complex deployments, Watt provides one runtime that handles everything - from APIs and databases to React/Next.js frontends - with built-in observability and zero-configuration deployment.

**Think Docker Compose for Node.js applications** - but faster, simpler, and with production-ready monitoring built-in.

## 5-Minute Deep Dive

### The Problem Watt Solves

Modern Node.js development is fragmented and complex:

- **Multiple servers to manage** - Database server, API server, frontend server, reverse proxy
- **Complex deployment pipelines** - Different containers, orchestration, networking
- **Fragmented monitoring** - Logs scattered across services, no unified observability
- **Inconsistent environments** - What works locally breaks in production

### How Watt Transforms Your Development

Watt provides a **unified application server** that runs everything in a single Node.js process with intelligent resource management:

```bash
# Before: Multiple servers and complex setup
docker-compose up postgres  # Database server
npm run api                 # API server  
npm run frontend           # Frontend server
nginx                      # Reverse proxy

# After: Single command with Watt
npm start                  # Everything runs together
```

### Core Capabilities

**🚀 Service Orchestration**
- Run databases, APIs, and frontends in a single application server
- Automatic inter-service communication and load balancing
- Hot reloading and development-to-production consistency

**⚡ Built-in Database Layer**  
- Auto-generated REST and GraphQL APIs from your database schema
- Support for PostgreSQL, MySQL, MariaDB, SQLite
- Built-in migrations, authorization, and real-time subscriptions

**🎨 Framework Integration**
- Native support for Next.js, Astro, Remix, Vite applications
- Works with Express, Fastify, or any Node.js framework
- Unified routing and middleware across all services

**📊 Production-Ready Observability**
- Structured logging with Pino across all services
- Prometheus metrics and OpenTelemetry distributed tracing
- Health checks and Kubernetes-ready deployments

### When to Choose Watt

**✅ Perfect For:**
- **Full-stack applications** where you want unified backend/frontend deployment
- **API-first projects** that need auto-generated database endpoints
- **Microservices** that should deploy as a single unit
- **Teams migrating** from fragmented Node.js toolchains

**⚠️ Consider Alternatives When:**
- You need polyglot services (non-Node.js languages)
- Your architecture requires true service independence
- You're heavily invested in existing container orchestration

## 15-Minute Complete Understanding

### Architecture Deep Dive

Watt fundamentally reimagines Node.js application architecture by providing a **service mesh within a single Node.js process**. Here's how it works:

#### Service Types and Execution Models

**Worker Thread Services** (Fast startup, low overhead):
- **Next.js/Astro/Remix applications** - Frontend frameworks with SSR
- **HTTP Services** - Custom APIs built on Fastify
- **Database Services** - Auto-generated APIs from SQL schemas

**Child Process Services** (For complex startup requirements):
- **Node.js applications** - Existing apps with complex initialization
- **Legacy services** - Migration-friendly wrapper for existing code

#### Inter-Service Communication

```javascript
// Internal service-to-service communication
const response = await fetch('http://api.plt.local/users')

// External API exposure through Composer
GET /users -> routes to -> http://api.plt.local/users
```

Watt provides:
- **Internal DNS resolution** (`service.plt.local`) for inter-service communication
- **Unified external routing** through Platformatic Composer
- **Automatic load balancing** and health checking
- **Request/response transformation** and API aggregation

### Production Architecture Benefits

#### Unified Logging and Observability

```javascript
// Every service automatically gets structured logging
logger.info({
  service: 'user-api',
  userId: 123,
  action: 'login'
}, 'User logged in')

// Distributed tracing across all services
// OpenTelemetry spans automatically correlate requests
```

#### Deployment Simplification

**Traditional Microservices Deployment:**
```yaml
# docker-compose.yml - 100+ lines
services:
  postgres: ...
  redis: ...  
  user-api: ...
  product-api: ...
  frontend: ...
  nginx: ...
```

**Watt Deployment:**
```yaml
# docker-compose.yml - 10 lines
services:
  app:
    image: my-watt-app
    ports: ["3042:3042"]
```

### Service Configuration Patterns

Watt uses a **configuration-driven approach** where each service declares its requirements:

```json
// watt.json - Application orchestration
{
  "services": [
    {
      "path": "./web/api",
      "id": "api"
    },
    {
      "path": "./web/frontend", 
      "id": "frontend"
    }
  ]
}

// web/api/platformatic.json - Database service
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/db/2.0.0.json",
  "db": {
    "connectionString": "{DATABASE_URL}",
    "graphql": true,
    "openapi": true
  }
}

// web/frontend/watt.json - Next.js integration  
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/next/2.0.0.json",
  "application": {
    "basePath": "/app"
  }
}
```

### Enterprise Production Patterns

#### Multi-Environment Configuration

```javascript
// Environment-specific configuration
{
  "db": {
    "connectionString": "{DATABASE_URL}",
    "poolSize": "{DB_POOL_SIZE:-10}"
  },
  "server": {
    "port": "{PORT:-3042}",
    "hostname": "{HOST:-0.0.0.0}"
  },
  "logging": {
    "level": "{LOG_LEVEL:-info}"
  }
}
```

#### Health Checks and Kubernetes Integration

```yaml
# Kubernetes deployment with built-in health checks
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
      - name: watt-app
        livenessProbe:
          httpGet:
            path: /.well-known/live
            port: 3042
        readinessProbe:
          httpGet:
            path: /.well-known/ready  
            port: 3042
```

### Migration Strategy from Existing Applications

#### From Express/Fastify Applications

```javascript
// 1. Wrap existing Express app
import express from 'express'

export function build() {
  const app = express()
  // ... your existing Express routes
  return app
}

// 2. Add to Watt configuration
// watt.json
{
  "services": [
    { "path": "./existing-express-app", "id": "api" }
  ]
}
```

#### From Next.js Applications

```bash
# 1. Add Watt configuration to existing Next.js app
echo '{"$schema": "https://schemas.platformatic.dev/@platformatic/next/2.0.0.json"}' > watt.json

# 2. Create Watt project structure
npx wattpm init
wattpm import ./existing-nextjs-app

# 3. Add database service
wattpm create --type @platformatic/db
```

### Performance Characteristics

**Memory Usage:**
- **Traditional microservices:** ~50-100MB per service
- **Watt services:** ~10-20MB per service (shared Node.js runtime)

**Startup Time:**
- **Traditional:** 2-5 seconds per service (sequential startup)
- **Watt:** 500ms total (parallel startup with worker threads)

**Development Experience:**
- **Hot reload:** All services restart together
- **Unified debugging:** Single debugger session for entire application
- **Consistent environments:** Development matches production exactly

### Understanding the Platformatic Ecosystem

Watt is the **application server** that orchestrates different types of services:

**Service Types within Watt:**
- **Database Service** (`@platformatic/db`) - Auto-generated APIs from SQL schemas
- **HTTP Service** (`@platformatic/service`) - Custom application logic with Fastify
- **Composer Service** (`@platformatic/composer`) - API gateway and service aggregation
- **Runtime Environment** (`@platformatic/runtime`) - Development/production environment management

**Stackable Integrations:**
- **Next.js** (`@platformatic/next`) - React applications with SSR
- **Astro** (`@platformatic/astro`) - Multi-framework static sites
- **Remix** (`@platformatic/remix`) - Full-stack React framework
- **Vite** (`@platformatic/vite`) - Modern build tool integration
- **Node.js** (`@platformatic/node`) - Generic Node.js application wrapper

### Advanced Use Cases

#### Multi-Tenant SaaS Applications

```javascript
// Tenant-aware database service with row-level security
{
  "db": {
    "connectionString": "{DATABASE_URL}",
    "authorization": {
      "rules": [{
        "role": "user",
        "entity": "users",
        "find": ["user_id = $USER_ID"],
        "save": ["user_id = $USER_ID"],
        "delete": ["user_id = $USER_ID"]
      }]
    }
  }
}
```

#### Real-Time Applications

```javascript
// GraphQL subscriptions across services
subscription UserUpdated($userId: ID!) {
  userUpdated(userId: $userId) {
    id
    name
    lastSeen
  }
}
```

#### API-First Development

```javascript
// Auto-generated OpenAPI from database schema
GET /api/users        # List users
POST /api/users       # Create user  
GET /api/users/123    # Get user by ID
PUT /api/users/123    # Update user
DELETE /api/users/123 # Delete user

# GraphQL endpoint automatically available
POST /api/graphql
```

## Next Steps

Now that you understand what Watt is and how it works, choose your next step:

### 🚀 **Get Started Immediately**
- [5-Minute Quick Start](/docs/getting-started/quick-start-watt) - Get a running application
- [Step-by-Step Tutorial](/docs/learn/beginner/crud-application) - Build a complete app

### 🔍 **Learn More About Watt**  
- [Architecture Overview](/docs/overview/architecture-overview) - Technical deep dive
- [Use Cases & Examples](/docs/overview/use-cases-and-examples) - Real-world scenarios
- [Comparison with Alternatives](/docs/overview/comparison-with-alternatives) - vs Express, Next.js, etc.

### 🛠️ **Start Building**
- [Migration Guide](/docs/getting-started/port-your-app) - Port existing applications
- [Database Integration](/docs/guides/databases/) - Add persistent data storage
- [Framework Integration](/docs/guides/frameworks/) - Add React, Vue, or other frameworks

### 📖 **Deep Understanding**
- [Watt Reference](/docs/reference/watt/) - Complete configuration options
- [Service Types](/docs/reference/) - Database, HTTP, Composer services
- [Production Deployment](/docs/guides/deployment/) - Kubernetes, Docker, monitoring

**Questions?** Join our [Discord community](https://discord.gg/platformatic) or check [GitHub Discussions](https://github.com/platformatic/platformatic/discussions) for real-time help from the Watt team and community.