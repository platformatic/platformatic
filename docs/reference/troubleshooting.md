# Troubleshooting

This section helps you diagnose and resolve common issues when working with Watt and Platformatic services.

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
   - `platformatic.json`
   - `platformatic.yml`
   - `platformatic.toml`

2. Check file format and syntax:
   ```bash
   # Validate JSON syntax
   cat watt.json | jq .
   
   # Or use the config validation
   wattpm config validate
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
   "postgres://username:password@host:port/database"
   
   // MySQL
   "mysql://username:password@host:port/database"
   
   // SQLite
   "sqlite://./path/to/database.sqlite"
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
```bash
# Apply pending migrations
platformatic db migrations apply

# Check migration status
platformatic db migrations status

# Create a new migration
platformatic db migrations create
```

### Service Discovery and Communication Issues

#### Service Not Found

**Problem:** "Service not found" or "Service with id 'X' is not started" errors.

**Solution:**
1. **Check running services:**
   ```bash
   wattpm ps
   wattpm services
   ```

2. **Verify service configuration:**
   ```bash
   wattpm config
   ```

3. **Check service health:**
   ```bash
   wattpm inject --path /health
   wattpm logs service-name
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
# or for individual services
platformatic service compile

# Generate TypeScript types
platformatic db types

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

2. **Compile all services:**
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

| Error Code | Description | Solution |
|------------|-------------|----------|
| PLT_CONFIG_NO_CONFIG_FILE_FOUND | Configuration file not found | Create a `watt.json` or use `--config` option |
| PLT_CONFIG_CANNOT_PARSE_CONFIG_FILE | Invalid configuration file syntax | Validate JSON/YAML syntax |
| PLT_CONFIG_VALIDATION_ERRORS | Configuration doesn't match schema | Check configuration against schema |
| PLT_CONFIG_ENV_VAR_MISSING | Environment variable not set | Set required environment variables |

### Database Errors

| Error Code | Description | Solution |
|------------|-------------|----------|
| PLT_SQL_MAPPER_CONNECTION_STRING_REQUIRED | Missing database connection | Add `connectionString` to config |
| PLT_DB_MIGRATIONS_TO_APPLY_ERROR | Pending migrations | Run `platformatic db migrations apply` |
| PLT_DB_UNKNOWN_DATABASE_ERROR | Unsupported database | Use PostgreSQL, MySQL, MariaDB, or SQLite |

### Runtime Errors

| Error Code | Description | Solution |
|------------|-------------|----------|
| PLT_RUNTIME_EADDR_IN_USE | Port already in use | Change port or kill existing process |
| PLT_RUNTIME_SERVICE_NOT_FOUND | Service not found | Check service ID and configuration |
| PLT_RUNTIME_APPLICATION_NOT_STARTED | Application not running | Start application with `wattpm start` |

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

### Check Service Health

```bash
# Test individual service endpoints
wattpm inject --path /health
wattpm inject --path /metrics
wattpm inject --path /documentation/json

# View service configuration
wattpm config service-name
```

### Monitor Logs in Real-time

```bash
# Stream all logs
wattpm logs

# Stream logs from specific service
wattpm logs my-app api-service

# Filter by log level
wattpm logs --level error
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

# Service status
wattpm ps
wattpm services
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