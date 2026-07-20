import createError from '@fastify/error'

export const ERROR_PREFIX = 'PLT_NUXT'

export const UnsupportedSchedulerManifestVersionError = createError(
  `${ERROR_PREFIX}_UNSUPPORTED_SCHEDULER_MANIFEST_VERSION`,
  'Unsupported Nuxt scheduler manifest version "%s"'
)
