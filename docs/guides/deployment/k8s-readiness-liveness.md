# How to Configure Kubernetes Health Checks with Watt

## Problem

You're deploying Watt applications to Kubernetes and need robust health checking that:
- Prevents traffic from reaching unhealthy pods
- Automatically restarts failed containers
- Handles complex health dependencies (databases, external services)
- Provides proper startup time for initialization
- Integrates with Kubernetes orchestration patterns

**When to use this solution:**
- Production Kubernetes deployments
- Applications with external dependencies that need health validation
- Services requiring zero-downtime deployments
- Complex multi-service applications where service health interdependencies matter

## Solution Overview

This guide shows you how to implement comprehensive Kubernetes health checks using Watt's built-in health endpoints. You'll learn to:
1. Configure readiness and liveness probes properly
2. Implement custom health checks for your application dependencies  
3. Set appropriate probe timing and thresholds
4. Handle startup scenarios and graceful shutdowns

## Understanding Kubernetes Health Probes

Kubernetes uses [probes](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#container-probes) to determine application health:

- **Readiness Probe**: Determines if the pod is ready to receive traffic. Failed readiness removes the pod from service endpoints.
- **Liveness Probe**: Determines if the container should be restarted. Failed liveness triggers container restart by Kubernetes.
- **Startup Probe**: Provides extra time for slow-starting containers. Disables readiness and liveness probes until startup succeeds.

## Prerequisites

Before implementing Kubernetes health checks, you need:

- **Node.js 20.3+** installed on your development machine
- **Docker** for containerization
- **Kubernetes cluster** access (local or cloud)
- **kubectl** configured to access your cluster

## Installation

**1. Create a new Watt application:**
```bash
npx wattpm@latest create my-health-app
cd my-health-app
```

## Platformatic Health Check APIs

Platformatic Watt provides built-in health check endpoints through its metrics server. The metrics server exposes the following endpoints by default:

- **`/ready`** (Readiness endpoint): Indicates if all services are started and ready to accept traffic
- **`/status`** (Liveness endpoint): Indicates if all services are healthy and their custom health checks pass

### Endpoint Customization

You can customize the health check endpoints in your Watt configuration:

```json
{
  "metrics": {
    "hostname": "0.0.0.0",
    "port": 9090,
    "readiness": {
      "endpoint": "/health"
    },
    "liveness": {
      "endpoint": "/live"
    }
  }
}
```

### Service Discovery and Autoload

By default, Watt automatically loads all services in the `web` folder via the autoload configuration. You don't need to manually specify each service in the configuration. Watt will:

- Discover all valid Platformatic services in this directory
- Automatically register them in the runtime
- Include them in health check evaluations
- Expose their metrics through the metrics server

This autoload behavior simplifies deployment and ensures all your services are automatically included in the health monitoring system.

### Custom Health Check Functions

- **`setCustomHealthCheck`**: Sets a custom liveness check function that runs on the `/status` (or custom liveness) endpoint
- **`setCustomReadinessCheck`**: Sets a custom readiness check function that runs on the `/ready` (or custom readiness) endpoint

Both methods accept a function that returns:
- A `boolean` value (`true` = healthy, `false` = unhealthy)
- An object with:
  - `status`: boolean indicating success/failure
  - `statusCode`: optional HTTP status code (defaults to 200/500)
  - `body`: optional response body

## Implementation

### 1. Service Implementation with Custom Health Checks

Create a Platformatic service that implements comprehensive health checks:

```javascript
import fastify from 'fastify'

export function create () {
  const app = fastify({ 
    logger: true
  })

  // Register custom liveness check (for /status endpoint)
  globalThis.platformatic.setCustomHealthCheck(async () => {
    try {
      // Example: Check database connectivity
      if (app.hasDecorator('db')) {
        await app.db.query('SELECT 1')
      }
      
      // Example: Check external service health
      const response = await fetch('https://api.external-service.com/health', {
        timeout: 5000
      })
      
      if (!response.ok) {
        return {
          status: false,
          statusCode: 503,
          body: 'External service unavailable'
        }
      }
      
      return { status: true }
    } catch (err) {
      app.log.error({ err }, 'Health check failed')
      return {
        status: false,
        statusCode: 503,
        body: `Health check failed: ${err.message}`
      }
    }
  })

  // Register custom readiness check (for /ready endpoint)
  globalThis.platformatic.setCustomReadinessCheck(async () => {
    try {
      // Basic service readiness checks
      // These should be fast and lightweight
      
      // Check if critical dependencies are initialized
      if (app.hasDecorator('db') && !app.db.pool) {
        return false
      }
      
      return true
    } catch (err) {
      app.log.error({ err }, 'Readiness check failed')
      return false
    }
  })

  // Add application routes
  app.get('/', async () => {
    return { message: 'Service is running' }
  })

  return app
}
```

### 2. Watt Configuration

Configure the metrics server in your `watt.json` file:

```json
{
  "metrics": {
    "hostname": "0.0.0.0",
    "port": 9090,
    "readiness": {
      "success": {
        "statusCode": 200,
        "body": "Ready"
      },
      "fail": {
        "statusCode": 503,
        "body": "Not Ready"
      }
    },
    "liveness": {
      "success": {
        "statusCode": 200,
        "body": "Healthy"
      },
      "fail": {
        "statusCode": 503,
        "body": "Unhealthy"
      }
    }
  }
}
```

### 3. Kubernetes Configuration

Create a Kubernetes deployment configuration that defines the probes:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: watt-health-app
  labels:
    app: watt-health-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: watt-health-app
  template:
    metadata:
      labels:
        app: watt-health-app
    spec:
      containers:
      - name: watt-app
        image: watt-health-app:latest
        ports:
        - containerPort: 3042
          name: service
        - containerPort: 9090
          name: metrics
        env:
        - name: PLT_SERVER_HOSTNAME
          value: "0.0.0.0"
        readinessProbe:
          httpGet:
            path: /ready
            port: 9090
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          successThreshold: 1
          failureThreshold: 3
        livenessProbe:
          httpGet:
            path: /status
            port: 9090
          initialDelaySeconds: 30
          periodSeconds: 30
          timeoutSeconds: 10
          failureThreshold: 3
        startupProbe:
          httpGet:
            path: /ready
            port: 9090
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 5
          failureThreshold: 20  # Allow up to 100 seconds for startup
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

Key configuration points:

- **Startup Probe**: Allows up to 100 seconds for application initialization
- **Readiness Probe**: Checks `/ready` endpoint every 10 seconds after startup
- **Liveness Probe**: Checks `/status` endpoint every 30 seconds after startup
- **Environment Variables**: `PLT_SERVER_HOSTNAME=0.0.0.0` ensures the app binds to all interfaces

**Important Timing Considerations:**
- Startup probe runs first and disables other probes until successful
- Readiness probe has lower failure threshold for faster traffic removal
- Liveness probe has higher failure threshold to avoid unnecessary restarts
- Timeout values account for potential network latency

### 4. Docker Configuration

Create a `Dockerfile` for your Watt application:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose ports
EXPOSE 3042 9090

# Set environment variables
ENV PLT_SERVER_HOSTNAME=0.0.0.0
ENV NODE_ENV=production

# Health check for Docker
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:9090/ready || exit 1

# Start the application
CMD ["npm", "start"]
```

## Watt Internal Service Communication

Watt provides a built-in service mesh that enables zero-configuration communication between services using the `.plt.local` domain. This is crucial for implementing proper health checks in multi-service applications.

### Architecture Overview

The following diagram illustrates how services communicate within a Watt application for health checks in Kubernetes:

```mermaid
graph TB
    subgraph "Kubernetes Pod"
        subgraph "Watt Runtime"
            subgraph "Service Mesh"
                Router[Internal Router]
                Discovery["Service Discovery<br/>(.plt.local)"]
            end
            
            subgraph "Services"
                Gateway["Gateway Service<br/>(Composer)<br/>:3001"]
                API["API Service<br/>(Backend)<br/>:3002"] 
                Worker["Worker Service<br/>(Background)<br/>:3003"]
            end
            
            subgraph "Health Monitoring"
                Metrics["Metrics Server<br/>:9090"]
                Health["/ready, /status"]
            end
        end
    end
    
    subgraph "External"
        K8s[Kubernetes Probes]
        Client[External Clients]
    end
    
    %% Health check flows
    K8s --> |"GET /ready<br/>GET /status"| Metrics
    Metrics --> |"Check service health"| Gateway
    Metrics --> |"Check service health"| API  
    Metrics --> |"Check service health"| Worker
    
    %% Internal service communication
    Gateway --> |"fetch('http://api.plt.local/health')"| Router
    Gateway --> |"fetch('http://worker.plt.local/health')"| Router
    Router --> API
    Router --> Worker
    
    %% External access
    Client --> |"External requests"| Gateway
    
    %% Service discovery
    Discovery -.-> |"Resolves .plt.local"| Router
    
    style Metrics fill:#e1f5fe
    style Health fill:#e8f5e8
    style Router fill:#fff3e0
    style Discovery fill:#fff3e0
```

### Key Communication Patterns:

1. **Kubernetes Health Probes** → Metrics server (`:9090/ready`, `:9090/status`)
2. **Metrics Server** → Individual services for health verification
3. **Inter-Service Health Checks** → Via `.plt.local` domain (e.g., `http://api.plt.local/health`)
4. **External Traffic** → Gateway service (composer) for API aggregation

### Internal Fetch with Automatic Service Discovery

Services within a Watt application can communicate with each other using the automatic service discovery:

```javascript
// Health check for internal services using Watt's service mesh
globalThis.platformatic.setCustomHealthCheck(async () => {
  try {
    const healthChecks = await Promise.allSettled([
      // Database service health check
      fetch('http://api.plt.local/health', { timeout: 2000 }),
      
      // Background worker service health check  
      fetch('http://worker.plt.local/health', { timeout: 2000 }),
      
      // Composer gateway health check
      fetch('http://gateway.plt.local/health', { timeout: 2000 })
    ])
    
    const allHealthy = healthChecks.every(result => 
      result.status === 'fulfilled' && result.value.ok
    )
    
    return {
      status: allHealthy,
      body: JSON.stringify({
        service: 'healthy',
        dependencies: healthChecks.map((check, index) => ({
          service: ['api', 'worker', 'gateway'][index],
          status: check.status === 'fulfilled' && check.value.ok ? 'healthy' : 'unhealthy'
        }))
      })
    }
  } catch (error) {
    return { 
      status: false, 
      statusCode: 503,
      body: `Health check failed: ${error.message}`
    }
  }
})
```

### Key Benefits of Watt's Internal Communication:

- **Zero Configuration**: Services are automatically discoverable via `{service-id}.plt.local`
- **No Network Latency**: Communication happens in-process via the service mesh
- **Automatic Load Balancing**: Requests are distributed across service workers
- **Built-in Service Discovery**: No need for external service registry

## Composer Gateway Integration

When using Platformatic Composer as an API gateway within your Watt application, you can implement health checks that verify both the gateway and backend services:

### Composer Service Configuration

Add a composer service to your Watt application structure:

```
├── watt.json               # Main Watt configuration with metrics
├── web/
│   ├── api/                # Backend API service
│   │   ├── platformatic.json
│   │   └── index.js
│   ├── worker/             # Background worker service
│   │   ├── platformatic.json
│   │   └── index.js
│   └── gateway/            # Composer API gateway
│       ├── platformatic.json
│       └── index.js
```

### Gateway Service Health Checks

The composer gateway can implement health checks that verify all backend services:

```javascript
// web/gateway/index.js - Composer gateway with health checks
import fastify from 'fastify'

export function create () {
  const app = fastify({ logger: true })

  // Composer gateway health check - verifies all backend services
  globalThis.platformatic.setCustomHealthCheck(async () => {
    try {
      // Check all services that the gateway proxies to
      const serviceHealths = await Promise.allSettled([
        fetch('http://api.plt.local/health', { timeout: 2000 }),
        fetch('http://worker.plt.local/health', { timeout: 2000 })
      ])
      
      const healthyServices = serviceHealths.filter(result => 
        result.status === 'fulfilled' && result.value.ok
      ).length
      
      if (healthyServices === serviceHealths.length) {
        return {
          status: true,
          body: JSON.stringify({
            gateway: 'healthy',
            upstreamServices: serviceHealths.length,
            healthyServices: healthyServices
          })
        }
      }
      
      return {
        status: false,
        statusCode: 503,
        body: JSON.stringify({
          gateway: 'degraded',
          upstreamServices: serviceHealths.length,
          healthyServices: healthyServices
        })
      }
    } catch (error) {
      return { 
        status: false, 
        statusCode: 503,
        body: `Gateway health check failed: ${error.message}`
      }
    }
  })

  return app
}
```

### Composer Configuration for Health Checks

Configure the composer service in `web/gateway/platformatic.json`:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/composer/2.0.0.json",
  "composer": {
    "services": [
      {
        "id": "api",
        "origin": "http://api.plt.local",
        "openapi": {
          "url": "/documentation/json"
        }
      },
      {
        "id": "worker",
        "origin": "http://worker.plt.local",
        "proxy": {
          "prefix": "/worker"
        }
      }
    ],
    "refreshTimeout": 1000
  },
  "plugins": {
    "paths": ["./index.js"]
  }
}
```

This configuration creates an API gateway that:
- Proxies requests to backend services using their internal `.plt.local` addresses
- Automatically refreshes service configurations
- Implements health checks for all upstream services

## How It Works

1. **Startup Phase**: 
   - Kubernetes starts the container and waits for the startup probe to succeed
   - The startup probe gives the application time to initialize (up to 100 seconds in our example)
   - Readiness and liveness probes are disabled during this phase

2. **Readiness Check** (`/ready` endpoint):
   - Checks if all Watt services have started successfully
   - Runs your custom readiness check functions
   - If successful: pod receives traffic through Kubernetes services
   - If failed: pod is removed from service endpoints (no restart)

3. **Liveness Check** (`/status` endpoint):
   - First verifies readiness (all services started)
   - Then runs your custom health check functions, including internal service checks via `.plt.local`
   - If successful: container continues running
   - If failed: Kubernetes restarts the container

4. **Internal Service Communication**:
   - Services communicate via Watt's internal service mesh using `.plt.local` domains
   - Health checks can verify dependent services without external network calls
   - Composer gateway can aggregate health status from all backend services

**Important**: The liveness check depends on readiness. If readiness fails, liveness will also fail, potentially causing unnecessary restarts.

## Project Structure

You can see a full working example in [https://github.com/platformatic/k8s-readiness-liveness](https://github.com/platformatic/k8s-readiness-liveness).

The example project structure demonstrates a Watt application with health checks and composer gateway:

```
├── watt.json               # Main Watt configuration with metrics
├── Dockerfile              # Container configuration
├── package.json            # Dependencies and scripts
├── web/
│   ├── api/                # Backend API service
│   │   ├── platformatic.json
│   │   └── index.js        # Service with custom health checks
│   ├── worker/             # Background worker service
│   │   ├── platformatic.json
│   │   └── index.js        # Worker with health endpoint
│   └── gateway/            # Composer API gateway
│       ├── platformatic.json # Composer configuration
│       └── index.js        # Gateway with upstream health checks
└── k8s/
    ├── deployment.yaml     # Kubernetes deployment with probes
    ├── service.yaml        # Kubernetes service configuration
    └── ingress.yaml        # Optional ingress configuration
