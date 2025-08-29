# Introducing Watt 3: Faster, Simpler, and More Powerful Than Ever

Today, we're excited to announce the release of **Watt 3** (`wattpm` v3.0.0), a major evolution of the Watt Node.js Application Server that brings significant performance improvements, architectural simplifications, and modernization upgrades that will transform how you build and deploy Node.js applications.

## Why Watt?

Watt is an extensible Node.js application server that transforms how you build, deploy, and scale applications. Whether you're building a simple API, orchestrating microservices, or creating full-stack applications with modern frontend frameworks, Watt provides:

- **Zero-configuration deployment:** Get applications running instantly without complex setup
- **Multi-threading support:** Leverage Node.js worker threads for better performance
- **Production-ready:** Built-in monitoring, logging, and operational best practices
- **Service orchestration:** Seamlessly coordinate multiple applications and services
- **Extensible architecture:** Built-in capabilities for databases, APIs, gateways, and frontend frameworks

Watt eliminates the complexity of modern application development while maintaining the flexibility developers need. From rapid prototypes to production-scale deployments, Watt adapts to your requirements without imposing rigid constraints.

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

### 🔧 Introducing Watt Utilities (`@platformatic/wattpm-utils`)

**Modular utilities for enhanced extensibility.** As part of our architectural modernization, we've extracted shared utility functions into a dedicated `wattpm-utils` CLI:

- **Clear separation of concerns:** All main commands like `dev`, `start` and `build` remain in `wattpm`, while utility commands are now in `wattpm-utils`
- **Enhanced security:** No command in `wattpm` performs installation or downloading operations, simplifying auditing and hardening of projects.
- **Modular design:** Common utility functions separated from core application server logic
- **Enhanced reusability:** Shared utilities available across the entire Watt ecosystem
- **Better maintainability:** Focused packages with clear separation of concerns

This restructuring creates a cleaner architecture where the main `wattpm` CLI focuses on essential application lifecycle operations, while `wattpm-utils` handles auxiliary utilities. This separation makes it easier for developers to build custom capabilities and extensions that integrate seamlessly with the Watt ecosystem.

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

### 🏷️ Clearer Terminology: From Stackables and Services to Capabilities and Applications

**Better names for better understanding.** The application server now runs "applications" instead of "services". We also have renamed "stackables" to "capabilities" throughout the application server, along with a complete architectural overhaul:

- **Extensible application server clarity:** The terminology now clearly reflects that Watt is an extensible application server where capabilities enhance and extend functionality
- **Modern terminology:** Aligns with current cloud-native conventions
- **Accurate representation:** "Applications" reflects the full range of what you can deploy and build, while "capabilities" accurately describes the extensible components that add functionality
- **Intuitive naming:** "Capabilities" better describes what these extensible components do within the application server
- **Consistent terminology:** Unified language across docs, APIs, and code
- **Developer clarity:** Easier onboarding and understanding for new users of the extensible platform
- **Modern architecture:** New `applicationFactory` for `@platformatic/service` pattern with cleaner separation of concerns
- **Modular exports:** Structured exports for better composability and testing
- **Backward compatibility:** Existing configurations continue to work during migration

This terminology shift is important for users because it accurately communicates Watt's nature as an extensible application server—capabilities are the building blocks that extend the server's functionality, while applications are the complete deployable units that leverage these capabilities.

All documentations have been updated to reflect the new terminology.

### 🧹 Logs Rolling Removal

We have removed log rotation to improve maintainability. Log rotation can be handled by external tools like [logrotate](https://linux.die.net/man/8/logrotate) for better operational practices.

### ⚡ Unified CLI Experience

**One CLI to rule them all.** We've consolidated individual CLIs (`plt-service`, `plt-composer`, `plt-db`, `plt-control`) into the unified `wattpm` CLI:

- **Simplified workflows:** Single command interface for all operations
- **Reduced complexity:** Fewer tools to learn and manage
- **Consistent experience:** Same patterns across different application types

If you were using one of the legacy CLIs above, here's a quick migration guide:

- **`plt-runtime`:** You can directly run `wattpm`
- **`plt-service`:** You can directly run `wattpm` in any folder containing a `@platformatic/service` `watt.json` file
- **`plt-control`:** All commands are directly available in `wattpm`
- **`plt-db` and `plt-composer`:** Commands are now integrated into `wattpm`, prefixed by the application name (for instance: `wattpm my-db-app:seed`).

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

### Existing Node.js Projects

For existing Node.js applications that aren't using Watt yet, Watt 3 makes it easier than ever to get started. Simply run `wattpm create` in your project directory to automatically generate the necessary configuration files (`watt.json`, `.env`, `.env.sample`) and update your `package.json`. Then use `wattpm dev` for development and `wattpm build && wattpm start` for production.

This process wraps your existing application with Watt's powerful features including multi-threading support, standardized environment configuration, service orchestration, and built-in logging and monitoring.

For detailed step-by-step instructions on porting existing Node.js applications, see our comprehensive [migration guide](https://docs.platformatic.dev/docs/getting-started/port-your-app).

### Community and Support

- **Documentation:** Updated guides and examples are available in our docs
- **Community:** Join discussions in our GitHub Discussions
- **Issues:** Report bugs or request features on GitHub
- **Examples:** Check out sample applications showcasing Watt 3 features

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
-  }
```

### 4. Replace Client Generation

If you were using `@platformatic/client`, we've got great news! It lives on as **[Massimo](https://massimohttp.dev/)**:

- **Upgrade path:** `@platformatic/client` → `massimo` and `@platformatic/client-cli` → `massimo-cli`
- **Same powerful features:** All the type-safe client generation you loved, now as a standalone project
- **Production proven:** Used by companies like Spendesk in production environments
- **Enhanced capabilities:** Dual architecture with both runtime library and code generator options

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

### 6. Migrate stackables to capabilities.

**This section only applies if you have created custom stackables on top of `@platformatic/service`.** Most users can skip this step as it only affects those who have built custom extensions to the service capability.

This update is necessary due to the terminology restructuring and API simplification introduced in Watt 3.

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

## Thank You

Watt 3 represents months of careful planning, development, and testing. We're grateful to our community for feedback, bug reports, and contributions that made this release possible.

The changes in Watt 3 position it as a more performant, maintainable, and future-ready Node.js application server for building applications at scale.
