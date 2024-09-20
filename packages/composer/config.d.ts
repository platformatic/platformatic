/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export interface PlatformaticComposer {
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
          level: (
            | ("fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent")
            | {
                [k: string]: unknown;
              }
          ) &
            string;
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
    loggerInstance?: {
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
    http2?: boolean;
    https?: {
      allowHTTP1?: boolean;
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
  composer: {
    services: {
      id: string;
      origin?: string;
      openapi?: {
        [k: string]: unknown;
      };
      graphql?:
        | boolean
        | {
            host?: string;
            name?: string;
            graphqlEndpoint?: string;
            composeEndpoint?: string;
            entities?: {
              /**
               * This interface was referenced by `undefined`'s JSON-Schema definition
               * via the `patternProperty` "^.*$".
               */
              [k: string]: {
                pkey?: string;
                resolver?: {
                  name: string;
                  argsAdapter?:
                    | {
                        [k: string]: unknown;
                      }
                    | string;
                  partialResults?:
                    | {
                        [k: string]: unknown;
                      }
                    | string;
                };
                fkeys?: {
                  type: string;
                  field?: string;
                  as?: string;
                  pkey?: string;
                  subgraph?: string;
                  resolver?: {
                    name: string;
                    argsAdapter?:
                      | {
                          [k: string]: unknown;
                        }
                      | string;
                    partialResults?:
                      | {
                          [k: string]: unknown;
                        }
                      | string;
                  };
                  [k: string]: unknown;
                }[];
                many?: {
                  type: string;
                  fkey: string;
                  as?: string;
                  pkey?: string;
                  subgraph?: string;
                  resolver: {
                    name: string;
                    argsAdapter?:
                      | {
                          [k: string]: unknown;
                        }
                      | string;
                    partialResults?:
                      | {
                          [k: string]: unknown;
                        }
                      | string;
                  };
                  [k: string]: unknown;
                }[];
                [k: string]: unknown;
              };
            };
          };
      proxy?:
        | false
        | {
            prefix: string;
          };
    }[];
    openapi?: {
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
      [k: string]: unknown;
    };
    graphql?: {
      graphiql?: boolean;
      onSubgraphError?: {
        [k: string]: unknown;
      };
      defaultArgsAdapter?:
        | {
            [k: string]: unknown;
          }
        | string;
      entities?: {
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^.*$".
         */
        [k: string]: {
          pkey?: string;
          resolver?: {
            name: string;
            argsAdapter?:
              | {
                  [k: string]: unknown;
                }
              | string;
            partialResults?:
              | {
                  [k: string]: unknown;
                }
              | string;
          };
          fkeys?: {
            type: string;
            field?: string;
            as?: string;
            pkey?: string;
            subgraph?: string;
            resolver?: {
              name: string;
              argsAdapter?:
                | {
                    [k: string]: unknown;
                  }
                | string;
              partialResults?:
                | {
                    [k: string]: unknown;
                  }
                | string;
            };
            [k: string]: unknown;
          }[];
          many?: {
            type: string;
            fkey: string;
            as?: string;
            pkey?: string;
            subgraph?: string;
            resolver: {
              name: string;
              argsAdapter?:
                | {
                    [k: string]: unknown;
                  }
                | string;
              partialResults?:
                | {
                    [k: string]: unknown;
                  }
                | string;
            };
            [k: string]: unknown;
          }[];
          [k: string]: unknown;
        };
      };
      addEntitiesResolvers?: boolean;
    };
    addEmptySchema?: boolean;
    refreshTimeout?: number;
  };
  metrics?:
    | boolean
    | {
        port?: number | string;
        hostname?: string;
        endpoint?: string;
        server?: "own" | "parent" | "hide";
        defaultMetrics?: {
          enabled: boolean;
        };
        auth?: {
          username: string;
          password: string;
        };
        labels?: {
          [k: string]: string;
        };
      };
  types?: {
    autogenerate?: boolean;
    /**
     * The path to the directory the types should be generated in.
     */
    dir?: string;
  };
  plugins?: {
    [k: string]: unknown;
  };
  clients?: {
    serviceId?: string;
    name?: string;
    type?: "openapi" | "graphql";
    path?: string;
    schema?: string;
    url?: string;
    fullResponse?: boolean;
    fullRequest?: boolean;
    validateResponse?: boolean;
  }[];
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
  module?: string;
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
   * This interface was referenced by `Info`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
export interface Contact {
  name?: string;
  url?: string;
  email?: string;
  /**
   * This interface was referenced by `Contact`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
export interface License {
  name: string;
  identifier?: string;
  url?: string;
  /**
   * This interface was referenced by `License`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
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
   * This interface was referenced by `Server`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
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
   * This interface was referenced by `ServerVariable`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
export interface Paths {
  [k: string]: PathItem;
}
/**
 * This interface was referenced by `Paths`'s JSON-Schema definition
 * via the `patternProperty` "^/".
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
   * This interface was referenced by `PathItem`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
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
   * This interface was referenced by `Operation`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
export interface ExternalDocumentation {
  description?: string;
  url: string;
  /**
   * This interface was referenced by `ExternalDocumentation`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
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
   * This interface was referenced by `Components`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
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
   * This interface was referenced by `Tag`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
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
