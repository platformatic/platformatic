---
title: What is Watt?
label: What is Watt?
---

# What is Watt?

## 30-Second Overview

**Watt is a Node.js Application Server** that integrates multiple Node.js applications and frontend frameworks as a single unified system. Instead of managing separate servers and complex deployments, Watt provides one runtime that handles everything - from APIs to React/Next.js frontends - with built-in observability and zero-configuration deployment. Watt allows you to integrate any existing app into your application server.

**Think Docker Compose for Node.js applications** - but faster, simpler, and with production-ready monitoring built-in.

## 5-Minute Deep Dive

### The Problem Watt Solves

Modern Node.js development is fragmented and complex:

- **Multiple servers to manage** - API server, frontend server, reverse proxy
- **Complex deployment pipelines** - Different containers, orchestration, networking
- **Fragmented monitoring** - Logs scattered across services, no unified observability
- **Inconsistent environments** - What works locally breaks in production
- **Single-threaded limitations** - Traditional Node.js applications can't fully utilize multi-core systems

### How Watt Transforms Your Development

Watt provides a **unified application server** that runs everything in a single Node.js process with intelligent resource management:

```bash
# Before: Multiple servers and complex setup
npm run api                 # API server
npm run frontend           # Frontend server
nginx                      # Reverse proxy

# After: Single command with Watt
npm start                  # Everything runs together
```

### Core Capabilities

**🚀 Application Orchestration**

- Run APIs and frontends in a single application server
- Automatic inter-application communication and load balancing
- Hot reloading and development-to-production consistency

**🎨 Framework Integration**

- Native support for Next.js, Astro, Remix, Vite, NestJS applications
- Integrates any existing Express, Fastify, or Node.js application
- Unified routing and middleware across all applications

**⚡ Multithreading**

- Parallel execution of multiple applications within a single Node.js process leveraging Node.js worker threads
- Intelligent resource allocation and load distribution

**📊 Production-Ready Observability**

- Structured logging with Pino across all applications
- Prometheus metrics and OpenTelemetry distributed tracing
- Health checks and Kubernetes-ready deployments

### When to Choose Watt

**✅ Perfect For:**

- **Full-stack applications** where you want unified backend/frontend deployment
- **API-first projects** that need auto-generated database endpoints
- **Microservices** that should deploy as a single unit
- **Teams migrating** from fragmented Node.js toolchains

**⚠️ Consider Alternatives When:**

- Your architecture requires true application independence with completely isolated processes
- You're heavily invested in existing container orchestration
- You need languages not yet supported (Watt supports Node.js, PHP, with Python coming soon)

## 15-Minute Complete Understanding

### Architecture Deep Dive

Watt fundamentally reimagines Node.js application architecture by providing a **application mesh within a single Node.js process**. Here's how it works:

#### Application Types and Execution Models

**Worker Thread Applications** (Fast startup, low overhead):

- **Next.js/Astro/Remix applications** - Frontend frameworks with SSR
- **HTTP Applications** - Custom APIs built on Fastify
- **Database Applications** - Auto-generated APIs from SQL schemas via Platformatic DB

**Child Process Applications** (For complex startup requirements):

- **Node.js applications** - Existing apps with complex initialization
- **Legacy applications** - Migration-friendly wrapper for existing code

#### Inter-Application Communication

```javascript
// Internal application-to-application communication
const response = await fetch('http://api.plt.local/users')

// External API exposure through Composer
GET /users -> routes to -> http://api.plt.local/users
```

Watt provides:

- **Internal DNS resolution** (`application.plt.local`) for inter-application communication
- **Unified external routing** through Platformatic Composer
- **Automatic load balancing** and health checking
- **Request/response transformation** and API aggregation

### Production Architecture Benefits

#### Unified Logging and Observability

```javascript
// Every application automatically gets structured logging
logger.info(
  {
    application: 'user-api',
    userId: 123,
    action: 'login'
  },
  'User logged in'
)

// Distributed tracing across all applications
// OpenTelemetry spans automatically correlate requests
```

#### Deployment Simplification

**Traditional Microservices Deployment:**

```yaml
# docker-compose.yml - 100+ lines
services:
  user-api: ...
  product-api: ...
  frontend: ...
  nginx: ...
```

**Watt Deployment:**

```yaml
# docker-compose.yml - 4 lines
services:
  app:
    image: my-watt-app
    ports: ['3042:3042']
```

### Application Configuration Patterns

Watt uses a **configuration-driven approach** where each application declares its requirements:

