---
title: Use Cases and Examples
label: Use Cases & Examples
---

# Use Cases and Examples

## When Watt Excels: Real-World Scenarios

Watt transforms complex Node.js application development into a unified experience. Here are the scenarios where Watt delivers the most value and the practical examples that demonstrate its capabilities.

---

## Quick Decision Guide

### ✅ **Perfect Fit for Watt**

**API-First Applications**
- Auto-generated REST/GraphQL APIs from database schemas
- Need rapid prototyping and iteration
- Want OpenAPI documentation built-in

**Full-Stack Web Applications**
- Next.js, Astro, or Remix frontends with Node.js APIs
- Database-driven applications with complex business logic
- Need unified deployment of frontend and backend

**Microservices as Modular Monoliths**
- Multiple services that should deploy together
- Team wants microservices benefits without operational complexity
- Need service-to-service communication without network overhead

**Legacy Modernization**
- Existing Express, Fastify, or Node.js applications
- Need to add modern tooling (observability, auto-generated APIs, etc.)
- Want gradual migration to modern architecture

### ⚠️ **Consider Alternatives When**

**Polyglot Requirements**
- Need non-Node.js services (Python ML models, Java services, etc.)
- Team expertise is primarily in other languages
- Existing investment in non-Node.js infrastructure

**True Service Independence**
- Services need completely independent deployment cycles
- Different services have drastically different scaling requirements
- Organizational boundaries require strict service isolation

**Heavily Container-Orchestrated Environments**
- Deep investment in Kubernetes-native patterns
- Need fine-grained resource allocation per service
- Complex multi-region deployment requirements

---

## Industry Use Cases

### E-Commerce and Retail

**Scenario:** Multi-tenant e-commerce platform with product catalog, user management, and order processing

```ascii
┌─────────────────────────────────────────────────┐
│                Watt Application                 │
├─────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │  Storefront │  │  Admin      │  │ Customer │ │
│  │  (Next.js)  │  │ Dashboard   │  │   API    │ │
│  │             │  │ (React)     │  │(Database)│ │
│  └─────────────┘  └─────────────┘  └──────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │  Products   │  │   Orders    │  │ Payments │ │
│  │    API      │  │     API     │  │Integration│ │
│  │ (Database)  │  │ (Database)  │  │(Service) │ │
│  └─────────────┘  └─────────────┘  └──────────┘ │
└─────────────────────────────────────────────────┘
```

**Why Watt Works:**
- Unified deployment reduces complexity from 6+ containers to 1
- Auto-generated APIs accelerate product catalog and order management
- Built-in authorization handles multi-tenant data isolation
- Shared logging provides unified view of customer journey

**Example Architecture:**
```json
{
  "services": [
    { "path": "./web/storefront", "id": "storefront" },
    { "path": "./web/admin", "id": "admin" },
    { "path": "./web/products-api", "id": "products" },
    { "path": "./web/orders-api", "id": "orders" },
    { "path": "./web/customers-api", "id": "customers" },
    { "path": "./web/payments", "id": "payments" }
  ]
}
```

### SaaS Applications

**Scenario:** Project management SaaS with user workspaces, real-time collaboration, and analytics

```ascii
┌─────────────────────────────────────────────────┐
│                Watt SaaS Platform               │
├─────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │  Frontend   │  │ WebSocket   │  │Analytics │ │
│  │  (Remix)    │  │  Service    │  │Dashboard │ │
│  │             │  │(Real-time)  │  │ (Vite)   │ │
│  └─────────────┘  └─────────────┘  └──────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │ Projects    │  │   Users     │  │ Billing  │ │
│  │    API      │  │     API     │  │   API    │ │
│  │ (Database)  │  │ (Database)  │  │(Service) │ │
│  └─────────────┘  └─────────────┘  └──────────┘ │
└─────────────────────────────────────────────────┘
```

