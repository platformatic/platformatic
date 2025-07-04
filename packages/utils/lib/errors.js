import createError from '@fastify/error'

export const ERROR_PREFIX = 'PLT_UTILS'

export function ensureLoggableError (error) {
  Reflect.defineProperty(error, 'message', { enumerable: true })

  if ('code' in error) {
    Reflect.defineProperty(error, 'code', { enumerable: true })
  }

  if ('stack' in error) {
    Reflect.defineProperty(error, 'stack', { enumerable: true })
  }

  return error
}

export const PathOptionRequiredError = createError(`${ERROR_PREFIX}_PATH_OPTION_REQUIRED`, 'path option is required')