```

The `watt.json` configuration enables the metrics server:

```json
{
  "metrics": {
    "hostname": "{PLT_SERVER_HOSTNAME}",
    "port": 9090,
    "readiness": true,
    "liveness": true
  }
}
```

**Note**: You don't need to manually configure services in the `watt.json` file. Watt automatically discovers and loads all services from the `web` directory using its autoload feature. Any valid Platformatic service placed in the `web` folder will be automatically registered and included in health checks.

This exposes:
- Health endpoints on port `9090`: `/ready` (readiness) and `/status` (liveness)
- Application services on port `3042` (default Watt port)

**To run the complete example:**

1. Clone the example repository:
   ```bash
   git clone https://github.com/platformatic/k8s-readiness-liveness.git
   cd k8s-readiness-liveness
   ```

2. Follow the setup instructions in the repository's `README.md`

3. Deploy to your Kubernetes cluster:
   ```bash
   kubectl apply -f k8s/
   ```

## Verification and Testing

### Test Health Endpoints Locally

**1. Start your Watt application:**
```bash
npm start
# or for development
npm run dev
```

**2. Test health endpoints:**
```bash
# Test readiness endpoint
curl -v http://localhost:9090/ready
# Expected: 200 OK "Ready" (or custom response)

# Test liveness endpoint  
curl -v http://localhost:9090/status
# Expected: 200 OK "Healthy" (or custom response)

