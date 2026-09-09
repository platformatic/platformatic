import { CapabilityFactoryKeyCollisionError, CapabilityFactoryOptionsRequiredError } from './errors.js'

/*
  The helper every capability implements its factory with, ~20 lines per package.

  Factory options are the capability's per-app configuration with the capability's namespaced block
  flattened into the top level (next.trailingSlash -> trailingSlash), while the shared blocks —
  logger, server, watch, application — keep their v3 positions. The application block deliberately
  stays nested: several capabilities define their own outputDirectory alongside
  application.outputDirectory, and hoisting both would collide.

  Flattening is defined over a list of blocks, not a single one: every vite-derived capability
  flattens vite plus its own block, while tanstack, which has no block of its own, flattens vite
  alone.
*/

// The assertion is not hypothetical. db's block carries a cache property and top-level cache
// exists in next's schema, so two capabilities meaning structurally different things at one
// flattened key is precisely the hazard the entry/factory split exists to prevent. It runs when
// the factory is defined — at import time — rather than when it is called, so a capability whose
// schema grew a colliding key cannot ship.
export function buildFlatteningPlan (module, schema, flatten, exclude = []) {
  const properties = schema?.properties ?? {}
  const retained = new Set(Object.keys(properties).filter(name => !flatten.includes(name)))
  const plan = new Map()

  for (const block of flatten) {
    const blockProperties = properties[block]?.properties ?? {}

    for (const key of Object.keys(blockProperties)) {
      // A key the capability deliberately keeps nested. The per-capability assertion below cannot
      // see the hazard that motivates this one: two capabilities meaning structurally different
      // things at one flattened key — db's cache is a boolean, next's top-level cache is an object
      // — which is a decision the schema audit records rather than something a schema can detect.
      if (exclude.includes(key)) {
        continue
      }

      if (retained.has(key)) {
        throw new CapabilityFactoryKeyCollisionError(module, key, block, 'a retained top-level key of the same schema')
      }

      const claimed = plan.get(key)

      if (claimed) {
        throw new CapabilityFactoryKeyCollisionError(module, key, block, `the ${claimed} block`)
      }

      plan.set(key, block)
    }
  }

  return plan
}

/*
  Two overloads, not a union parameter. The callback form returns a deferred definition — a
  function the loader awaits — so reading .module on it is a type error until it has run. A single
  signature returning ApplicationDefinition for both forms would typecheck next(cb).module, which
  is exactly the mistake the deferred type exists to prevent.

  The implementation reuses classification rule 1: next(cb) returns async ctx => next(await cb(ctx))
  — the await is what makes the async half of the contract work, since the callback's promise must
  resolve before the factory sees the options. Serializability is untouched: the callback resolves
  before anything crosses a worker boundary.
*/
export function defineCapabilityFactory (module, schema, options = {}) {
  if (typeof module !== 'string' || module.length === 0) {
    throw new CapabilityFactoryOptionsRequiredError()
  }

  const { version, flatten = [], exclude = [], mapOptions } = options
  const plan = buildFlatteningPlan(module, schema, flatten, exclude)

  function factory (optionsOrCallback) {
    if (typeof optionsOrCallback === 'function') {
      return async context => factory(await optionsOrCallback(context))
    }

    // module and version are loader metadata, not capability options: the loader strips them into
    // the application entry's envelope before AJV validation and transform run, so capability
    // schemas keep additionalProperties: false and a stamped factory result validates cleanly.
    const definition = { module }

    if (version) {
      definition.version = version
    }

    for (const [key, value] of Object.entries(optionsOrCallback ?? {})) {
      if (value === undefined) {
        continue
      }

      const block = plan.get(key)

      if (block) {
        definition[block] = { ...definition[block], [key]: value }
      } else {
        // An option the capability's schema does not have lands here and is rejected by that
        // schema with a precise error, which scales automatically as capabilities add options.
        definition[key] = value
      }
    }

    return mapOptions ? mapOptions(definition, optionsOrCallback ?? {}) : definition
  }

  return factory
}
