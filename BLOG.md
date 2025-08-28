# Introducing Watt 3: Faster, Simpler, and More Powerful Than Ever

Today, we're excited to announce the release of **Watt 3** (`wattpm` v3.0.0), a major evolution of the Watt Node.js Application Server that brings significant performance improvements, architectural simplifications, and modernization upgrades that will transform how you build and deploy Node.js applications.

## What's New in Watt 3

Watt 3 isn't just an incremental update—it's a complete reimagining of how applications start, scale, and operate on the Watt application server. With 18 commits and 15 major breaking changes, this release represents the most significant evolution in Watt's history. Here are the key transformations:

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
Service B ├─→ All services ready! (12 seconds)
Service C ┘
```

### 💻 Native TypeScript Support Powered by Type Stripping

**Revolutionary TypeScript execution without compilation overhead.** Watt 3 leverages Node.js's groundbreaking **type stripping** technology to execute TypeScript directly:

- **Instant execution:** TypeScript files run immediately without compilation delays
- **Native performance:** Types stripped at parse-time, code runs at JavaScript speeds  
- **Zero build complexity:** No more transpilation, watch processes, or build tooling
- **Better development experience:** Edit TypeScript, run immediately—no compilation step
- **Simplified deployment:** Ship .ts files directly, let Node.js handle the rest

**How Type Stripping Works:**
Instead of traditional transpilation that rewrites your code, Node.js type stripping simply removes type annotations during parsing—like erasing pencil marks from a drawing. Your logic stays identical, but types disappear at runtime, delivering instant startup and native JavaScript performance.

*Learn more about this revolutionary approach: [Everything You Need to Know About Node.js Type Stripping](https://satanacchio.hashnode.dev/everything-you-need-to-know-about-nodejs-type-stripping)*

This represents the future of TypeScript development—all the type safety benefits during development, with zero runtime overhead.

### 🏗️ Composer → Gateway: A More Powerful API Gateway

**From simple composition to full-feattured gateway.** We've renamed the `composer` to `gateway` to better reflect its evolved capabilities:

- **Enhanced routing:** More sophisticated request routing and load balancing
- **Better proxy capabilities:** Improved upstream service integration
- **Cleaner architecture:** The name now matches the functionality

The transition is seamless with full backward compatibility, but the new gateway terminology better represents the powerful API gateway features you've been using.

### 🧪 Modern Testing with Node.js Native Runner

**Mission accomplished: From playground to production.** We've successfully migrated from `borp` to Node.js's built-in `--test` runner, completing a journey that helped shape Node.js testing itself:

- **Strategic innovation:** Borp served as our testing playground when Node.js `--test` was missing critical features
- **Community contribution:** The gaps we identified in borp were contributed back to Node.js core
- **Feature parity achieved:** Node.js 22.18+ now includes all the essential testing capabilities we needed
- **Reduced dependencies:** One less external framework to manage and maintain
- **Native performance:** Tests run directly on the Node.js engine with zero overhead

This migration represents more than a dependency change—it's proof that thoughtful experimentation can drive improvements in Node.js itself. Your tests now run on the same battle-tested engine that powers your applications.

### 🚀 Massimo: From Integrated Tool to Standalone Powerhouse

**Great news for API client generation!** What began as `@platformatic/client` has evolved into something much bigger. We've extracted and enhanced it as **[Massimo](https://massimohttp.dev/)**—a production-proven, standalone client generation solution:

- **Enhanced capabilities:** Dual architecture with both runtime library and code generator
- **Production proven:** Already powering companies like Spendesk in production
- **Zero dependencies:** Frontend clients with no external dependencies
- **Better performance:** Optimized for both server-side (Undici) and browser (fetch) environments
- **Active development:** Dedicated project with community contributions

This extraction allows Massimo to evolve independently while Watt 3 focuses on its core application server strengths.

### 🧹 Streamlined Architecture  

**Simpler is better.** With Massimo now independent, we've streamlined Watt 3 by removing the integrated client generation:

- **Reduce complexity:** 25,000+ lines of code removed for a leaner, more focused application server
- **Improve maintainability:** Fewer moving parts means more reliable core functionality  
- **Clear separation:** Client generation and application server concerns properly separated

This change creates a cleaner architecture where each tool excels in its domain—Watt 3 as a Node.js application server, Massimo for API clients.

### 🏷️ Clearer Terminology: From Stackables to Capabilities

**Better names for better understanding.** We've renamed "stackables" to "capabilities" throughout the application server, along with a complete architectural overhaul:

- **Intuitive naming:** "Capabilities" better describes what these components do
- **Consistent terminology:** Unified language across docs, APIs, and code
- **Developer clarity:** Easier onboarding and understanding for new users
- **Modern architecture:** New `applicationFactory` pattern with cleaner separation of concerns
- **Modular exports:** Structured exports for better composability and testing

The new capability format provides a much cleaner development experience with better separation between configuration, transformation, and application logic.

### 📱 Services Become Applications

**Broader scope, better naming.** The application server now uses "applications" instead of "services":

- **Accurate representation:** Reflects the full range of what you can deploy
- **Modern terminology:** Aligns with current cloud-native conventions
- **Backward compatibility:** Existing configurations continue to work during migration

### ⚡ Unified CLI Experience

**One CLI to rule them all.** We've consolidated individual CLIs (`plt-service`, `plt-composer`, `plt-db`) into the unified `wattpm` CLI:

- **Simplified workflows:** Single command interface for all operations
- **Reduced complexity:** Fewer tools to learn and manage
- **Consistent experience:** Same patterns across different application types
- **11,000+ lines removed:** Massive cleanup and simplification

### 🏗️ Architectural Modernization

**Foundation for the future.** Major architectural improvements include:

- **ESM everywhere:** Complete migration from CommonJS to ES modules
- **Node.js 22+ required:** Leverage latest performance improvements and features
- **Unified base classes:** All capabilities now inherit from `BaseStackable`
- **Package restructuring:** Split utilities for better modularity (`@platformatic/wattpm-utils`)

### 🧹 Feature Cleanup

**Focus on what matters.** We've removed underutilized features to improve maintainability:

- **Marketplace removal:** Use standard package managers instead
- **Log rolling removal:** External log rotation for better ops practices
- **Control CLI removal:** Integrated into main CLI for consistency
- **25,000+ lines removed:** Leaner, more focused codebase

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
- **Reduced dependencies:** 25,000+ lines removed, fewer external packages to audit
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

### 2. Update Your Dependencies
```json
{
  "dependencies": {
-   "@platformatic/composer": "^2.65.1",
+   "@platformatic/gateway": "^3.0.0-alpha.6",
-   "create-platformatic": "^2.65.1"
+   "create-wattpm": "^3.0.0-alpha.6"
  }
}
```

### 3. Update Configuration Files
```json
// watt.json
{
  "applications": [
    {
      "id": "my-api",
-     "type": "service"
+     "type": "application"
    },
    {
      "id": "my-gateway", 
-     "type": "composer"
+     "type": "gateway"
    }
  ]
}

