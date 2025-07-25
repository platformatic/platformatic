/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export type CrudOperationAuth =
  | {
      /**
       * checks for the operation
       */
      checks?: {
        [k: string]: {
          [k: string]: unknown;
        };
      };
      /**
       * array of enabled field for the operation
       */
      fields?: string[];
    }
  | boolean;

export interface PlatformaticDB {
  basePath?: string;
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
          formatters?: {
            path: string;
          };
          timestamp?: "epochTime" | "unixTime" | "nullTime" | "isoTime";
          redact?: {
            paths: string[];
            censor?: string;
          };
          base?: {
            [k: string]: unknown;
          } | null;
          messageKey?: string;
          customLevels?: {
            [k: string]: unknown;
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
  db: {
    connectionString: string;
    schema?: string[];
    schemalock?:
      | boolean
      | {
          path?: string;
          [k: string]: unknown;
        };
    poolSize?: number;
    idleTimeoutMilliseconds?: number;
    queueTimeoutMilliseconds?: number;
    acquireLockTimeoutMilliseconds?: number;
    autoTimestamp?:
      | {
          createdAt?: string;
          updatedAt?: string;
          [k: string]: unknown;
        }
      | boolean;
    graphql?:
      | boolean
      | {
          graphiql?: boolean;
          include?: {
            [k: string]: boolean;
          };
          ignore?: {
            [k: string]:
              | boolean
              | {
                  [k: string]: boolean;
                };
          };
          subscriptionIgnore?: string[];
          schema?: string;
          schemaPath?: string;
          enabled?: boolean | string;
          [k: string]: unknown;
        };
    openapi?:
      | boolean
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
          allowPrimaryKeysInInput?: boolean;
          include?: {
            [k: string]: boolean;
          };
          ignore?: {
            [k: string]:
              | boolean
              | {
                  [k: string]: boolean;
                };
          };
          ignoreRoutes?: {
            method: string;
            path: string;
          }[];
          enabled?: boolean | string;
          /**
           * Base URL for generated Platformatic DB routes
           */
          prefix?: string;
        };
    include?: {
      [k: string]: boolean;
    };
    ignore?: {
      [k: string]: boolean;
    };
    limit?: {
      default?: number;
      max?: number;
      [k: string]: unknown;
    };
    events?:
      | boolean
      | {
          connectionString?: string;
          enabled?: boolean | string;
        };
    cache?: boolean;
    [k: string]: unknown;
  };
  authorization?: {
    /**
     * The password should be used to access routes under /_admin prefix and for admin access to REST and GraphQL endpoints with X-PLATFORMATIC-ADMIN-SECRET header.
     */
    adminSecret?: string;
    /**
     * The user metadata key to store user roles
     */
    roleKey?: string;
    /**
     * The user metadata path to store user roles
     */
    rolePath?: string;
    /**
     * The role name for anonymous users
     */
    anonymousRole?: string;
    jwt?: {
      secret?:
        | string
        | {
            [k: string]: unknown;
          };
      /**
       * the namespace for JWT custom claims
       */
      namespace?: string;
      jwks?:
        | boolean
        | {
            [k: string]: unknown;
          };
      [k: string]: unknown;
    };
    webhook?: {
      /**
       * the webhook url
       */
      url?: string;
    };
    rules?: (
      | {
          /**
           * the DB entity type to which the rule applies
           */
          entity?: string;
          /**
           * the role name to match the rule
           */
          role: string;
          /**
           * defaults for entity creation
           */
          defaults?: {
            [k: string]: string;
          };
          find?: CrudOperationAuth;
          save?: CrudOperationAuth;
          delete?: CrudOperationAuth;
          updateMany?: CrudOperationAuth;
        }
      | {
          /**
           * the DB entity types to which the rule applies
           */
          entities?: string[];
          /**
           * the role name to match the rule
           */
          role: string;
          /**
           * defaults for entity creation
           */
          defaults?: {
            [k: string]: string;
          };
          find?: CrudOperationAuth;
          save?: CrudOperationAuth;
          delete?: CrudOperationAuth;
          updateMany?: CrudOperationAuth;
        }
    )[];
  };
  migrations?: {
    /**
     * The path to the directory containing the migrations.
     */
    dir: string;
    /**
     * Table created to track schema version.
     */
    table?: string;
    validateChecksums?: boolean;
    /**
     * Whether to automatically apply migrations when running the migrate command.
     */
    autoApply?: boolean | string;
    /**
     * Force line ending on file when generating checksum. Value should be either CRLF (windows) or LF (unix/mac).
     */
    newline?: string;
    /**
     * For Postgres and MS SQL Server(will ignore for another DBs). Specifies schema to look to when validating `versions` table columns. For Postgres, run's `SET search_path = currentSchema` prior to running queries against db.
     */
    currentSchema?: string;
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
    /**
     * Should types be auto generated.
     */
    autogenerate?: string | boolean;
    /**
     * The path to the directory the types should be generated in.
     */
    dir?: string;
  };
  plugins?: {
    [k: string]: unknown;
  };
  telemetry?: {
    enabled?: boolean | string;
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
          type?: "console" | "otlp" | "zipkin" | "memory" | "file";
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
            /**
             * The path to write the traces to. Only for file exporter.
             */
            path?: string;
            [k: string]: unknown;
          };
          additionalProperties?: never;
          [k: string]: unknown;
        }[]
      | {
          type?: "console" | "otlp" | "zipkin" | "memory" | "file";
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
            /**
             * The path to write the traces to. Only for file exporter.
             */
            path?: string;
            [k: string]: unknown;
          };
          additionalProperties?: never;
          [k: string]: unknown;
        };
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
  runtime?: {
    preload?: string | string[];
    basePath?: string;
    workers?: number | string;
    logger?: {
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
      formatters?: {
        path: string;
      };
      timestamp?: "epochTime" | "unixTime" | "nullTime" | "isoTime";
      redact?: {
        paths: string[];
        censor?: string;
      };
      base?: {
        [k: string]: unknown;
      } | null;
      messageKey?: string;
      customLevels?: {
        [k: string]: unknown;
      };
      [k: string]: unknown;
    };
    server?: {
      hostname?: string;
      port?: number | string;
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
    };
    startTimeout?: number;
    restartOnError?: boolean | number;
    gracefulShutdown?: {
      runtime: number | string;
      service: number | string;
    };
    health?: {
      enabled?: boolean | string;
      interval?: number | string;
      gracePeriod?: number | string;
      maxUnhealthyChecks?: number | string;
      maxELU?: number | string;
      maxHeapUsed?: number | string;
      maxHeapTotal?: number | string;
      maxYoungGeneration?: number | string;
    };
    undici?: {
      agentOptions?: {
        [k: string]: unknown;
      };
      interceptors?:
        | {
            module: string;
            options: {
              [k: string]: unknown;
            };
            [k: string]: unknown;
          }[]
        | {
            Client?: {
              module: string;
              options: {
                [k: string]: unknown;
              };
              [k: string]: unknown;
            }[];
            Pool?: {
              module: string;
              options: {
                [k: string]: unknown;
              };
              [k: string]: unknown;
            }[];
            Agent?: {
              module: string;
              options: {
                [k: string]: unknown;
              };
              [k: string]: unknown;
            }[];
            [k: string]: unknown;
          };
      [k: string]: unknown;
    };
    httpCache?:
      | boolean
      | {
          store?: string;
          /**
           * @minItems 1
           */
          methods?: [string, ...string[]];
          cacheTagsHeader?: string;
          maxSize?: number;
          maxEntrySize?: number;
          maxCount?: number;
          [k: string]: unknown;
        };
    watch?: boolean | string;
    managementApi?:
      | boolean
      | string
      | {
          logs?: {
            maxSize?: number;
          };
        };
    metrics?:
      | boolean
      | {
          port?: number | string;
          enabled?: boolean | string;
          hostname?: string;
          endpoint?: string;
          auth?: {
            username: string;
            password: string;
          };
          labels?: {
            [k: string]: string;
          };
          readiness?:
            | boolean
            | {
                endpoint?: string;
                success?: {
                  statusCode?: number;
                  body?: string;
                };
                fail?: {
                  statusCode?: number;
                  body?: string;
                };
              };
          liveness?:
            | boolean
            | {
                endpoint?: string;
                success?: {
                  statusCode?: number;
                  body?: string;
                };
                fail?: {
                  statusCode?: number;
                  body?: string;
                };
              };
          additionalProperties?: never;
          [k: string]: unknown;
        };
    telemetry?: {
      enabled?: boolean | string;
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
            type?: "console" | "otlp" | "zipkin" | "memory" | "file";
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
              /**
               * The path to write the traces to. Only for file exporter.
               */
              path?: string;
              [k: string]: unknown;
            };
            additionalProperties?: never;
            [k: string]: unknown;
          }[]
        | {
            type?: "console" | "otlp" | "zipkin" | "memory" | "file";
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
              /**
               * The path to write the traces to. Only for file exporter.
               */
              path?: string;
              [k: string]: unknown;
            };
            additionalProperties?: never;
            [k: string]: unknown;
          };
    };
    inspectorOptions?: {
      host?: string;
      port?: number;
      breakFirstLine?: boolean;
      watchDisabled?: boolean;
      [k: string]: unknown;
    };
    serviceTimeout?: number | string;
    messagingTimeout?: number | string;
    env?: {
      [k: string]: string;
    };
    sourceMaps?: boolean;
    scheduler?: {
      enabled?: boolean | string;
      name: string;
      cron: string;
      callbackUrl: string;
      method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
      headers?: {
        [k: string]: string;
      };
      body?:
        | string
        | {
            [k: string]: unknown;
          };
      maxRetries?: number;
      [k: string]: unknown;
    }[];
  };
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
  put?: Operation1;
  post?: Operation1;
  delete?: Operation1;
  options?: Operation1;
  head?: Operation1;
  patch?: Operation1;
  trace?: Operation1;
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
export interface Operation1 {
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
   * This interface was referenced by `Operation1`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
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
