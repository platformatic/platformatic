import { strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadConfiguration } from '../index.js'

const configFile = join(import.meta.dirname, '..', 'fixtures', 'config-context', 'watt.config.mjs')

// Hermetic: an ambient NODE_ENV would otherwise decide what these assert.
const hermetic = { ignoreProcessEnv: true, env: {} }

test('the command decides production when the caller does not', async t => {
  /*
    build produces production artifacts, so it evaluates as a production boot. A build that
    evaluated as a development one read the development env files and handed every callback
    `production: false` while writing what `start` would later run.
  */
  const built = await loadConfiguration(configFile, null, { ...hermetic, command: 'build' })
  strictEqual(built.restartOnError, 4242)
  strictEqual(built.logger.level, 'fatal')

  /*
    And the consequence: NODE_ENV is the lowest rung of the ladder and defaults to production when
    the boot is one. v3's build left it unset, so bundlers and Babel configurations that branch on
    it produced development artifacts from a production build.
  */
  strictEqual(built.startTimeout, 11111)

  const developed = await loadConfiguration(configFile, null, { ...hermetic })
  strictEqual(developed.restartOnError, 500)
  strictEqual(developed.logger.level, 'trace')
  strictEqual(developed.startTimeout, 22222)
})

test('an explicit production flag still wins over the command default', async t => {
  const config = await loadConfiguration(configFile, null, { ...hermetic, command: 'build', production: false })
  strictEqual(config.logger.level, 'trace')
  strictEqual(config.restartOnError, 4242)
})