**Why Watt Works:**
- GraphQL subscriptions enable real-time features
- Row-level security provides workspace isolation
- Built-in metrics track user engagement and system health
- Single deployment simplifies compliance and monitoring

**Example Configuration:**
```javascript
// Database service with workspace isolation
{
  "db": {
    "authorization": {
      "rules": [{
        "role": "user",
        "entity": "projects", 
        "find": ["workspace_id = $WORKSPACE_ID"],
        "save": ["workspace_id = $WORKSPACE_ID"]
      }]
    }
  }
}
```

### Enterprise Applications

**Scenario:** Internal employee portal with HR systems, document management, and approval workflows

```ascii
┌─────────────────────────────────────────────────┐
│           Enterprise Employee Portal            │
├─────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │  Portal     │  │ Document    │  │   HR     │ │
│  │  Frontend   │  │ Viewer      │  │Dashboard │ │
│  │  (Astro)    │  │             │  │         │ │
│  └─────────────┘  └─────────────┘  └──────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │   Legacy    │  │ Workflows   │  │   Auth   │ │
│  │    HR       │  │    API      │  │ Service  │ │
│  │Integration  │  │ (Database)  │  │(LDAP/SSO)│ │
│  └─────────────┘  └─────────────┘  └──────────┘ │
└─────────────────────────────────────────────────┘
```

**Why Watt Works:**
- Legacy integration through service wrappers
- Enterprise SSO/LDAP authentication built-in
- Audit logging and compliance reporting
- Gradual migration from monolithic systems

### Fintech and Financial Services

**Scenario:** Personal finance app with banking integration, transaction processing, and reporting

```ascii
┌─────────────────────────────────────────────────┐
│              Fintech Application                │
├─────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │   Mobile    │  │   Web       │  │ Reports  │ │
│  │   App       │  │   App       │  │ Engine   │ │
│  │  (API)      │  │ (Next.js)   │  │(Service) │ │
│  └─────────────┘  └─────────────┘  └──────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │Transactions │  │   Accounts  │  │ Banking  │ │
│  │    API      │  │     API     │  │Integration│ │
│  │ (Database)  │  │ (Database)  │  │ (Plaid)  │ │
│  └─────────────┘  └─────────────┘  └──────────┘ │
└─────────────────────────────────────────────────┘
```

**Why Watt Works:**
- PCI compliance through unified logging and monitoring
- Real-time transaction processing with event-driven architecture
- Bank-grade authorization and audit trails
- Single deployment reduces compliance surface area

---

## Architecture Patterns

### Pattern 1: API-First Applications

**Best For:** Mobile apps, third-party integrations, microservices consumers

**Architecture:**
```ascii
┌──────────────┐    ┌─────────────────────────────────────┐
│   Client     │───▶│            Watt App                 │
│ Applications │    │  ┌─────────────┐  ┌─────────────┐   │
└──────────────┘    │  │  Database   │  │   Gateway   │   │
                    │  │   Service   │  │  (Composer) │   │
┌──────────────┐    │  │             │  │             │   │
│  Third-Party │───▶│  └─────────────┘  └─────────────┘   │
│ Integrations │    │  ┌─────────────┐  ┌─────────────┐   │
└──────────────┘    │  │  Business   │  │   Auth      │   │
                    │  │   Logic     │  │  Service    │   │
                    │  │  (Service)  │  │             │   │
                    │  └─────────────┘  └─────────────┘   │
                    └─────────────────────────────────────┘
```

**Example Implementation:**
```json
// watt.json
{
  "entrypoint": "api-gateway",
  "services": [
    {
      "path": "./web/users-api",
      "id": "users-api",
      "$schema": "@platformatic/db"
    },
    {
      "path": "./web/business-logic",
      "id": "business-logic", 
      "$schema": "@platformatic/service"
    },
    {
      "path": "./web/api-gateway",
      "id": "api-gateway",
      "$schema": "@platformatic/composer"
    }
  ]
}
```

