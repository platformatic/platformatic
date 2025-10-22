import Issues from '../../getting-started/issues.md';

# Watt CLI Commands

Watt provides two main CLI tools for different purposes:

- **`wattpm`** - Primary command for creating, managing, and running Watt applications
- **`platformatic`** - Legacy command with additional utilities and backwards compatibility

## Installation

Install Watt globally for the best development experience:

```bash
npm install -g wattpm
```

Or install as a project dependency:

```bash
npm install wattpm
# then run with npx
npx wattpm --help
```

## Global Options

These options are available for all `wattpm` commands:

- `-r, --no-pretty` - Disable pretty-printed output for logs and console messages
- `-v, --verbose` - Enable verbose output for detailed information
- `-V, --version` - Display the current wattpm version
- `-h, --help` - Show help information

## Core Watt Commands (`wattpm`)

These are the primary commands for working with Watt applications:

### `wattpm create` or `wattpm init`

Creates a new Watt application with interactive setup using `wattpm-utils`.

```bash
wattpm create my-app
wattpm init  # creates in current directory
```

**Options:**

- `-l, --latest` - Use the latest version of watt-utils
- `-c, --config <name>` - Configuration file name (default: `watt.json`)
- `-s, --skip-dependencies` - Don't install dependencies after creating files
- `-P, --package-manager <manager>` - Use specific package manager (`npm`, `yarn`, `pnpm`)
- `-M, --module <name>` - Additional application generator modules (can be used multiple times)

**Example:**

```bash
wattpm create my-api
wattpm init --skip-dependencies --package-manager pnpm
```

### `wattpm dev`

Starts your Watt application in development mode with hot reloading.

```bash
wattpm dev [directory]
```

**Options:**

- `-c, --config <path>` - Path to configuration file (auto-detected by default)

**Example:**

```bash
wattpm dev
wattpm dev ./my-app --config custom-watt.json
```

### `wattpm start`

Starts your Watt application in production mode.

```bash
wattpm start [directory]
```

**Options:**

- `-c, --config <path>` - Path to configuration file (auto-detected by default)
- `-i, --inspect` - Start Node.js inspector for debugging

**Example:**

```bash
wattpm start
wattpm start ./dist --inspect
```

### `wattpm build`

Builds all applications in your Watt application for production.

```bash
wattpm build [directory]
```

**Options:**

- `-c, --config <path>` - Path to configuration file (auto-detected by default)

**Example:**

```bash
wattpm build
wattpm build ./src --config watt.production.json
```

### `wattpm install`

Installs dependencies for the application and all its applications.

```bash
wattpm install [directory]
```

**Options:**

- `-c, --config <path>` - Path to configuration file
- `-p, --production` - Install only production dependencies
- `-P, --package-manager <manager>` - Use specific package manager

**Example:**

```bash
wattpm install --production
wattpm install --package-manager yarn
```

### `wattpm update`

Updates all Platformatic packages to their latest compatible versions.

```bash
wattpm update [directory]
```

**Options:**

- `-c, --config <path>` - Path to configuration file
- `-f, --force` - Force updates even if they violate package.json version ranges

**Example:**

```bash
wattpm update
wattpm update --force
```

## Application Management Commands

These commands help you manage running Watt applications:

### `wattpm ps`

Lists all currently running Watt applications.

```bash
wattpm ps
```

### `wattpm stop`

Stops a running Watt application.

```bash
wattpm stop [id]
```

**Arguments:**

- `id` - Process ID or application name (optional if only one app is running)

### `wattpm restart`

Restarts all applications in a running application (picks up application changes, not main config).

```bash
wattpm restart [id] [application...]
```

**Arguments:**

- `id` - Process ID or application name (optional if only one app is running)
- `application` - Name of the application to restart (if omitted, all applications are restarted).

### `wattpm reload`

Reloads a running application completely (picks up all changes including main config).

```bash
wattpm reload [id]
```

**Arguments:**

- `id` - Process ID or application name (optional if only one app is running)

## Application Management Commands

### `wattpm applications`

Lists all applications in a running application.

```bash
wattpm applications [id]
```

**Arguments:**

- `id` - Process ID or application name (optional if only one app is running)

### `wattpm import`

Imports an external application into your Watt application.

```bash
wattpm import [directory] [url]
```

**Arguments:**

- `directory` - Application directory (default: current directory)
- `url` - URL or GitHub repository to import (format: `user/repo` for GitHub)

**Options:**

- `-c, --config <path>` - Configuration file path
- `-i, --id <name>` - Service ID (default: repository basename)
- `-p, --path <path>` - Local path for the application (default: application ID)
- `-H, --http` - Use HTTP instead of SSH for GitHub URLs
- `-b, --branch <name>` - Branch to clone (default: `main`)
- `-s, --skip-dependencies` - Don't install application dependencies
- `-P, --package-manager <manager>` - Package manager to use

**Examples:**

```bash
wattpm import platformatic/hello-world
wattpm import https://github.com/user/my-application.git --id my-application
wattpm import --http --branch develop user/repo
```

### `wattpm-utils resolve`

Downloads and resolves all external applications defined in your configuration.

```bash
wattpm-utils resolve [directory]
```

**Options:**

- `-c, --config <path>` - Configuration file path
- `-u, --username <name>` - Username for private repositories
- `-p, --password <token>` - Password/token for private repositories
- `-s, --skip-dependencies` - Don't install application dependencies
- `-P, --package-manager <manager>` - Package manager to use

**Example:**

```bash
wattpm-utils resolve --username myuser --password $GITHUB_TOKEN
```

