# Monitoring and Observability

This guide covers how to implement comprehensive monitoring and observability for your Watt applications, including logging, metrics, tracing, and health checks.

## Overview

Observability is crucial for production applications. Watt provides built-in support for:

- **Structured Logging**: JSON-based logging with configurable levels
- **Metrics Collection**: Prometheus-compatible metrics for performance monitoring  
- **Distributed Tracing**: OpenTelemetry integration for request tracing
- **Health Checks**: Application and service health endpoints
- **Error Tracking**: Centralized error collection and alerting

## Quick Setup

The fastest way to enable monitoring is during Watt application creation using the `@platformatic/node` stackable:

```bash
npx wattpm@latest create my-app
# Select the @platformatic/node stackable during setup
# Choose monitoring options during setup

cd my-app
npx wattpm dev
```

### Setting up Fastify for Monitoring

After creating your Watt application, you'll need to set up Fastify properly. The basic Watt quick start uses Node.js core `createServer`, but for comprehensive monitoring, you should use **Platformatic Service**, **Platformatic DB**, or **Platformatic Composer**.

For a **Platformatic Service** with Fastify:

```bash
# Create a new service with the @platformatic/service stackable
npx wattpm@latest create my-monitoring-app
# Select "@platformatic/service" during setup
```

This creates a Fastify-based service with built-in monitoring capabilities.

## Logging Configuration

### Basic Logging

Configure logging in your `watt.json`:

```json
{
  "server": {
    "logger": {
      "level": "info",
      "prettyPrint": false
    }
  }
}
```

### Structured Logging

For production, use structured JSON logging:

```json
{
  "server": {
    "logger": {
      "level": "info",
      "prettyPrint": false,
      "redact": ["password", "authorization"],
      "serializers": {
        "req": "pino-std-serializers.req",
        "res": "pino-std-serializers.res"
      }
    }
  }
}
```

### Log Levels

Available log levels (in order of verbosity):
- `fatal`: Only fatal errors
- `error`: Errors and fatal  
- `warn`: Warnings, errors, and fatal
- `info`: General information (recommended for production)
- `debug`: Debug information
- `trace`: Very detailed debug information

### Custom Logging in Platformatic Services

Add logging to your **Platformatic Service** plugins using ESM syntax:

```javascript
// services/api/plugin.js
export default async function (app) {
  app.get('/api/users', async (request, reply) => {
    request.log.info({ userId: 123 }, 'User data requested')
    
    try {
      const users = await getUsers()
      request.log.debug({ count: users.length }, 'Users retrieved')
      return users
    } catch (error) {
      request.log.error({ error }, 'Failed to get users')
      throw error
    }
  })
}

// For @platformatic/node applications
export async function getUsers() {
  // Your user fetching logic here
  return []
}
```

## Metrics Collection

### Enable Metrics

Configure Prometheus-compatible metrics:

```json
{
  "metrics": {
    "enabled": true,
    "endpoint": "/metrics",
    "auth": {
      "username": "{PLT_METRICS_USERNAME}",
      "password": "{PLT_METRICS_PASSWORD}"
    }
  }
}
```

### Built-in Metrics

Watt automatically collects:

- **HTTP Metrics**: Request count, duration, status codes
- **System Metrics**: CPU, memory, event loop lag
- **Database Metrics**: Connection pool, query duration (if using Database Service)
- **Custom Metrics**: Application-specific metrics you define

### Custom Metrics in Platformatic Services

Add custom metrics to your **Platformatic Service**, **Platformatic DB**, or **Platformatic Composer** using ESM syntax:

```javascript
// services/api/plugin.js
export default async function (app) {
  // Counter for API calls
  const apiCallsCounter = app.metrics.counter({
    name: 'api_calls_total',
    help: 'Total number of API calls',
    labelNames: ['method', 'endpoint', 'status']
  })

  // Histogram for response times
  const responseTimeHistogram = app.metrics.histogram({
    name: 'api_response_time_seconds',
    help: 'API response time in seconds',
    buckets: [0.1, 0.5, 1.0, 2.0, 5.0]
  })

  app.addHook('onRequest', async (request, reply) => {
    request.startTime = Date.now()
  })

  app.addHook('onResponse', async (request, reply) => {
    const duration = (Date.now() - request.startTime) / 1000
    
    apiCallsCounter.inc({
      method: request.method,
      endpoint: request.routerPath,
      status: reply.statusCode
    })
    
    responseTimeHistogram.observe(duration)
  })
}
```

