# Introducing Watt 3: Faster, Simpler, and More Powerful Than Ever

Today, we're excited to announce the release of **Watt 3** (`wattpm` v3.0.0), a major evolution of the Watt Node.js Application Server that brings significant performance improvements, architectural simplifications, and modernization upgrades that will transform how you build and deploy Node.js applications.

## What's New in Watt 3

Watt 3 isn't just an incremental update—it's a complete reimagining of how applications start, scale, and operate on the Watt application server. With 15 major breaking changes, this release represents the most significant evolution in Watt's history. Here are the key transformations:

### 🚀 Parallel Application Startup and Shutdown

**The biggest performance boost yet.** Watt 3 now starts and stops all your applications in parallel instead of one-by-one. This means:

- **Faster deployments:** Complex applications with multiple services now start in a fraction of the time
- **Better resource utilization:** Your infrastructure resources are used more efficiently during startup
- **Enhanced reliability:** Improved error handling and dependency management during service lifecycle operations

Whether you're running a single service or orchestrating a complex microservice architecture, parallel execution dramatically reduces your time-to-ready.

```bash
# Before: Services started sequentially
Service A → Service B → Service C → Gateway (45 seconds)

# After: Services started in parallel
Service A ┐
Service B ├─→ All services ready! (15 seconds)
Service C ┘
```

### 🏗️ Composer → Gateway: A More Powerful API Gateway

**From simple composition to full-feattured gateway.** We've renamed the `composer` to `gateway` to better reflect its evolved capabilities:

- **Enhanced routing:** More sophisticated request routing and load balancing
- **Better proxy capabilities:** Improved upstream service integration
- **Cleaner architecture:** The name now matches the functionality

The transition is seamless with full backward compatibility, but the new gateway terminology better represents the powerful API gateway features you've been using.

### 🚀 Massimo: From Integrated Tool to Standalone Powerhouse

**Great news for API client generation!** What began as `@platformatic/client` has evolved into something much bigger. We've extracted and enhanced it as **[Massimo](https://massimohttp.dev/)**—a production-proven, standalone client generation solution:

- **Enhanced capabilities:** Dual architecture with both runtime library and code generator
- **Production proven:** Already powering companies like [Spendesk](https://www.spendesk.com/) in production
- **Zero dependencies:** Frontend clients with no external dependencies
- **Better performance:** Optimized for both server-side (Undici) and browser (fetch) environments
- **Active development:** Dedicated project with community contributions

This extraction allows Massimo to evolve independently while Watt 3 focuses on its core application server strengths.

### 🔧 Introducing Watt Package Utilities (`@platformatic/wattpm-utils`)

**Modular utilities for enhanced extensibility.** As part of our architectural modernization, we've extracted shared utility functions into a dedicated `wattpm-utils` CLI:

- **Modular design:** Common utility functions separated from core application server logic
- **Enhanced reusability:** Shared utilities available across the entire Watt ecosystem
- **Better maintainability:** Focused packages with clear separation of concerns

This restructuring creates a cleaner architecture where utility functions are properly modularized, making it easier for developers to build custom capabilities and extensions that integrate seamlessly with the Watt ecosystem.

### 💻 Native TypeScript Support Powered by Type Stripping

**Revolutionary TypeScript execution without compilation overhead.** Watt 3 leverages Node.js's groundbreaking **type stripping** technology to execute TypeScript directly:

- **Instant execution:** TypeScript files run immediately without compilation delays
- **Native performance:** Types stripped at parse-time, code runs at JavaScript speeds
- **Zero build complexity:** No more transpilation, watch processes, or build tooling
- **Better development experience:** Edit TypeScript, run immediately—no compilation step
- **Simplified deployment:** Ship .ts files directly, let Node.js handle the rest

**How Type Stripping Works:**
Instead of traditional transpilation that rewrites your code, Node.js type stripping simply removes type annotations during parsing—like erasing pencil marks from a drawing. Your logic stays identical, but types disappear at runtime, delivering instant startup and native JavaScript performance.

_Learn more about this revolutionary approach: [Everything You Need to Know About Node.js Type Stripping](https://satanacchio.hashnode.dev/everything-you-need-to-know-about-nodejs-type-stripping)_

This represents the future of TypeScript development—all the type safety benefits during development, with zero runtime overhead.

### 📱 Services Become Applications

**Broader scope, better naming.** The application server now uses "applications" instead of "services":

- **Accurate representation:** Reflects the full range of what you can deploy
- **Modern terminology:** Aligns with current cloud-native conventions
- **Backward compatibility:** Existing configurations continue to work during migration

### 🏷️ Clearer Terminology: From Stackables to Capabilities

**Better names for better understanding.** We've renamed "stackables" to "capabilities" throughout the application server, along with a complete architectural overhaul:

- **Intuitive naming:** "Capabilities" better describes what these components do
- **Consistent terminology:** Unified language across docs, APIs, and code
- **Developer clarity:** Easier onboarding and understanding for new users
- **Modern architecture:** New `applicationFactory` pattern with cleaner separation of concerns
- **Modular exports:** Structured exports for better composability and testing

The new capability format provides a much cleaner development experience with better separation between configuration, transformation, and application logic.

### 🧹 Feature Cleanup

**Focus on what matters.** We've removed underutilized features to improve maintainability:

- **Marketplace removal:** Use standard package managers instead
- **Log rolling removal:** External log rotation for better ops practices

### ⚡ Unified CLI Experience

**One CLI to rule them all.** We've consolidated individual CLIs (`plt-service`, `plt-composer`, `plt-db`, `plt-control`) into the unified `wattpm` CLI:

- **Simplified workflows:** Single command interface for all operations
- **Reduced complexity:** Fewer tools to learn and manage
- **Consistent experience:** Same patterns across different application types

### 🏗️ Architectural Modernization

**Foundation for the future.** Major architectural improvements include:

- **ESM everywhere:** Complete migration from CommonJS to ES modules
- **Node.js 22+ required:** Leverage latest performance improvements and features
- **Unified base classes:** All capabilities now inherit from `BaseCapability`

## Why These Changes Matter

### For Developers

- **Faster feedback loops:** Parallel startup and instant TypeScript execution reduce development cycle time
- **Revolutionary TypeScript DX:** Type stripping eliminates compilation delays—write TypeScript, run immediately
- **Simplified debugging:** Fewer abstraction layers, unified CLI, and direct source mapping mean clearer error messages
- **Modern toolchain:** Native Node.js testing, ESM modules, type stripping, and latest Node.js features
- **Better performance:** Zero-overhead TypeScript, parallel operations, and reduced build complexity
- **Clearer mental models:** Intuitive terminology (capabilities, applications, gateway)
- **Unified workflows:** Single CLI for all operations reduces context switching

### For Operations Teams

- **Faster deployments:** Parallel startup reduces deployment windows by 60-75%
- **Improved resource efficiency:** Better utilization during scaling events and startup
- **Reduced dependencies:** 40,000+ lines removed, fewer external packages to audit
- **Enhanced monitoring:** Clearer component boundaries with gateway terminology
- **Modern runtime:** Node.js 22+ requirement ensures latest security and performance
- **Simplified log management:** External log rotation encourages better ops practices
- **Unified tooling:** Single CLI reduces operational complexity

### For Application Architects

- **Cleaner abstractions:** Gateway, applications, and capabilities provide intuitive concepts
- **Better scaling patterns:** Parallel execution enables more efficient horizontal scaling
- **Future-ready foundation:** ESM modules, modern testing, and latest Node.js features
- **Architectural consistency:** Unified base classes and consistent inheritance patterns
- **Modular design:** Split packages allow for more flexible composition
- **Reduced technical debt:** Major cleanup removes legacy code and patterns

## Migration Path

While Watt 3 introduces breaking changes, most applications will upgrade automatically. Here's what you need to know:

### 1. Upgrade Node.js First

```bash
# Upgrade to Node.js 22.18.0 or higher
nvm install 22
nvm use 22
node --version  # Should be 22.18.0+
```

### 2. Update Your Dependencies and migrate from `@platformatic/composer` to `@platformatic/gateway`.

```diff
{
  "dependencies": {
-   "@platformatic/composer": "^2.65.1",
+   "@platformatic/gateway": "^3.0.0",
-   "create-platformatic": "^2.65.1"
+   "create-wattpm": "^3.0.0"
  }
}
```

You can also use `npx wattpm-utils update` to manage this automatically for you.
Note that in Watt 3 still ships `@platformatic/composer@3.0.0` as an alias of `@platformatic/gateway@3.0.0`, but the alias will be removed in Watt 4.

### 3. Update Configuration Files

```diff
// watt.json - Remove old configuration sections
-  "clients": {
-    "frontend": true
-  },
-  "typescript": {
-    "outDir": "dist"
-  },
-  "marketplace": {
-    "autoInstall": true
-  }
```

### 4. Replace Client Generation

If you were using `@platformatic/client`, we've got great news! It lives on as **[Massimo](https://massimohttp.dev/)**:

- **Upgrade path:** `@platformatic/client` → `massimo` and `@platformatic/client-cli` → `massimo-cli`
- **Same powerful features:** All the type-safe client generation you loved, now as a standalone project
- **Production proven:** Used by companies like Spendesk in production environments
- **Enhanced capabilities:** Dual architecture with both runtime library and code generator options

Alternatively, use other tools:

- **OpenAPI clients:** Use `openapi-generator` or `swagger-codegen`
- **GraphQL clients:** Use `graphql-code-generator`

### 5. Update CLI Commands and Scripts

```diff
{
  "scripts": {
-   "test": "borp",
+   "test": "node --test",
-   "start": "plt-service start",
+   "start": "wattpm start",
-   "dev": "plt-service dev",
+   "dev": "wattpm dev"
  }
}
```

### 6. Update capabilities which extend @platformatic/service.

Consider the following custom stackable for Watt 2:

```js
// plugin.js
export async function plugin (server, opts) {
  // Do something here
}

// index.js
import { buildStackable } from '@platformatic/service'
import { Generator } from './generator.js'
import { plugin } from './plugin.js'
import { schema, version } from './schema.js'

export { Generator } from './generator.js'

export async function stackable (fastify, opts) {
  await fastify.register(plugin, opts)
}

stackable.Generator = _Generator
stackable.configType = 'my-stackable'
stackable.schema = schema
stackable.configManagerConfig = {
  transformConfig () {
    // Do some transformation here
  },
  schemaOptions: {
    useDefaults: true,
    coerceTypes: true,
    allErrors: true,
    strict: false
  },
  version: version
}

export default {
  configType: 'my-stackable',
  configManagerConfig: stackable.configManagerConfig,
  buildStackable: (opts) => buildStackable(opts, stackable)
  schema,
  version,
}
```

As you can see, there is a lot of boilerplate code there just to extend `@platformatic/service`.

With Watt 3, everything becomes much easier.

All you need to do is to focus on your application code and eventually a transformation function for your configuration.

```js
// application.js
import { platformaticService } from '@platformatic/service'

export async function plugin (app, capability) {
  await platformaticService(app, capability)

  // Do something here
}

// index.js
import { create as createService, transform as serviceTransform } from '@platformatic/service'
import { Generator } from './generator.js'
import { application } from './application.js'
import { schema, version } from './schema.js'

export { Generator } from './generator.js'
export { schema, version } from './schema.js'

async function transform (config, schema, options) {
  config = await serviceTransform(config, schema, options)

  // Do some transformation here

  return config
}

export async function create (configOrRoot, sourceOrConfig, context) {
  return createService(configOrRoot, sourceOrConfig, { schema, applicationFactory: application, transform, ...context })
}
```

As you can see, the API is much shorter and straightforward.

## What's Next

Watt 3 lays the foundation for exciting features coming in future releases:

- **Enhanced observability:** Better metrics and tracing for parallel applications
- **Advanced gateway features:** Traffic splitting, circuit breakers, and rate limiting
- **Improved developer experience:** Enhanced CLI tools and debugging capabilities
- **Cloud-native integrations:** Better Kubernetes and container orchestration support

## Getting Started with Watt 3

Ready to experience the performance and simplicity improvements? Here's how to get started:

### New Projects

```bash
# Use the new create command
npx create-wattpm@latest my-app
cd my-app
npm install
npm start
```

### Existing Projects

Configurations files will be upgraded automatically at runtime thanks to Watt's built-in migration mechanisms, but some manual changes may be required:

1. **Upgrade Node.js** to 22.18.0+ before upgrading Watt
2. **Upgrade dependencies** to 3.0.0. It can be executed via `wattpm-utils update`
3. **Update CLI usage** from individual CLIs to unified `wattpm` in scripts
4. **Replace client generation** - migrate from `@platformatic/client` to [Massimo](https://massimohttp.dev/)
5. **Update custom capabilities** to use new `applicationFactory` format
6. **Remove deprecated configs** (TypeScript outDir, marketplace, log rolling)

**Testing:**

- Test in staging environment to verify automatic migrations worked correctly

### Community and Support

- **Documentation:** Updated guides and examples are available in our docs
- **Community:** Join discussions in our GitHub Discussions
- **Issues:** Report bugs or request features on GitHub
- **Examples:** Check out sample applications showcasing Watt 3 features

## Thank You

Watt 3 represents months of careful planning, development, and testing. We're grateful to our community for feedback, bug reports, and contributions that made this release possible.

The changes in Watt 3 position it as a more performant, maintainable, and future-ready Node.js application server for building applications at scale.
