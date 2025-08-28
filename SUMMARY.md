# Watt 3 (v3.0.0-alpha.6) - Commit Summary

This document provides a comprehensive summary of the key changes and commits that make up the Watt 3 release.

## Overview

Watt 3 represents a major architectural evolution of the Platformatic platform, introducing significant performance improvements, API redesigns, and modernization efforts. This release includes 11 commits with 9 major breaking changes that enhance scalability, simplify the codebase, and align with modern Node.js best practices.

## Detailed Commit Analysis

### 1. Parallel Application Startup/Shutdown (5ecdd5c06)
**[PR #4229](https://github.com/platformatic/platformatic/pull/4229)** | **[Commit](https://github.com/platformatic/platformatic/commit/5ecdd5c069eef5206eb02367f9bec122e0380375)** | **Merged:** August 28, 2025

**Summary:** This major change modifies the Platformatic runtime to start and stop applications in parallel instead of serially, significantly improving performance. The change introduces parallel startup configurations, enhanced dependency management, and better error handling during service lifecycle operations.

**Technical Impact:**
- Added parallel execution support for all capability types (Astro, Next, Nest, Remix, Vite, etc.)
- Enhanced the foundation execution engine with parallel processing capabilities
- Introduced new configuration options for controlling parallel vs serial startup
- Updated schema definitions across all packages to support the new parallelism features
- Modified worker controllers and inter-thread communication for concurrent operations

**Breaking Changes:**
- Applications now start/stop in parallel by default, which may affect timing-dependent code
- Changed service startup order and dependency resolution behavior
- Modified ITC (Inter-Thread Communication) protocols to handle concurrent operations

**Migration Notes:**
- Review any timing-dependent code that relies on specific startup sequences
- Update monitoring and logging systems to handle concurrent startup events
- Test applications thoroughly to ensure parallel startup doesn't break functionality

---

### 2. Client Package Removal (9fdc46ad6)
**[Commit](https://github.com/platformatic/platformatic/commit/9fdc46ad64922ad7eda12ef97f4f383850b83d53)** | **Merged:** August 27, 2025

**Summary:** This major breaking change completely removes the `@platformatic/client` and `@platformatic/client-cli` packages from the codebase. This eliminates the auto-generated client functionality that was previously used to create TypeScript/JavaScript clients from OpenAPI/GraphQL schemas.

**Technical Impact:**
- Removed over 25,000 lines of code across 304 files
- Eliminated packages: `@platformatic/client` and `@platformatic/client-cli`
- Removed extensive test suites, fixtures, and E2E testing infrastructure
- Updated CI/CD workflows to remove client-related testing
- Simplified documentation and error handling by removing client-specific content

**Breaking Changes:**
- `@platformatic/client` and `@platformatic/client-cli` packages no longer available
- Auto-generated client functionality completely removed
- All client generation tools and CLI commands eliminated
- Frontend integration templates and examples removed

**Migration Notes:**
- Users relying on auto-generated clients must implement their own client generation
- Consider using alternative tools like OpenAPI generators or GraphQL code generators
- Manual client code may be needed for applications previously using generated clients

---

### 3. Composer to Gateway Rename (e8ab4ebcb)
**[PR #4224](https://github.com/platformatic/platformatic/pull/4224)** | **[Commit](https://github.com/platformatic/platformatic/commit/e8ab4ebcb09860d8d078c51d5547a84174db2c4b)** | **Merged:** August 25, 2025

**Summary:** This major refactoring renames the `composer` package to `gateway` throughout the entire codebase while maintaining backwards compatibility. The change reflects the evolution of the component from a simple composer to a full-featured API gateway with enhanced routing and proxy capabilities.

**Technical Impact:**
- Renamed `@platformatic/composer` to `@platformatic/gateway` 
- Updated 323 files with package references, imports, and configuration
- Migrated all documentation, guides, and examples to use gateway terminology
- Updated test suites, fixtures, and CI workflows
- Maintained backwards compatibility by keeping composer package as a deprecation wrapper

**Breaking Changes:**
- Package name changed from `@platformatic/composer` to `@platformatic/gateway`
- Configuration files should use `gateway` instead of `composer` in new projects
- CLI commands and schemas updated to reflect gateway terminology
- Import paths changed for direct package usage

**Migration Notes:**
- Update package.json dependencies from `@platformatic/composer` to `@platformatic/gateway`
- Rename configuration sections from `composer` to `gateway`
- Update import statements in code that directly imports the package
- CLI commands remain compatible but prefer new gateway terminology

---

### 4. Borp to Node.js Native Testing (4b417a293)
**[PR #4213](https://github.com/platformatic/platformatic/pull/4213)** | **[Commit](https://github.com/platformatic/platformatic/commit/4b417a2935d09b9f95c92ec109fac36721f21991)** | **Merged:** August 22, 2025

**Summary:** This change removes the `borp` testing framework dependency across all packages and replaces it with Node.js's built-in `--test` runner. This modernizes the testing infrastructure and reduces external dependencies while leveraging Node.js native testing capabilities.

**Technical Impact:**
- Removed `borp` dependency from 126 package.json files
- Updated test scripts across all packages to use `node --test`
- Modified CI/CD workflows to use native Node.js testing
- Updated package configurations and removed borp-specific test setups
- Added coverage script enhancements for the new test runner

**Breaking Changes:**
- `borp` no longer available as a testing dependency
- Test execution may have different behavior with Node.js native runner
- Some test configuration options may need adjustment
- Coverage reporting mechanisms updated

**Migration Notes:**
- Update any custom test scripts that relied on borp-specific features
- Review test configurations for compatibility with Node.js native test runner
- Update CI/CD pipelines to use `node --test` instead of borp
- Verify coverage reporting still works as expected

---

### 5. Marketplace Removal (5c345265b)
**[PR #4209](https://github.com/platformatic/platformatic/pull/4209)** | **[Commit](https://github.com/platformatic/platformatic/commit/5c345265b40388fab5d3c4da87aca44a3a2fd2d8)** | **Merged:** August 22, 2025

**Summary:** This breaking change removes the marketplace functionality from Platformatic, eliminating the ability to discover and install community-contributed plugins and templates through the marketplace system.

**Technical Impact:**
- Removed `@platformatic/marketplace` package entirely
- Eliminated marketplace discovery and installation commands
- Removed marketplace-related configuration options
- Updated CLI to remove marketplace subcommands
- Simplified codebase by removing marketplace integration points

**Breaking Changes:**
- Marketplace functionality no longer available
- Marketplace CLI commands removed
- Marketplace configuration options eliminated
- Community plugin discovery through marketplace disabled

**Migration Notes:**
- Remove marketplace-related configuration from existing projects
- Use manual plugin installation methods
- Consider alternative plugin discovery mechanisms

---

### 6. ESM Migration (39a17a77a)
**[PR #4212](https://github.com/platformatic/platformatic/pull/4212)** | **[Commit](https://github.com/platformatic/platformatic/commit/39a17a77a6fbaca3b0648941b9dda4fed20a076e)** | **Merged:** August 22, 2025

**Summary:** This major refactoring migrates all packages in the monorepo from CommonJS to ECMAScript Modules (ESM), modernizing the codebase to align with current JavaScript standards and improving compatibility with modern tooling.

**Technical Impact:**
- Converted all 36 packages to ESM format
- Updated import/export statements across the entire codebase
- Modified package.json files to include `"type": "module"`
- Updated build scripts and configurations for ESM compatibility
- Fixed dynamic imports and module resolution issues

**Breaking Changes:**
- All packages now use ESM instead of CommonJS
- `require()` statements replaced with `import` statements
- Module resolution behavior changed to ESM semantics
- Some dynamic loading patterns may need adjustment

**Migration Notes:**
- Update consuming applications to use ESM imports
- Ensure Node.js version supports ESM (Node.js 14+)
- Review dynamic import usage in applications
- Update build tools and configurations for ESM compatibility

---

### 7. Services to Applications Rename (ad35181c5)
**[PR #4208](https://github.com/platformatic/platformatic/pull/4208)** | **[Commit](https://github.com/platformatic/platformatic/commit/ad35181c565b847a6081797a41c3c317ff9ea0fc)** | **Merged:** August 21, 2025

**Summary:** This refactoring renames the concept of "services" to "applications" throughout the codebase, API, and documentation to better reflect the broader scope of what can be deployed and managed by Platformatic.

**Technical Impact:**
- Updated terminology across all packages and documentation
- Modified API endpoints to use "applications" instead of "services"
- Updated configuration schemas and validation
- Changed CLI commands and help text to reflect new terminology
- Maintained backwards compatibility for existing configurations

**Breaking Changes:**
- API endpoints using "service" terminology deprecated
- Configuration files should use "application" instead of "service"
- CLI commands prefer "application" terminology
- Schema definitions updated to reflect new naming

**Migration Notes:**
- Update API calls to use new "application" endpoints
- Gradually migrate configuration files to use "application" terminology
- Update documentation and scripts to use new terminology
- Test backwards compatibility during migration

---

### 8. Stackables to Capabilities Rename (8e9db53d8)
**[PR #4205](https://github.com/platformatic/platformatic/pull/4205)** | **[Commit](https://github.com/platformatic/platformatic/commit/8e9db53d8b9f71ccf8c7cc0703dbaf6cc8f6bf13)** | **Merged:** August 19, 2025

**Summary:** This refactoring renames "stackables" to "capabilities" throughout the platform, providing clearer terminology for the plugin system that extends Platformatic's functionality.

**Technical Impact:**
- Updated all references from "stackables" to "capabilities"
- Modified package names, imports, and exports
- Updated configuration schemas and validation rules
- Changed API endpoints and responses
- Updated documentation and examples

**Breaking Changes:**
- "Stackables" terminology no longer used
- Package imports updated to use "capabilities"
- Configuration files should use "capabilities" instead of "stackables"
- API responses use new terminology

**Migration Notes:**
- Update configuration files to use "capabilities" terminology
- Modify code that references "stackables" to use "capabilities"
- Update documentation and comments
- Test configuration compatibility during migration

---

### 9. Management API Testing Enhancement (7da7a3ca6)
**[PR #4210](https://github.com/platformatic/platformatic/pull/4210)** | **[Commit](https://github.com/platformatic/platformatic/commit/7da7a3ca6300eceb916d505529134273a689b36e)** | **Merged:** August 21, 2025

**Summary:** This enhancement adds testing to ensure the management API is enabled by default in runtime configurations, improving the reliability of the management interface.

**Technical Impact:**
- Added comprehensive tests for management API default behavior
- Enhanced test coverage for runtime configuration
- Improved validation of default configuration values
- Added regression tests for management API availability

**Breaking Changes:** None

**Migration Notes:** No migration required

---

### 10. Node.js 20 Support Drop (467311c39)
**[PR #4105](https://github.com/platformatic/platformatic/pull/4105)** | **[Commit](https://github.com/platformatic/platformatic/commit/467311c395e2fc964e2129ce038e8d525884555b)** | **Merged:** June 24, 2025

**Summary:** This major breaking change removes support for Node.js 20 and raises the minimum Node.js version requirement to 22.18.0 across all packages. This modernization effort enables the platform to leverage newer Node.js features and improved performance characteristics.

**Technical Impact:**
- Updated engine requirements in all 36 package.json files to require Node.js 22.18.0+
- Simplified version checking logic by removing Node.js 20 compatibility code
- Removed Node.js 20 from CI/CD test matrices and workflows
- Updated documentation and deployment guides to reflect new requirements
- Cleaned up dependencies that were needed for Node.js 20 compatibility (minimatch, glob)

**Breaking Changes:**
- **Minimum Node.js version:** Now requires Node.js 22.18.0 or higher
- **Runtime incompatibility:** Applications running on Node.js 20 will no longer work
- **Development environment:** Developers must upgrade to Node.js 22.18.0+
- **Deployment impact:** Production environments must be updated before upgrading

**Migration Notes:**
- Upgrade Node.js runtime to version 22.18.0 or higher in all environments
- Update Docker base images and container configurations
- Verify compatibility of existing Node.js tooling and dependencies
- Test applications thoroughly with Node.js 22 before production deployment
- Update CI/CD pipelines to use Node.js 22+ for builds and testing

---

### 11. Version Bump (9bd48fbc5)
**[Commit](https://github.com/platformatic/platformatic/commit/9bd48fbc5b06b749760c0e4e7cf7be2e8a0be577)** | **Merged:** August 25, 2025

**Summary:** Official version bump to v3.0.0-alpha.6, marking the release of all the above changes as a cohesive alpha release.

**Technical Impact:**
- Updated all package.json files to version 3.0.0-alpha.6
- Synchronized versions across the entire monorepo
- Prepared release artifacts and documentation

**Breaking Changes:** None (version bump only)

**Migration Notes:** Update dependency versions to 3.0.0-alpha.6

## Release Statistics

- **Total Commits:** 11 commits (9 breaking changes + 1 enhancement + 1 version bump)
- **Files Changed:** 1000+ files across all packages
- **Lines Changed:** 30,000+ lines of code
- **Packages Affected:** All 36 packages in the monorepo
- **Breaking Changes:** 9 major breaking changes
- **Performance Improvements:** Parallel startup/shutdown implementation
- **Major Removals:** Client packages, marketplace, borp testing framework
- **Major Renames:** Composer→Gateway, Services→Applications, Stackables→Capabilities
- **Modernization:** Complete ESM migration across all packages

## Upgrade Considerations

This release contains significant breaking changes that require careful migration planning:

1. **Node.js Version:** Upgrade to Node.js 22.18.0+ in all environments before upgrading Platformatic
2. **Parallel Startup:** Test applications for timing dependencies and concurrent operations
3. **Client Removal:** Implement alternative client generation strategies using external tools
4. **Gateway Rename:** Update package dependencies from composer to gateway
5. **Testing Framework:** Migrate from borp to native Node.js `--test` runner
6. **ESM Migration:** Update all imports/exports to use ESM syntax
7. **Marketplace Removal:** Use manual plugin installation methods
8. **Terminology Updates:** Update configurations to use new naming (applications, capabilities, gateway)
9. **API Changes:** Update API calls to use new endpoint terminology

## Next Steps

- Review the [Migration Guide](#) for detailed upgrade instructions
- Test applications thoroughly in a staging environment
- Update CI/CD pipelines to accommodate the new testing framework
- Plan for the removal of client generation functionality