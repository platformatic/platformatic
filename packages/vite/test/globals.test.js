import { deepStrictEqual, equal } from 'node:assert'
import { test } from 'node:test'
import { platformaticGlobalsPlugin } from '../lib/globals.js'

test('keeps @platformatic/globals external for Nitro based builders', () => {
  const plugin = platformaticGlobalsPlugin()
  const builder = { options: {} }

  equal(plugin.name, 'platformatic-globals')
  plugin.nitro(builder)

  deepStrictEqual(builder.options.traceDeps, ['@platformatic/globals'])
  deepStrictEqual(builder.options.externals.external, ['@platformatic/globals'])
  deepStrictEqual(builder.options.rollupConfig.external, ['@platformatic/globals'])
})

test('preserves the Rollup configuration a Vite build already declares', () => {
  const plugin = platformaticGlobalsPlugin()
  const builder = { options: { rollupConfig: { external: ['vite-external'] } } }

  plugin.nitro(builder)

  deepStrictEqual(builder.options.rollupConfig.external, ['vite-external', '@platformatic/globals'])
})