```json
// watt.json - Application orchestration
{
  "applications": [
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

// web/api/platformatic.json - Express.js application
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/node/3.0.0.json"
}

// web/frontend/watt.json - Next.js integration
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/next/3.0.0.json",
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
    "poolSize": "{DB_POOL_SIZE}"
  },
  "server": {
    "port": "{PORT}",
    "hostname": "{HOST}"
  },
  "logging": {
    "level": "{LOG_LEVEL}"
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
  "applications": [
    { "path": "./existing-express-app", "id": "api" }
  ]
}
```

#### From Next.js Applications

```bash
# 1. Add Watt configuration to existing Next.js app
echo '{"$schema": "https://schemas.platformatic.dev/@platformatic/next/3.0.0.json"}' > watt.json

# 2. Create Watt project structure
npm wattpm create
wattpm-utils import ./existing-nextjs-app

# 3. Add database application
npm wattpm create # Choose @platformatic/db
```

### Development Experience

**Development Benefits:**

- **Hot reload:** All applications restart together
- **Unified debugging:** Single debugger session for entire application
- **Consistent environments:** Development matches production exactly

**Unified Runtime:**

- **Shared Node.js process:** Applications run within the same runtime
- **Worker threads:** Enables parallel execution for compatible applications
- **Resource management:** Intelligent allocation across applications

### Understanding the Platformatic Ecosystem

Watt is the **application server** that orchestrates different types of applications. Understanding the distinction between Watt and its application types is crucial:

#### Watt vs Platformatic DB: Clear Distinction

| Aspect                 | **Watt (Application Server)**                          | **Platformatic DB (Application Type)**      |
| ---------------------- | ------------------------------------------------------ | ------------------------------------------- |
| **Purpose**            | Orchestrates multiple applications in a single runtime | Generates APIs from database schemas        |
| **Scope**              | Entire application architecture                        | Database-specific application layer         |
| **Role**               | Container/runtime for applications                     | One application running within Watt         |
| **Deployment**         | Deploys as complete application                        | Deployed as part of Watt application        |
| **Communication**      | Manages application mesh and routing                   | Exposes database APIs to other applications |
| **Database Operation** | **Does NOT run databases directly**                    | **Connects to existing databases**          |
| **Use Case**           | Full-stack application development                     | Auto-generated CRUD APIs from SQL schema    |

#### Relationship Diagram

```ascii
┌──────────────────────────────────────────────────────────┐
│                    Watt Application Server               │
│  ┌─────────────────────────────────────────────────────┐ │
│  │                Application Orchestration            │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │ Next.js     │  │ Fastify     │  │ Platformatic DB │   │
│  │ Frontend    │  │ API Service │  │ (Auto-gen APIs) │   │
│  │ (@plt/next) │  │ (@plt/svc)  │  │ (@plt/db)       │   │
│  └─────────────┘  └─────────────┘  └─────────────────┘   │
│                                                          │
└────────────────────────────────────────────┬─────────────┘
                                             │
                                    ┌────────▼────────┐
                                    │   External      │
                                    │   Database      │
                                    │ (PostgreSQL,    │
                                    │  MySQL, etc.)   │
                                    └─────────────────┘
```

**Key Point**: Watt is the **runtime environment** that can include a Platformatic DB application, but Watt itself does not run databases. Platformatic DB connects to external database systems and auto-generates REST/GraphQL APIs from their schemas.

#### Capabilities Types within Watt

**Core Capabilities:**

- **Node.js** (`@platformatic/node`) - Generic Node.js application wrapper
- **Runtime Environment** (`@platformatic/runtime`) - Development/production environment management
- **Gateway Application** (`@platformatic/gateway`) - API gateway and application aggregation (formerly known as Composer)
- **Database Application** (`@platformatic/db`) - Auto-generated APIs from SQL schemas
- **HTTP Application** (`@platformatic/service`) - Custom application logic with Fastify

**Capabilities Integrations:**

- **Next.js** (`@platformatic/next`) - React applications with SSR
- **Astro** (`@platformatic/astro`) - Multi-framework static sites
- **Remix** (`@platformatic/remix`) - Full-stack React framework
- **Vite** (`@platformatic/vite`) - Modern build tool integration
- **Vinext (Experimental)** (`@platformatic/vinext`) - Next.js-compatible applications on Vite
- **NestJS** (`@platformatic/nestjs`) - Progressive Node.js framework for scalable server-side applications

#### API-First Development

```
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
- [Application Types](/docs/reference/) - Database, HTTP, Composer applications
- [Production Deployment](/docs/guides/deployment/) - Kubernetes, Docker, monitoring

**Questions?** Join our [Discord community](https://discord.gg/platformatic) or check [GitHub Discussions](https://github.com/platformatic/platformatic/discussions) for real-time help from the Watt team and community.
