# Migrating a TypeScript Application with ts-node to Watt

## Problem

You have a standalone [TypeScript](https://typescriptlang.org) application using ts-node for development, and you want to migrate it to Platformatic Watt while preserving your existing TypeScript workflow. You need to:

- Retain ts-node for direct TypeScript execution in development
- Maintain your current development experience without requiring builds
- Take advantage of Watt's features (hot reload, multi-application support, etc.)
- Keep development production builds working as before

Your TypeScript code uses modern `import` and `export` statements, but you might not be familiar with the differences between JavaScript module systems (like "ESM" and "CommonJS"). This guide will help you understand what's needed without assuming prior knowledge.

**When to use this solution:**

- Migrating existing TypeScript applications to Platformatic Watt
- Teams with established ts-node development workflows
- Applications that need Watt's orchestration while keeping TypeScript tooling
- Projects transitioning to Platformatic without rewriting build processes

## Solution Overview

This guide walks you through migrating a standalone TypeScript application to Watt while keeping ts-node. We'll cover:

1. Understanding your current standalone setup
2. Understanding JavaScript module systems (and why it matters)
3. Configuring Watt to use ts-node with `execArgv`
4. Adjusting your development and production workflows
5. Troubleshooting common module system issues

## Your Current Standalone Setup

This section shows an example of a typical standalone TypeScript application structure. Your actual setup may differ, but the principles in this guide apply regardless of your specific configuration.

Most TypeScript applications use modern `import` and `export` syntax in their TypeScript files as defined in the [ESM module format](https://nodejs.org/dist/latest/docs/api/modules.html). However, many of these applications are configured to compile down to an older JavaScript module format called "CommonJS" for runtime execution. This is what we call a ["faux ESM"](#understanding-javascript-module-systems) setup - your TypeScript code looks modern, but it runs as [CommonJS module format](https://nodejs.org/dist/latest/docs/api/modules.html).

Let's look at a typical standalone TypeScript application structure:

**Directory structure:**

```
my-app/
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
└── node_modules/
```

**package.json:**

```json
{
  "name": "my-app",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "fastify": "^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.9.3"
  }
}
```

Notice: This package.json **does not** have `"type": "module"`. This is the typical setup for many TypeScript applications.

**tsconfig.json:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true
  }
}
```

Notice: The `"module": "commonjs"` setting means TypeScript will compile your modern `import`/`export` syntax into CommonJS `require()` calls.

**src/index.ts:**

```typescript
import { createServer } from 'node:http'

// Using the legacy enum syntax will make this file not loadable via Node.js native type stripping
enum Environment {
  Development = 'development',
  Production = 'production'
}

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(
    JSON.stringify({
      environment: Environment[process.env.NODE_ENV as keyof typeof Environment] ?? Environment.Development
    })
  )
})

server.listen(3000)
```

Your TypeScript code uses `import` statements (which look modern), but when you build with `tsc`, it gets converted to CommonJS. When you run `npm run dev`, ts-node executes your TypeScript directly in CommonJS mode. Everything works, and you may not have thought about the module system at all. Now let's migrate this to Watt.

## Understanding JavaScript Module Systems

Before we migrate, it's helpful to understand what's happening under the hood. JavaScript has two main module systems:

**CommonJS (the older system):**

- Uses `require()` to import modules and `module.exports` to export
- Example: `const http = require('http')`
- Default in Node.js for many years
- Still very common and fully supported

**ESM (ECMAScript Modules, the newer system):**

- Uses `import` and `export` statements
- Example: `import http from 'http'`
- Native JavaScript standard
- Requires special configuration in Node.js

**The Faux ESM situation:**

TypeScript lets you write modern `import`/`export` syntax regardless of which module system you're actually using at runtime. Most TypeScript projects are configured to **compile** those modern imports into CommonJS `require()` calls. This is perfectly fine and very common!

**Why this matters for Watt:**

When migrating to Watt with ts-node, we need to tell ts-node which module system to use. Since your current setup uses CommonJS (even though you write `import` statements in TypeScript), we'll configure ts-node to use CommonJS mode with the `-r ts-node/register` flag.

**Note:** If you want to use true ESM instead, you'll need to change your tsconfig.json and package.json settings. We'll show you how at the end of this guide.

## Migration Steps

This migration uses the standalone Node.js capability approach for a simpler single-application setup. We'll configure Watt to use ts-node in CommonJS mode, matching your current setup.

### Step 1: Install Dependencies

```bash
npm install wattpm @platformatic/globals @platformatic/node
npm install -D @platformatic/tsconfig
```

### Step 2: Create Watt Configuration

**Create `watt.json` in your project root:**

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/node/3.25.0.json",
  "application": {
    "commands": {
      "build": "tsc -p ."
    }
  },
  "node": {
    "disableBuildInDevelopment": true
  },
  "runtime": {
    "application": {
      "execArgv": ["-r", "ts-node/register"]
    },
    "server": {
      "port": 3000
    }
  }
}
```

