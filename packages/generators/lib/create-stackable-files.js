'use strict'

const JS_STACKABLE_INDEX_FILE = `\
'use strict'

const { platformaticService } = require('@platformatic/service')
const { schema } = require('./lib/schema')
const { Generator } = require('./lib/generator')

async function stackable (fastify, opts) {
  await fastify.register(platformaticService, opts)
  await fastify.register(require('./plugins/example'), opts)
}

stackable.configType = 'stackable'
stackable.schema = schema
stackable.Generator = Generator
stackable.configManagerConfig = {
  schema,
  envWhitelist: ['PORT', 'HOSTNAME'],
  allowToWatch: ['.env'],
  schemaOptions: {
    useDefaults: true,
    coerceTypes: true,
    allErrors: true,
    strict: false
  }
}

// break Fastify encapsulation
stackable[Symbol.for('skip-override')] = true

module.exports = stackable
`

const TS_STACKABLE_INDEX_FILE = `\
import { platformaticService, Stackable } from '@platformatic/service'
import { schema } from './lib/schema'
import { Generator } from './lib/generator'
import { StackableConfig } from './config'

const stackable: Stackable<StackableConfig> = async function (fastify, opts) {
  await fastify.register(platformaticService, opts)
  await fastify.register(require('./plugins/example'), opts)
}

stackable.configType = 'stackable'
stackable.schema = schema
stackable.Generator = Generator
stackable.configManagerConfig = {
  schema,
  envWhitelist: ['PORT', 'HOSTNAME'],
  allowToWatch: ['.env'],
  schemaOptions: {
    useDefaults: true,
    coerceTypes: true,
    allErrors: true,
    strict: false
  }
}

// break Fastify encapsulation
// @ts-ignore 
stackable[Symbol.for('skip-override')] = true

export default stackable
`

const INDEX_TYPES_FILE = `\
import { FastifyInstance } from 'fastify'
import { PlatformaticApp } from '@platformatic/service'
import { StackableConfig } from './config'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApp<StackableConfig>
  }
}
`

const JS_STACKABLE_GENERATOR_FILE = `\
'use strict'

const { Generator: ServiceGenerator } = require('@platformatic/service')
const { schema } = require('./schema')

class Generator extends ServiceGenerator {
  getDefaultConfig () {
    const defaultBaseConfig = super.getDefaultConfig()
    const defaultConfig = {
      greeting: 'Hello world!'
    }
    return Object.assign({}, defaultBaseConfig, defaultConfig)
  }

  async _getConfigFileContents () {
    const baseConfig = await super._getConfigFileContents()
    const config = {
      $schema: './stackable.schema.json',
      greeting: {
        text: this.config.greeting ?? 'Hello world!'
      }
    }
    return Object.assign({}, baseConfig, config)
  }

  async _afterPrepare () {
    this.addFile({
      path: '',
      file: 'stackable.schema.json',
      contents: JSON.stringify(schema, null, 2)
    })
  }
}

module.exports = Generator
module.exports.Generator = Generator
`

const TS_STACKABLE_GENERATOR_FILE = `\
import { Generator as ServiceGenerator } from '@platformatic/service'
import { BaseGenerator } from '@platformatic/generators'
import { schema } from './schema'

class Generator extends ServiceGenerator {
  getDefaultConfig (): BaseGenerator.JSONValue {
    const defaultBaseConfig = super.getDefaultConfig()
    const defaultConfig = {
      greeting: 'Hello world!'
    }
    return Object.assign({}, defaultBaseConfig, defaultConfig)
  }

  async _getConfigFileContents (): Promise<BaseGenerator.JSONValue> {
    const baseConfig = await super._getConfigFileContents()
    const config = {
      $schema: './stackable.schema.json',
      greeting: {
        text: this.config.greeting ?? 'Hello world!'
      }
    }
    return Object.assign({}, baseConfig, config)
  }

  async _afterPrepare () {
    this.addFile({
      path: '',
      file: 'stackable.schema.json',
      contents: JSON.stringify(schema, null, 2)
    })
  }
}

export default Generator
export { Generator }

`

const JS_STACKABLE_SCHEMA_FILE = `\
'use strict'

const { schema } = require('@platformatic/service')

const stackableSchema = {
  ...schema.schema,
  $id: 'stackable',
  title: 'Stackable Config',
  properties: {
    ...schema.schema.properties,
    greeting: {
      type: 'object',
      properties: {
        text: {
          type: 'string'
        }
      },
      required: ['text'],
      additionalProperties: false
    }
  },
}

module.exports.schema = stackableSchema

if (require.main === module) {
  console.log(JSON.stringify(stackableSchema, null, 2))
}
`

