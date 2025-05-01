# Kubernetes Readiness and Liveness with Platformatic

This guide explains how to implement Kubernetes readiness and liveness probes in a Platformatic service using Watt. We'll walk through setting up a sample service that properly implements these health checks for robust container orchestration.

## Overview

Kubernetes uses [probes](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#container-probes) to determine the health of your application:

- **Readiness Probe**: Indicates whether the application is ready to handle requests. Kubernetes won't send traffic to a pod until its readiness probe succeeds.
- **Liveness Probe**: Determines if the application is running properly. If this probe fails, Kubernetes will restart the container.

## Platformatic Health Check APIs

Platformatic provides a built-in API for implementing readiness and liveness through its metrics server. The metrics server is configured in your Watt configuration file and exposes health check endpoints:

- The `/ready` endpoint indicates if the service is running and ready to accept traffic
- The `/status` endpoint indicates if all services in the stack are reachable
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

Create a Platformatic service that implements comprehensive health checks:

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
   - The `watt` server checks that all the services are up and running
   - If successful, the pod is marked as ready to receive traffic; if it fails `failureThreshold` times, the pod is marked as not ready

3. **Liveness Check**:
   - Kubernetes calls the `/status` endpoint every `periodSeconds`
   - The `watt` server checks that all the services are ready and perform the custom health check for each service
   - If successful, the container is considered healthy; if it fails `failureThreshold` times, Kubernetes restarts the container

## Project Structure

You can see a full working example in [https://github.com/platformatic/k8s-readiness-liveness](https://github.com/platformatic/k8s-readiness-liveness).

The example project structure demonstrates a Watt application with health checks:

```txt
├── app
│   ├── watt.json           # Main Watt configuration
│   └── services
│       ├── main            # Entry point service
│       │   └── platformatic.json
│       └── service-one     # Example service with custom health check
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

This configuration exposes health check endpoints available at `/ready` and `/status` on port `9090` and the service endpoints on port `3001`.

You can follow the `README.md` in the [demo/k8s-readiness-liveness](https://github.com/platformatic/k8s-readiness-liveness/blob/main/README.md) to run the example.

## References

- [Kubernetes Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)
- [Configure Liveness, Readiness and Startup Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Container Probes](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#container-probes)