**Key Benefits:**
- Auto-generated OpenAPI documentation
- Built-in rate limiting and authentication
- Unified API versioning and deprecation
- Automatic client SDK generation

### Pattern 2: Full-Stack Web Applications

**Best For:** Customer-facing web apps, content management systems, dashboards

**Architecture:**
```ascii
┌──────────────┐    ┌─────────────────────────────────────┐
│   Browser    │───▶│            Watt App                 │
│              │    │  ┌─────────────┐  ┌─────────────┐   │
└──────────────┘    │  │  Frontend   │  │    API      │   │
                    │  │   (Next.js/ │  │  Services   │   │
                    │  │   Astro/    │  │             │   │
                    │  │   Remix)    │  │             │   │
                    │  └─────────────┘  └─────────────┘   │
                    │  ┌─────────────┐  ┌─────────────┐   │
                    │  │  Database   │  │   Assets    │   │
                    │  │   Service   │  │  (Static)   │   │
                    │  │             │  │             │   │
                    │  └─────────────┘  └─────────────┘   │
                    └─────────────────────────────────────┘
```

**Example Implementation:**
```json
// watt.json
{
  "entrypoint": "frontend",
  "services": [
    {
      "path": "./web/frontend",
      "id": "frontend",
      "$schema": "@platformatic/next"
    },
    {
      "path": "./web/api", 
      "id": "api",
      "$schema": "@platformatic/db"
    },
    {
      "path": "./web/assets",
      "id": "assets",
      "$schema": "@platformatic/service"
    }
  ]
}
```

**Key Benefits:**
- Server-side rendering with API co-location
- Unified authentication across frontend and API
- Shared configuration and environment variables
- Single domain, no CORS complexity

### Pattern 3: Event-Driven Systems

**Best For:** Real-time applications, IoT data processing, workflow automation

**Architecture:**
```ascii
┌──────────────┐    ┌─────────────────────────────────────┐
│  External    │───▶│            Watt App                 │
│  Events      │    │  ┌─────────────┐  ┌─────────────┐   │
└──────────────┘    │  │   Event     │  │  Processors │   │
                    │  │  Gateway    │  │   (Workers) │   │
┌──────────────┐    │  │             │  │             │   │
│  Webhooks    │───▶│  └─────────────┘  └─────────────┘   │
└──────────────┘    │  ┌─────────────┐  ┌─────────────┐   │
                    │  │   Event     │  │   State     │   │
                    │  │   Store     │  │  Manager    │   │
                    │  │ (Database)  │  │ (Database)  │   │
                    │  └─────────────┘  └─────────────┘   │
                    └─────────────────────────────────────┘
```

**Example Implementation:**
```javascript
// Event processor service
module.exports = async function (app) {
  app.register(async function (app) {
    // Process events from queue
    app.addHook('onReady', async () => {
      app.eventQueue.on('user.created', async (event) => {
        await app.platformatic.entities.auditLog.save({
          input: { action: 'USER_CREATED', userId: event.userId }
        })
      })
    })
  })
}
```

### Pattern 4: Legacy Modernization

**Best For:** Migrating existing applications, gradual architecture evolution

**Architecture:**
```ascii
┌──────────────┐    ┌─────────────────────────────────────┐
│   Clients    │───▶│            Watt App                 │
│              │    │  ┌─────────────┐  ┌─────────────┐   │
└──────────────┘    │  │   Modern    │  │   Legacy    │   │
                    │  │   Frontend  │  │   App       │   │
                    │  │  (Next.js)  │  │ (Express)   │   │
                    │  └─────────────┘  └─────────────┘   │
                    │  ┌─────────────┐  ┌─────────────┐   │
                    │  │    New      │  │   Legacy    │   │
                    │  │    APIs     │  │ Database    │   │
                    │  │ (Database)  │  │ (Wrapped)   │   │
                    │  └─────────────┘  └─────────────┘   │
                    └─────────────────────────────────────┘
```

