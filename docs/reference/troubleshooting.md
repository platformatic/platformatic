# Troubleshooting

This section helps you diagnose and resolve common issues when working with Watt and Platformatic applications.

## Common Issues and Solutions

### Installation and Setup Issues

#### "Command not found: wattpm"

**Problem:** After installing `wattpm`, the command is not recognized.

**Solution:**

```bash
# If installed globally, ensure npm global bin is in your PATH
npm list -g --depth=0
npm config get prefix

# If the prefix is not in your PATH, add it:
echo 'export PATH="$(npm config get prefix)/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Alternatively, install locally and use npx:
npm install wattpm
npx wattpm --help
```

#### Configuration File Not Found

**Problem:** Error: "No config file found" or "Cannot parse config file"

**Solution:**

1. Ensure you have a configuration file in the current directory:
   - `watt.json` (recommended for Watt applications)

2. Check file format and syntax:

   ```bash
   # Validate JSON syntax
   cat watt.json | jq .
   ```

3. Use the `--config` option to specify a custom path:
   ```bash
   wattpm start --config ./config/my-watt.json
   ```

### Database Connection Issues

#### Database Connection Failed

**Problem:** "Connection refused" or "Authentication failed" errors.

**Solution:**

1. **Check connection string format:**

   ```javascript
   // PostgreSQL
   'postgres://username:password@host:port/database'

   // MySQL
   'mysql://username:password@host:port/database'

   // SQLite
   'sqlite://./path/to/database.sqlite'
   ```

2. **Test database connectivity:**

   ```bash
   # PostgreSQL
   psql "postgres://user:pass@host:port/db" -c "SELECT 1;"

   # MySQL
   mysql -h host -P port -u user -p database -e "SELECT 1;"
   ```

3. **Use environment variables for credentials:**
   ```json
   {
     "db": {
       "connectionString": "{PLT_DATABASE_URL}"
     }
   }
   ```
   ```bash
   export PLT_DATABASE_URL="postgres://user:pass@localhost:5432/mydb"
   ```

#### Migrations Not Applied

**Problem:** "You have migrations to apply" error.

**Solution:**

````bash
# Apply pending migrations
wattpm db:migrations:apply
K```

### Application Discovery and Communication Issues

#### Application Not Found

**Problem:** "Application not found" or "Application with id 'X' is not started" errors.

**Solution:**

1. **Check running applications:**

   ```bash
   wattpm ps
   wattpm applications
````

2. **Verify application configuration:**

   ```bash
   wattpm config
   ```

3. **Check application health:**
   ```bash
   wattpm inject --path /health
   wattpm logs application-name
   ```

#### Port Already in Use

**Problem:** "EADDRINUSE: address already in use" error.

**Solution:**

```bash
# Find process using the port
lsof -i :3042
# or
netstat -tulpn | grep 3042

# Kill the process (replace PID with actual process ID)
kill -9 PID

# Or change the port in configuration
```

### Development and Hot Reload Issues

#### Changes Not Reflected

**Problem:** Code changes don't appear when running `wattpm dev`.

**Solution:**

1. **Check watch configuration:**

   ```json
   {
     "watch": {
       "enabled": true,
       "path": "./src",
       "ignore": ["*.test.js", "node_modules"]
     }
   }
   ```

2. **Restart development server:**

   ```bash
   # Stop current process (Ctrl+C)
   wattpm dev
   ```

3. **Check file permissions and symlinks:**
   ```bash
   ls -la ./src
   ```

### TypeScript Issues

#### TypeScript Compilation Errors

**Problem:** "Cannot find module" or TypeScript compilation errors.

**Solution:**

```bash
# Compile TypeScript plugins
wattpm build

# Generate TypeScript types
wattpm db:types

# Check TypeScript configuration
cat tsconfig.json
```

### Production Deployment Issues

#### Build Failures

**Problem:** Application fails to build for production.

**Solution:**

1. **Check dependencies:**

   ```bash
   wattpm install --production
   ```

2. **Compile all applications:**

   ```bash
   wattpm build
   ```

3. **Check for missing environment variables:**
   ```bash
   wattpm env
   ```

#### Performance Issues

**Problem:** Slow response times or high memory usage in production.

**Solution:**