// Remove old configuration sections
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
```json
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

### 6. Update Import Statements and Capability Format
```javascript
// Update ESM imports for Watt packages (your app can still use CommonJS)
-const { service } = require('@platformatic/service')
+import { application } from '@platformatic/service'

// Update capability references
-import { stackable } from './stackable.js'
+import { capability } from './capability.js'

// Migrate custom capabilities to new format
// Before (old stackable format)
-export async function stackable(fastify, opts) {
-  await fastify.register(plugin, opts)
-}
-stackable.Generator = Generator
-stackable.configType = 'my-capability'

// After (new capability format)
+export async function myCapability(app, stackable) {
+  await platformaticService(app, stackable)
+  await app.register(plugin, stackable)
+}
+
+export async function create(configOrRoot, sourceOrConfig, context) {
+  return createService(configOrRoot, sourceOrConfig, { 
+    schema, 
+    applicationFactory: myCapability, 
+    transform, 
+    ...context 
+  })
+}
+
+export { Generator } from './generator.js'
+export { schema, schemaComponents, version } from './schema.js'
```

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
Most applications will upgrade automatically thanks to Watt's built-in migration mechanisms, but some manual changes may be required:

**Automatic Migration:**
- Configuration terminology updates (services→applications, composer→gateway, stackables→capabilities)
- Package dependency updates and renames
- Schema and API endpoint migrations

**Manual Intervention Required:**
1. **Upgrade Node.js** to 22.18.0+ before upgrading Watt
2. **Update CLI usage** from individual CLIs to unified `wattpm` in scripts
3. **Replace client generation** - migrate from `@platformatic/client` to [Massimo](https://massimohttp.dev/)
4. **Update custom capabilities** to use new `applicationFactory` format
5. **Remove deprecated configs** (TypeScript outDir, marketplace, log rolling)

**Testing:**
- Review our [migration guide](SUMMARY.md) for detailed upgrade instructions
- Test in staging environment to verify automatic migrations worked correctly

### Community and Support

- **Documentation:** Updated guides and examples are available in our docs
- **Community:** Join discussions in our GitHub Discussions
- **Issues:** Report bugs or request features on GitHub
- **Examples:** Check out sample applications showcasing Watt 3 features

## Breaking Changes Summary

Watt 3 includes these 15 major breaking changes:

1. **Node.js 22+ required** - Minimum version now 22.18.0
2. **CLI consolidation** - Individual CLIs replaced with unified `wattpm`
3. **Direct TypeScript support** - `@platformatic/ts-compiler` removed
4. **Control CLI removed** - Functionality integrated into main CLI
5. **Client removal from service** - Service-level client generation removed
6. **Package restructuring** - `create-platformatic` → `create-wattpm`, utilities split
7. **Log rolling removed** - Use external log rotation solutions
8. **Stackables→Capabilities rename** - Terminology updated throughout
9. **Capability format overhaul** - New `applicationFactory` pattern with structured exports
10. **Services→Applications rename** - Broader scope terminology
11. **Testing framework change** - `borp` replaced with Node.js native `--test`
12. **Marketplace removal** - Use standard package managers
13. **Composer→Gateway rename** - Better reflects API gateway capabilities
14. **Client packages removed** - `@platformatic/client` packages eliminated
15. **Parallel startup behavior** - Applications start concurrently
16. **Complete ESM migration** - All core packages converted to ES modules (applications can still use CommonJS or ESM)

## Thank You

Watt 3 represents months of careful planning, development, and testing. We're grateful to our community for feedback, bug reports, and contributions that made this release possible.

The changes in Watt 3 position it as a more performant, maintainable, and future-ready Node.js application server for building applications at scale.

**Ready to experience Watt 3?** Download the alpha release and let us know what you think!

---

*Watt 3 (v3.0.0-alpha.6) is now available. For technical details, see our [commit summary](SUMMARY.md) and [migration guide](#). Learn more about the evolution of `@platformatic/client` to [Massimo](https://massimohttp.dev/) in our separate announcement.*