const TS_STACKABLE_SCHEMA_FILE = `\
import { schema } from '@platformatic/service'

const stackableSchema = {
  ...schema.schema,
  $id: 'stackable',
  title: 'Stackable Config',
  properties: {
    ...schema.schema.properties,
    greeting: {
      type: 'object',
      properties: {
        text: {
          type: 'string'
        }
      },
      required: ['text'],
      additionalProperties: false
    }
  },
}

export { stackableSchema as schema }

if (require.main === module) {
  console.log(JSON.stringify(stackableSchema, null, 2))
}
`

const STACKABLE_CONFIG_TYPES_FILE = `\
/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export interface StackableConfig {
  server?: {
    hostname?: string;
    port?: number | string;
    pluginTimeout?: number;
    healthCheck?:
      | boolean
      | {
          enabled?: boolean;
          interval?: number;
          [k: string]: unknown;
        };
    ignoreTrailingSlash?: boolean;
    ignoreDuplicateSlashes?: boolean;
    connectionTimeout?: number;
    keepAliveTimeout?: number;
    maxRequestsPerSocket?: number;
    forceCloseConnections?: boolean | string;
    requestTimeout?: number;
    bodyLimit?: number;
    maxParamLength?: number;
    disableRequestLogging?: boolean;
    exposeHeadRoutes?: boolean;
    logger?:
      | boolean
      | {
          level?: string;
          transport?:
            | {
                target?: string;
                options?: {
                  [k: string]: unknown;
                };
              }
            | {
                targets?: {
                  target?: string;
                  options?: {
                    [k: string]: unknown;
                  };
                  level?: string;
                  additionalProperties?: never;
                  [k: string]: unknown;
                }[];
                options?: {
                  [k: string]: unknown;
                };
              };
          pipeline?: {
            target?: string;
            options?: {
              [k: string]: unknown;
            };
          };
          [k: string]: unknown;
        };
    serializerOpts?: {
      schema?: {
        [k: string]: unknown;
      };
      ajv?: {
        [k: string]: unknown;
      };
      rounding?: "floor" | "ceil" | "round" | "trunc";
      debugMode?: boolean;
      mode?: "debug" | "standalone";
      largeArraySize?: number | string;
      largeArrayMechanism?: "default" | "json-stringify";
      [k: string]: unknown;
    };
    caseSensitive?: boolean;
    requestIdHeader?: string | false;
    requestIdLogLabel?: string;
    jsonShorthand?: boolean;
    trustProxy?: boolean | string | string[] | number;
    https?: {
      key:
        | string
        | {
            path?: string;
          }
        | (
            | string
            | {
                path?: string;
              }
          )[];
      cert:
        | string
        | {
            path?: string;
          }
        | (
            | string
            | {
                path?: string;
              }
          )[];
      requestCert?: boolean;
      rejectUnauthorized?: boolean;
    };
    cors?: {
      origin?:
        | boolean
        | string
        | (
            | string
            | {
                regexp: string;
                [k: string]: unknown;
              }
          )[]
        | {
            regexp: string;
            [k: string]: unknown;
          };
      methods?: string[];
      /**
       * Comma separated string of allowed headers.
       */
      allowedHeaders?: string;
      exposedHeaders?: string[] | string;
      credentials?: boolean;
      maxAge?: number;
      preflightContinue?: boolean;
      optionsSuccessStatus?: number;
      preflight?: boolean;
      strictPreflight?: boolean;
      hideOptionsRoute?: boolean;
    };
  };
  plugins?: {
    [k: string]: unknown;
  };
  metrics?:
    | boolean
    | {
        port?: number | string;
        hostname?: string;
        endpoint?: string;
        server?: "own" | "parent";
        auth?: {
          username: string;
          password: string;
        };
      };
  telemetry?: OpenTelemetry;
  watch?:
    | {
        enabled?: boolean | string;
        /**
         * @minItems 1
         */
        allow?: [string, ...string[]];
        ignore?: string[];
      }
    | boolean
    | string;
  $schema?: string;
  service?: {
    openapi?:
      | {
          info?: Info;
          jsonSchemaDialect?: string;
          servers?: Server[];
          paths?: Paths;
          webhooks?: {
            [k: string]: PathItemOrReference;
          };
          components?: Components;
          security?: SecurityRequirement[];
          tags?: Tag[];
          externalDocs?: ExternalDocumentation;
          /**
           * Base URL for the OpenAPI Swagger Documentation
           */
          swaggerPrefix?: string;
          /**
           * Path to an OpenAPI spec file
           */
          path?: string;
        }
      | boolean;
    graphql?:
      | {
          graphiql?: boolean;
        }
      | boolean;
  };
  clients?: {
    serviceId?: string;
    name?: string;
    type?: "openapi" | "graphql";
    path?: string;
    schema?: string;
    url?: string;
  }[];
  versions?: {
    /**
     * The path to the directory containing the versions mappers
     */
    dir: string;
    configs: {
      version: string;
      openapi?: {
        prefix?: string;
        path?: string;
      };
      plugins?:
        | {
            [k: string]: unknown;
          }
        | {
            [k: string]: unknown;
          };
    }[];
  };
  greeting?: {
    text: string;
  };
}
export interface OpenTelemetry {
  /**
   * The name of the service. Defaults to the folder name if not specified.
   */
  serviceName: string;
  /**
   * The version of the service (optional)
   */
  version?: string;
  /**
   * An array of paths to skip when creating spans. Useful for health checks and other endpoints that do not need to be traced.
   */
  skip?: {
    /**
     * The path to skip. Can be a string or a regex.
     */
    path?: string;
    /**
     * HTTP method to skip
     */
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
    [k: string]: unknown;
  }[];
  exporter?:
    | {
        type?: "console" | "otlp" | "zipkin" | "memory";
        /**
         * Options for the exporter. These are passed directly to the exporter.
         */
        options?: {
          /**
           * The URL to send the traces to. Not used for console or memory exporters.
           */
          url?: string;
          /**
           * Headers to send to the exporter. Not used for console or memory exporters.
           */
          headers?: {
            [k: string]: unknown;
          };
          [k: string]: unknown;
        };
        additionalProperties?: never;
        [k: string]: unknown;
      }[]
    | {
        type?: "console" | "otlp" | "zipkin" | "memory";
        /**
         * Options for the exporter. These are passed directly to the exporter.
         */
        options?: {
          /**
           * The URL to send the traces to. Not used for console or memory exporters.
           */
          url?: string;
          /**
           * Headers to send to the exporter. Not used for console or memory exporters.
           */
          headers?: {
            [k: string]: unknown;
          };
          [k: string]: unknown;
        };
        additionalProperties?: never;
        [k: string]: unknown;
      };
}
export interface Info {
  title: string;
  summary?: string;
  description?: string;
  termsOfService?: string;
  contact?: Contact;
  license?: License;
  version: string;
  /**
   * This interface was referenced by \`Info\`'s JSON-Schema definition
   * via the \`patternProperty\` "^x-".
   */
  [k: string]: unknown;
}
export interface Contact {
  name?: string;
  url?: string;
  email?: string;
  /**
   * This interface was referenced by \`Contact\`'s JSON-Schema definition
   * via the \`patternProperty\` "^x-".
   */
  [k: string]: unknown;
}
export interface License {
  name: string;
  identifier?: string;
  url?: string;
  /**
   * This interface was referenced by \`License\`'s JSON-Schema definition
   * via the \`patternProperty\` "^x-".
   */
  [k: string]: unknown;
}
export interface Server {
  url: string;
  description?: string;
  variables?: {
    [k: string]: ServerVariable;
  };
  /**
   * This interface was referenced by \`Server\`'s JSON-Schema definition
   * via the \`patternProperty\` "^x-".
   */
  [k: string]: unknown;
}
export interface ServerVariable {
  /**
   * @minItems 1
   */
  enum?: [string, ...string[]];
  default: string;
  description?: string;
  /**
   * This interface was referenced by \`ServerVariable\`'s JSON-Schema definition
   * via the \`patternProperty\` "^x-".
   */
  [k: string]: unknown;
}
export interface Paths {
  [k: string]: PathItem;
}
/**
 * This interface was referenced by \`Paths\`'s JSON-Schema definition
 * via the \`patternProperty\` "^/".
 */
export interface PathItem {
  summary?: string;
  description?: string;
  servers?: Server[];
  parameters?: ParameterOrReference[];
  get?: Operation;
  put?: Operation;
  post?: Operation;
  delete?: Operation;
  options?: Operation;
  head?: Operation;
  patch?: Operation;
  trace?: Operation;
  /**
   * This interface was referenced by \`PathItem\`'s JSON-Schema definition
   * via the \`patternProperty\` "^x-".
   */
  [k: string]: unknown;
}
export interface ParameterOrReference {
  [k: string]: unknown;
}
export interface Operation {
  tags?: string[];
  summary?: string;
  description?: string;
  externalDocs?: ExternalDocumentation;
  operationId?: string;
  parameters?: ParameterOrReference[];
  requestBody?: RequestBodyOrReference;
  responses?: Responses;
  callbacks?: {
    [k: string]: CallbacksOrReference;
  };
  security?: SecurityRequirement[];
  servers?: Server[];
  /**
   * This interface was referenced by \`Operation\`'s JSON-Schema definition
   * via the \`patternProperty\` "^x-".
   */
  [k: string]: unknown;
}
export interface ExternalDocumentation {
  description?: string;
  url: string;
  /**
   * This interface was referenced by \`ExternalDocumentation\`'s JSON-Schema definition
   * via the \`patternProperty\` "^x-".
   */
  [k: string]: unknown;
}
export interface RequestBodyOrReference {
  [k: string]: unknown;
}
export interface Responses {
  [k: string]: ResponseOrReference;
}
export interface ResponseOrReference {
  [k: string]: unknown;
}
export interface CallbacksOrReference {
  [k: string]: unknown;
}
export interface SecurityRequirement {
  [k: string]: string[];
}
export interface PathItemOrReference {
  [k: string]: unknown;
}
export interface Components {
  schemas?: {
    [k: string]: unknown;
  };
  responses?: {
    [k: string]: ResponseOrReference;
  };
  parameters?: {
    [k: string]: ParameterOrReference;
  };
  examples?: {
    [k: string]: ExampleOrReference;
  };
  requestBodies?: {
    [k: string]: RequestBodyOrReference;
  };
  headers?: {
    [k: string]: HeaderOrReference;
  };
  securitySchemes?: {
    [k: string]: SecuritySchemeOrReference;
  };
  links?: {
    [k: string]: LinkOrReference;
  };
  callbacks?: {
    [k: string]: CallbacksOrReference;
  };
  pathItems?: {
    [k: string]: PathItemOrReference;
  };
  /**
   * This interface was referenced by \`Components\`'s JSON-Schema definition
   * via the \`patternProperty\` "^x-".
   */
  [k: string]: unknown;
}
export interface ExampleOrReference {
  [k: string]: unknown;
}
export interface HeaderOrReference {
  [k: string]: unknown;
}
export interface SecuritySchemeOrReference {
  [k: string]: unknown;
}
export interface LinkOrReference {
  [k: string]: unknown;
}
export interface Tag {
  name: string;
  description?: string;
  externalDocs?: ExternalDocumentation;
  /**
   * This interface was referenced by \`Tag\`'s JSON-Schema definition
   * via the \`patternProperty\` "^x-".
   */
  [k: string]: unknown;
}
`

