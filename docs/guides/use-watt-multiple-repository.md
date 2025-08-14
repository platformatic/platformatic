# How to Use Watt with Multiple Repository Services

## Problem

You need to build a microservices application where:
- Services are developed and maintained in separate Git repositories
- Different teams work on different services independently
- You want to combine services from multiple repos into a single Watt application
- You need flexible service resolution for local development vs. production

**When to use this solution:**
- Large organizations with multiple development teams
- Microservices architectures with independent service deployment
- Need to combine services from different repositories for integration testing
- Want to maintain service independence while enabling orchestration

## Solution Overview

Watt's multi-repository service resolution allows you to:
1. Define services from different Git repositories in your main application
2. Automatically resolve and integrate services from remote repositories  
3. Override service locations for local development
4. Build and deploy unified applications from distributed services

This guide shows you how to set up and manage a Watt application with multi-repository services.

## Prerequisites

Before starting, ensure you have:

- [Node.js](https://nodejs.org/en) (v20.16.0+ or v22.3.0+)
- [npm](https://www.npmjs.com/package/npm) (v10 or higher)
- Git access to your service repositories
- A code editor (e.g., [Visual Studio Code](https://code.visualstudio.com))

## Step 1: Create Your Main Watt Application

**1. Initialize a new Watt application:**
```bash
mkdir my-microservices-app
cd my-microservices-app
npx wattpm@latest create
```

**2. Configure service resolution in package.json:**

```json
{
  "name": "my-microservices-app",
  "private": true,
  "scripts": {
    "dev": "wattpm dev",
    "resolve": "wattpm resolve",
    "build": "wattpm build",
    "start": "wattpm start"
  },
  "dependencies": {
    "@platformatic/runtime": "^2.21.0",
    "@platformatic/next": "^2.21.0", 
    "@platformatic/node": "^2.21.0",
    "wattpm": "^2.21.0"
  },
  "workspaces": [
    "web/*",
    "external/*"
  ]
}
```

**3. Create directory structure for services:**
```bash
mkdir -p web/ external/
```

**What this setup provides:**
- `web/` - Directory for resolved web services
- `external/` - Directory for resolved external services  
- `wattpm resolve` command for service resolution
- Workspace configuration for multi-service management

## Step 2: Configure Multi-Repository Services

### Define Services in watt.json

Configure your `watt.json` to include services from multiple repositories:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/runtime/2.21.0.json",
  "web": [
    {
      "id": "composer",
      "path": "web/composer"
    },
    {
      "id": "user-service",
      "path": "{PLT_USER_SERVICE_PATH}",
      "url": "https://github.com/your-org/user-service.git"
    },
    {
      "id": "product-service", 
      "path": "{PLT_PRODUCT_SERVICE_PATH}",
      "url": "https://github.com/your-org/product-service.git"
    },
    {
      "id": "frontend",
      "path": "{PLT_FRONTEND_PATH}",
      "url": "https://github.com/your-org/nextjs-frontend.git"
    }
  ]
}
```

**Configuration explanation:**
- **Local services** (like `composer`) use direct paths
- **Remote services** use environment variables for paths + Git URLs
- **Environment variables** allow flexible local vs. remote resolution
- **Git URLs** define where to fetch services when not available locally

### Repository Architecture Example

```
Organization Structure:
├── my-microservices-app/          # Main orchestration app
│   ├── watt.json                  # Service definitions
│   ├── package.json               # Workspace configuration
│   └── web/                       # Resolved services appear here
├── user-service/                  # Separate repository
│   ├── package.json
│   └── platformatic.json
├── product-service/               # Separate repository  
│   ├── package.json
│   └── platformatic.json
└── nextjs-frontend/               # Separate repository
    ├── package.json
    └── next.config.js
```

## Step 3: Configure Environment Variables

### Local Development Configuration

Create a `.env` file for local development:

```env
# Local service paths (when developing locally)
PLT_USER_SERVICE_PATH=../user-service
PLT_PRODUCT_SERVICE_PATH=../product-service  
PLT_FRONTEND_PATH=../nextjs-frontend

# Production paths (when services are resolved from Git)
# PLT_USER_SERVICE_PATH=web/user-service
# PLT_PRODUCT_SERVICE_PATH=web/product-service
# PLT_FRONTEND_PATH=web/frontend
```

### Production Configuration

For production deployments, services are resolved from Git repositories:

```env
# Production environment - services resolved from Git
PLT_USER_SERVICE_PATH=web/user-service
PLT_PRODUCT_SERVICE_PATH=web/product-service
PLT_FRONTEND_PATH=web/frontend
```

### Git Configuration

Update your main repository's `.gitignore`:

```gitignore
# Ignore resolved services - they come from other repos
web/*
external/*
!web/.gitkeep
!external/.gitkeep

# Standard Node.js ignores
node_modules/
.env
.env.local
dist/
build/
```

**Why ignore resolved services:**
- Services are pulled from their own repositories
- Prevents committing resolved service code to main repo
- Keeps main repo focused on orchestration configuration

## Step 4: Resolve and Run Services

### Resolve Services from Repositories

**1. Resolve all services:**
```bash
npm run resolve
```

**What this does:**
- Clones services from Git repositories if not found locally
- Installs dependencies for each resolved service
- Links services according to workspace configuration
- Prepares services for building and running

**2. Verify service resolution:**
```bash
ls -la web/
# Should show resolved services: user-service, product-service, frontend
```

### Build and Start Your Application

**1. Build all services:**
```bash
npm run build
```

**2. Start in development mode:**
```bash
npm run dev
```

**3. Start in production mode:**
```bash
npm run start
```

## Step 5: Verification and Testing

### Verify Service Resolution

**1. Check that services were resolved correctly:**
```bash
# List resolved services
ls -la web/

# Verify service configurations
cat web/user-service/package.json
cat web/product-service/platformatic.json
```

**2. Test service connectivity:**
```bash
# Start the application
npm run dev

# Test individual services (if exposed)
curl http://localhost:3042/users/health
curl http://localhost:3042/products/health
curl http://localhost:3042/
```

### Local Development Workflow

**For active development on specific services:**

```bash
# Set up local development
export PLT_USER_SERVICE_PATH=../user-service-local
export PLT_PRODUCT_SERVICE_PATH=web/product-service  # Use resolved version

# Resolve with mixed local/remote services
npm run resolve

# Start development server
npm run dev
```

**Benefits of this approach:**
- Develop locally on services you're working on
- Use stable versions of other services from Git
- Quickly switch between local and remote service versions
- Test integration without affecting other services

## Troubleshooting

### Service Resolution Fails

**Problem:** `npm run resolve` fails to clone or resolve services

**Solutions:**
- Verify Git repository URLs are accessible
- Check that you have proper Git authentication (SSH keys/tokens)
- Ensure environment variables are set correctly
- Verify network connectivity to Git repositories

### Services Not Starting

**Problem:** Resolved services fail to start

**Solutions:**
- Check that service dependencies were installed (`npm run resolve` again)
- Verify service configurations are valid
- Check port conflicts between services
- Review service logs for specific errors

### Local Development Issues  

**Problem:** Local services not being used despite environment variables

**Solutions:**
- Verify environment variables are exported in current shell
- Check that local service paths exist and contain valid service code
- Ensure local services have proper `package.json` and configuration files
- Try resolving again: `npm run resolve`

### Build Failures

**Problem:** `npm run build` fails for resolved services

**Solutions:**
- Ensure all services have proper build scripts in `package.json`
- Check that service dependencies are installed
- Verify service configurations are valid
- Try building individual services to isolate issues

## Advanced Patterns

### CI/CD Pipeline Configuration

```yaml
# .github/workflows/deploy.yml
name: Deploy Multi-Repo App
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Resolve services from Git
        env:
          PLT_USER_SERVICE_PATH: web/user-service
          PLT_PRODUCT_SERVICE_PATH: web/product-service
          PLT_FRONTEND_PATH: web/frontend
        run: npm run resolve
        
      - name: Build application  
        run: npm run build
        
      - name: Deploy to production
        run: npm run deploy
```

### Service Versioning

Pin specific service versions by using Git tags in URLs:

```json
{
  "web": [
    {
      "id": "user-service",
      "path": "web/user-service",
      "url": "https://github.com/your-org/user-service.git#v1.2.3"
    }
  ]
}
```

## Next Steps

Now that you have multi-repository services working:

- **[Set up monitoring](/docs/guides/monitoring)** - Monitor all services from one place
- **[Configure deployment](/docs/guides/deployment/)** - Deploy your multi-service application
- **[Add inter-service communication](/docs/guides/service-communication/)** - Enable services to communicate securely
- **[Implement service discovery](/docs/guides/service-mesh/)** - Advanced service orchestration patterns

## Additional Resources

- [wattpm-resolve sample application](https://github.com/platformatic/wattpm-resolve) - Complete working example
- [Watt Setup Guide](/docs/getting-started/quick-start-watt) - Basic Watt application setup
- [Service Development Guide](/docs/guides/service-development/) - Best practices for individual services