**Example Migration Strategy:**
```javascript
// Wrap existing Express app
// web/legacy-app/index.js
import express from 'express'

export function build() {
  const app = express()
  
  // Import existing Express routes
  app.use('/legacy-api', require('./legacy-routes'))
  
  return app
}
```

---

## Success Stories by Company Size

### Startups (1-10 developers)

**Challenge:** Rapid prototyping, minimal DevOps overhead, fast time-to-market

**Watt Solution:**
```bash
# From idea to production in minutes
npx wattpm create my-startup-mvp
cd my-startup-mvp

# Add database and API
wattpm create --type @platformatic/db --name backend-api

# Add React frontend  
wattpm create --type @platformatic/next --name user-dashboard

# Deploy to production
npm run build
docker build -t my-startup-mvp .
```

**Results:**
- 80% reduction in deployment complexity
- Single developer can manage full-stack application
- Built-in monitoring and logging eliminate third-party costs

### Scale-ups (11-50 developers)

**Challenge:** Team coordination, service boundaries, maintaining development velocity

**Watt Solution:**
- Teams own individual services within unified Watt applications
- Shared tooling and standards across all services
- Service composition without microservices complexity

**Example Team Structure:**
```ascii
Product Team A        Product Team B        Platform Team
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Feature   │      │   Feature   │      │    Auth     │
│  Services   │      │  Services   │      │   Service   │
└─────────────┘      └─────────────┘      └─────────────┘
         └──────────────┬──────────────────────┘
                        │
                ┌───────▼────────┐
                │  Watt Runtime  │
                │  (Unified App) │
                └────────────────┘
```

**Results:**
- Teams maintain independence while sharing infrastructure
- 60% reduction in deployment pipeline complexity
- Unified observability across all team services

### Enterprises (50+ developers)

**Challenge:** Legacy integration, compliance requirements, organizational boundaries

**Watt Solution:**
- Gradual migration patterns for legacy applications
- Enterprise-grade security and compliance features
- Integration with existing enterprise systems

**Example Enterprise Architecture:**
```ascii
┌─────────────────────────────────────────────────┐
│                Enterprise                        │
├─────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │    Watt     │  │    Watt     │  │  Legacy  │ │
│  │   App A     │  │   App B     │  │  Systems │ │
│  │(Customer)   │  │(Internal)   │  │          │ │
│  └─────────────┘  └─────────────┘  └──────────┘ │
│                                                 │
│         ┌─────────────────────────┐             │
│         │   Enterprise Services  │             │
│         │   (SSO, Monitoring,    │             │
│         │   Compliance, Audit)   │             │
│         └─────────────────────────┘             │
└─────────────────────────────────────────────────┘
```

**Results:**
- 40% reduction in compliance audit effort
- Unified security policies across all applications  
- Simplified deployment to enterprise Kubernetes clusters

---

## Example Applications

### 1. E-commerce Store

**Conceptual Example:** Full-stack e-commerce application pattern

**Features:**
- Product catalog with search and filtering
- Shopping cart and checkout process
- Admin dashboard for inventory management
- Customer authentication and profiles

**Architecture Pattern:**
```json
{
  "services": [
    { "path": "./storefront", "id": "storefront" },
    { "path": "./admin", "id": "admin" },
    { "path": "./products", "id": "products" },
    { "path": "./orders", "id": "orders" },
    { "path": "./auth", "id": "auth" }
  ]
}
```

### 2. Content Management System

**Conceptual Example:** Multi-tenant content management pattern

**Features:**
- Content authoring with rich text editor
- Multi-site content management
- API-driven content delivery
- User roles and permissions

**GraphQL Query Pattern:**
```javascript
// Auto-generated GraphQL APIs from database schema
query GetPosts($siteId: ID!) {
  posts(where: { siteId: { eq: $siteId } }) {
    id
    title
    content
    publishedAt
    author {
      name
      email
    }
  }
}
```