Key configuration details:

- Uses `@platformatic/node` schema
- `application.commands.build: "tsc -p ."` defines the build command that will be used in production
  - `-p .` tells TypeScript to use the tsconfig.json in the current directory
- `node.disableBuildInDevelopment: true` ensures TypeScript runs directly in dev mode without needing to build first
- `runtime.application.execArgv` configures how Node.js runs your TypeScript files:
  - `"-r", "ts-node/register"` registers ts-node for CommonJS module loading
- `runtime.server.port: 3000` sets the default server port

This configuration provides maximum compatibility - it works whether your TypeScript compiles to CommonJS or ESM, automatically handling both module systems.

### Step 3: Update Package.json

Update your package.json to use Watt commands:

```json
{
  "name": "my-app",
  "main": "src/index.ts",
  "scripts": {
    "dev": "wattpm dev",
    "build": "wattpm build",
    "start": "wattpm start"
  },
  "dependencies": {
    "@platformatic/globals": "^3.25.0",
    "@platformatic/node": "^3.25.0",
    "wattpm": "^3.25.0"
  },
  "devDependencies": {
    "@platformatic/tsconfig": "^0.1.0",
    "@types/node": "^22.0.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.9.3"
  }
}
```

Notice: We kept everything the same as your original setup - no `"type": "module"` field, since we're sticking with CommonJS mode. The main changes are just the npm scripts to use `wattpm` commands instead of running ts-node directly.

## Migrating to True ESM

If you want to use true ECMAScript Modules (ESM) instead of CommonJS, you'll need to update several configuration files. This section shows you how to convert your application to use native ESM.

### When to Use ESM

Consider migrating to ESM if you:

- Want to use modern JavaScript features and native module syntax
- Need to import ESM-only packages (many newer npm packages only support ESM)
- Prefer the standardized module system over CommonJS

### ESM Migration Steps

**1. Update package.json to enable ESM:**

Add `"type": "module"` to tell Node.js to treat `.js` files as ESM:

```json
{
  "name": "my-app",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "dev": "wattpm dev",
    "build": "wattpm build",
    "start": "wattpm start"
  },
  "dependencies": {
    "@platformatic/globals": "^3.25.0",
    "@platformatic/node": "^3.25.0",
    "wattpm": "^3.25.0"
  },
  "devDependencies": {
    "@platformatic/tsconfig": "^0.1.0",
    "@types/node": "^22.0.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.9.3"
  }
}
```

**2. Update tsconfig.json for ESM output:**

Change your TypeScript configuration to compile to ESM:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true
  }
}
```

Key changes:

- `"module": "NodeNext"` tells TypeScript to emit ESM-compatible code
- `"moduleResolution": "NodeNext"` uses Node.js's ESM resolution algorithm

**3. Update watt.json to use ESM loader:**

Change the `execArgv` configuration to use ts-node's ESM loader:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/node/3.25.0.json",
  "application": {
    "commands": {
      "build": "tsc -p ."
    }
  },
  "node": {
    "disableBuildInDevelopment": true
  },
  "runtime": {
    "application": {
      "execArgv": ["--loader", "ts-node/esm"]
    },
    "server": {
      "port": 3000
    }
  }
}
```

The key change is `"execArgv": ["--loader", "ts-node/esm"]` which registers ts-node's ESM loader instead of the CommonJS register hook.

**4. Update your imports (if needed):**

With ESM, you may need to add file extensions to relative imports in some cases. However, TypeScript typically handles this for you:

```typescript
// This works in ESM
import { myFunction } from './myModule.js' // Note: .js extension even though source is .ts
```

Your TypeScript code doesn't need to change if you're already using `import`/`export` syntax, but be aware that:

- File extensions may be required for relative imports (TypeScript config handles this) and `index.js` files are not resolved automatically
- `__dirname` and `__filename` are not available in ESM (use `import.meta.filename` or `import.meta.dirname` instead)
- Top-level `await` is supported in ESM

**5. Test your application:**

Run your development server to ensure everything works:

```bash
npm run dev
```

