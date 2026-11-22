# Cloud Platform Deployment for Platformatic Watt

## Watt 4 hosting contract

Preserve existing provider files and check current provider schemas/runtime support.
Watt 4 requires **Node.js 24.20.0+**, compatible production capability packages, complete
build/workspace output, and `wattpm build` before `wattpm start`. Prefer a verified
container image when the provider's managed Node version cannot satisfy the requirement.

The templates use `HOST`, `PORT`, and `LOG_LEVEL`, which must be explicitly read by the
owning capability/root configuration. Preserve existing variable names when integrating,
but Watt no longer injects/rewrites listener ports. Match the provider's actual public
port and bind `0.0.0.0` on that application; keep metrics/control private. Every `/health`
below assumes an implemented route with the correct Gateway prefix, not a built-in endpoint.

Installation, login, secret changes, provisioning, scaling, image publishing, and deployment
need separate authorization. Never execute downloaded installer scripts automatically.
Do not put real secrets in CLI examples/history. All provider snippets below require
review against current provider APIs, plans, IAM, and health/resource requirements;
they are not verified deployment results. See [Docker](docker.md) for Watt-preserving images.

## Fly.io

### Installation
```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
fly auth login
```

### Configuration

Create `fly.toml`:
```toml
app = "my-watt-app"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  HOST = "0.0.0.0"
  LOG_LEVEL = "info"
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

[[http_service.checks]]
  grace_period = "10s"
  interval = "30s"
  method = "GET"
  path = "/health"
  timeout = "5s"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512
```

### Deployment Commands
```bash
# Launch new app
fly launch

# Deploy
fly deploy

# Set secrets
fly secrets set DATABASE_URL="postgresql://..." SESSION_SECRET="..."

# Scale
fly scale count 3

# View logs
fly logs

# SSH into machine
fly ssh console
```

---

## Railway

### Configuration

Create `railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "numReplicas": 1,
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

Or use `railway.toml`:
```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 30
numReplicas = 1
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

### Deployment
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up

# Set environment variables
railway variables set NODE_ENV=production
railway variables set DATABASE_URL="postgresql://..."

# View logs
railway logs
```

---

## Render

### Configuration

Create `render.yaml`:
```yaml
services:
  - type: web
    name: watt-app
    env: node
    region: oregon
    plan: starter
    buildCommand: npm ci && npm run build
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: HOST
        value: 0.0.0.0
      - key: LOG_LEVEL
        value: info
      - key: DATABASE_URL
        fromDatabase:
          name: watt-db
          property: connectionString
    autoDeploy: true
    scaling:
      minInstances: 1
      maxInstances: 3
      targetMemoryPercent: 80
      targetCPUPercent: 70

databases:
  - name: watt-db
    plan: starter
    region: oregon
```

### Deployment
1. Connect GitHub repository to Render
2. Create new Web Service
3. Select repository
4. Render auto-detects settings from `render.yaml`
5. Add environment variables in dashboard
6. Deploy

---

## Vercel

**Not a Watt runtime target in this guide**: Standard Vercel Next.js/serverless hosting
runs the framework's deployment adapter, not a persistent Watt runtime with worker/mesh
orchestration. Use a supported long-running container platform for Watt. The example below
is framework-only hosting and must not be advertised as deploying Watt itself.

### Framework-only Next.js alternative

Create `vercel.json`:
```json
{
  "buildCommand": "next build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["iad1"],
  "env": {
    "LOG_LEVEL": "info"
  }
}
```

### Deployment
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Production deploy
vercel --prod

# Set environment variables
vercel env add DATABASE_URL
```

---

## DigitalOcean App Platform

### Configuration

Create `app.yaml` (for DO App Spec):
```yaml
name: watt-app
region: nyc
services:
  - name: web
    dockerfile_path: Dockerfile
    github:
      repo: your-username/your-repo
      branch: main
      deploy_on_push: true
    http_port: 3000
    instance_count: 2
    instance_size_slug: basic-xxs
    health_check:
      http_path: /health
      initial_delay_seconds: 10
      period_seconds: 30
    envs:
      - key: NODE_ENV
        value: production
      - key: HOST
        value: "0.0.0.0"
      - key: LOG_LEVEL
        value: info
      - key: DATABASE_URL
        scope: RUN_TIME
        type: SECRET
    routes:
      - path: /

databases:
  - name: db
    engine: PG
    version: "16"
    size: db-s-dev-database
```

### Deployment
```bash
# Install doctl
brew install doctl

# Authenticate
doctl auth init

# Create app
doctl apps create --spec app.yaml

# Update app
doctl apps update <app-id> --spec app.yaml

# View logs
doctl apps logs <app-id>
```

---

## AWS (Elastic Beanstalk)

### Configuration

Create `.ebextensions/nodecommand.config`:
```yaml
option_settings:
  aws:elasticbeanstalk:container:nodejs:
    NodeCommand: "npm start"
  aws:elasticbeanstalk:application:environment:
    NODE_ENV: production
    HOST: "0.0.0.0"
    LOG_LEVEL: info
```

Create `Procfile`:
```
web: npm start
```

### Deployment
```bash
# Install EB CLI
pip install awsebcli

# Initialize
eb init

# Create environment
eb create watt-app-prod

# Deploy
eb deploy

# Set environment variables
eb setenv DATABASE_URL="postgresql://..."

# View logs
eb logs
```

---

## Google Cloud Run

### Deployment
```bash
# Build and push to Container Registry
gcloud builds submit --tag gcr.io/PROJECT_ID/watt-app

# Deploy
gcloud run deploy watt-app \
  --image gcr.io/PROJECT_ID/watt-app \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production,HOST=0.0.0.0,LOG_LEVEL=info,PORT=3000"

# Set secrets
gcloud run services update watt-app \
  --set-secrets "DATABASE_URL=database-url:latest"
```

---

## Azure Container Apps

### Deployment
```bash
# Create resource group
az group create --name watt-app-rg --location eastus

# Create Container Apps environment
az containerapp env create \
  --name watt-app-env \
  --resource-group watt-app-rg \
  --location eastus

# Deploy
az containerapp create \
  --name watt-app \
  --resource-group watt-app-rg \
  --environment watt-app-env \
  --image your-registry/watt-app:latest \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 10 \
  --env-vars "NODE_ENV=production" "HOST=0.0.0.0" "PORT=3000"
```

---

## Common Environment Variables

Document only the variables actually read by the selected application/configuration.
These are conventional examples, not automatic Watt-injected settings:
```
NODE_ENV=production
HOST=0.0.0.0
LOG_LEVEL=info
PORT=3000 (or platform-specific)
```

## Health Check Endpoint

For an Express app where this route is intentionally implemented, `/health` can be:
```javascript
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});
```
