# Watt MCP Server

An MCP (Model Context Protocol) server for managing Watt application configurations. This server provides tools for Claude Code to help configure Platformatic Watt applications.

## Features

- **Configuration Guide**: Comprehensive guide with all details about Watt configurations
- **Read Configuration**: Parse Watt configuration files (JSON/YAML)
- **Validate Configuration**: Validate configs against JSON schema
- **Generate Configuration**: Create new configs with sensible defaults
- **Write Configuration**: Write configs and manage package.json dependencies automatically
- **Update Configuration**: Add/update services in runtime configs
- **Schema Access**: Get the full Watt JSON schema for reference

## Installation

### From npm (Recommended)

```bash
npm install -g @platformatic/watt-mcp-server
```

### From Source (For Development)

```bash
cd packages/watt-mcp-server
pnpm install
npm link
```

## Usage with Claude Code

Add this MCP server to your Claude Code configuration.

Create or edit `~/.claude.json` (note: it's `.claude.json` in your home directory, not `.claude/config.json`):

```json
{
  "mcpServers": {
    "watt": {
      "command": "watt-mcp-server"
    }
  }
}
```

**Important**:
- The configuration file is `~/.claude.json` (a file in your home directory)
- If the file already exists, it will contain other settings - just add the `mcpServers` section to the existing JSON
- Don't confuse this with `~/.claude/` (the directory)

After adding the configuration, restart Claude Code to load the MCP server.

**Note**: The `npm install -g` or `npm link` command makes the `watt-mcp-server` command available globally, so you don't need to specify full paths in the configuration.

## Available Tools

### get_configuration_guide

**IMPORTANT: Claude Code should read this first when working with Watt configurations.**

Get a comprehensive guide with complete information about Watt/Platformatic configurations, including:
- All application types (node, service, db, gateway) with required/optional config
- Runtime configuration structure
- Architecture patterns (standalone, gateway with services, multi-service)
- Entry file structures and code examples
- Common patterns (environment variables, service discovery, logging, metrics)
- Package.json requirements
- Best practices
- Troubleshooting tips

**Parameters:** None

**Example usage in Claude Code:**
> "Show me the Watt configuration guide"

**Why this tool exists:**
This tool provides Claude Code with all the knowledge needed to intelligently create and manipulate Watt configurations without asking the user for details. When Claude reads this guide, it understands:
- When services need server config vs. when they don't
- What dependencies are required for each type
- How to structure multi-service applications
- Best practices for production deployments

### read_watt_config

Read and parse a Watt configuration file.

**Parameters:**
- `path` (string, required): Path to the watt configuration file

**Example usage in Claude Code:**
> "Read my watt.json configuration"

### validate_watt_config

Validate a Watt configuration against the JSON schema.

**Parameters:**
- `path` (string): Path to the configuration file to validate
- `config` (object): Configuration object to validate (alternative to path)

**Example usage in Claude Code:**
> "Validate my watt.json file"

### write_watt_config

**PREFERRED TOOL for writing Watt/Platformatic config files.** Write a Watt configuration file and automatically manage package.json dependencies. Use this instead of Write tool for Watt configs.

**Parameters:**
- `path` (string, required): Path where to write the configuration
- `config` (object, required): Configuration object to write
- `serviceName` (string, optional): Name of the service for package.json (important for npm workspaces to avoid conflicts). Should match the service directory name.
- `updateDependencies` (boolean, optional): Whether to create/update package.json with required dependencies (default: true)

**Automatic Dependency Management:**
When writing a configuration, this tool will automatically:
- Create a `package.json` if it doesn't exist
- Add required dependencies based on the service type:
  - `node`: wattpm, @platformatic/node
  - `service`: wattpm, @platformatic/service
  - `db`: wattpm, @platformatic/db
  - `gateway`: wattpm, @platformatic/gateway
- Fix incorrect dependency versions (e.g., update `^2.0.0` to `^3.11.0`)
- Remove incompatible dependencies (`fastify`, old `platformatic` package)
- Fix the `start` script to use `"watt start"` (not `"platformatic start"`)
- Preserve other dependencies and scripts

### generate_watt_config

**PREFERRED TOOL for creating Watt/Platformatic configurations.** Generate a basic Watt configuration with common defaults.

**IMPORTANT: Use "node" type (default) for HTTP services like Fastify, Express, Koa. Only use "service" when you need Platformatic auto-generated features.**

**Parameters:**
- `type` (string): Type of application - `node`, `service`, `db`, `gateway`, or `runtime` (default: `node`)
  - **`node`**: For Fastify/Express/HTTP services (DEFAULT)
  - **`service`**: Only for Platformatic-specific features
  - **`db`**: Database with auto-APIs
  - **`gateway`**: API gateway
  - **`runtime`**: Multi-service config
- `serviceName` (string): Name of the service (default: `main`)
- `mainFile` (string): Main entry file for node type (default: `index.js`)
- `port` (number): Server port (optional for services behind a gateway, required for runtime entrypoint)
- `hostname` (string): Server hostname (default: `0.0.0.0`)
- `isStandalone` (boolean): Whether this is a standalone service (not behind a gateway) (default: `false`)
- `entrypoint` (string): For runtime type - REQUIRED - the service ID that should be the entrypoint (publicly exposed)
- `autoloadPath` (string): For runtime type - path to directory containing services to autoload (e.g., "./packages" or "./services"). Recommended for monorepo pattern.
- `autoloadExclude` (array): For runtime type with autoload - array of subdirectories to exclude from autoloading
- `includeLogger` (boolean): Include logger configuration (default: `true`)
- `includeMetrics` (boolean): Include metrics configuration (default: `false`)

**Important Notes:**
- **Type Defaults**: Always use "node" for HTTP services (Fastify, Express, etc.) unless you specifically need Platformatic features
- Services behind a gateway (default) don't need `server` configuration - the gateway handles routing
- Only standalone services (`isStandalone: true`) or services with explicit `port` will include server config
- Gateways always need server configuration
- Runtime configurations MUST specify an entrypoint
- If there is a gateway in the runtime, the gateway MUST be set as the entrypoint
- Use autoload for monorepo pattern - it auto-discovers services from a directory

**Example usage in Claude Code:**
> "Generate a Watt service configuration for a REST API behind a gateway"
> "Generate a standalone Watt service configuration on port 3000"

### add_service_to_runtime

Add or update a service in a Watt runtime configuration. Adds to the `applications` array (or throws an error if `autoload` is configured).

**Parameters:**
- `runtimeConfigPath` (string, required): Path to the runtime configuration file
- `serviceId` (string, required): ID of the service to add
- `servicePath` (string): Path to the service directory
- `serviceConfig` (string): Path to the service configuration file

**Note**: Cannot add services manually when autoload is configured. Services are automatically discovered from the autoload path.

**Example usage in Claude Code:**
> "Add a new API service at ./services/api to my watt.json"

### get_watt_schema

Get the JSON schema for Watt configuration.

**Parameters:** None

**Example usage in Claude Code:**
> "Show me the Watt configuration schema"

## Example Conversations with Claude Code

### Generate a new configuration

```
You: Generate a Watt service configuration for a REST API on port 3000 with metrics enabled

Claude Code will:
1. Use generate_watt_config tool
2. Show you the generated configuration
3. Ask if you want to save it
```

### Validate existing configuration

```
You: Check if my watt.json file is valid

Claude Code will:
1. Use read_watt_config to read the file
2. Use validate_watt_config to validate it
3. Report any validation errors with helpful suggestions
```

### Create multi-service setup

```
You: I want to create a Watt application with two Fastify services behind a gateway

Claude Code will:
1. Read the configuration guide to understand the architecture
2. Generate appropriate configurations using "node" type for Fastify services (with create() function)
3. Generate gateway configuration (with server config)
4. Create the runtime configuration with autoload or applications array
5. Set gateway as the entrypoint
6. Create directory structure and files
7. Set up package.json files with correct dependencies (@platformatic/node, fastify)
```

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Start the server directly (for testing)
pnpm start
```

## Testing the MCP Server

You can test the server is working by checking if Claude Code can see the tools:

```
You: What Watt configuration tools do you have available?

Claude Code should list all 7 tools provided by this MCP server.
```

To test the configuration guide:

```
You: Show me the Watt configuration guide

Claude Code will use the get_configuration_guide tool and display comprehensive information about Watt configurations.
```

## Architecture

The MCP server is built using:
- **@modelcontextprotocol/sdk**: MCP protocol implementation
- **wattpm**: Watt schema and configuration types
- **ajv**: JSON schema validation
- **yaml**: YAML parsing/serialization

## License

Apache 2.0