### Metrics Dashboard

Access metrics at `http://localhost:3042/metrics` or configure with monitoring systems:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'watt-app'
    static_configs:
      - targets: ['localhost:3042']
    metrics_path: '/metrics'
    basic_auth:
      username: 'metrics_user'
      password: 'secure_password'
```

## Distributed Tracing

### OpenTelemetry Setup

Enable tracing for request correlation across services:

```json
{
  "telemetry": {
    "serviceName": "my-watt-app",
    "version": "1.0.0",
    "exporter": {
      "type": "otlp",
      "options": {
        "url": "http://localhost:4318/v1/traces"
      }
    }
  }
}
```

### Tracing in Platformatic Services

Tracing is automatically enabled for HTTP requests, database queries, and inter-service calls in **Platformatic Service**, **Platformatic DB**, and **Platformatic Composer**. Add custom spans using ESM syntax:

```javascript
// services/api/plugin.js
export default async function (app) {
  app.get('/api/complex-operation', async (request, reply) => {
    const tracer = app.openTelemetry.tracer
    
    return await tracer.startActiveSpan('complex-operation', async (span) => {
      try {
        span.setAttributes({
          'operation.type': 'data-processing',
          'user.id': request.user.id
        })
        
        const result = await processData()
        span.setStatus({ code: 1 }) // SUCCESS
        return result
      } catch (error) {
        span.recordException(error)
        span.setStatus({ code: 2, message: error.message }) // ERROR
        throw error
      } finally {
        span.end()
      }
    })
  })
}

async function processData() {
  // Your data processing logic here
  return { processed: true }
}
```

### Jaeger Integration

For local development with Jaeger:

```bash
# Start Jaeger (using Docker)
docker run -d --name jaeger \
  -p 16686:16686 \
  -p 14268:14268 \
  jaegertracing/all-in-one:latest

# Configure Watt to send traces to Jaeger
```

```json
{
  "telemetry": {
    "serviceName": "my-watt-app",
    "exporter": {
      "type": "jaeger",
      "options": {
        "endpoint": "http://localhost:14268/api/traces"
      }
    }
  }
}
```

## Health Checks

### Application Health

Configure health check endpoints:

```json
{
  "server": {
    "healthCheck": {
      "enabled": true,
      "interval": 5000,
      "exposeUptime": true
    }
  }
}
```

This creates health endpoints:
- `GET /status` - Basic health status
- `GET /status/live` - Kubernetes liveness probe
- `GET /status/ready` - Kubernetes readiness probe

### Service-Specific Health Checks

Add custom health checks to your **Platformatic Service** using ESM syntax:

```javascript
// services/api/plugin.js
import underPressure from '@fastify/under-pressure'

export default async function (app) {
  await app.register(underPressure, {
    healthCheck: async function () {
      // Custom health check logic
      const dbHealthy = await checkDatabaseConnection()
      const externalServiceHealthy = await checkExternalAPI()
      
      if (!dbHealthy || !externalServiceHealthy) {
        throw new Error('Service dependencies unavailable')
      }
      
      return { status: 'ok', timestamp: Date.now() }
    },
    healthCheckInterval: 10000
  })
}

async function checkDatabaseConnection() {
  // Your database health check logic
  return true
}

async function checkExternalAPI() {
  // Your external service health check logic
  return true
}
```

### Database Health Checks

For **Platformatic DB** services, health checks include:

```javascript
// Automatic database connection health check using ESM
import underPressure from '@fastify/under-pressure'

export default async function (app) {
  await app.register(underPressure, {
    healthCheck: async function () {
      try {
        await app.platformatic.db.query('SELECT 1')
        return { database: 'connected' }
      } catch (error) {
        throw new Error(`Database connection failed: ${error.message}`)
      }
    }
  })
}
```

## Log Aggregation

### ELK Stack Integration

Send logs to Elasticsearch:

```json
{
  "server": {
    "logger": {
      "level": "info",
      "stream": {
        "type": "tcp",
        "host": "elasticsearch.example.com",
        "port": 9200
      }
    }
  }
}
```

### Fluentd Integration

Configure structured logging for Fluentd:

```json
{
  "server": {
    "logger": {
      "level": "info",
      "prettyPrint": false,
      "timestamp": true,
      "formatters": {
        "level": "levelName"
      }
    }
  }
}
```

For more details on ELK integration, see the [Logging to Elasticsearch guide](./logging-to-elasticsearch.md).

## Environment-Specific Logging Configuration

You need to customize logging behavior in your Watt application for different environments (development, staging, production):

### Development Environment

```json
{
  "server": {
    "logger": {
      "level": "debug",
      "prettyPrint": true,
      "colorize": true
    }
  }
}
```

### Production Environment

```json
{
  "server": {
    "logger": {
      "level": "warn",
      "prettyPrint": false,
      "redact": ["password", "authorization", "cookie"],
      "serializers": {
        "req": "pino-std-serializers.req",
        "res": "pino-std-serializers.res"
      }
    }
  }
}
```

### Using Environment Variables

```json
{
  "server": {
    "logger": {
      "level": "{LOG_LEVEL}",
      "prettyPrint": "{NODE_ENV !== 'production'}"
    }
  }
}
```
```

