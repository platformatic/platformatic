import createError from '@fastify/error'

export const ERROR_PREFIX = 'PLT_GATEWAY'

export const FastifyInstanceIsAlreadyListeningError = createError(
  `${ERROR_PREFIX}_FASTIFY_INSTANCE_IS_ALREADY_LISTENING`,
  'Fastify instance is already listening. Cannot call "addGatewayOnRouteHook"!'
)
export const FailedToFetchOpenAPISchemaError = createError(
  `${ERROR_PREFIX}_FAILED_TO_FETCH_OPENAPI_SCHEMA`,
  'Failed to fetch OpenAPI schema from %s'
)
export const ValidationErrors = createError(`${ERROR_PREFIX}_VALIDATION_ERRORS`, 'Validation errors: %s')
export const PathAlreadyExistsError = createError(
  `${ERROR_PREFIX}_PATH_ALREADY_EXISTS`,
  'Path "%s" is exposed by both the "%s" and the "%s" applications. Set a different openapi.prefix on one of them to resolve the conflict.'
)
export const CouldNotReadOpenAPIConfigError = createError(
  `${ERROR_PREFIX}_COULD_NOT_READ_OPENAPI_CONFIG`,
  'Could not read openapi config for "%s" application'
)
export const InvalidOpenAPISchemaError = createError(
  `${ERROR_PREFIX}_INVALID_OPENAPI_SCHEMA`,
  'Failed to compose OpenAPI schemas: %s'
)
export const WsNoTcpUpstreamError = createError(
  `${ERROR_PREFIX}_WS_NO_TCP_UPSTREAM`,
  'Cannot proxy a WebSocket connection to the "%s" application because it does not expose a TCP server. Set "websocket": true on the application, make it listen on a TCP port (e.g. "useHttp": true), set "proxy.ws.upstream", or provide a custom "proxy.custom.getUpstream".',
  502
)