# Check metrics endpoint
curl http://localhost:9090/metrics
# Expected: Prometheus metrics output
```

**3. Test with failing health checks:**
```bash
# If your app has test endpoints to simulate failures:
curl -X POST http://localhost:3042/api/test/fail-health
curl http://localhost:9090/status
# Expected: 503 Service Unavailable
```

### Test in Kubernetes

**1. Deploy to Kubernetes:**
```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

**2. Monitor pod health:**
```bash
# Check pod status
kubectl get pods -l app=demo-readiness-liveness

# Watch pod events
kubectl describe pod <pod-name>

# Check probe results
kubectl get events --field-selector reason=Unhealthy
```

**3. Test probe behavior:**
```bash
# Test health endpoints from within the pod
kubectl exec <pod-name> -- curl -f http://localhost:9090/ready
kubectl exec <pod-name> -- curl -f http://localhost:9090/status

# Watch Kubernetes pod status in real-time
kubectl get pods -l app=watt-health-app -w

# Check pod events for probe failures
kubectl get events --field-selector involvedObject.name=<pod-name>
```

### Verify Probe Configuration

**Check probe timing is appropriate:**
```bash
# Get current probe configuration
kubectl get deployment demo-readiness-liveness -o yaml | grep -A 10 Probe
```

**Monitor probe metrics:**
```bash
# Check probe success/failure rates
kubectl top pods
kubectl describe pod <pod-name> | grep -A 5 "Liveness\|Readiness"
```

