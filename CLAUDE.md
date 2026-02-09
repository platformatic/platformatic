# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Platformatic is an open-source Node.js application platform for building APIs with auto-generated GraphQL/REST endpoints, database integration, and microservice orchestration. This is a pnpm workspace monorepo with 36 packages.

## Essential Commands

```bash
# Setup and installation
pnpm install
pnpm run global-links  # Link CLI tools globally for development

# Development workflow
pnpm test              # Run all tests (uses Docker for databases)
pnpm run build         # Build all packages
pnpm run lint          # Lint all packages
pnpm run gen-schema    # Generate JSON schemas
pnpm run gen-types     # Generate TypeScript types

# Cleanup
pnpm clean             # Clean node_modules in all packages
pnpm cleanall          # Clean everything including lockfile

# Testing individual packages
cd packages/<package-name>
npm test               # Run tests for specific package

# Version management
./scripts/sync-version.sh  # Sync versions across all packages
```

## Architecture

### Core Components (packages/)
- **cli**: Main Platformatic CLI (`platformatic`/`plt` commands)
- **wattpm**: Node.js application server (`watt` command) 
- **db**: Database service with auto-generated APIs
- **service**: HTTP service based on Fastify
- **composer**: API gateway for aggregating services
- **runtime**: Microservice orchestration environment

### Capabilities (Frontend Framework Integration)
- **next**, **astro**, **vite**, **remix**: Framework-specific integrations
- **node**: Generic Node.js capability

### SQL Components
- **sql-mapper**: Data mapping layer
- **sql-graphql**: GraphQL schema generation from SQL
- **sql-openapi**: REST API generation from SQL
- **db-authorization**: Database authorization system

## Development Guidelines

### Workspace Dependencies
Use `workspace:*` for internal package dependencies. All packages share the same version (currently 2.65.1).

### Testing
- Tests require Docker for database setup
- Test script automatically selects appropriate Docker Compose file based on OS
- Tests run with concurrency=1 and extended timeouts (300000ms)
- Pre-commit hooks enforce linting

### Configuration
- JSON Schema validation for all configuration files
- Supports JSON, YAML, and TOML config formats
- Uses neostandard ESLint configuration

### Database Support
Supports PostgreSQL, MySQL, MariaDB, and SQLite. The codebase is database-agnostic with automatic schema introspection and API generation.

## Package Structure Patterns
- Each package has its own `package.json` with consistent scripts
- TypeScript definitions are auto-generated
- Fastify-based HTTP services follow consistent plugin patterns
- Configuration schemas are defined in each package's `lib/schema.js`

## Git Commit Guidelines

All commits must include a DCO (Developer Certificate of Origin) sign-off. Always use `git commit -s` to automatically add the human's sign-off, and manually include Claude's sign-off.

When creating commits, the commit message should include:
- `Co-Authored-By: Claude <noreply@anthropic.com>`
- `Signed-off-by: Claude <noreply@anthropic.com>`

The `-s` flag will automatically add the human's `Signed-off-by` line, ensuring both contributors are properly signed off for DCO compliance.