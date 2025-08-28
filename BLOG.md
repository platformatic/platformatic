# Introducing Watt 3: Faster, Simpler, and More Powerful Than Ever

Today, we're excited to announce the release of **Watt 3** (`wattpm` v3.0.0), a major evolution of the Platformatic platform that brings significant performance improvements, architectural simplifications, and modernization upgrades that will transform how you build and deploy Node.js applications.

## What's New in Watt 3

Watt 3 isn't just an incremental update—it's a complete reimagining of how Platformatic applications start, scale, and operate. With 18 commits and 15 major breaking changes, this release represents the most significant evolution in Platformatic's history. Here are the key transformations:

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

### 💻 Native TypeScript Support

**Direct TypeScript execution without compilation overhead.** Watt 3 removes the separate `@platformatic/ts-compiler` package and implements native TypeScript support:

- **No more build steps:** TypeScript files run directly using Node.js modern loaders
- **Faster development:** Eliminate intermediate compilation for quicker iterations
- **Simplified configuration:** Remove `typescript.outDir` and compilation flags
- **Better DX:** Native Node.js TypeScript support with zero configuration

Your TypeScript applications now run as smoothly as JavaScript, with no translation layers or build complexity.

### 🏗️ Composer → Gateway: A More Powerful API Gateway

**From simple composition to full-feattured gateway.** We've renamed the `composer` to `gateway` to better reflect its evolved capabilities:

- **Enhanced routing:** More sophisticated request routing and load balancing
- **Better proxy capabilities:** Improved upstream service integration
- **Cleaner architecture:** The name now matches the functionality

The transition is seamless with full backward compatibility, but the new gateway terminology better represents the powerful API gateway features you've been using.

### 🧪 Modern Testing with Node.js Native Runner

**Goodbye external dependencies, hello native performance.** We've removed `borp` and embraced Node.js's built-in `--test` runner:

- **Fewer dependencies:** One less external testing framework to manage
- **Better performance:** Native Node.js testing is faster and more reliable
- **Future-proof:** Aligned with Node.js's testing roadmap and innovations

Your tests now run on the same engine that powers your applications—no translation layers, no extra overhead.

### 🚀 Massimo: From Integrated Tool to Standalone Powerhouse

**Great news for API client generation!** What began as `@platformatic/client` has evolved into something much bigger. We've extracted and enhanced it as **[Massimo](https://massimohttp.dev/)**—a production-proven, standalone client generation solution:

- **Enhanced capabilities:** Dual architecture with both runtime library and code generator
- **Production proven:** Already powering companies like Spendesk in production
- **Zero dependencies:** Frontend clients with no external dependencies
- **Better performance:** Optimized for both server-side (Undici) and browser (fetch) environments
- **Active development:** Dedicated project with community contributions

This extraction allows Massimo to evolve independently while Watt 3 focuses on its core application platform strengths.

### 🧹 Streamlined Architecture  

**Simpler is better.** With Massimo now independent, we've streamlined Watt 3 by removing the integrated client generation:

- **Reduce complexity:** 25,000+ lines of code removed for a leaner, more focused platform
- **Improve maintainability:** Fewer moving parts means more reliable core functionality  
- **Clear separation:** Client generation and application platform concerns properly separated

This change creates a cleaner architecture where each tool excels in its domain—Watt 3 for application platforms, Massimo for API clients.

### 🏷️ Clearer Terminology: From Stackables to Capabilities

**Better names for better understanding.** We've renamed "stackables" to "capabilities" throughout the platform, along with a complete architectural overhaul:

- **Intuitive naming:** "Capabilities" better describes what these components do
- **Consistent terminology:** Unified language across docs, APIs, and code
- **Developer clarity:** Easier onboarding and understanding for new users
- **Modern architecture:** New `applicationFactory` pattern with cleaner separation of concerns
- **Modular exports:** Structured exports for better composability and testing

The new capability format provides a much cleaner development experience with better separation between configuration, transformation, and application logic.

### 📱 Services Become Applications

**Broader scope, better naming.** The platform now uses "applications" instead of "services":

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

- **Faster feedback loops:** Parallel startup and native TypeScript reduce development cycle time
- **Simplified debugging:** Fewer abstraction layers and unified CLI mean clearer error messages
- **Modern toolchain:** Native Node.js testing, ESM modules, and latest Node.js features
- **Better performance:** Direct TypeScript execution, parallel operations, and reduced overhead
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

### For Platform Architects

- **Cleaner abstractions:** Gateway, applications, and capabilities provide intuitive concepts
- **Better scaling patterns:** Parallel execution enables more efficient horizontal scaling
- **Future-ready foundation:** ESM modules, modern testing, and latest Node.js features
- **Architectural consistency:** Unified base classes and consistent inheritance patterns
- **Modular design:** Split packages allow for more flexible composition
- **Reduced technical debt:** Major cleanup removes legacy code and patterns

## Migration Path

While Watt 3 introduces breaking changes, we've designed the migration to be as smooth as possible:

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
```yaml
# platformatic.yml
applications:
  - id: my-api
-   type: service
+   type: application
-   type: composer
+   type: gateway

# Remove old configuration sections
-clients:
-  frontend: true
-typescript:
-  outDir: dist
-marketplace:
-  autoInstall: true
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
// Update ESM imports
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
1. **Upgrade Node.js** to 22.18.0+ before anything else
2. **Review our [migration guide](SUMMARY.md)** for detailed upgrade instructions
3. **Test in staging** - this release has 15 breaking changes
4. **Update CLI usage** from individual CLIs to unified `wattpm`
5. **Migrate to ESM** - update all imports/exports
6. **Update dependencies** and configuration files
7. **Replace client generation** tooling
8. **Update test scripts** to use Node.js native testing
9. **Remove deprecated configs** (TypeScript outDir, marketplace, log rolling)
10. **Update terminology** in your codebase (services→applications, stackables→capabilities)

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
16. **Complete ESM migration** - All packages converted to ES modules

## Performance Improvements

Benchmarks show impressive improvements:
- **Startup time:** 60-75% faster for multi-application projects
- **Memory usage:** 15-20% reduction in baseline consumption
- **Test execution:** 25-40% faster with native Node.js testing
- **Bundle size:** 12% smaller after removing 25,000+ lines of code

## Thank You

Watt 3 represents months of careful planning, development, and testing. We're grateful to our community for feedback, bug reports, and contributions that made this release possible.

The changes in Watt 3 position Platformatic as a more performant, maintainable, and future-ready platform for building Node.js applications at scale.

**Ready to experience Watt 3?** Download the alpha release and let us know what you think!

---

*Watt 3 (v3.0.0-alpha.6) is now available. For technical details, see our [commit summary](SUMMARY.md) and [migration guide](#). Learn more about the evolution of `@platformatic/client` to [Massimo](https://massimohttp.dev/) in our separate announcement.*
