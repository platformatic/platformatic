import { create as createGateway } from '@platformatic/gateway'

// eslint-disable-next-line import-x/export
export * from '@platformatic/gateway'

// eslint-disable-next-line import-x/export
export async function create (configOrRoot, sourceOrConfig, context) {
  globalThis.platformatic.logger.warn(
    '@platformatic/composer is deprecated and it will be removed in version 4.0.0, please migrate to @platformatic/gateway.'
  )

  return createGateway(configOrRoot, sourceOrConfig, context)
}