## Production Configuration Best Practices

### Probe Timing Guidelines

**Startup-dependent applications:**
```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 9090
  initialDelaySeconds: 10    # Short delay for quick apps
  periodSeconds: 5           # Frequent checks during startup
  timeoutSeconds: 5          # Allow time for health check
  successThreshold: 1        # Single success to mark ready
  failureThreshold: 3        # Allow some startup failures

livenessProbe:
  httpGet:
    path: /status
    port: 9090
  initialDelaySeconds: 30    # Longer delay after initial startup
  periodSeconds: 30          # Less frequent checks when running
  timeoutSeconds: 10         # More time for complex checks
  failureThreshold: 3        # Avoid restart on transient issues
```

**Database-dependent applications:**
```yaml
startupProbe:                # Use startup probe for slow initialization
  httpGet:
    path: /ready
    port: 9090
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 30       # Up to 5 minutes for startup

readinessProbe:
  httpGet:
    path: /ready
    port: 9090
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 1        # Quick removal from service if unhealthy

livenessProbe:
  httpGet:
    path: /status
    port: 9090
  initialDelaySeconds: 0     # Disabled until startup probe succeeds
  periodSeconds: 20
  timeoutSeconds: 10
  failureThreshold: 3
```

## Troubleshooting

### Pod Failing Readiness Checks

