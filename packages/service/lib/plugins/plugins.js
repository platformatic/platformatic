'use strict'

const { join, resolve } = require('path')
const { readFile } = require('fs/promises')
const fp = require('fastify-plugin')

const { getJSPluginPath, isFileAccessible } = require('../utils')

const wrapperPath = join(__dirname, 'sandbox-wrapper.js')

async function loadPlugins (app) {
  const configManager = app.platformatic.configManager
  const config = configManager.current

  if (config.plugins.typescript) {
    const workingDir = configManager.dirname
    const tsConfigPath = join(workingDir, 'tsconfig.json')

    const isTsConfigAccessible = await isFileAccessible(tsConfigPath)
    if (!isTsConfigAccessible) {
      throw new Error('Cannot load typescript plugin, tsconfig.json not found')
    }

    const tsConfig = JSON.parse(await readFile(tsConfigPath, 'utf8'))
    const outDir = resolve(workingDir, tsConfig.compilerOptions.outDir)

    config.plugins.paths = config.plugins.paths.map((plugin) => {
      /* c8 ignore next 3 */
      return typeof plugin === 'string'
        ? getJSPluginPath(workingDir, plugin, outDir)
        : { ...plugin, path: getJSPluginPath(workingDir, plugin.path, outDir) }
    })
  }

  await app.register(require(wrapperPath), { paths: config.plugins.paths })
}

module.exports = fp(loadPlugins)
