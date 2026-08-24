import Ajv from 'ajv'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { CapabilitySchemaNotFoundError, InvalidApplicationConfigurationError } from './errors.js'

/*
  The AJV custom keywords are one of the deliberately-kept pieces, carried over as code by explicit
  decision rather than by surviving a refactor. They are re-implemented here rather than imported
  from the v3 configuration module, which leaves foundation with migrate's legacy reader.

  The root they resolve against is the application's, not the runtime's: a capability's config is
  written where the application lives, so a relative path in it means a path from there.
*/
export function createCapabilityValidator (schema, { root, fixPaths = true, useDefaults = true } = {}) {
  // Coercion is disabled in v4. Its only justification was placeholder strings, and on the genuine
  // unions that survive the audit — boolean | number, boolean | object — AJV coercion is a
  // documented hazard in this very codebase.
  const ajv = new Ajv({ useDefaults, coerceTypes: false, allErrors: true, strict: false })

  ajv.addKeyword({
    keyword: 'resolvePath',
    type: 'string',
    schemaType: 'boolean',
    validate (_schema, path, parentSchema, data) {
      if (typeof path !== 'string' || path.trim() === '') {
        return Boolean(parentSchema.allowEmptyPaths)
      }

      if (fixPaths) {
        data.parentData[data.parentDataProperty] = resolve(root, path)
      }

      return true
    }
  })

  ajv.addKeyword({ keyword: 'allowEmptyPaths', type: 'string', schemaType: 'boolean' })

  ajv.addKeyword({
    keyword: 'resolveModule',
    type: 'string',
    schemaType: 'boolean',
    validate (_schema, path, _parentSchema, data) {
      if (typeof path !== 'string' || path.trim() === '') {
        return false
      }

      if (!fixPaths) {
        return true
      }

      try {
        data.parentData[data.parentDataProperty] = createRequire(join(root, 'noop.js')).resolve(path)
        return true
      } catch {
        return false
      }
    }
  })

  ajv.addKeyword({
    keyword: 'typeof',
    validate: function validate (schema, value, _parentSchema, data) {
      // eslint-disable-next-line valid-typeof
      if (typeof value === schema) {
        return true
      }

      validate.errors = [{ message: `"${data.parentDataProperty}" should be a ${schema}.`, params: data.parentData }]
      return false
    }
  })

  return ajv.compile(schema)
}

/*
  The schema is imported through the capability's light subpath, resolved application-scoped first
  with the runtime-bundled fallback — the canonical capability resolution order, so the schema copy
  that validates is the same copy whose implementation the worker will load.

  The subpath is part of the v4 capability contract, and it is light only in import cost: it
  executes in the main process with full privileges, like any capability code. Falling back to the
  package's main entry is a transitional step: until every capability ships the subpath, boot would
  otherwise not be able to validate at all, and a validator that skips what it cannot import is not
  a validator. Removing the fallback is part of the capability work.
*/
export async function importCapabilitySchema (module, applicationRoot, { runtimeScope } = {}) {
  const scopes = [
    { scope: 'application', require: createRequire(join(applicationRoot, 'noop.js')) },
    // The bundled fallback resolves from the caller's position, not from this module's: foundation
    // is the lowest package in the graph and depends on no capability, so resolving from here would
    // make "runtime-bundled" name a place no capability has ever been installed.
    { scope: 'runtime', require: createRequire(runtimeScope ?? import.meta.filename) }
  ]

  for (const { scope, require } of scopes) {
    for (const [via, specifier] of [
      ['subpath', `${module}/schema`],
      ['entry', module]
    ]) {
      let resolved

      try {
        resolved = require.resolve(specifier)
      } catch {
        continue
      }

      const loaded = await import(pathToFileURL(resolved).href)

      if (loaded?.schema) {
        return {
          scope,
          via,
          path: resolved,
          schema: loaded.schema,
          // The package-level metadata main-side preparation needs besides the schema. An absent
          // servesWithoutPort means 'worker', which is what the serving predicate reads.
          metadata: {
            skipTelemetryHooks: loaded.skipTelemetryHooks ?? false,
            modulesToLoad: loaded.modulesToLoad ?? [],
            servesWithoutPort: loaded.servesWithoutPort ?? 'worker'
          }
        }
      }
    }
  }

  throw new CapabilitySchemaNotFoundError(module, applicationRoot)
}

/*
  AJV puts the offending property name in params rather than in the message, so the commonest
  mistake of all — a typo in an option name — reads as "must NOT have additional properties" and
  leaves the author to find which one. Naming it is the difference between an error you can act on
  and one you have to bisect.
*/
function describeFailure (error) {
  if (error.params?.additionalProperty) {
    return `must NOT have the additional property '${error.params.additionalProperty}'`
  }

  if (error.params?.allowedValues) {
    return `${error.message} (${error.params.allowedValues.join(', ')})`
  }

  return error.message
}

export function validateCapabilityConfiguration (config, schema, { id, module, root, fixPaths = true } = {}) {
  const validator = createCapabilityValidator(schema, { root, fixPaths })

  if (validator(config)) {
    return config
  }

  const failures = validator.errors.map(error => ({
    path: error.instancePath === '' ? '/' : error.instancePath,
    message: describeFailure(error),
    params: error.params
  }))

  const error = new InvalidApplicationConfigurationError(
    id,
    module,
    failures.map(failure => `\n  - ${failure.path}: ${failure.message}`).join('')
  )

  Object.defineProperty(error, 'validationErrors', { value: failures })
  throw error
}
