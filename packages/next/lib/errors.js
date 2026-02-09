import createError from '@fastify/error'

export const ERROR_PREFIX = 'PLT_NEXT'

export const StandaloneServerNotFound = createError(
  `${ERROR_PREFIX}_CANNOT_FIND_STANDALONE_SERVER`,
  'Cannot find server.js entrypoint in .next/standalone.'
)

export const CannotParseStandaloneServer = createError(
  `${ERROR_PREFIX}_CANNOT_PARSE_STANDALONE_SERVER`,
  'Cannot parse nextConfig from standalone server.js.'
)
