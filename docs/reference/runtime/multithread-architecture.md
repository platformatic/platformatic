# Platformatic Runtime Multithread Architecture

This document describes the multithread system architecture in Platformatic Runtime, which enables horizontal scaling of applications through worker threads.

## Overview

Platformatic Runtime implements a sophisticated multithread architecture that allows applications to be scaled horizontally by running multiple worker instances. This system is built on Node.js Worker Threads and provides automatic load balancing, health monitoring, and fault tolerance.

### Key Components

- **Runtime Manager** (`lib/runtime.js`): Main orchestrator managing worker lifecycle
- **Worker Threads** (`lib/worker/main.js`): Individual application instances running in isolated threads
- **Round Robin Load Balancer** (`lib/worker/round-robin-map.js`): Distributes requests across workers
- **Inter-Thread Communication (ITC)** (`lib/worker/itc.js`): Message passing between runtime and workers
- **Thread Interceptor**: Network routing and application mesh capabilities

## Thread Management Architecture

### Worker Creation and Lifecycle

```
Runtime Manager
    ├── Service Configuration
    ├── Worker Pool Management
    ├── Health Monitoring
    └── Lifecycle Events
```

#### Worker Thread Creation Process

1. **Configuration**: Each application can specify worker count via `workers` property
2. **Thread Spawning**: Workers are created using `new Worker(kWorkerFile, options)`
3. **Resource Limits**: Memory and CPU constraints applied per worker
4. **Environment Setup**: Each worker gets isolated environment and dependencies

#### Key Configuration Options

- **Global Workers**: Default worker count for all applications (`config.workers`)
- **Service-Specific**: Override via `service.workers` property
- **Production Mode**: Multiple workers enabled only in production
- **Entrypoint Services**: Always use single worker for entrypoints (unless `reusePort` supported)

### Worker Thread Structure

Each worker thread (`lib/worker/main.js`) contains:

- **Isolated Application Instance**: Complete application instance
- **ITC Communication**: Bidirectional message channel with runtime
- **Network Interceptor**: Handles application mesh routing
- **Telemetry**: Independent monitoring and metrics collection
- **Resource Monitoring**: Health checks and memory/CPU tracking

## Load Balancing and Request Distribution

### Round Robin Implementation

The `RoundRobinMap` class manages worker selection:

```javascript
class RoundRobinMap {
  configure(applications, defaultInstances, production) {
    // Set up worker counts per application
  }
  
  next(application) {
    // Return next available worker in round-robin fashion
  }
}
```

#### Distribution Strategy

1. **Round Robin**: Requests distributed evenly across available workers
2. **Health Awareness**: Unhealthy workers excluded from rotation
3. **Restart Tolerance**: Continues operation during worker restarts
4. **Graceful Degradation**: Falls back to fewer workers if some fail

### Network Mesh Integration

The system uses `undici-thread-interceptor` for application mesh:

- **Domain-based Routing**: Services accessible via `.plt.local` domain
- **Worker Registration**: Each worker registers with mesh interceptor
- **Automatic Discovery**: Services can communicate without explicit configuration
- **Load Balancing**: Requests automatically distributed across worker instances

## Inter-Thread Communication (ITC)

### Communication Patterns

The ITC system enables bidirectional communication between runtime and workers:

#### Runtime → Worker Commands

- `start`: Initialize and start application
- `stop`: Graceful shutdown
- `getStatus`: Service status query
- `getMetrics`: Performance metrics collection
- `getHealth`: Health check data
- `build`: Trigger application build process

#### Worker → Runtime Events

- `init`: Worker initialization complete
- `changed`: Service file changes detected
- Runtime events forwarding for management API

### Message Handling

```javascript
// ITC Handler Example
const itc = new ITC({
  name: 'worker-name',
  port: parentPort,
  handlers: {
    async start() {
      await app.start()
      return application.entrypoint ? app.getUrl() : null
    },
    
    async stop() {
      await app.stop()
      await dispatcher.interceptor.close()
    }
  }
})
```

## Health Monitoring and Fault Tolerance

