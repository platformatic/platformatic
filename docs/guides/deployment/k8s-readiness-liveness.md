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

## Platformatic Health Check APIs

Platformatic provides a built-in API for implementing readiness and liveness through its metrics server. The metrics server is configured in your Watt configuration file and exposes health check endpoints:

- The `/ready` endpoint indicates if the application is running and ready to accept traffic
- The `/status` endpoint indicates if all applications in the stack are reachable
- Custom health checks can be added using the `setCustomHealthCheck` method available on the `globalThis.platformatic` object. The method receives a function that returns a boolean or an object with the following properties:
  - `status`: a boolean indicating if the health check is successful
  - `statusCode`: an optional HTTP status code to return
  - `body`: an optional body to return
- Custom readiness checks can be added using the `setCustomReadinessCheck` method available on the `globalThis.platformatic` object. The method receives a function that returns a boolean or an object with the following properties:
  - `status`: a boolean indicating if the readiness check is successful
  - `statusCode`: an optional HTTP status code to return
  - `body`: an optional body to return

## Implementation

### 1. Service Implementation with Custom Health Checks

Create a Platformatic application that implements comprehensive health checks:

```javascript
import fastify from 'fastify'

export function create () {
  const app = fastify({ 
    logger: true, 
    hostname: process.env.PLT_SERVER_HOSTNAME 
  })

  // Register custom health check with Platformatic
  globalThis.platformatic.setCustomHealthCheck(async () => {
    try {
      // Add your health checks here
      // For example:
      // await Promise.all([
      //   app.db?.query('SELECT 1'),
      //   fetch('https://external-service/health')
      // ])
      return true
    } catch (err) {
      app.log.error(err)
      return false
    }
  })

  // Register custom readiness check with Platformatic
  globalThis.platformatic.setCustomReadinessCheck(async () => {
    try {
      // Add your readiness checks here
      // For example:
      // await Promise.all([
      //   app.db?.query('SELECT 1'),
      //   fetch('https://external-service/health')
      // ])
      return true
    } catch (err) {
      app.log.error(err)
      return false
    }
  })

  return app
}
```

### 2. Kubernetes Configuration

Create a Kubernetes deployment configuration that defines the probes:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo-readiness-liveness
  labels:
    app: demo-readiness-liveness
spec:
  replicas: 1
  selector:
    matchLabels:
      app: demo-readiness-liveness
  template:
    metadata:
      labels:
        app: demo-readiness-liveness
    spec:
      containers:
      - name: demo-readiness-liveness
        image: demo-readiness-liveness:latest
        ports:
        - containerPort: 3001
          name: service
        - containerPort: 9090
          name: metrics
        readinessProbe:
          httpGet:
            path: /ready
            port: 9090
          initialDelaySeconds: 30
          periodSeconds: 30
          failureThreshold: 1
        livenessProbe:
          httpGet:
            path: /status
            port: 9090
          initialDelaySeconds: 30
          periodSeconds: 30
          failureThreshold: 1
        resources:
          requests:
            memory: "256Mi"
            cpu: "500m"
          limits:
            memory: "512Mi"
            cpu: "1000m"
```

Key configuration points:

- **Readiness Probe**: Checks `/ready` endpoint every 30 seconds
- **Liveness Probe**: Checks `/status` endpoint every 30 seconds
- Both probes:
  - `initialDelaySeconds: 30`: Wait 30 seconds before first probe
  - `periodSeconds: 30`: Check every 30 seconds
  - `failureThreshold: 1`: Fail after 1 unsuccessful attempt

Please note these values are for demonstration purposes. In a production environment, you should set these values based on your application's characteristics and requirements.

### 3. Environment Configuration

Ensure your service binds to the correct network interface in Kubernetes:

```yaml
env:
- name: PLT_SERVER_HOSTNAME
  value: "0.0.0.0"
