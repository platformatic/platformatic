# How to Use Watt with Multiple Repository Applications

## Problem

You need to build a microservices application where:

- Applications are developed and maintained in separate Git repositories
- Different teams work on different applications independently
- You want to combine applications from multiple repos into a single Watt application
- You need flexible application resolution for local development vs. production

**When to use this solution:**

- Large organizations with multiple development teams
- Microapplications architectures with independent application deployment
- Need to combine applications from different repositories for integration testing
- Want to maintain application independence while enabling orchestration

## Solution Overview

Watt's multi-repository application resolution allows you to:

1. Define applications from different Git repositories in your project
2. Automatically resolve and integrate applications from remote repositories
3. Override application locations for local development
4. Build and deploy unified applications from distributed applications

This guide shows you how to set up and manage a Watt application with multi-repository applications.

## Prerequisites

Before starting, ensure you have:

- [Node.js](https://nodejs.org/en) (v22.19.0+)
- [npm](https://www.npmjs.com/package/npm) (comes with Node.js)
- Git access to your application repositories
- A code editor (e.g., [Visual Studio Code](https://code.visualstudio.com))

## Step 1: Create Your Project

**1. Configure application resolution in package.json:**

```json
{
  "name": "my-microservices-app",
  "private": true,
  "scripts": {
    "dev": "wattpm dev",
    "resolve": "wattpm-utils resolve",
    "build": "wattpm build",
    "start": "wattpm start"
  },
  "dependencies": {
    "@platformatic/runtime": "^3.0.0",
    "@platformatic/next": "^3.0.0",
    "@platformatic/node": "^3.0.0",
    "wattpm": "^3.0.0",
    "wattpm-utils": "^3.0.0"
  },
  "workspaces": ["web/*", "external/*"]
}
```

**2. Create directory structure for applications:**

```bash
mkdir -p web/ external/
```

**What this setup provides:**

- `web/` - Directory for resolved web applications
- `external/` - Directory for resolved external applications
- `wattpm-utils resolve` command for application resolution
- Workspace configuration for multi-application management

## Step 2: Configure Multi-Repository Services

### Define Services in watt.json

Configure your `watt.json` to include applications from multiple repositories:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/runtime/3.0.0.json",
  "web": [
    {
      "id": "gateway",
      "path": "web/gateway"
    },
    {
      "id": "user-application",
      "path": "{PLT_USER_SERVICE_PATH}",
      "url": "https://github.com/your-org/user-application.git"
    },
    {
      "id": "product-application",
      "path": "{PLT_PRODUCT_SERVICE_PATH}",
      "url": "https://github.com/your-org/product-application.git"
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

- **Local applications** (like `gateway`) use direct paths
- **Remote applications** use environment variables for paths + Git URLs
- **Environment variables** allow flexible local vs. remote resolution
- **Git URLs** define where to fetch applications when not available locally

### Repository Architecture Example

```
Organization Structure:
├── my-microservices-app/          # Watt runtime orchestration
│   ├── watt.json                  # Service definitions
│   ├── package.json               # Workspace configuration
│   └── web/                       # Resolved applications appear here
├── user-application/                  # Separate repository
│   ├── package.json
│   └── platformatic.json
├── product-application/               # Separate repository
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
# Local application paths (when developing locally)
PLT_USER_SERVICE_PATH=../user-application
PLT_PRODUCT_SERVICE_PATH=../product-application
PLT_FRONTEND_PATH=../nextjs-frontend

# Production paths (when applications are resolved from Git)
# PLT_USER_SERVICE_PATH=web/user-application
# PLT_PRODUCT_SERVICE_PATH=web/product-application
# PLT_FRONTEND_PATH=web/frontend
```

### Production Configuration

For production deployments, applications are resolved from Git repositories:

```env
# Production environment - applications resolved from Git
PLT_USER_SERVICE_PATH=web/user-application
PLT_PRODUCT_SERVICE_PATH=web/product-application
PLT_FRONTEND_PATH=web/frontend
```

### Git Configuration

Update your project repository's `.gitignore`:

```gitignore
# Ignore resolved applications - they come from other repos
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

**Why ignore resolved applications:**

- Services are pulled from their own repositories
- Prevents committing resolved application code to project repo
- Keeps project repo focused on orchestration configuration

## Step 4: Resolve and Run Services

### Resolve Services from Repositories

**1. Resolve all applications:**

```bash
npm run resolve
```

**What this does:**

- Clones applications from Git repositories if not found locally
- Installs dependencies for each resolved application
- Links applications according to workspace configuration
- Prepares applications for building and running

**2. Verify application resolution:**

```bash
ls -la web/
# Should show resolved applications: user-application, product-application, frontend
```

### Build and Start Your Application

**1. Build all applications:**

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

**1. Check that applications were resolved correctly:**

```bash
# List resolved applications
ls -la web/

# Verify application configurations
cat web/user-application/package.json
cat web/product-application/platformatic.json
```

**2. Test application connectivity:**

```bash
# Start the application
npm run dev

# Test individual applications (if exposed)
curl http://localhost:3042/users/health
curl http://localhost:3042/products/health
curl http://localhost:3042/
```

### Local Development Workflow

**For active development on specific applications:**

```bash
# Set up local development
export PLT_USER_SERVICE_PATH=../user-application-local
export PLT_PRODUCT_SERVICE_PATH=web/product-application  # Use resolved version

# Resolve with mixed local/remote applications
npm run resolve

# Start development server
npm run dev
```

**Benefits of this approach:**

- Develop locally on applications you're working on
- Use stable versions of other applications from Git
- Quickly switch between local and remote application versions
- Test integration without affecting other applications

## Troubleshooting

### Service Resolution Fails

**Problem:** `npm run resolve` fails to clone or resolve applications

**Solutions:**

- Verify Git repository URLs are accessible
- Check that you have proper Git authentication (SSH keys/tokens)
- Ensure environment variables are set correctly
- Verify network connectivity to Git repositories

### Services Not Starting

**Problem:** Resolved applications fail to start

**Solutions:**

- Check that application dependencies were installed (`npm run resolve` again)
- Verify application configurations are valid
- Check port conflicts between applications
- Review application logs for specific errors

### Local Development Issues

**Problem:** Local applications not being used despite environment variables

**Solutions:**

- Verify environment variables are exported in current shell
- Check that local application paths exist and contain valid application code
- Ensure local applications have proper `package.json` and configuration files
- Try resolving again: `npm run resolve`

### Build Failures

**Problem:** `npm run build` fails for resolved applications

**Solutions:**

- Ensure all applications have proper build scripts in `package.json`
- Check that application dependencies are installed
- Verify application configurations are valid
- Try building individual applications to isolate issues

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

      - name: Resolve applications from Git
        env:
          PLT_USER_SERVICE_PATH: web/user-application
          PLT_PRODUCT_SERVICE_PATH: web/product-application
          PLT_FRONTEND_PATH: web/frontend
        run: npm run resolve

      - name: Build application
        run: npm run build

      - name: Deploy to production
        run: npm run deploy
```

### Service Versioning

Pin specific application versions by using Git tags in URLs:

```json
{
  "web": [
    {
      "id": "user-application",
      "path": "web/user-application",
      "url": "https://github.com/your-org/user-application.git#v1.2.3"
    }
  ]
}
```

## Next Steps

Now that you have multi-repository applications working:

- **[Monitoring with Prometheus and Grafana](/docs/guides/monitoring)** - Monitor all applications from one place
- **[How to Dockerize Your Watt Application](/docs/guides/deployment/dockerize-a-watt-app)** - Deploy your multi-application application

## Additional Resources

- [wattpm-resolve sample application](https://github.com/platformatic/wattpm-resolve) - Complete working example
- [Watt Quick Start](/docs/getting-started/quick-start-watt) - Basic Watt application setup