### 3. Real-time Chat Application

**Conceptual Example:** WebSocket-powered messaging system

**Features:**
- WebSocket-based real-time messaging
- Channel management and user presence
- Message history and search
- File sharing capabilities

**Real-time Pattern:**
```javascript
// GraphQL subscriptions for real-time updates
subscription MessageAdded($channelId: ID!) {
  messageAdded(channelId: $channelId) {
    id
    content
    author {
      name
    }
    timestamp
  }
}
```

### 4. Analytics Dashboard

**Conceptual Example:** Time-series data processing system

**Features:**
- Time-series data collection
- Interactive charts and visualizations
- Custom report generation
- Data export capabilities

**Database Schema Pattern:**
```javascript
// Database configuration optimized for analytics
{
  "db": {
    "migrations": {
      "dir": "./migrations"
    },
    "schemas": [
      {
        "name": "events",
        "indexes": [
          { "fields": ["timestamp", "event_type"] },
          { "fields": ["user_id", "timestamp"] }
        ]
      }
    ]
  }
}
```

---

## Getting Started with Your Use Case

### Quick Assessment Framework

**1. Identify Your Primary Pattern**
- [ ] API-First: Mobile app backend, third-party integrations
- [ ] Full-Stack: Web application with integrated frontend/backend  
- [ ] Event-Driven: Real-time features, webhook processing
- [ ] Legacy Migration: Existing applications need modernization

**2. Choose Your Starting Point**
```bash
# API-First
npx wattpm create --template api-first

# Full-Stack
npx wattpm create --template full-stack --framework next

# Event-Driven  
npx wattpm create --template event-driven

# Legacy Migration
npx wattpm create --template migration
```

**3. Add Services Based on Your Needs**
```bash
# Database service for data-driven features
wattpm create --type @platformatic/db --name data-api

# Frontend service for user interfaces
wattpm create --type @platformatic/next --name user-interface  

# Business logic service for custom functionality
wattpm create --type @platformatic/service --name business-logic

# Integration service for third-party APIs
wattpm create --type @platformatic/service --name integrations
```

### Evaluation Checklist

**✅ Watt is a Strong Fit When:**
- [ ] Your team primarily uses Node.js and JavaScript/TypeScript
- [ ] You want rapid development with built-in best practices
- [ ] Database-driven APIs are a core part of your application
- [ ] You need unified deployment and monitoring
- [ ] Your services should communicate with low latency
- [ ] You want to reduce operational complexity

**⚠️ Consider Alternatives When:**
- [ ] You need polyglot services (Python, Java, Go, etc.)
- [ ] Services must be independently deployable by different teams
- [ ] You have existing heavy investment in container orchestration
- [ ] Your architecture requires complex networking and service mesh features
- [ ] Performance requirements exceed single-process capabilities

---

## Next Steps

Choose your path based on your use case:

**🚀 Start Building Immediately**
- [Quick Start Guide](/docs/getting-started/quick-start-watt) - Get running in 5 minutes
- [Example Applications](https://github.com/platformatic/examples) - Explore working Watt application patterns

**🔍 Deep Dive into Architecture** 
- [Architecture Overview](/docs/overview/architecture-overview) - Technical details
- [Service Types Reference](/docs/reference/) - Database, HTTP, Composer services

**🔄 Migrate Existing Applications**
- [Migration Guide](/docs/getting-started/port-your-app) - Step-by-step porting
- [Integration Patterns](/docs/guides/integrations/) - Connect existing systems

**📊 Production Deployment**
- [Deployment Guide](/docs/guides/deployment/) - Docker, Kubernetes, cloud platforms
- [Monitoring Setup](/docs/guides/monitoring-and-observability/) - Metrics, logging, tracing

**Questions about your specific use case?** Join our [Discord community](https://discord.gg/platformatic) where the Watt team and community discuss real-world applications and architectural patterns.