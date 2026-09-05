import { deepStrictEqual, equal } from 'node:assert'
import { test } from 'node:test'
import { platformaticNitroPlugin } from '../lib/nitro.js'

test('provides the externalization as a Nitro Vite module', () => {
  const plugin = platformaticNitroPlugin()
  const nitro = { options: {} }

  equal(plugin.name, 'platformatic-globals')
  plugin.nitro(nitro)

  deepStrictEqual(nitro.options.traceDeps, ['@platformatic/globals'])
  deepStrictEqual(nitro.options.externals.external, ['@platformatic/globals'])
  deepStrictEqual(nitro.options.rollupConfig.external, ['@platformatic/globals'])
})