1. **Enable metrics collection:**

   ```json
   {
     "metrics": {
       "enabled": true,
       "endpoint": "/metrics"
     }
   }
   ```

2. **Check logs for errors:**

   ```bash
   wattpm logs --level error
   ```

3. **Monitor resource usage:**
   ```bash
   wattpm inject --path /metrics
   ```

## Error Reference

### Configuration Errors

| Error Code                          | Description                        | Solution                                      |
| ----------------------------------- | ---------------------------------- | --------------------------------------------- |
| PLT_CONFIG_NO_CONFIG_FILE_FOUND     | Configuration file not found       | Create a `watt.json` or use `--config` option |
| PLT_CONFIG_CANNOT_PARSE_CONFIG_FILE | Invalid configuration file syntax  | Validate JSON/YAML syntax                     |
| PLT_CONFIG_VALIDATION_ERRORS        | Configuration doesn't match schema | Check configuration against schema            |
| PLT_CONFIG_ENV_VAR_MISSING          | Environment variable not set       | Set required environment variables            |

### Database Errors

| Error Code                                | Description                 | Solution                                  |
| ----------------------------------------- | --------------------------- | ----------------------------------------- |
| PLT_SQL_MAPPER_CONNECTION_STRING_REQUIRED | Missing database connection | Add `connectionString` to config          |
| PLT_DB_MIGRATIONS_TO_APPLY_ERROR          | Pending migrations          | Run `wattpm db:migrations:apply`          |
| PLT_DB_UNKNOWN_DATABASE_ERROR             | Unsupported database        | Use PostgreSQL, MySQL, MariaDB, or SQLite |

### Runtime Errors

| Error Code                          | Description             | Solution                               |
| ----------------------------------- | ----------------------- | -------------------------------------- |
| PLT_RUNTIME_EADDR_IN_USE            | Port already in use     | Change port or kill existing process   |
| PLT_RUNTIME_APPLICATION_NOT_FOUND   | Application not found   | Check application ID and configuration |
| PLT_RUNTIME_APPLICATION_NOT_STARTED | Application not running | Start application with `wattpm start`  |

For a complete list of error codes, see the [Error Reference](./errors.md).

## Debugging Techniques

### Enable Debug Logging

```bash
# Enable debug logs
DEBUG=platformatic:* wattpm dev

# Or set log level in configuration
{
  "server": {
    "logger": {
      "level": "debug"
    }
  }
}
```

### Use the Inspector

```bash
# Start with Node.js inspector
wattpm start --inspect

# Then connect Chrome DevTools or VS Code
```

### Check Application Health

```bash
# Test individual application endpoints
wattpm inject --path /health
wattpm inject --path /metrics
wattpm inject --path /documentation/json

# View application configuration
wattpm config application-name
```

### Monitor Logs in Real-time

```bash
# Stream all logs
wattpm logs

# Stream logs from specific application
wattpm logs my-app api-application

# Filter by log level
wattpm logs --level error
```

## Observability Architecture Diagrams

Understanding how observability works in Watt applications is crucial for effective debugging. Logs, telemetry tracing, and metrics have three completely different implementations and data flows.

### Logging Flow

Watt uses Pino for high-performance logging with centralized log streaming through the Runtime API:

```mermaid
graph TD
    A[Watt Application] --> B[Application Worker 1]
    A --> C[Application Worker 2]
    A --> D[Application Worker N]

    B --> E[Pino Logger]
    C --> F[Pino Logger]
    D --> G[Pino Logger]

    E --> H[Runtime Process]
    F --> H
    G --> H

    H --> I[Log Files<br/>pino-roll]
    H --> J[Management API<br/>getRuntimeLiveLogsStream]

    J --> K[wattpm logs<br/>command]

    L[External Log Aggregator<br/>ELK/Fluentd] --> I

    style A fill:#e1f5fe
    style H fill:#f3e5f5
    style K fill:#e8f5e8
    style L fill:#fff3e0
```

**Key Points:**

- Each worker application uses its own Pino logger instance
- All logs flow through the main Runtime process
- Runtime API provides live log streaming for CLI commands
- Logs are persisted to rotating files using pino-roll
- External systems can consume log files directly

### Telemetry Tracing Flow