**Problem:** Pods remain in "Not Ready" state

**Solutions:**
```bash
# Check health endpoint directly
kubectl exec <pod-name> -- curl http://localhost:9090/ready

# Review application logs
kubectl logs <pod-name>

# Check probe configuration
kubectl describe pod <pod-name> | grep -A 10 Readiness

# Common fixes:
# - Increase initialDelaySeconds if app needs more startup time
# - Check that health dependencies are available
# - Verify metrics server is configured and running on correct port
```

### Pod Continuously Restarting

**Problem:** Liveness probes causing restart loops

**Solutions:**
```bash
# Check restart count and reason
kubectl get pods -l app=your-app

# Review pod events
kubectl describe pod <pod-name>

# Check liveness endpoint
kubectl exec <pod-name> -- curl http://localhost:9090/status

# Common fixes:
# - Increase timeoutSeconds for slow health checks
# - Increase failureThreshold to avoid restarts on transient issues
# - Review custom health check logic for potential failures
# - Check if app is properly handling SIGTERM for graceful shutdown
```

### Health Checks Always Failing

**Problem:** Health endpoints return 500/404 errors

**Solutions:**
```bash
# Verify metrics server is listening
kubectl exec <pod-name> -- netstat -tlnp | grep :9090

# Check Watt configuration
kubectl exec <pod-name> -- cat watt.json

# Test endpoints with verbose output
kubectl exec <pod-name> -- curl -v http://localhost:9090/ready
kubectl exec <pod-name> -- curl -v http://localhost:9090/status

# Check application logs for errors
kubectl logs <pod-name> --tail=100

# Verify container environment
kubectl exec <pod-name> -- env | grep PLT_
```

