# How to Compile TypeScript for Production Deployment

## Important Note

**This guide focuses specifically on Platformatic services (Service, DB, and Composer) that run within Watt.** 

If you're working with basic Node.js applications without Platformatic services, the TypeScript compilation workflow is different and involves standard TypeScript toolchain (tsc, webpack, etc.) rather than the Platformatic-specific commands shown in this guide.

## Problem

Your Watt application uses TypeScript for development, but you need to optimize it for production:
- Automatic TypeScript compilation during startup adds latency and memory usage
- Production environments should use pre-compiled JavaScript for better performance
- You want to avoid shipping TypeScript source files to production
- You need consistent compilation across development and production environments

**When to use this solution:**
- Watt applications using Platformatic Service, DB, or Composer services
- Production deployments where startup time is critical
- Containerized environments with limited resources  
- Applications with large TypeScript codebases across multiple Platformatic services
- CI/CD pipelines that can handle build steps for Platformatic services

## Solution Overview

This guide shows you how to pre-compile TypeScript for Platformatic services before deployment while maintaining flexibility for development. You'll learn to:
1. Configure TypeScript compilation settings for Platformatic Service, DB, and Composer
2. Use different compilation modes for development vs. production
3. Optimize production builds by excluding source files
4. Handle multi-service TypeScript compilation across different Platformatic service types

## Step 1: Configure TypeScript Settings

### Basic TypeScript Configuration

If you've generated your application using `npx wattpm create`, your config file will include TypeScript support. The exact configuration depends on which Platformatic service type you're using:

**For Platformatic Service, DB, or Composer services:**
```json
{
  "plugins": {
    "paths": [{
      "path": "plugins",
      "encapsulate": false
    }, "routes"],
    "typescript": "{PLT_TYPESCRIPT}"
  }
}
```

**Note:** This guide focuses on Platformatic Service, Platformatic DB, and Platformatic Composer services that run within Watt. For basic Node.js applications without these Platformatic services, the TypeScript compilation approach differs significantly.

### Environment Variable Configuration

Configure your `.env` file for development:

```env
# Development - compile TypeScript on-the-fly
PLT_TYPESCRIPT=true
```

Configure your production `.env` file:

```env
# Production - use pre-compiled JavaScript
PLT_TYPESCRIPT=false
```

**Why this approach works:**
- Development gets automatic compilation for fast iteration across all Platformatic services
- Production uses pre-compiled code for optimal performance
- Same configuration file works across environments and service types (Service, DB, Composer)
- Unified TypeScript handling across your entire Watt application

## Step 2: Compile for Production Deployment

### Single Service Compilation

For individual Platformatic services (Service, DB, or Composer) within Watt:

```bash
# Navigate to your service directory
cd web/my-service

# For Platformatic Service
npx platformatic service compile
# Or: plt service compile

# For Platformatic DB
npx platformatic db compile
# Or: plt db compile

# For Platformatic Composer
npx platformatic composer compile
# Or: plt composer compile
```

### Multi-Service (Runtime) Compilation

For Watt applications with multiple Platformatic services (any combination of Service, DB, or Composer):

```bash
# From your main application directory
npx platformatic runtime compile

# Or use the shorter command
plt runtime compile
```

**What this does:**
- Compiles all TypeScript files to JavaScript across all Platformatic services
- Preserves directory structure for each service type
- Generates source maps for debugging
- Validates TypeScript code before compilation
- Handles service-specific compilation requirements

## Step 3: Optimize Production Builds

### Configure Output Directory

To avoid shipping TypeScript source files, configure an output directory:

```json
{
  "plugins": {
    "paths": [{
      "path": "plugins",
      "encapsulate": false
    }, "routes"],
    "typescript": {
      "enabled": "{PLT_TYPESCRIPT}",
      "outDir": "dist"
    }
  }
}
```

**Benefits of using `outDir`:**
- Separates compiled JavaScript from TypeScript source
- Enables cleaner production deployments
- Reduces deployment package size
- Improves security by not exposing source code

### TypeScript Configuration File

Create a `tsconfig.json` for optimal production builds:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true,
    "removeComments": true
  },
  "include": [
    "plugins/**/*",
    "routes/**/*",
    "lib/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "test/**/*"
  ]
}
```

## Step 4: Update Package.json Scripts

Add build scripts to your `package.json`:

```json
{
  "scripts": {
    "dev": "wattpm dev",
    "build": "plt runtime compile",
    "build:service": "plt service compile",
    "start": "wattpm start",
    "clean": "rm -rf dist"
  }
}
```

## Step 5: Verification and Testing

### Verify Compilation

**1. Test compilation locally:**
```bash
# Clean any previous builds
npm run clean

# Compile TypeScript
npm run build

# Check compiled output
ls -la dist/  # Should show compiled .js files
```

**2. Test compiled application:**
```bash
# Set production environment
export PLT_TYPESCRIPT=false

# Start with compiled code
npm start

# Verify endpoints work
curl http://localhost:3042/
```

### Verify Production Environment

**1. Check that TypeScript is disabled:**
```bash
# In production environment
echo $PLT_TYPESCRIPT  # Should output: false
```

**2. Verify faster startup:**
```bash
# Time the startup with compiled code
time npm start
```

**Expected results:**
- Faster application startup
- Lower memory usage during startup
- No TypeScript compilation logs

## Docker Integration

### Multi-Stage Dockerfile with TypeScript

```dockerfile
# Build stage
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
COPY --parents ./web/*/package.json ./

RUN npm install

COPY . .
RUN npm run build

# Production stage  
FROM node:20-alpine AS production

WORKDIR /app

# Copy compiled code and production dependencies
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
COPY --from=build /app/watt.json ./

RUN npm install --omit=dev

ENV PLT_TYPESCRIPT=false
ENV HOSTNAME=0.0.0.0
ENV PORT=3042

EXPOSE 3042

CMD ["npm", "start"]
```

## Troubleshooting

### Compilation Errors

**Problem:** TypeScript compilation fails with type errors

**Solutions:**
- Run `tsc --noEmit` to check types without compilation
- Fix TypeScript errors in source files
- Update `tsconfig.json` strictness settings
- Check that all dependencies have proper type definitions

### Runtime Errors with Compiled Code

**Problem:** Application works in development but fails with compiled code

**Solutions:**
- Verify all files were compiled (check `dist/` directory)
- Ensure import paths are correct in compiled code
- Check that `outDir` configuration matches runtime expectations
- Verify environment variables are set correctly (`PLT_TYPESCRIPT=false`)

### Missing Files in Production

**Problem:** Some files missing after compilation

**Solutions:**
- Check `tsconfig.json` include/exclude patterns
- Verify that all necessary files are being compiled
- Ensure non-TypeScript files are copied to output directory
- Check that paths in configuration match compiled output

### Performance Issues

**Problem:** Compilation is too slow

**Solutions:**
- Use incremental compilation: `"incremental": true` in `tsconfig.json`
- Exclude unnecessary files in `tsconfig.json`
- Use TypeScript project references for large projects
- Consider parallel compilation for multi-service projects

## Next Steps

Now that you have optimized TypeScript compilation:

- **[Dockerize your application](/docs/guides/deployment/dockerize-a-watt-app)** - Container deployment with compiled code
- **[Set up Kubernetes health checks](/docs/guides/deployment/k8s-readiness-liveness)** - Production orchestration
- **[Configure monitoring](/docs/guides/monitoring)** - Track performance improvements
- **[Set up CI/CD pipelines](/docs/guides/ci-cd)** - Automate compilation and deployment
