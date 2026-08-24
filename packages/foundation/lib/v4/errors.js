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

export const ApplicationShorthandConflictError = createError(
  `${ERROR_PREFIX}_APPLICATION_SHORTHAND_CONFLICT`,
  '%s declares the singular application shorthand alongside %s. The shorthand is only for genuinely single-application projects.'
)

export const RootConfigurationInApplicationEntryError = createError(
  `${ERROR_PREFIX}_ROOT_CONFIGURATION_IN_APPLICATION_ENTRY`,
  '%s is the configuration of application %s but classifies as a root configuration. A root configuration cannot nest inside an application entry.'
)

export const ApplicationConfiguredTwiceError = createError(
  `${ERROR_PREFIX}_APPLICATION_CONFIGURED_TWICE`,
  'Application %s has an inline config in the root configuration and a configuration file at %s. Remove one of them.'
)

export const ApplicationStartsNothingError = createError(
  `${ERROR_PREFIX}_APPLICATION_STARTS_NOTHING`,
  'Application %s would start nothing: %s does not serve without a listener under %s, and the application declares neither server.port nor application.commands.%s.'
)

export const CapabilitySchemaNotFoundError = createError(
  `${ERROR_PREFIX}_CAPABILITY_SCHEMA_NOT_FOUND`,
  'Cannot import the schema of %s from %s, nor from the copy bundled with the runtime. A v4 capability exports one from its /schema subpath.'
)

export const InvalidApplicationConfigurationError = createError(
  `${ERROR_PREFIX}_INVALID_APPLICATION_CONFIGURATION`,
  'The configuration of application %s does not validate against the %s schema:%s'
)

export const CapabilityNotResolvableError = createError(
  `${ERROR_PREFIX}_CAPABILITY_NOT_RESOLVABLE`,
  'Cannot resolve %s from %s, nor from the copy bundled with the runtime.'
)

export const CapabilityVersionSkewError = createError(
  `${ERROR_PREFIX}_CAPABILITY_VERSION_SKEW`,
  '%s'
)

export const AmbiguousCapabilityError = createError(
  `${ERROR_PREFIX}_AMBIGUOUS_CAPABILITY`,
  'Application %s declares more than one capability dependency: %s. Add a configuration file naming the one it uses.'
)

export const CapabilityNotDetectedError = createError(
  `${ERROR_PREFIX}_CAPABILITY_NOT_DETECTED`,
  'Cannot detect the capability of application %s: %s declares no capability dependency, no known framework and no JavaScript sources.'
)

export const ObjectSourceRootRequiredError = createError(
  `${ERROR_PREFIX}_OBJECT_SOURCE_ROOT_REQUIRED`,
  'Provide the root argument when passing a configuration object: it stands in for the directory a configuration file would have been read from.'
)

export const EnvFileOnInlineConfigError = createError(
  `${ERROR_PREFIX}_ENV_FILE_ON_INLINE_CONFIG`,
  'Application %s declares an envfile but carries an inline config, so no file is read for it and the envfile would govern the worker environment alone.'
)

export const EnvFileOnDecidingDirectoryError = createError(
  `${ERROR_PREFIX}_ENV_FILE_ON_DECIDING_DIRECTORY`,
  'Application %s declares an envfile and its directory is the directory of %s. Applying it would mean reading the configuration in order to build the environment that produces the configuration.'
)

export const EnvFileNotFoundError = createError(
  `${ERROR_PREFIX}_ENV_FILE_NOT_FOUND`,
  'The env file %s does not exist.'
)

export const InvalidApplicationIdError = createError(
  `${ERROR_PREFIX}_INVALID_APPLICATION_ID`,
  'The application id %s (derived from %s) is not a valid DNS label, so it cannot be used as a mesh hostname. Set an explicit id on the entry.'
)

export const InvalidRootConfigurationError = createError(
  `${ERROR_PREFIX}_INVALID_ROOT_CONFIGURATION`,
  'The configuration %s does not validate: %s'
)

export const ConfigurationEvaluationTimeoutError = createError(
  `${ERROR_PREFIX}_CONFIGURATION_EVALUATION_TIMEOUT`,
  'Evaluating %s timed out after %dms.'
)

export const EvaluationEndedWithoutResultError = createError(
  `${ERROR_PREFIX}_EVALUATION_ENDED_WITHOUT_RESULT`,
  'Evaluating %s ended without a result (worker exit code %d). A configuration that never resolves, or that calls process.exit, ends this way.'
)
