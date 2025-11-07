'use strict'

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { schema as wattSchema } from 'wattpm'
import { getConfigurationGuide } from './lib/configuration-guide.js'
import {
  readWattConfig,
  writeWattConfig,
  validateConfig,
  generateConfig,
  addServiceToRuntime
} from './lib/config.js'
import {
  updatePackageJsonDependencies,
  readOrCreatePackageJson
} from './lib/package-json.js'

// Re-export functions for backward compatibility with tests
export {
  getConfigurationGuide,
  readWattConfig,
  writeWattConfig,
  validateConfig,
  generateConfig,
  addServiceToRuntime,
  updatePackageJsonDependencies,
  readOrCreatePackageJson
}

/**
 * Create and start the MCP server
 */
export function createMCPServer () {
  const server = new Server(
    {
      name: 'watt-mcp-server',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  )

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'read_watt_config',
        description: 'Read and parse a Watt configuration file (JSON or YAML)',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the watt configuration file (watt.json, watt.yaml, etc.)'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'validate_watt_config',
        description: 'Validate a Watt configuration against the JSON schema',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the watt configuration file to validate'
            },
            config: {
              type: 'object',
              description: 'Configuration object to validate (alternative to path)'
            }
          }
        }
      },
      {
        name: 'write_watt_config',
        description: 'PREFERRED TOOL for writing Watt/Platformatic config files. Write a Watt configuration file (JSON or YAML) and automatically manage package.json dependencies. Use this instead of Write tool for Watt configs.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path where to write the configuration file'
            },
            config: {
              type: 'object',
              description: 'Configuration object to write'
            },
            serviceName: {
              type: 'string',
              description: 'Name of the service for package.json (important for npm workspaces to avoid conflicts). Should match the service directory name.'
            },
            updateDependencies: {
              type: 'boolean',
              description: 'Whether to create/update package.json with required dependencies',
              default: true
            }
          },
          required: ['path', 'config']
        }
      },
      {
        name: 'generate_watt_config',
        description: 'PREFERRED TOOL for creating Watt/Platformatic configurations. Generate a basic Watt configuration with common defaults. IMPORTANT: Use "node" type (default) for HTTP services like Fastify, Express, Koa. Only use "service" when you need Platformatic auto-generated features.',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['node', 'service', 'db', 'gateway', 'runtime'],
              description: 'Type of Platformatic application. Use "node" (default) for Fastify/Express/HTTP services. "service" only for Platformatic-specific features. "db" for database with auto-APIs. "gateway" for API gateway. "runtime" for multi-service config.',
              default: 'node'
            },
            serviceName: {
              type: 'string',
              description: 'Name of the service',
              default: 'main'
            },
            mainFile: {
              type: 'string',
              description: 'Main entry file for node type',
              default: 'index.js'
            },
            port: {
              type: 'number',
              description: 'Server port (optional for services behind a gateway, required for runtime entrypoint)'
            },
            hostname: {
              type: 'string',
              description: 'Server hostname',
              default: '0.0.0.0'
            },
            isStandalone: {
              type: 'boolean',
              description: 'Whether this is a standalone service (not behind a gateway). Standalone services need server config.',
              default: false
            },
            entrypoint: {
              type: 'string',
              description: 'For runtime type: REQUIRED - the service ID that should be the entrypoint (publicly exposed). This service handles all incoming HTTP requests. When using autoload, this must match a directory name in the autoload path.'
            },
            autoloadPath: {
              type: 'string',
              description: 'For runtime type: path to directory containing services to autoload (e.g., "./packages" or "./services"). Recommended for monorepo pattern.'
            },
            autoloadExclude: {
              type: 'array',
              items: { type: 'string' },
              description: 'For runtime type with autoload: array of subdirectories to exclude from autoloading'
            },
            includeLogger: {
              type: 'boolean',
              description: 'Include logger configuration',
              default: true
            },
            includeMetrics: {
              type: 'boolean',
              description: 'Include metrics configuration',
              default: false
            }
          }
        }
      },
      {
        name: 'add_service_to_runtime',
        description: 'Add or update a service in a Watt runtime configuration',
        inputSchema: {
          type: 'object',
          properties: {
            runtimeConfigPath: {
              type: 'string',
              description: 'Path to the runtime configuration file'
            },
            serviceId: {
              type: 'string',
              description: 'ID of the service to add'
            },
            servicePath: {
              type: 'string',
              description: 'Path to the service directory'
            },
            serviceConfig: {
              type: 'string',
              description: 'Path to the service configuration file'
            }
          },
          required: ['runtimeConfigPath', 'serviceId']
        }
      },
      {
        name: 'get_watt_schema',
        description: 'Get the JSON schema for Watt configuration',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get_configuration_guide',
        description: 'IMPORTANT: Read this first when working with Watt/Platformatic configurations. Get comprehensive guide with all details about application types, configuration structure, best practices, architecture patterns, and troubleshooting. This provides Claude with complete knowledge to create and manipulate configurations intelligently.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ]
  }))

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    try {
      switch (name) {
        case 'read_watt_config': {
          const { config, absolutePath } = await readWattConfig(args.path)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  path: absolutePath,
                  config
                }, null, 2)
              }
            ]
          }
        }

        case 'validate_watt_config': {
          let config
          if (args.path) {
            const result = await readWattConfig(args.path)
            config = result.config
          } else if (args.config) {
            config = args.config
          } else {
            throw new Error('Either path or config must be provided')
          }

          const validation = validateConfig(config)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(validation, null, 2)
              }
            ]
          }
        }

        case 'write_watt_config': {
          const absolutePath = await writeWattConfig(args.path, args.config)

          const result = {
            success: true,
            path: absolutePath,
            message: 'Configuration written successfully'
          }

          // Update package.json if requested (default true)
          if (args.updateDependencies !== false) {
            // Detect type from config
            let type = 'node'
            if (args.config.service) type = 'service'
            else if (args.config.db) type = 'db'
            else if (args.config.gateway) type = 'gateway'

            const pkgResult = await updatePackageJsonDependencies(args.path, type, args.serviceName)
            if (pkgResult.updated) {
              result.packageJson = {
                path: pkgResult.packageJsonPath,
                created: pkgResult.created,
                added: pkgResult.added,
                updatedVersions: pkgResult.updatedVersions,
                startScriptFixed: pkgResult.startScriptFixed
              }
              const updates = []
              if (pkgResult.added.length > 0) {
                updates.push(`added dependencies: ${pkgResult.added.join(', ')}`)
              }
              if (pkgResult.updatedVersions.length > 0) {
                updates.push(`updated versions: ${pkgResult.updatedVersions.join(', ')}`)
              }
              if (pkgResult.startScriptFixed) {
                updates.push('fixed start script to: watt start')
              }
              if (updates.length > 0) {
                result.message += `. Package.json ${pkgResult.created ? 'created' : 'updated'} with ${updates.join(', ')}`
              }
            }
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          }
        }

        case 'generate_watt_config': {
          const config = generateConfig(args)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(config, null, 2)
              }
            ]
          }
        }

        case 'add_service_to_runtime': {
          const { config: runtimeConfig } = await readWattConfig(args.runtimeConfigPath)

          const updatedConfig = addServiceToRuntime(runtimeConfig, {
            id: args.serviceId,
            path: args.servicePath,
            config: args.serviceConfig
          })

          await writeWattConfig(args.runtimeConfigPath, updatedConfig)

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: `Service '${args.serviceId}' added/updated successfully`,
                  config: updatedConfig
                }, null, 2)
              }
            ]
          }
        }

        case 'get_watt_schema': {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(wattSchema, null, 2)
              }
            ]
          }
        }

        case 'get_configuration_guide': {
          const guide = getConfigurationGuide()
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(guide, null, 2)
              }
            ]
          }
        }

        default:
          throw new Error(`Unknown tool: ${name}`)
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error.message,
              stack: error.stack
            }, null, 2)
          }
        ],
        isError: true
      }
    }
  })

  return server
}

/**
 * Start the MCP server with stdio transport
 */
export async function startServer () {
  const server = createMCPServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error('Watt MCP Server running on stdio')
}
