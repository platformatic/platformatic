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

## Internal Mesh Network Architecture

The Platformatic Runtime implements a sophisticated internal mesh network that enables seamless communication between microservices running in different worker threads. This system is built on the `undici-thread-interceptor` package and provides transparent HTTP-based communication without the overhead of network sockets.

For a higher-level overview of inter-application communication, see the [Runtime Overview](../runtime/overview.md#inter-application-communication) documentation.

### Mesh Network Topology

The mesh creates full connectivity between all worker threads:

```
Runtime Manager (Main Thread)
    ├── ThreadInterceptor/Coordinator
    └── MessageChannels to all workers

Worker Thread Pool
    ├── Worker 1 (api.plt.local)
    ├── Worker 2 (api.plt.local)
    ├── Worker 3 (auth.plt.local)
    └── Worker 4 (db.plt.local)

Direct Worker-to-Worker Channels
    ├── Worker 1 ↔ Worker 2, 3, 4
    ├── Worker 2 ↔ Worker 3, 4
    └── Worker 3 ↔ Worker 4
```

### Domain-Based Routing System

The mesh network uses a sophisticated domain-based routing system to direct requests to the appropriate services:

#### Routing Configuration

- **Domain Suffix**: All internal services use the configurable `.plt.local` domain
- **Service Mapping**: Each service ID maps to a specific domain (e.g., `auth` → `auth.plt.local`)
- **Multiple Workers**: Multiple worker instances can serve the same domain for load balancing

#### Request Routing Process

When a request is made to `http://auth.plt.local/verify`:

1. **Hostname Extraction**: Extract hostname `auth.plt.local` from the request URL
2. **Domain Validation**: Check if hostname ends with the configured domain suffix
3. **Service Resolution**: Map `auth` to the list of available worker threads
4. **Load Balancing**: Use round-robin to select the next available worker
5. **Route Request**: Forward request to the selected worker via MessageChannel

### Inter-Thread Communication Patterns

The mesh network uses Node.js MessageChannel for efficient communication between threads:

#### Request Serialization and Transfer

```javascript
// Request flow from Worker A to Worker B
const requestData = {
  id: generateUniqueId(),
  method: 'POST',
  path: '/api/users',
  headers: { 'Content-Type': 'application/json' },
  body: requestBody // Transferred as MessagePort for large payloads
}

// Send via MessageChannel
workerPort.postMessage(requestData)
```

#### MessageChannel Architecture

- **Bidirectional Communication**: Each worker pair has a dedicated MessageChannel
- **Request/Response Correlation**: Unique request IDs match responses to original requests
- **Stream Handling**: Large payloads transferred as MessagePort streams for efficiency
- **Error Propagation**: Network errors and timeouts properly forwarded to requesting service

#### Efficient Streaming

For large request/response bodies, the system uses MessagePort transfers to avoid concatenation:

```javascript
// Large payload handling
if (bodySize > STREAM_THRESHOLD) {
  const { port1, port2 } = new MessageChannel()

  // Transfer stream with single copy (avoids concatenation)
  workerPort.postMessage({
    requestId,
    bodyStream: port1
  }, [port1])

  // Stream data through port2
  streamData(body, port2)
}
```

### Load Balancing and Scaling

#### Round-Robin Distribution

The RoundRobin class manages worker selection with O(1) efficiency:

```javascript
class RoundRobin {
  constructor(workers) {
    this.workers = workers
    this.index = 0
  }

  next() {
    const worker = this.workers[this.index]
    this.index = (this.index + 1) % this.workers.length
    return worker
  }
}
```

#### Scaling Patterns

- **Horizontal Scaling**: Add more worker instances for the same service
- **Health-Aware Balancing**: Exclude unhealthy workers from rotation
- **Dynamic Scaling**: Workers can be added/removed during runtime
- **Service-Specific Scaling**: Different services can have different worker counts

### Dynamic Mesh Management

The mesh network adapts automatically to runtime changes:

#### Worker Registration Process

When a new worker starts:

1. **Worker Initialization**: Worker thread calls `wire()` with its application server
2. **Mesh Registration**: Worker registers with the ThreadInterceptor in the main thread
3. **Channel Establishment**: MessageChannels created between new worker and all existing workers
4. **Route Advertisement**: New worker's routes are propagated to all other workers
5. **Load Balancer Update**: RoundRobin instances updated with new worker

#### Runtime Route Management

```javascript
// Add new service instance
interceptor.route("newservice", workerThread)

// Remove specific worker from service
interceptor.unroute("newservice", workerThread)

// Mesh automatically updates:
// - MessageChannels established/torn down
// - All workers notified of changes
// - Load balancing updated
```

### Performance Characteristics

The mesh network is optimized for high-performance inter-service communication:

#### Throughput Optimization

- **Efficient Transfers**: Large payloads use MessagePort streaming to avoid concatenation overhead
- **Concurrent Processing**: Multiple workers process requests simultaneously across CPU cores
- **Connection Pooling**: Reuse MessageChannels for multiple requests
- **Asynchronous I/O**: All inter-thread communication is non-blocking

#### Latency Characteristics

- **In-Memory Communication**: Eliminates network stack overhead
- **Direct Thread Communication**: No intermediate proxies or gateways
- **Efficient Serialization**: Minimal request/response serialization overhead
- **Round-Robin Selection**: O(1) worker selection time

#### Memory Efficiency

- **Shared Code**: Worker threads share the same V8 isolate for code
- **Isolated Heaps**: Each worker has independent memory heap
- **Stream Processing**: Large payloads streamed rather than buffered
- **Resource Limits**: Per-worker memory limits prevent resource exhaustion

### Integration with Threading Model

The mesh network is tightly integrated with the multithread architecture:

#### Worker Lifecycle Integration

- **Startup**: Mesh registration happens during worker initialization
- **Health Monitoring**: Mesh reflects worker health status in routing decisions
- **Restart**: Worker replacement maintains mesh connectivity
- **Shutdown**: Graceful mesh cleanup during worker termination

#### Fault Tolerance

- **Worker Failure Isolation**: Failed workers removed from mesh without affecting others
- **Automatic Recovery**: New workers automatically join the mesh
- **Circuit Breaker**: Temporarily exclude failing services from routing
- **Graceful Degradation**: Continue operation with reduced worker count

### Security and Isolation

The mesh network maintains security boundaries:

#### Thread Isolation

- **Memory Isolation**: Each worker has independent memory space
- **Process Isolation**: Option to run workers in separate processes
- **Resource Limits**: Memory and CPU constraints per worker
- **Capability Control**: Limited access to system resources per worker

#### Communication Security

- **Internal-Only**: Mesh communication limited to `.plt.local` domain
- **No External Access**: Mesh traffic never leaves the runtime process
- **Request Validation**: Input validation at mesh boundaries
- **Error Boundary**: Errors contained within individual workers

This comprehensive mesh network architecture enables Platformatic Runtime to provide transparent, high-performance inter-service communication while maintaining the benefits of isolation and scalability that come with a multi-threaded execution model.

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