```

## How It Works

1. **Startup**: When the pod starts, Kubernetes waits `initialDelaySeconds` before beginning health checks.

2. **Readiness Check**:
   - Kubernetes calls the `/ready` endpoint every `periodSeconds`
   - The `watt` server checks that all the applications are up and running
   - If successful, the pod is marked as ready to receive traffic; if it fails `failureThreshold` times, the pod is marked as not ready

3. **Liveness Check**:
   - Kubernetes calls the `/status` endpoint every `periodSeconds`
   - The `watt` server checks that all the applications are ready and perform the custom health check for each application
   - If successful, the container is considered healthy; if it fails `failureThreshold` times, Kubernetes restarts the container

## Project Structure

You can see a full working example in [https://github.com/platformatic/k8s-readiness-liveness](https://github.com/platformatic/k8s-readiness-liveness).

The example project structure demonstrates a Watt application with health checks:

```txt
├── app
│   ├── watt.json           # Main Watt configuration
│   └── applications
│       ├── main            # Entry point application
│       │   └── platformatic.json
│       └── application-one     # Example application with custom health check
│           ├── platformatic.json
│           └── app.js
├── k8s
│   ├── deployment.yaml     # Kubernetes deployment with probes
│   └── service.yaml        # Kubernetes service configuration
└── Dockerfile              # Container image build
```

The `watt.json` configuration exposes the metrics server on port 9090:

```json
{
  "metrics": {
    "hostname": "{PLT_SERVER_HOSTNAME}",
    "port": 9090
  }
}
```

This configuration exposes health check endpoints available at `/ready` and `/status` on port `9090` and the application endpoints on port `3001`.

You can follow the `README.md` in the [demo/k8s-readiness-liveness](https://github.com/platformatic/k8s-readiness-liveness/blob/main/README.md) to run the example.

## Verification and Testing

### Test Health Endpoints Locally

**1. Start your Watt application:**
```bash
npm run dev
```

**2. Test health endpoints:**
```bash
# Test readiness endpoint
curl http://localhost:9090/ready

# Test liveness endpoint  
curl http://localhost:9090/status

# Expected responses should be 200 OK with health status
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
# Force a health check failure (if your app supports it)
kubectl exec <pod-name> -- curl -X POST http://localhost:9090/fail-health

# Watch Kubernetes response
kubectl get pods -w
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
# Verify metrics server configuration
kubectl exec <pod-name> -- netstat -ln | grep 9090

# Check Watt configuration
kubectl exec <pod-name> -- cat watt.json | grep -A 5 metrics

# Test endpoints manually
kubectl exec <pod-name> -- curl -v http://localhost:9090/ready

# Common fixes:
# - Ensure metrics.hostname is set to "0.0.0.0" not "127.0.0.1"
# - Verify metrics.port matches probe configuration
# - Check that custom health check functions don't throw exceptions
# - Ensure all applications in Watt application are starting correctly
```

### Slow Startup Times

**Problem:** Pods take too long to become ready

**Solutions:**
```bash
# Analyze startup time
kubectl logs <pod-name> --timestamps

# Check resource limits
kubectl describe pod <pod-name> | grep -A 5 Limits

# Profile health check performance
kubectl exec <pod-name> -- time curl http://localhost:9090/ready

# Common fixes:
# - Use startup probes for applications with long initialization
# - Optimize custom health check logic
# - Increase CPU/memory resources if resource-constrained
# - Remove expensive operations from readiness checks
```

## Advanced Patterns

### Multi-Service Health Dependencies

For complex applications with service interdependencies:

```javascript
// Implement cascading health checks
globalThis.platformatic.setCustomHealthCheck(async () => {
  try {
    // Check primary service health
    const serviceHealth = await checkServiceHealth()
    
    // Check critical dependencies
    const dbHealth = await checkDatabaseConnection()
    const cacheHealth = await checkCacheConnection()
    
    // Check non-critical dependencies (don't fail health check)
    const externalServiceHealth = await checkExternalServices().catch(() => false)
    
    if (serviceHealth && dbHealth && cacheHealth) {
      return {
        status: true,
        body: {
          service: 'healthy',
          database: dbHealth,
          cache: cacheHealth,
          external: externalServiceHealth
        }
      }
    }
    
    return { status: false }
  } catch (error) {
    return { 
      status: false, 
      statusCode: 503,
      body: { error: error.message }
    }
  }
})
```

### Graceful Shutdown Handling

```javascript
// Handle graceful shutdown for zero-downtime deployments
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, starting graceful shutdown')
  
  // Stop accepting new requests
  globalThis.platformatic.setCustomReadinessCheck(() => false)
  
  // Allow existing requests to complete
  await new Promise(resolve => setTimeout(resolve, 5000))
  
  // Clean up resources
  await cleanupConnections()
  
  process.exit(0)
})
```

## Next Steps

Now that you have robust Kubernetes health checks:

- **[Set up monitoring and alerting](/docs/guides/monitoring)** - Track health check metrics
- **[Configure autoscaling](/docs/guides/autoscaling)** - Scale based on health and load
- **[Implement circuit breakers](/docs/guides/resilience)** - Handle dependency failures gracefully  
- **[Set up distributed tracing](/docs/guides/tracing)** - Debug complex health check failures

## References

- [Kubernetes Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)
- [Configure Liveness, Readiness and Startup Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Container Probes](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#container-probes)
- [Example Application](https://github.com/platformatic/k8s-readiness-liveness) - Complete working example