Your application should now be running with true ESM! The behavior should be identical to before, but you're now using the native JavaScript module system.

### Important ESM Notes

- **File extensions:** When importing local files in ESM, you reference the compiled `.js` extension even though your source files are `.ts`
- **No `__dirname` or `__filename`:** Use `import.meta.filename` or `import.meta.dirname` instead. For example:
- **Named imports:** ESM is more strict about named vs. default imports. You may need to adjust how you import some packages
- **Top-level await:** You can use `await` at the top level of your modules without wrapping in an async function

## Faster Development Startup

By default, ts-node checks your TypeScript for errors every time it runs. This is helpful but can slow down startup, especially in large projects. If you want faster startup, you can use "transpile-only" mode, which skips the type checking.

**For CommonJS mode (the default setup in this guide):**

```json
"execArgv": ["-r", "ts-node/register/transpile-only"]
```

**For ESM mode (if you migrated to true ESM):**

```json
"execArgv": ["--loader", "ts-node/esm/transpile-only"]
```

When using transpile-only mode, ts-node will just convert your TypeScript to JavaScript without checking for errors. You should run `npx tsc --noEmit` separately (e.g., in a pre-commit hook or CI pipeline) to catch type errors.

## Node.js 22+ Built-in TypeScript Support

If you're using Node.js 22 or later and only need type stripping (similar to [transpile-only mode](#faster-development-startup)), you don't need ts-node at all! Node.js 22+ includes experimental built-in support for running TypeScript files directly.

### When is Native Type Stripping Available?

Node.js built-in type stripping only strips types and doesn't transpile TypeScript-specific syntax. Your code should only use type annotations and standard JavaScript syntax.

**Avoid these TypeScript-specific features:**

- **Legacy enums** (use const enums or plain objects instead)
- **Decorators** (not supported yet)
- **Parameter properties** (use explicit class properties)
- **Namespace syntax** (use ES modules instead)

### Migration Steps from ts-node

**1. Update watt.json to use Node.js built-in type stripping:**

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/node/3.25.0.json",
  "runtime": {
    "server": {
      "port": 3000
    }
  }
}
```

**2. Remove ts-node from package.json:**

```bash
npm uninstall ts-node
```

**3. Update your package.json (if needed):**

If your package.json referenced the `dist` folder for production builds, you can now directly point to the `src/index.ts` file.

```json
{
  "name": "my-app",
  "main": "src/index.ts",
  "scripts": {
    "dev": "wattpm dev",
    "build": "wattpm build",
    "start": "wattpm start"
  },
  "dependencies": {
    "@platformatic/globals": "^3.25.0",
    "@platformatic/node": "^3.25.0",
    "wattpm": "^3.25.0"
  },
  "devDependencies": {
    "@platformatic/tsconfig": "^0.1.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.9.3"
  }
}
```

**4. Review your TypeScript code for unsupported features:**

Node.js built-in type stripping only strips types and doesn't transpile TypeScript-specific syntax. Check your code for:

- **Legacy enums** (use const enums or plain objects instead)
- **Decorators** (not supported yet)
- **Parameter properties** (use explicit class properties)
- **Namespace syntax** (use ES modules instead)

For example, the enum in our example code won't work with built-in type stripping. You'd need to change it to:

```typescript
// Before (won't work with --experimental-strip-types)
enum Environment {
  Development = 'development',
  Production = 'production'
}

// After (works with --experimental-strip-types)
const Environment = {
  Development: 'development',
  Production: 'production'
} as const
```

### Important Notes

- It only strips types - no transpilation of other TypeScript features like legacy enums, decorators or JSX
- Type checking is not performed (similar to transpile-only mode), so run `npx tsc --noEmit` separately to catch type errors
- Works with both CommonJS and ESM (configured via your package.json and tsconfig.json as usual)
- The `dist` folder is still created during production builds via `tsc`, so you don't need to update any deployment configurations

This is the simplest approach if you're on Node.js 22+ and don't use advanced TypeScript features beyond type annotations.

## Using swc-node as an lternative

While ts-node is the most popular choice for running TypeScript directly, there are faster alternatives that you might want to consider.

`swc-node` uses SWC (Speedy Web Compiler), a Rust-based transpiler that's extremely fast.

**Installation:**

```bash
npm install -D @swc-node/register @swc/core
```

**Update `watt.json` in your project root:**

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/node/3.25.0.json",
  "runtime": {
    "application": {
      "execArgv": ["--import", "@swc-node/register/esm-register"]
    }
  },
  "node": {
    "disableBuildInDevelopment": true
  }
}
```
