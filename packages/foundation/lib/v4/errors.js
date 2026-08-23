import createError from '@fastify/error'
import { ERROR_PREFIX } from '../errors.js'

// The v4 loader carries its own error table rather than extending the v3 one: the v3
// configuration machinery moves out of foundation into wattpm-utils' migrate reader, and
// an error shared between the two would follow it.

export const AmbiguousConfigurationFileError = createError(
  `${ERROR_PREFIX}_AMBIGUOUS_CONFIGURATION_FILE`,
  'Multiple Watt configuration files found in %s: %s. Exactly one is allowed.'
)

export const LegacyConfigurationFileError = createError(
  `${ERROR_PREFIX}_LEGACY_CONFIGURATION_FILE`,
  '%s is a v3-era configuration. Watt v4 uses watt.config.ts.\n  Run:  npx wattpm-utils@4 migrate'
)

export const ConfigurationFileNotFoundError = createError(
  `${ERROR_PREFIX}_CONFIGURATION_FILE_NOT_FOUND`,
  'No Watt configuration file found in %s or its ancestors up to %s.'
)

export const InvalidConfigurationExportError = createError(
  `${ERROR_PREFIX}_INVALID_CONFIGURATION_EXPORT`,
  'The default export of %s is not a configuration object (received %s).'
)

export const NestedFunctionExportError = createError(
  `${ERROR_PREFIX}_NESTED_FUNCTION_EXPORT`,
  'The default export of %s is a function that returned another function.'
)

export const InvalidConfigValueError = createError(
  `${ERROR_PREFIX}_INVALID_CONFIG_VALUE`,
  'Invalid configuration value at %s: %s.'
)

export const DeferredSlotInApplicationDefinitionError = createError(
  `${ERROR_PREFIX}_DEFERRED_SLOT_IN_APPLICATION_DEFINITION`,
  '%s exports an application definition with a function at %s. Application definitions have no config slots; use the factory callback form instead.'
)

export const EnvFileNotFoundError = createError(
  `${ERROR_PREFIX}_ENV_FILE_NOT_FOUND`,
  'The env file %s does not exist.'
)

export const InvalidApplicationIdError = createError(
  `${ERROR_PREFIX}_INVALID_APPLICATION_ID`,
  'The application id %s (derived from %s) is not a valid DNS label, so it cannot be used as a mesh hostname. Set an explicit id on the entry.'
)

export const ConfigurationEvaluationTimeoutError = createError(
  `${ERROR_PREFIX}_CONFIGURATION_EVALUATION_TIMEOUT`,
  'Evaluating %s timed out after %dms.'
)
