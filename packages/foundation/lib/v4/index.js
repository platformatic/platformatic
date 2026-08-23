// The v4 configuration loader. It is written new for v4 rather than carved out of the v3
// configuration machinery, and it shares nothing with it: the v3 parsers, replaceEnv, the YAML
// pre-pass, strictEnv and the $schema URL machinery move into wattpm-utils as migrate's private
// legacy reader. Only deliberately-kept pieces are carried over, each by explicit decision.
export * from './canonicalize.js'
export * from './capability-resolution.js'
export * from './classify.js'
export * from './context.js'
export * from './detect.js'
export * from './env.js'
export * from './evaluate.js'
export * from './errors.js'
export * as errors from './errors.js'
export * from './filenames.js'
export * from './identifiers.js'
export * from './load.js'
export * from './pipeline.js'
export * from './scope.js'
export * from './topology.js'
