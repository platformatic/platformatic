# Introducing Watt 3: Faster, Simpler, and More Powerful Than Ever

Today, we're excited to announce the release of **Watt 3** (`wattpm` v3.0.0), a major evolution of the Platformatic platform that brings significant performance improvements, architectural simplifications, and modernization upgrades that will transform how you build and deploy Node.js applications.

## What's New in Watt 3

Watt 3 isn't just an incremental update—it's a complete reimagining of how Platformatic applications start, scale, and operate. Here are the four major changes that define this release:

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

### Native TypeScript Support

Thanks to type stripping..

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

### 🧹 Streamlined Architecture

**Simpler is better.** We've removed the auto-generated client packages (`@platformatic/client` and `@platformatic/client-cli`) to:

- **Reduce complexity:** 25,000+ lines of code removed for a leaner, more focused platform
- **Improve maintainability:** Fewer moving parts means more reliable core functionality  
- **Encourage best practices:** Use standard OpenAPI/GraphQL tooling for client generation

This change pushes client generation to the edges where it belongs, using industry-standard tools rather than maintaining our own implementation.

TODO: mention massimo

### Stackable -> Capabilities

FILLME

### Services -> Applications

FILLME

## Why These Changes Matter

### For Developers

- **Faster feedback loops:** Parallel startup means quicker development iterations
- **Simplified debugging:** Fewer abstraction layers mean clearer error messages
- **Modern toolchain:** Native Node.js testing aligns with current best practices
- **Better performance:** Less overhead, more throughput

### For Operations Teams

- **Faster deployments:** Parallel startup reduces deployment windows
- **Improved resource efficiency:** Better utilization during scaling events
- **Reduced dependencies:** Fewer external packages to audit and maintain
- **Enhanced monitoring:** Clearer component boundaries with gateway terminology

### For Platform Architects

- **Cleaner abstractions:** Gateway concept is more intuitive than composer
- **Better scaling patterns:** Parallel execution enables more efficient horizontal scaling
- **Future-ready foundation:** Modern testing and architecture patterns

## Migration Path

While Watt 3 introduces breaking changes, we've designed the migration to be as smooth as possible:

### 1. Update Your Dependencies
```json
{
  "dependencies": {
-   "@platformatic/composer": "^2.65.1",
+   "@platformatic/gateway": "^3.0.0-alpha.6"
  }
}
```

### 2. Update Configuration Files
```yaml
# platformatic.yml
applications:
  - id: my-api
-   type: composer
+   type: gateway
```

### 3. Replace Client Generation
If you were using `@platformatic/client`, consider these alternatives:
- **OpenAPI clients:** Use `openapi-generator` or `swagger-codegen`
- **GraphQL clients:** Use `graphql-code-generator`
- **Custom solutions:** Write lightweight client wrappers for your specific needs

TODO: mention massimo

### 4. Update Test Scripts
```json
{
  "scripts": {
-   "test": "borp",
+   "test": "node --test"
  }
}
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
npm create platformatic@latest my-app
cd my-app
npm install
npm start
```

### Existing Projects
1. Review our [migration guide](SUMMARY.md) for detailed upgrade instructions
2. Test in a staging environment first
3. Update dependencies and configuration files
4. Replace any client generation tooling
5. Update test scripts to use Node.js native testing

### Community and Support

- **Documentation:** Updated guides and examples are available in our docs
- **Community:** Join discussions in our GitHub Discussions
- **Issues:** Report bugs or request features on GitHub
- **Examples:** Check out sample applications showcasing Watt 3 features

## Breaking Changes Summary

Watt 3 includes these breaking changes:

1. **Parallel startup behavior** - Applications start concurrently (may affect timing-dependent code)
2. **Client packages removed** - `@platformatic/client` and `@platformatic/client-cli` no longer available
3. **Gateway rename** - `@platformatic/composer` renamed to `@platformatic/gateway`
4. **Testing framework change** - `borp` replaced with Node.js native `--test` runner

## Thank You

Watt 3 represents months of careful planning, development, and testing. We're grateful to our community for feedback, bug reports, and contributions that made this release possible.

The changes in Watt 3 position Platformatic as a more performant, maintainable, and future-ready platform for building Node.js applications at scale.

**Ready to experience Watt 3?** Download the alpha release and let us know what you think!

---

*Wattpm 3 (v3.0.0) is now available. For technical details, see our [commit summary](SUMMARY.md) and [migration guide](#).*