## Production Monitoring Setup

### Kubernetes Deployment

Complete monitoring setup for Kubernetes:

```yaml
# monitoring.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: watt-config
data:
  watt.json: |
    {
      "server": {
        "logger": { "level": "info", "prettyPrint": false },
        "healthCheck": { "enabled": true }
      },
      "metrics": {
        "enabled": true,
        "endpoint": "/metrics"
      },
      "telemetry": {
        "serviceName": "watt-production",
        "exporter": {
          "type": "otlp",
          "options": {
            "url": "http://otel-collector:4318/v1/traces"
          }
        }
      }
    }
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: watt-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: watt-app
  template:
    metadata:
      labels:
        app: watt-app
    spec:
      containers:
      - name: app
        image: my-watt-app:latest
        ports:
        - containerPort: 3042
        env:
        - name: NODE_ENV
          value: "production"
        livenessProbe:
          httpGet:
            path: /status/live
            port: 3042
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /status/ready
            port: 3042
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: config
          mountPath: /app/watt.json
          subPath: watt.json
      volumes:
      - name: config
        configMap:
          name: watt-config
```

### Docker Compose Monitoring Stack

Complete monitoring with Prometheus, Grafana, and Jaeger:

```yaml
# docker-compose.monitoring.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3042:3042"
    environment:
      - NODE_ENV=production
    volumes:
      - ./watt.production.json:/app/watt.json

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-storage:/var/lib/grafana

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"
      - "14268:14268"
    environment:
      - COLLECTOR_OTLP_ENABLED=true

volumes:
  grafana-storage:
```

## Monitoring Best Practices

### Alerting Rules

Set up alerts for critical metrics:

```yaml
# alerts.yml
groups:
- name: watt-app-alerts
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is above 10% for 2 minutes"

  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High response time"
      description: "95th percentile response time is above 2 seconds"

  - alert: ServiceDown
    expr: up{job="watt-app"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Watt application is down"
      description: "Watt application has been down for more than 1 minute"
```

### Dashboard Examples

Key metrics to monitor:

- **Request Rate**: Requests per second
- **Error Rate**: Percentage of failed requests
- **Response Time**: P50, P95, P99 response times
- **System Metrics**: CPU usage, memory consumption
- **Database Performance**: Connection pool, query duration
- **Service Health**: Health check status across services

### Log Analysis

Essential log queries:

```bash
# Error analysis
wattpm logs --level error | grep "database"

# Performance analysis  
wattpm logs | grep "duration" | jq '.responseTime'

# User behavior analysis
wattpm logs | grep "user_id" | jq '.userId'
```

## Troubleshooting

Common monitoring issues and solutions:

### Metrics Not Appearing

1. **Check metrics endpoint**: `curl http://localhost:3042/metrics`
2. **Verify configuration**: Ensure metrics are enabled
3. **Check Prometheus scraping**: Look for scraping errors

### Missing Traces

1. **Verify exporter configuration**: Check OTLP endpoint
2. **Check sampling rate**: Ensure traces are being sampled
3. **Network connectivity**: Verify tracing backend is reachable

### Health Check Failures

1. **Review health check logic**: Check custom health checks
2. **Database connectivity**: Verify database connections
3. **External dependencies**: Check third-party service health

For more troubleshooting help, see the [Troubleshooting Guide](../reference/troubleshooting.md).

## Related Guides

- [Logging to Elasticsearch](./logging-to-elasticsearch.md) - ELK stack integration
- [Telemetry Configuration](./telemetry.md) - OpenTelemetry setup
- [Production Deployment](./deployment/dockerize-a-watt-app.md) - Production deployment patterns