### Health Check System

Each worker is continuously monitored for:

- **Event Loop Utilization (ELU)**: Prevents thread blocking
- **Memory Usage**: Heap and RSS monitoring
- **Response Times**: Application performance tracking
- **Custom Health Checks**: Service-specific health indicators

#### Health Check Configuration

```javascript
const health = {
  enabled: true,
  interval: 5000,        // Check frequency
  maxELU: 0.98,         // Maximum event loop utilization
  maxHeapUsed: 0.95,    // Maximum heap usage percentage
  maxUnhealthyChecks: 3, // Failures before replacement
  gracePeriod: 30000     // Grace period after start
}
```

### Automatic Recovery

#### Worker Replacement

When a worker becomes unhealthy:

1. **New Worker Creation**: Spawn replacement worker
2. **Mesh Registration**: Register new worker with interceptor
3. **Traffic Migration**: Route new requests to healthy worker
4. **Graceful Removal**: Stop and clean up unhealthy worker

#### Restart Strategies

- **Immediate Restart**: For quick failures (< 10ms threshold)
- **Delayed Restart**: For persistent issues (configurable delay)
- **Circuit Breaker**: Disable restart after max attempts
- **Graceful Degradation**: Continue with reduced worker count

## Worker Configuration and Resource Management

### Resource Limits

Workers are created with specific resource constraints:

```javascript
const worker = new Worker(workerFile, {
  resourceLimits: {
    maxOldGenerationSizeMb: calculatedMemoryLimit,
    maxYoungGenerationSizeMb: youngGenerationLimit
  },
  execArgv: nodeOptions,
  env: workerEnvironment
})
```

### Environment Isolation

Each worker receives:

- **Isolated Environment**: Separate `process.env` per worker
- **Service Configuration**: Specific config patches and overrides
- **Worker Identity**: Unique worker ID and application binding
- **Telemetry Setup**: Independent monitoring configuration

## Development vs Production Behavior

### Development Mode

- **Single Worker**: All applications run with 1 worker
- **File Watching**: Automatic reload on file changes
- **Debug Support**: Inspector integration for debugging
- **Simplified Logging**: Reduced complexity for development

### Production Mode

- **Multiple Workers**: Full worker scaling enabled
- **Health Monitoring**: Complete health check system active
- **Restart on Error**: Automatic recovery mechanisms
- **Performance Optimization**: Resource limits and monitoring

## Threading Model Benefits

### Horizontal Scaling

- **CPU Utilization**: Better multi-core CPU usage
- **Request Throughput**: Higher concurrent request handling
- **Fault Isolation**: Worker failures don't affect entire application
- **Memory Efficiency**: Shared code with isolated heaps

### Operational Advantages

- **Zero-Downtime Updates**: Rolling worker replacement
- **Granular Monitoring**: Per-worker metrics and health
- **Flexible Scaling**: Service-specific worker configuration
- **Resource Protection**: Memory and CPU limits per worker

## Integration Points

### Service Mesh

The multithread system integrates with Platformatic's application mesh:

- **Automatic Registration**: Workers register with mesh on startup
- **Load Distribution**: Mesh-aware load balancing
- **Service Discovery**: Transparent inter-application communication
- **Health Propagation**: Health status reflected in mesh

### Management API

Runtime provides management capabilities:

- **Worker Status**: Real-time worker state monitoring
- **Metrics Aggregation**: Combined metrics from all workers
- **Control Operations**: Start/stop individual workers
- **Log Streaming**: Aggregated logs from all workers

## File Structure

```
packages/runtime/lib/
├── runtime.js              # Main runtime orchestrator
├── worker/
│   ├── main.js            # Worker thread entry point
│   ├── itc.js             # Inter-thread communication
│   ├── round-robin-map.js # Load balancing logic
│   ├── symbols.js         # Shared symbols and constants
│   └── app.js             # Worker application wrapper
└── errors.js              # Error definitions
```

This architecture provides a robust foundation for building scalable microservice applications with automatic load balancing, health monitoring, and fault tolerance built into the runtime system.
