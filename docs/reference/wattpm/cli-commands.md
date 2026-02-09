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
- `-S, --socket <path>` - Path for the control socket. If not specified, the default platform-specific location is used.
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

You can also trigger manual reloading by typing `rs` followed by a carriage return.

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

### `wattpm applications:add`

Adds new applications to a running application from a configuration file.

```bash
wattpm applications:add [id] path1 [path2] [...]
```

**Arguments:**

- `id` - Process ID or application name (optional if only one app is running)
- `paths` - A folder containing an application or a JSON file containing the applications to add

**Options:**

- `-s, --save` - Save the added applications to the application configuration file

**Note:** If the `paths` argument is a path to a JSON file, it should be an array. The contents follow the same format of the [application](../runtime/configuration#applications) property.

### `wattpm applications:remove`

Removes applications from a running application.

```bash
wattpm applications:remove [id] application1 [application2] [...]
```

**Arguments:**

- `id` - Process ID or application name (optional if only one app is running)
- `applications` - List of application IDs to remove

**Options:**

- `-s, --save` - Remove the applications from the application configuration file

**Example:**

```bash
wattpm applications:remove my-app api-app database-app --save
```

### `wattpm import`

Imports an external application into your Watt application.

```bash
wattpm import [directory] [url]
```

**Arguments:**

- `directory` - Application directory (default: current directory)
- `url` - URL or GitHub repository to import. Supports multiple formats:
  - GitHub shorthand: `user/repo`
  - Git URL: `https://github.com/user/repo.git`
  - Git URL with branch fragment: `https://github.com/user/repo.git#branch-name`

**Options:**

- `-c, --config <path>` - Configuration file path
- `-i, --id <name>` - Service ID (default: repository basename)
- `-p, --path <path>` - Local path for the application (default: application ID)
- `-H, --http` - Use HTTP instead of SSH for GitHub URLs
- `-b, --branch <name>` - Branch to clone (overrides URL fragment, default: `main`)
- `-s, --skip-dependencies` - Don't install application dependencies
- `-P, --package-manager <manager>` - Package manager to use

**Branch Specification:**

You can specify a branch in two ways during import:

1. **URL Fragment**: Append `#branch-name` to the git URL
2. **Flag**: Use the `-b/--branch` flag (takes precedence over URL fragment)

**Note:** When manually editing the configuration file to add applications with URLs, you must use the URL fragment syntax (`url#branch`) to specify a branch, as the `-b` flag is only available during the `import` command.

**Examples:**

```bash
# Import using GitHub shorthand
wattpm import platformatic/hello-world

# Import with explicit ID
wattpm import https://github.com/user/my-application.git --id my-application

# Import specific branch using URL fragment
wattpm import https://github.com/user/repo.git#develop

# Import specific branch using flag
wattpm import --http --branch develop user/repo

# Flag overrides URL fragment (will clone 'main' branch)
wattpm import https://github.com/user/repo.git#develop -b main
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

**Branch Specification in Configuration:**

When manually editing your configuration file to add applications with git URLs, specify branches using the URL fragment syntax (`url#branch`):

```json
{
  "web": [
    {
      "id": "my-app",
      "url": "https://github.com/user/repo.git#develop"
    }
  ]
}
```

Example:

```bash
wattpm-utils resolve --username myuser --password $GITHUB_TOKEN
```

**Packages Specification in Configuration:**

You can specify npm packages, including version, by using the `npm:` protocol in the URL:

```json
{
  "web": [
    {
      "id": "my-app",
      "url": "npm:myapp"
    }
  ]
}
```

The example above will install the latest version. But you can provide a version (including semver ranges):

```json
{
  "web": [
    {
      "id": "my-app",
      "url": "npm:myapp@0.2.0"
    }
  ]
}
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

### `wattpm repl`

Starts an interactive Node.js REPL (Read-Eval-Print Loop) session inside a running application's worker thread. This allows you to inspect and interact with your application at runtime for debugging and exploration.

```bash
wattpm repl [id] <application>
```

**Arguments:**

- `id` - Process ID or runtime name (optional if only one runtime is running)
- `application` - Application name (if omitted, auto-connects when single application or lists available applications)

**Available Context:**

The REPL session provides access to:

- `app` - The Fastify application instance (for service-based applications)
- `capability` - The application capability object with configuration and methods
- `platformatic` - The global platformatic object with messaging, events, and configuration
- `config` - The application's configuration object
- `logger` - The application logger

**REPL Commands:**

Standard Node.js REPL commands are available:

- `.exit` - Exit the REPL session
- `.help` - Show available REPL commands
- `.break` - Clear the current multi-line expression
- `.clear` - Reset the REPL context
- `.save <file>` - Save REPL history to a file
- `.load <file>` - Load a file into the REPL session

**Examples:**

```bash
# Auto-connect if single application, or list available applications
wattpm repl

# Start REPL in a specific application
wattpm repl api-service

# Start REPL with explicit runtime name and application
wattpm repl my-app api-service

# Start REPL using runtime PID
wattpm repl 12345 api-service
```

**Example REPL Session:**

```javascript
api-service> app.server.address()
{ address: '::', family: 'IPv6', port: 3000 }

api-service> Object.keys(platformatic)
[ 'logger', 'events', 'messaging', 'config', ... ]

api-service> config.id
'api-service'

api-service> await app.inject({ method: 'GET', url: '/health' })
{ statusCode: 200, ... }

api-service> .exit
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
export default function (runtime, applications) {
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