## Debugging and Inspection Commands

### `wattpm logs`

Streams logs from a running application or specific application.

```bash
wattpm logs [id] [application]
```

**Arguments:**

- `id` - Process ID or application name (optional if only one app is running)
- `application` - Specific application name (optional, streams from all applications if omitted)

**Example:**

```bash
wattpm logs
wattpm logs my-app api-application
```

### `wattpm inject`

Injects HTTP requests into a running application for testing.

```bash
wattpm inject [id] [application]
```

**Arguments:**

- `id` - Process ID or application name (optional if only one app is running)
- `application` - Application name (optional, uses entrypoint if omitted)

**Options:**

- `-m, --method <verb>` - HTTP method (default: `GET`)
- `-p, --path <path>` - Request path (default: `/`)
- `-H, --header <header>` - Request headers (can be used multiple times)
- `-d, --data <body>` - Request body data
- `-D, --data-file <file>` - Read request body from file
- `-o, --output <file>` - Write response to file
- `-f, --full-output` - Include response headers in output

**Examples:**

```bash
wattpm inject --path /api/health
wattpm inject --method POST --header "Content-Type: application/json" --data '{"name": "test"}'
wattpm inject my-app api-application --path /users --output response.json
```

### `wattpm env`

Displays environment variables for a running application or application.

```bash
wattpm env [id] [application]
```

**Arguments:**

- `id` - Process ID or application name (optional if only one app is running)
- `application` - Application name (optional, shows app-level env if omitted)

**Options:**

- `-t, --table` - Display variables in table format

**Example:**

```bash
wattpm env --table
wattpm env my-app database-application
```

### `wattpm config`

Displays configuration for a running application or application.

```bash
wattpm config [id] [application]
```

**Arguments:**

- `id` - Process ID or application name (optional if only one app is running)
- `application` - Application name (optional, shows app config if omitted)

**Example:**

```bash
wattpm config
wattpm config my-app api-application
```

## Performance Profiling Commands

### `wattpm pprof start`

Starts CPU profiling for applications in a running application.

```bash
wattpm pprof start [id] [application]
```

**Arguments:**

- `id` - Process ID or application name (optional if only one app is running)
- `application` - Application name (optional, profiles all applications if omitted)

**Example:**

```bash
wattpm pprof start                      # Start profiling all applications (auto-detect runtime)
wattpm pprof start api-application          # Start profiling specific application (auto-detect runtime)
wattpm pprof start my-app               # Start profiling all applications in specific app
wattpm pprof start my-app api-application   # Start profiling specific application in specific app
wattpm pprof start 12345 api-application    # Start profiling specific application using PID
```

### `wattpm pprof stop`

Stops CPU profiling and saves profile data as `pprof-{application}-{timestamp}.pb` files.

```bash
wattpm pprof stop [id] [application]
```

**Arguments:**

- `id` - Process ID or application name (optional if only one app is running)
- `application` - Application name (optional, stops profiling all applications if omitted)

**Example:**

```bash
wattpm pprof stop                      # Stop profiling all applications (auto-detect runtime)
wattpm pprof stop api-application          # Stop profiling specific application (auto-detect runtime)
wattpm pprof stop my-app               # Stop profiling all applications in specific app
wattpm pprof stop my-app api-application   # Stop profiling specific application in specific app
wattpm pprof stop 12345 api-application    # Stop profiling specific application using PID
```

## Advanced Commands

### `wattpm patch-config`

Applies configuration patches using JavaScript files.

```bash
wattpm patch-config [directory] <patch-file>
```

**Arguments:**

- `directory` - Application directory (default: current directory)
- `patch-file` - JavaScript file that exports a patch function

**Options:**

- `-c, --config <path>` - Configuration file path

**Patch file format:**

```javascript
// patch.js
export default function  (runtime, applications) {
  return {
    runtime: [
      /* JSON Patch operations for runtime config */
    ],
    applications: [
      /* JSON Patch operations for application configs */
    ]
  }
}
```

**Example:**

```bash
wattpm patch-config ./patches/production.js
```

### `wattpm admin`

Starts the Watt administration web interface.

```bash
wattpm admin [latest]
```

**Options:**

- `-l, --latest` - Use the latest version of watt-admin
- `-P, --package-manager <manager>` - Package manager for installing watt-admin

**Example:**

```bash
wattpm admin latest
```

## Utility Commands

### `wattpm help`

Displays help information.

```bash
wattpm help [command]
```

**Arguments:**

- `command` - Show help for a specific command

**Example:**

```bash
wattpm help
wattpm help create
```

### `wattpm version`

Displays the current Watt version.

```bash
wattpm version
```

## Configuration Files

Watt automatically detects configuration files in this order:

1. `watt.json` / `watt.json5`
2. `platformatic.json` / `platformatic.json5`
3. `platformatic.yml` / `platformatic.yaml`
4. `platformatic.tml` / `platformatic.toml`

For more details, see [Configuration File Formats](../../file-formats.md).

## Common Workflows

### Creating a New Application

```bash
# Create a new Watt app
wattpm create my-app
cd my-app

# Start in development mode
wattpm dev

# In another terminal, test it
wattpm inject --path /api/health
```

### Adding an External Service

```bash
# Import an application from GitHub
wattpm import platformatic/example-application

# Resolve all external applications
wattpm-utils resolve

# Restart to pick up changes
wattpm restart
```

### Production Deployment

```bash
# Build the application
wattpm build

# Start in production mode
wattpm start

# Monitor logs
wattpm logs
```

<Issues />