**Common fixes:**
- Ensure `metrics.hostname` is `"0.0.0.0"` (not `"127.0.0.1"` or `"localhost"`)
- Verify `metrics.port` matches probe port configuration  
- Check that `PLT_SERVER_HOSTNAME=0.0.0.0` environment variable is set
- Ensure custom health check functions handle errors gracefully
- Verify all Watt services are starting without errors

### Slow Startup Times

**Problem:** Pods take too long to become ready

**Solutions:**
```bash
# Analyze startup time with timestamps
kubectl logs <pod-name> --timestamps --since=5m

# Check resource usage and limits
kubectl describe pod <pod-name> | grep -A 10 -B 5 "Limits\|Requests"
kubectl top pod <pod-name>

# Profile health check performance
kubectl exec <pod-name> -- time curl -f http://localhost:9090/ready

# Check Node.js startup time
kubectl exec <pod-name> -- ps aux | grep node
```

**Common fixes:**
- **Use startup probes** for applications with slow initialization (database migrations, cache warming, etc.)
- **Optimize custom health checks** - keep them lightweight and fast
- **Increase resources** if CPU/memory constrained (check with `kubectl top`)
- **Remove expensive operations** from readiness checks (use async background tasks instead)
- **Pre-build dependencies** in Docker image rather than installing at runtime
- **Use Node.js production optimizations** (`NODE_ENV=production`, `--max-old-space-size`)

## Advanced Patterns

### Multi-Service Health Dependencies

For complex applications with service interdependencies using Watt's internal service mesh:

```javascript
// web/api/index.js
import fastify from 'fastify'

export function create () {
  const app = fastify({ logger: true })

  // Critical dependency checker using Watt's internal communication
  async function checkCriticalDependencies() {
    const checks = await Promise.allSettled([
      // Database connection
      app.hasDecorator('db') ? app.db.query('SELECT 1') : Promise.resolve(),
      // Redis cache
      app.hasDecorator('redis') ? app.redis.ping() : Promise.resolve(),
      // Internal service dependencies using .plt.local domain
      fetch('http://worker.plt.local/health', { timeout: 2000 }),
      fetch('http://gateway.plt.local/health', { timeout: 2000 })
    ])
    
    return checks.every(result => result.status === 'fulfilled')
  }

  // Implement cascading health checks
  // Note: This requires the watt metrics server to be enabled in your configuration
  globalThis.platformatic.setCustomHealthCheck(async () => {
    try {
      const criticalHealthy = await checkCriticalDependencies()
      
      // Check non-critical dependencies (don't fail on these)
      const externalAPIs = await Promise.allSettled([
        fetch('https://api.external-service.com/health', { timeout: 3000 })
      ])
      
      const externalHealthy = externalAPIs.every(result => 
        result.status === 'fulfilled' && result.value.ok
      )
      
      if (criticalHealthy) {
        return {
          status: true,
          body: JSON.stringify({
            service: 'healthy',
            dependencies: {
              critical: 'healthy',
              external: externalHealthy ? 'healthy' : 'degraded'
            },
            timestamp: new Date().toISOString()
          })
        }
      }
      
      return { 
        status: false,
        statusCode: 503,
        body: 'Critical dependencies unavailable'
      }
    } catch (error) {
      app.log.error({ err: error }, 'Health check failed')
      return { 
        status: false, 
        statusCode: 503,
        body: `Health check error: ${error.message}`
      }
    }
  })

  return app
}
```

### Graceful Shutdown Handling

```javascript
// web/api/index.js
import fastify from 'fastify'

export function create () {
  const app = fastify({ logger: true })
  
  let isShuttingDown = false
  
  // Handle graceful shutdown for zero-downtime deployments
  process.on('SIGTERM', async () => {
    app.log.info('Received SIGTERM, starting graceful shutdown')
    isShuttingDown = true
    
    // Immediately fail readiness checks to stop receiving new traffic
    globalThis.platformatic.setCustomReadinessCheck(() => {
      return {
        status: false,
        statusCode: 503,
        body: 'Service is shutting down'
      }
    })
    
    try {
      // Allow existing requests to complete (Kubernetes gives 30s by default)
      await new Promise(resolve => setTimeout(resolve, 10000))
      
      // Clean up resources
      if (app.hasDecorator('db')) {
        await app.db.close()
      }
      if (app.hasDecorator('redis')) {
        await app.redis.quit()
      }
      
      app.log.info('Graceful shutdown completed')
      process.exit(0)
    } catch (error) {
      app.log.error({ err: error }, 'Error during shutdown')
      process.exit(1)
    }
  })
  
  // Custom readiness check that accounts for shutdown state
  globalThis.platformatic.setCustomReadinessCheck(async () => {
    if (isShuttingDown) {
      return false
    }
    
    // Add your readiness logic here
    return true
  })
  
  return app
}
```

## Next Steps

Now that you have robust Kubernetes health checks:

- **[Configure monitoring](/docs/guides/monitoring)** - Track health check metrics with Prometheus
- **[Set up logging](/docs/guides/logging)** - Centralize health check logs for debugging
- **[Container deployment guide](/docs/guides/deployment/dockerize-a-watt-app)** - Optimize your Docker setup
- **[TypeScript compilation](/docs/guides/deployment/compiling-typescript)** - Production builds and optimization

## References

### Kubernetes Documentation
- [Kubernetes Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)
- [Configure Liveness, Readiness and Startup Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Container Probes](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#container-probes)

### Platformatic Resources  
- [Watt Runtime Configuration](/docs/reference/runtime/configuration) - Complete metrics configuration reference
- [Node.js Stackable Reference](/docs/reference/node) - Custom health check API documentation
- [Example Application](https://github.com/platformatic/k8s-readiness-liveness) - Complete working example with Kubernetes manifests

### Best Practices
- [Kubernetes Health Check Best Practices](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#when-should-you-use-a-liveness-probe)
- [Production Readiness Checklist](https://kubernetes.io/docs/concepts/cluster-administration/production-environment/)