Watt implements distributed tracing using OpenTelemetry with automatic span propagation across applications:

```mermaid
graph TD
    A[Incoming Request] --> B[Watt Application]
    B --> C[Fastify onRequest Hook]
    C --> D[OpenTelemetry Plugin<br/>startHTTPSpan]

    D --> E[Application Worker 1]
    D --> F[Application Worker 2]

    E --> G[Inter-application Call<br/>undici interceptor]
    F --> H[Database Query<br/>auto-instrumentation]

    G --> I[Trace Context<br/>Propagation]
    H --> I

    I --> J[OTLP Exporter]
    I --> K[Jaeger Exporter]
    I --> L[Zipkin Exporter]

    J --> M[OpenTelemetry Collector]
    K --> N[Jaeger Backend]
    L --> O[Zipkin Backend]

    M --> P[Observability Platform<br/>Jaeger/Grafana/etc]
    N --> P
    O --> P

    style A fill:#e1f5fe
    style D fill:#f3e5f5
    style I fill:#e8f5e8
    style P fill:#fff3e0
```

**Key Points:**

- Each application has its own OpenTelemetry plugin instance
- Traces automatically span across application boundaries
- Context propagation happens via HTTP headers
- Multiple exporter types supported (OTLP, Jaeger, Zipkin)
- Custom spans can be created using `app.openTelemetry.startSpan()`

### Metrics Collection Flow

Watt exposes Prometheus-compatible metrics through a dedicated metrics server:

```mermaid
graph TD
    A[Watt Application] --> B[Application Worker 1]
    A --> C[Application Worker 2]
    A --> D[Application Worker N]

    B --> E[Fastify Metrics<br/>@fastify/metrics]
    C --> F[Custom Metrics<br/>app.metrics.counter]
    D --> G[System Metrics<br/>Node.js metrics]

    E --> H[Runtime Process<br/>Metrics Aggregation]
    F --> H
    G --> H

    H --> I[Prometheus Server<br/>:9090/metrics]
    H --> J[Management API<br/>getRuntimeMetrics]

    I --> K[Prometheus Scraper]
    J --> L[wattpm metrics<br/>command]

    K --> M[Prometheus Database]
    M --> N[Grafana Dashboard]
    M --> O[Alertmanager]

    style A fill:#e1f5fe
    style H fill:#f3e5f5
    style I fill:#e8f5e8
    style M fill:#fff3e0
```

**Key Points:**

- Each worker collects its own metrics (HTTP, custom, system)
- Runtime process aggregates metrics from all workers
- Dedicated Prometheus server runs on separate port (default 9090)
- Metrics available in both text and JSON formats
- Built-in health check endpoints (/ready, /status)

### Observability Integration Patterns

For production deployments, these three systems work together:

```mermaid
graph LR
    A[Watt Application] --> B[Logs]
    A --> C[Traces]
    A --> D[Metrics]

    B --> E[ELK Stack]
    C --> F[Jaeger/Tempo]
    D --> G[Prometheus]

    E --> H[Unified Dashboard<br/>Grafana]
    F --> H
    G --> H

    H --> I[Alerting<br/>PagerDuty/Slack]
    H --> J[APM Analysis<br/>Error Correlation]

    style A fill:#e1f5fe
    style H fill:#f3e5f5
    style I fill:#ffebee
    style J fill:#e8f5e8
```

## Getting Additional Help

### Community Resources

- **Discord:** Join our [Discord server](https://discord.gg/platformatic) for real-time help
- **GitHub Issues:** Report bugs at [github.com/platformatic/platformatic](https://github.com/platformatic/platformatic/issues)
- **Documentation:** Search this documentation for specific topics

### Diagnostic Information

When asking for help, include this information:

```bash
# System information
node --version
npm --version
wattpm version

# Configuration (remove sensitive data)
cat watt.json

# Error logs
wattpm logs --level error > error.log

# Application status
wattpm ps
wattpm applications
```

### Creating Minimal Reproductions

1. **Create a minimal example:**

   ```bash
   wattpm create debug-app --skip-dependencies
   cd debug-app
   # Add only the problematic configuration
   ```

2. **Test the issue:**

   ```bash
   wattpm dev
   # Document the steps to reproduce
   ```

3. **Share the reproduction** with the community or support team.
