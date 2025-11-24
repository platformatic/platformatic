# Migrating a TypeScript Application with ts-node to Watt

## Problem

You have a standalone TypeScript application using ts-node for development, and you want to migrate it to Platformatic Watt while preserving your existing TypeScript workflow. You need to:

- Retain ts-node for direct TypeScript execution in development
- Maintain your current development experience without requiring builds
- Take advantage of Watt's features (hot reload, multi-application support, etc.)
- Keep production builds working as before

**When to use this solution:**

- Migrating existing TypeScript applications to Platformatic Watt
- Teams with established ts-node development workflows
- Applications that need Watt's orchestration while keeping TypeScript tooling
- Projects transitioning to Platformatic without rewriting build processes

## Solution Overview

This guide walks you through migrating a standalone TypeScript application to Watt while keeping ts-node. We'll cover:

1. Understanding your current standalone setup
2. Configuring Watt to use ts-node with `execArgv`
3. Adjusting your development and production workflows
4. Handling both ESM and CommonJS module systems

## Your Current Standalone Setup

Before migrating, let's look at a typical standalone TypeScript application structure:

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
  "type": "module",
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

**tsconfig.json:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "outDir": "dist",
    "strict": true
  }
}
```

**src/index.ts:**

```typescript
import { createServer } from 'node:http'

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ message: 'Hello World' }))
})

server.listen(3000, () => {
  console.log('Server listening on port 3000')
})
```

You run `npm run dev` to start development with ts-node, and everything works. Now let's migrate this to Watt.

## Migration Steps

This migration uses the standalone Node.js capability approach for a simpler single-application setup.

### Step 1: Install Dependencies

```bash
npm install wattpm @platformatic/globals @platformatic/node
npm install -D @platformatic/tsconfig
```

### Step 2: Create Watt Configuration

**Create `watt.json` in your project root (for ESM applications):**

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/node/3.25.0.json",
  "runtime": {
    "application": {
      "execArgv": ["--no-warnings", "--loader", "ts-node/esm"],
      "commands": {
        "build": "tsc"
      }
    }
  },
  "node": {
    "skipBuildInDevelopment": true
  }
}
```

Key configuration details:

- Uses `@platformatic/node` schema
- `execArgv` passes ts-node ESM loader to Node.js process
- `skipBuildInDevelopment: true` ensures TypeScript runs directly in dev mode

**Note:** For CommonJS applications, use different `execArgv`. See the [Handling CommonJS Applications](#handling-commonjs-applications) section below.

### Step 3: Update Package.json

Keep your application structure mostly the same:

```json
{
  "name": "my-app",
  "main": "src/index.ts",
  "type": "module",
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

## Handling CommonJS Applications

If your application uses CommonJS instead of ESM, you need to use a different `execArgv` configuration.

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/node/3.25.0.json",
  "runtime": {
    "application": {
      "execArgv": ["-r", "ts-node/register"],
      "commands": {
        "build": "tsc"
      }
    }
  },
  "node": {
    "skipBuildInDevelopment": true
  }
}
```

## Advanced Configuration

### Custom TypeScript Compiler Options

You can extend `@platformatic/tsconfig` with your own options:

```json
{
  "extends": "@platformatic/tsconfig",
  "compilerOptions": {
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### Faster Development Startup

If type checking slows down startup, use transpile-only mode:

**For ESM:**

```json
"execArgv": ["--no-warnings", "--loader", "ts-node/esm/transpile-only"]
```

**For CommonJS:**

```json
"execArgv": ["-r", "ts-node/register/transpile-only"]
```

This skips type checking for faster startup. Run `npx tsc --noEmit` separately for type checking.