function generateStackableFiles (typescript) {
  if (typescript) {
    return [
      {
        path: '',
        file: 'index.ts',
        contents: TS_STACKABLE_INDEX_FILE
      },
      {
        path: '',
        file: 'index.d.ts',
        contents: INDEX_TYPES_FILE
      },
      {
        path: '',
        file: 'config.d.ts',
        contents: STACKABLE_CONFIG_TYPES_FILE
      },
      {
        path: 'lib',
        file: 'generator.ts',
        contents: TS_STACKABLE_GENERATOR_FILE
      },
      {
        path: 'lib',
        file: 'schema.ts',
        contents: TS_STACKABLE_SCHEMA_FILE
      }
    ]
  }
  return [
    {
      path: '',
      file: 'index.js',
      contents: JS_STACKABLE_INDEX_FILE
    },
    {
      path: '',
      file: 'index.d.ts',
      contents: INDEX_TYPES_FILE
    },
    {
      path: '',
      file: 'config.d.ts',
      contents: STACKABLE_CONFIG_TYPES_FILE
    },
    {
      path: 'lib',
      file: 'generator.js',
      contents: JS_STACKABLE_GENERATOR_FILE
    },
    {
      path: 'lib',
      file: 'schema.js',
      contents: JS_STACKABLE_SCHEMA_FILE
    }
  ]
}

module.exports = {
  generateStackableFiles
}
