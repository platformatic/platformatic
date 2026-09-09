import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert'
import { test } from 'node:test'
import { buildFlatteningPlan, defineCapabilityFactory } from '../index.js'

const nextLike = {
  type: 'object',
  properties: {
    module: { type: 'string' },
    logger: { type: 'object' },
    server: { type: 'object' },
    watch: { type: 'object' },
    application: { type: 'object', properties: { outputDirectory: { type: 'string' } } },
    cache: { type: 'object', properties: { adapter: { type: 'string' } } },
    next: { type: 'object', properties: { trailingSlash: { type: 'boolean' }, basePath: { type: 'string' } } }
  },
  additionalProperties: false
}

test('the capability block is flattened and the shared blocks keep their v3 positions', () => {
  const next = defineCapabilityFactory('@platformatic/next', nextLike, { version: '4.0.0', flatten: ['next'] })

  deepStrictEqual(
    next({
      trailingSlash: true,
      cache: { adapter: 'redis' },
      server: { port: 8080 },
      application: { outputDirectory: 'out' }
    }),
    {
      module: '@platformatic/next',
      version: '4.0.0',
      next: { trailingSlash: true },
      cache: { adapter: 'redis' },
      server: { port: 8080 },
      application: { outputDirectory: 'out' }
    }
  )
})

test('the application block deliberately stays nested', () => {
  // Several capabilities define their own outputDirectory alongside application.outputDirectory,
  // and hoisting both would collide.
  const next = defineCapabilityFactory('@platformatic/next', nextLike, { flatten: ['next'] })
  const definition = next({ application: { outputDirectory: 'out' } })

  strictEqual(definition.outputDirectory, undefined)
  deepStrictEqual(definition.application, { outputDirectory: 'out' })
})

test('flattening is defined over a list of blocks, not a single one', () => {
  // Every vite-derived capability flattens vite plus its own block; tanstack, which has no block of
  // its own, flattens vite alone.
  const schema = {
    properties: {
      module: { type: 'string' },
      vite: { type: 'object', properties: { configFile: { type: 'string' }, ssr: {} } },
      remix: { type: 'object', properties: { outputDirectory: { type: 'string' } } }
    }
  }

  const remix = defineCapabilityFactory('@platformatic/remix', schema, { flatten: ['vite', 'remix'] })

  deepStrictEqual(remix({ configFile: './vite.config.ts', outputDirectory: 'build' }), {
    module: '@platformatic/remix',
    vite: { configFile: './vite.config.ts' },
    remix: { outputDirectory: 'build' }
  })
})

test('a flattened key colliding with a retained top-level key fails when the factory is defined', () => {
  // db's block carries a cache property and top-level cache exists in next's schema: two
  // capabilities meaning structurally different things at one flattened key is the hazard.
  const schema = {
    properties: {
      cache: { type: 'boolean' },
      db: { type: 'object', properties: { cache: { type: 'boolean' } } }
    }
  }

  throws(() => defineCapabilityFactory('@platformatic/db', schema, { flatten: ['db'] }), error => {
    strictEqual(error.code, 'PLT_BASIC_CAPABILITY_FACTORY_KEY_COLLISION')
    ok(error.message.includes('cache'))
    ok(error.message.includes('retained top-level key'))
    return true
  })
})

test('a flattened key claimed by two blocks fails the same way', () => {
  const schema = {
    properties: {
      vite: { type: 'object', properties: { outputDirectory: { type: 'string' } } },
      nitro: { type: 'object', properties: { outputDirectory: { type: 'string' } } }
    }
  }

  throws(() => defineCapabilityFactory('@platformatic/nitro', schema, { flatten: ['vite', 'nitro'] }), {
    code: 'PLT_BASIC_CAPABILITY_FACTORY_KEY_COLLISION'
  })
})

test('the plan is the whole of the assertion, and it is reusable', () => {
  const plan = buildFlatteningPlan('@platformatic/next', nextLike, ['next'])

  strictEqual(plan.get('trailingSlash'), 'next')
  strictEqual(plan.get('cache'), undefined)
})

test('the result is discriminated by module, with no symbols and no classes', () => {
  const node = defineCapabilityFactory('@platformatic/node', { properties: {} }, { version: '4.0.0' })
  const definition = node()

  deepStrictEqual(definition, { module: '@platformatic/node', version: '4.0.0' })
  deepStrictEqual(Object.getOwnPropertySymbols(definition), [])
  strictEqual(Object.getPrototypeOf(definition), Object.prototype)
  deepStrictEqual(JSON.parse(JSON.stringify(definition)), definition)
})

test('a hand-written definition carries no stamp, and the factory only adds one when it has one', () => {
  const php = defineCapabilityFactory('@platformatic/php', { properties: {} })

  deepStrictEqual(php({}), { module: '@platformatic/php' })
})

test('an undefined option is omitted rather than carried', () => {
  const next = defineCapabilityFactory('@platformatic/next', nextLike, { flatten: ['next'] })

  // Matching the loader: cache: { url: process.env.REDIS_URL } with the variable unset yields the
  // schema's defaults speaking, not an undefined crossing the boundary.
  deepStrictEqual(next({ trailingSlash: undefined, cache: undefined }), { module: '@platformatic/next' })
})

test('the callback overload returns a function the loader awaits, not a definition', async () => {
  const next = defineCapabilityFactory('@platformatic/next', nextLike, { flatten: ['next'] })
  const deferred = next(({ mode }) => ({ trailingSlash: mode === 'production' }))

  strictEqual(typeof deferred, 'function')
  strictEqual(deferred.module, undefined)

  deepStrictEqual(await deferred({ mode: 'production' }), {
    module: '@platformatic/next',
    next: { trailingSlash: true }
  })
})

test('the callback may be async, and its promise resolves before the factory sees the options', async () => {
  const next = defineCapabilityFactory('@platformatic/next', nextLike, { flatten: ['next'] })
  const deferred = next(async () => ({ trailingSlash: true }))

  deepStrictEqual(await deferred({}), { module: '@platformatic/next', next: { trailingSlash: true } })
})

test('mapOptions gets the last word, for the cases the plan cannot express', () => {
  const schema = { properties: { db: { type: 'object', properties: { connectionString: { type: 'string' } } } } }
  const db = defineCapabilityFactory('@platformatic/db', schema, {
    flatten: ['db'],
    mapOptions (definition) {
      return { ...definition, db: { ...definition.db, applyMigrations: true } }
    }
  })

  deepStrictEqual(db({ connectionString: 'sqlite://./db.sqlite' }), {
    module: '@platformatic/db',
    db: { connectionString: 'sqlite://./db.sqlite', applyMigrations: true }
  })
})

test('defining a factory without a module name is refused', () => {
  throws(() => defineCapabilityFactory(), { code: 'PLT_BASIC_CAPABILITY_FACTORY_OPTIONS_REQUIRED' })
  throws(() => defineCapabilityFactory('', {}), { code: 'PLT_BASIC_CAPABILITY_FACTORY_OPTIONS_REQUIRED' })
})
