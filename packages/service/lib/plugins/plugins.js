'use strict'

const { join, resolve } = require('path')
const { readFile } = require('fs/promises')
const fp = require('fastify-plugin')

const { getJSPluginPath, isFileAccessible } = require('../utils')

const wrapperPath = join(__dirname, 'sandbox-wrapper.js')

async function loadPlugins (app) {
  const configManager = app.platformatic.configManager
  const config = configManager.current

  let isOutDirAccessible = false
  let outDir = null

  const workingDir = configManager.dirname
  const tsConfigPath = configManager.current.plugins.typescript?.tsConfig || join(workingDir, 'tsconfig.json')

  // If the tsconfig.json file exists, then we need to adjust the plugin paths
  // to point to the compiled JS files.
  const isTsConfigAccessible = await isFileAccessible(tsConfigPath)
  if (isTsConfigAccessible) {
    const tsConfig = JSON.parse(await readFile(tsConfigPath, 'utf8'))
    outDir = resolve(workingDir, tsConfig.compilerOptions.outDir)
  }

  if (configManager.current.plugins.typescript?.outDir) {
    outDir = configManager.current.plugins.typescript.outDir
  }

  if (outDir) {
    isOutDirAccessible = await isFileAccessible(outDir)
  }

  if (isOutDirAccessible) {
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
